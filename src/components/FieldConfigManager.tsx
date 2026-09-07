import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowUp, List, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  upsertFieldConfig,
  deleteFieldConfig,
  reorderFieldConfigs,
  upsertFieldOption,
  setFieldOptionActive,
  reorderFieldOptions,
} from "@/lib/master.functions";
import { useMasters, notifyMastersChanged } from "@/hooks/use-masters";
import { FIELD_TYPES } from "@/lib/permissions";
import { hasOptions, type FieldConfig, type FieldOption } from "@/lib/field-config";

export function FieldConfigManager({ module = "workflow" }: { module?: string }) {
  const { fieldsFor, allOptionsFor, reload } = useMasters();
  const fields = fieldsFor(module);
  const isEnquiry = module === "enquiry";
  const formLabel = isEnquiry ? "Enquiry Form" : "Registration";
  const tableLabel = isEnquiry ? "Enquiry Table" : "Workflow";
  const upsertFn = useServerFn(upsertFieldConfig);
  const deleteFn = useServerFn(deleteFieldConfig);
  const reorderFn = useServerFn(reorderFieldConfigs);

  const [editing, setEditing] = useState<FieldConfig | null>(null);
  const [open, setOpen] = useState(false);
  const [optionsFor, setOptionsFor] = useState<FieldConfig | null>(null);


  async function refresh() {
    await reload();
    notifyMastersChanged();
  }

  async function toggle(f: FieldConfig, key: keyof FieldConfig, value: boolean) {
    try {
      await upsertFn({
        data: {
          id: f.id,
          label: f.label,
          fieldType: f.field_type,
          options: f.options,
          isEnabled: key === "is_enabled" ? value : f.is_enabled,
          isRequired: key === "is_required" ? value : f.is_required,
          showInRegistration:
            key === "show_in_registration" ? value : f.show_in_registration,
          showInWorkflow: key === "show_in_workflow" ? value : f.show_in_workflow,
        },
      });
      await refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const next = [...fields];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    const a = next[index]!;
    next[index] = next[target]!;
    next[target] = a;
    try {
      await reorderFn({ data: { ids: next.map((f) => f.id) } });
      await refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function remove(f: FieldConfig) {
    if (f.is_system) return toast.error("System fields cannot be deleted — hide them instead.");
    if (!confirm(`Delete the field "${f.label}"?`)) return;
    try {
      await deleteFn({ data: { id: f.id } });
      await refresh();
      toast.success("Field deleted");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-elegant">
        <div>
          <h3 className="font-display text-lg font-semibold">
            Field &amp; Dropdown Configuration
          </h3>
          <p className="text-sm text-muted-foreground">
            The single place to control every field and every dropdown value used in Registration,
            Edit Registration and the Workflow Dashboard.
          </p>
        </div>
        <Button
          className="bg-gold-gradient text-gold-foreground shadow-gold"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Add Custom Field
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-elegant">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-3">Order</th>
                <th className="px-3 py-3">Display Label</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Enabled</th>
                <th className="px-3 py-3">Mandatory</th>
                <th className="px-3 py-3">Registration</th>
                <th className="px-3 py-3">Workflow</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((f, i) => (
                <tr key={f.id} className="border-t">
                  <td className="whitespace-nowrap px-3 py-2">
                    <Button size="sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => move(i, 1)}
                      disabled={i === fields.length - 1}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                  <td className="px-3 py-2 font-medium">
                    <div className="flex items-center gap-2">
                      {f.label}
                      {f.is_system && (
                        <Badge variant="outline" className="gap-1 text-[10px]">
                          <Lock className="h-3 w-3" /> System
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{f.field_key}</span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {FIELD_TYPES.find((t) => t.value === f.field_type)?.label ?? f.field_type}
                  </td>
                  <td className="px-3 py-2">
                    <Switch
                      checked={f.is_enabled}
                      onCheckedChange={(v) => toggle(f, "is_enabled", v)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Switch
                      checked={f.is_required}
                      onCheckedChange={(v) => toggle(f, "is_required", v)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Switch
                      checked={f.show_in_registration}
                      onCheckedChange={(v) => toggle(f, "show_in_registration", v)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Switch
                      checked={f.show_in_workflow}
                      onCheckedChange={(v) => toggle(f, "show_in_workflow", v)}
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {hasOptions(f) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mr-2"
                        onClick={() => setOptionsFor(f)}
                      >
                        <List className="mr-1.5 h-3 w-3" />
                        Manage Options
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          {allOptionsFor(f.id).filter((o) => o.is_active).length}
                        </span>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="mr-2"
                      onClick={() => {
                        setEditing(f);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={f.is_system}
                      onClick={() => remove(f)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Balance, Excess Amount, Payment Status and Collection % are system-generated from Fees and
        Amount Received — they are always read-only and cannot be configured here.
      </p>

      {open && (
        <FieldDialog
          field={editing}
          onClose={() => setOpen(false)}
          onSave={async (v) => {
            try {
              await upsertFn({
                data: {
                  id: editing?.id ?? null,
                  label: v.label,
                  fieldType: v.fieldType,
                  options: [],
                  defaultValue: v.defaultValue,
                  isRequired: v.isRequired,
                  showInRegistration: v.showInRegistration,
                  showInWorkflow: v.showInWorkflow,
                  isEnabled: editing ? editing.is_enabled : true,
                },
              });
              setOpen(false);
              await refresh();
              toast.success("Field saved");
            } catch (e: any) {
              toast.error(e.message);
            }
          }}
        />
      )}

      {optionsFor && (
        <ManageOptionsDialog
          field={optionsFor}
          options={allOptionsFor(optionsFor.id)}
          onClose={() => setOptionsFor(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

function FieldDialog({
  field,
  onClose,
  onSave,
}: {
  field: FieldConfig | null;
  onClose: () => void;
  onSave: (v: {
    label: string;
    fieldType: string;
    defaultValue: string;
    isRequired: boolean;
    showInRegistration: boolean;
    showInWorkflow: boolean;
  }) => Promise<void>;
}) {
  const [label, setLabel] = useState(field?.label ?? "");
  const [fieldType, setFieldType] = useState(field?.field_type ?? "text");
  const [defaultValue, setDefaultValue] = useState(field?.default_value ?? "");
  const [isRequired, setIsRequired] = useState(field?.is_required ?? false);
  const [visibility, setVisibility] = useState<"registration" | "workflow" | "both">(
    field
      ? field.show_in_registration && field.show_in_workflow
        ? "both"
        : field.show_in_workflow
          ? "workflow"
          : "registration"
      : "both",
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{field ? `Edit field — ${field.label}` : "Add custom field"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Display label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Field type</Label>
            <Select
              value={fieldType}
              onValueChange={setFieldType}
              disabled={Boolean(field?.is_system)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {field?.is_system && (
              <p className="text-xs text-muted-foreground">
                System fields keep their type — you can still rename, reorder, hide, make them
                mandatory and manage their dropdown options.
              </p>
            )}
          </div>
          {hasOptions({ field_type: fieldType }) && (
            <p className="rounded-md bg-secondary/50 p-3 text-xs text-muted-foreground">
              Save the field, then use the <strong>Manage Options</strong> button on the list to add
              its dropdown values.
            </p>
          )}
          <div className="space-y-2">
            <Label>Default value (optional)</Label>
            <Input
              value={defaultValue}
              onChange={(e) => setDefaultValue(e.target.value)}
              placeholder="Pre-filled when a new registration is created"
            />
          </div>
          <div className="space-y-2">
            <Label>Where should this field appear?</Label>
            <Select value={visibility} onValueChange={(v) => setVisibility(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="registration">Registration form only</SelectItem>
                <SelectItem value="workflow">Workflow dashboard only</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={isRequired} onCheckedChange={setIsRequired} />
            <Label>Mandatory</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!label.trim()}
            className="bg-gold-gradient text-gold-foreground shadow-gold"
            onClick={() =>
              onSave({
                label: label.trim(),
                fieldType,
                defaultValue: defaultValue.trim(),
                isRequired,
                showInRegistration: visibility !== "workflow",
                showInWorkflow: visibility !== "registration",
              })
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManageOptionsDialog({
  field,
  options,
  onClose,
  onChanged,
}: {
  field: FieldConfig;
  options: FieldOption[];
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const upsertOption = useServerFn(upsertFieldOption);
  const setActive = useServerFn(setFieldOptionActive);
  const reorder = useServerFn(reorderFieldOptions);
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>, okMessage?: string) {
    setBusy(true);
    try {
      await fn();
      await onChanged();
      if (okMessage) toast.success(okMessage);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage options — {field.label}</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            placeholder="New option value"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newLabel.trim()) {
                run(
                  () => upsertOption({ data: { fieldConfigId: field.id, label: newLabel.trim() } }),
                  "Option added",
                ).then(() => setNewLabel(""));
              }
            }}
          />
          <Button
            disabled={!newLabel.trim() || busy}
            className="bg-gold-gradient text-gold-foreground shadow-gold"
            onClick={async () => {
              await run(
                () => upsertOption({ data: { fieldConfigId: field.id, label: newLabel.trim() } }),
                "Option added",
              );
              setNewLabel("");
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add
          </Button>
        </div>

        <div className="divide-y rounded-xl border">
          {options.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No options yet.</p>
          )}
          {options.map((o, i) => (
            <div key={o.id} className="flex items-center gap-2 p-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={i === 0 || busy}
                onClick={() => {
                  const ids = options.map((x) => x.id);
                  [ids[i - 1], ids[i]] = [ids[i]!, ids[i - 1]!];
                  run(() => reorder({ data: { ids: ids as string[] } }));
                }}
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={i === options.length - 1 || busy}
                onClick={() => {
                  const ids = options.map((x) => x.id);
                  [ids[i + 1], ids[i]] = [ids[i]!, ids[i + 1]!];
                  run(() => reorder({ data: { ids: ids as string[] } }));
                }}
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>

              {editingId === o.id ? (
                <Input
                  autoFocus
                  className="h-8 flex-1"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  onBlur={async () => {
                    const value = editLabel.trim();
                    setEditingId(null);
                    if (value && value !== o.label) {
                      await run(
                        () => upsertOption({ data: { id: o.id, fieldConfigId: field.id, label: value } }),
                        "Option updated",
                      );
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
              ) : (
                <button
                  type="button"
                  className={`flex-1 rounded px-2 py-1 text-left text-sm hover:bg-muted ${o.is_active ? "" : "text-muted-foreground line-through"}`}
                  onClick={() => {
                    setEditingId(o.id);
                    setEditLabel(o.label);
                  }}
                >
                  {o.label}
                </button>
              )}

              <span className="text-xs text-muted-foreground">
                {o.is_active ? "Active" : "Inactive"}
              </span>
              <Switch
                checked={o.is_active}
                disabled={busy}
                onCheckedChange={(v) =>
                  run(
                    () => setActive({ data: { id: o.id, isActive: v } }),
                    v ? "Option activated" : "Option deactivated",
                  )
                }
              />
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Options are never deleted. Deactivating one hides it from future dropdowns while existing
          records keep their saved value.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
