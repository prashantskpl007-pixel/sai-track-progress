import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowUp, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
} from "@/lib/master.functions";
import { useMasters, notifyMastersChanged } from "@/hooks/use-masters";
import { FIELD_TYPES, type FieldConfig } from "@/lib/permissions";

export function FieldConfigManager() {
  const { fields, reload } = useMasters();
  const upsertFn = useServerFn(upsertFieldConfig);
  const deleteFn = useServerFn(deleteFieldConfig);
  const reorderFn = useServerFn(reorderFieldConfigs);

  const [editing, setEditing] = useState<FieldConfig | null>(null);
  const [open, setOpen] = useState(false);

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
            Registration &amp; Workflow Field Configuration
          </h3>
          <p className="text-sm text-muted-foreground">
            Decide which fields appear on the registration form and the workflow dashboard, in
            what order, and whether they are compulsory.
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
                  options: v.options,
                  isRequired: v.isRequired,
                  showInRegistration: v.showInRegistration,
                  showInWorkflow: v.showInWorkflow,
                  isEnabled: true,
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
    options: string[];
    isRequired: boolean;
    showInRegistration: boolean;
    showInWorkflow: boolean;
  }) => Promise<void>;
}) {
  const [label, setLabel] = useState(field?.label ?? "");
  const [fieldType, setFieldType] = useState(field?.field_type ?? "text");
  const [optionsText, setOptionsText] = useState((field?.options ?? []).join("\n"));
  const [isRequired, setIsRequired] = useState(field?.is_required ?? false);
  const [showReg, setShowReg] = useState(field?.show_in_registration ?? true);
  const [showWf, setShowWf] = useState(field?.show_in_workflow ?? true);

  const needsOptions = ["dropdown", "multiselect", "radio"].includes(fieldType);

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
                System fields keep their type — you can still rename, reorder, hide and make them
                mandatory.
              </p>
            )}
          </div>
          {needsOptions && (
            <div className="space-y-2">
              <Label>Dropdown values (one per line)</Label>
              <Textarea
                rows={5}
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                placeholder={"Option A\nOption B\nOther"}
              />
            </div>
          )}
          <div className="flex items-center gap-3">
            <Switch checked={isRequired} onCheckedChange={setIsRequired} />
            <Label>Mandatory</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={showReg} onCheckedChange={setShowReg} />
            <Label>Show on Registration form</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={showWf} onCheckedChange={setShowWf} />
            <Label>Show on Workflow dashboard</Label>
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
                options: optionsText
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
                isRequired,
                showInRegistration: showReg,
                showInWorkflow: showWf,
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
