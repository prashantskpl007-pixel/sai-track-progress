import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { supabase } from "@/integrations/supabase/client";
import { useMasters } from "@/hooks/use-masters";
import { usePermissions } from "@/hooks/use-permissions";
import { createEnquiry, updateEnquiry, softDeleteEnquiry } from "@/lib/enquiry.functions";
import {
  hasOptions,
  INR,
  isEmptyValue,
  readEnquiryValue,
  type FieldConfig,
} from "@/lib/field-config";

type Enquiry = Record<string, any>;

const PAGE_SIZE = 20;

function formatValue(field: FieldConfig, value: any) {
  if (isEmptyValue(value)) return "—";
  if (field.field_type === "currency") return INR(Number(value));
  if (field.field_type === "checkbox") return value === true || value === "true" ? "Yes" : "No";
  if (field.field_type === "date") {
    const d = new Date(String(value));
    return isNaN(d.getTime())
      ? String(value)
      : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }
  if (field.field_type === "datetime") {
    const d = new Date(String(value));
    return isNaN(d.getTime()) ? String(value) : d.toLocaleString("en-IN");
  }
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

/** Renders one configured field as the right input control. */
function FieldInput({
  field,
  value,
  options,
  onChange,
}: {
  field: FieldConfig;
  value: any;
  options: string[];
  onChange: (v: any) => void;
}) {
  const str = value == null ? "" : String(value);
  switch (field.field_type) {
    case "textarea":
      return <Textarea rows={2} value={str} onChange={(e) => onChange(e.target.value)} />;
    case "number":
    case "currency":
      return (
        <Input
          type="number"
          inputMode="decimal"
          value={str}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "date":
      return <Input type="date" value={str} onChange={(e) => onChange(e.target.value)} />;
    case "datetime":
      return (
        <Input type="datetime-local" value={str} onChange={(e) => onChange(e.target.value)} />
      );
    case "time":
      return <Input type="time" value={str} onChange={(e) => onChange(e.target.value)} />;
    case "email":
      return <Input type="email" value={str} onChange={(e) => onChange(e.target.value)} />;
    case "mobile":
      return (
        <Input inputMode="numeric" value={str} onChange={(e) => onChange(e.target.value)} />
      );
    case "file":
      return (
        <Input
          value={str}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Document link / reference"
        />
      );
    case "checkbox":
      return (
        <div className="flex h-10 items-center gap-2">
          <Checkbox
            checked={value === true || value === "true"}
            onCheckedChange={(v) => onChange(Boolean(v))}
          />
          <span className="text-sm text-muted-foreground">Yes</span>
        </div>
      );
    case "radio":
      return (
        <div className="flex flex-wrap gap-3 py-2">
          {options.map((o) => (
            <label key={o} className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                checked={str === o}
                onChange={() => onChange(o)}
                name={field.field_key}
              />
              {o}
            </label>
          ))}
        </div>
      );
    case "multiselect": {
      const selected: string[] = Array.isArray(value) ? value : str ? str.split(", ") : [];
      return (
        <div className="flex flex-wrap gap-3 rounded-md border p-2">
          {options.length === 0 && (
            <span className="text-xs text-muted-foreground">No options configured.</span>
          )}
          {options.map((o) => (
            <label key={o} className="flex items-center gap-1.5 text-sm">
              <Checkbox
                checked={selected.includes(o)}
                onCheckedChange={(v) =>
                  onChange(v ? [...selected, o] : selected.filter((x) => x !== o))
                }
              />
              {o}
            </label>
          ))}
        </div>
      );
    }
    case "dropdown":
      return options.length ? (
        <Select value={str || undefined} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input value={str} onChange={(e) => onChange(e.target.value)} />
      );
    default:
      return <Input value={str} onChange={(e) => onChange(e.target.value)} />;
  }
}

export function EnquiryModule() {
  const { enquiryFields, optionsFor } = useMasters();
  const perm = usePermissions();
  const createFn = useServerFn(createEnquiry);
  const updateFn = useServerFn(updateEnquiry);
  const deleteFn = useServerFn(softDeleteEnquiry);

  const [rows, setRows] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<string>("enquiry_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Enquiry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Enquiry | null>(null);

  const canAdd = perm.can("enquiry", "can_add");
  const canEdit = perm.can("enquiry", "can_edit");
  const canDelete = perm.can("enquiry", "can_delete");

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase.from("enquiries" as any) as any)
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data as Enquiry[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const tableFields = useMemo(
    () =>
      enquiryFields
        .filter((f) => f.is_enabled && f.show_in_workflow)
        .sort((a, b) => a.sort_order - b.sort_order),
    [enquiryFields],
  );
  const formFields = useMemo(
    () =>
      enquiryFields
        .filter((f) => f.is_enabled && f.show_in_registration)
        .sort((a, b) => a.sort_order - b.sort_order),
    [enquiryFields],
  );
  const filterFields = tableFields.filter((f) => f.field_type === "dropdown");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const list = rows.filter((r) => {
      for (const [key, val] of Object.entries(filters)) {
        if (!val || val === "all") continue;
        if (String(readEnquiryValue(r, key) ?? "") !== val) return false;
      }
      if (!query) return true;
      return tableFields.some((f) =>
        String(readEnquiryValue(r, f.field_key) ?? "")
          .toLowerCase()
          .includes(query),
      );
    });
    const sorted = [...list].sort((a, b) => {
      const av = readEnquiryValue(a, sortKey);
      const bv = readEnquiryValue(b, sortKey);
      const an = Number(av);
      const bn = Number(bv);
      let cmp: number;
      if (!isNaN(an) && !isNaN(bn) && av !== null && bv !== null && av !== "" && bv !== "") {
        cmp = an - bn;
      } else {
        cmp = String(av ?? "").localeCompare(String(bv ?? ""));
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [rows, q, filters, sortKey, sortDir, tableFields]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-elegant">
        <div>
          <h2 className="font-display text-lg font-semibold">Enquiries</h2>
          <p className="text-sm text-muted-foreground">
            Record every initial client enquiry. Fields are controlled in Master → Enquiry Fields.
          </p>
        </div>
        {canAdd && (
          <Button
            size="lg"
            className="bg-gold-gradient text-gold-foreground shadow-gold"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Add Enquiry
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-3 shadow-elegant">
        <div className="relative min-w-52 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="h-9 pl-8"
            placeholder="Search enquiries..."
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
        {filterFields.map((f) => (
          <Select
            key={f.id}
            value={filters[f.field_key] ?? "all"}
            onValueChange={(v) => {
              setFilters({ ...filters, [f.field_key]: v });
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-44">
              <SelectValue placeholder={f.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All {f.label}</SelectItem>
              {optionsFor(f.field_key, [], "enquiry").map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
        <Badge variant="outline">{filtered.length} records</Badge>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-elegant">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                {tableFields.map((f) => (
                  <th key={f.id} className="whitespace-nowrap px-3 py-2">
                    <button
                      type="button"
                      className="flex items-center gap-1 hover:text-foreground"
                      onClick={() => toggleSort(f.field_key)}
                    >
                      {f.label}
                      {sortKey === f.field_key &&
                        (sortDir === "asc" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        ))}
                    </button>
                  </th>
                ))}
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={tableFields.length + 1} className="py-10 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={tableFields.length + 1}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No enquiries yet.
                  </td>
                </tr>
              ) : (
                pageRows.map((r) => (
                  <tr key={r["id"]} className="border-t align-top">
                    {tableFields.map((f) => (
                      <td key={f.id} className="whitespace-nowrap px-3 py-2">
                        {f.field_key === "enquiry_status" &&
                        !isEmptyValue(readEnquiryValue(r, f.field_key)) ? (
                          <Badge variant="outline">
                            {String(readEnquiryValue(r, f.field_key))}
                          </Badge>
                        ) : (
                          formatValue(f, readEnquiryValue(r, f.field_key))
                        )}
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mr-2"
                          onClick={() => {
                            setEditing(r);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button size="sm" variant="outline" onClick={() => setDeleteTarget(r)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Page {currentPage} of {pageCount}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={currentPage <= 1}
            onClick={() => setPage(currentPage - 1)}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={currentPage >= pageCount}
            onClick={() => setPage(currentPage + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      {formOpen && (
        <EnquiryFormDialog
          fields={formFields}
          enquiry={editing}
          optionsFor={(key, include) => optionsFor(key, include, "enquiry")}
          onClose={() => setFormOpen(false)}
          onSave={async (values) => {
            try {
              if (editing) await updateFn({ data: { id: editing["id"], values } });
              else await createFn({ data: { values } });
              setFormOpen(false);
              await load();
              toast.success(editing ? "Enquiry updated" : "Enquiry added");
            } catch (e: any) {
              toast.error(e.message);
            }
          }}
        />
      )}

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this enquiry?</AlertDialogTitle>
            <AlertDialogDescription>
              The enquiry is removed from the list but kept in the records for audit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const target = deleteTarget;
                setDeleteTarget(null);
                if (!target) return;
                try {
                  await deleteFn({ data: { id: target["id"] } });
                  await load();
                  toast.success("Enquiry deleted");
                } catch (e: any) {
                  toast.error(e.message);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EnquiryFormDialog({
  fields,
  enquiry,
  optionsFor,
  onClose,
  onSave,
}: {
  fields: FieldConfig[];
  enquiry: Enquiry | null;
  optionsFor: (key: string, include?: (string | null | undefined)[]) => string[];
  onClose: () => void;
  onSave: (values: Record<string, any>) => Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    for (const f of fields) {
      const existing = enquiry ? readEnquiryValue(enquiry, f.field_key) : undefined;
      initial[f.field_key] =
        existing !== undefined && existing !== null
          ? existing
          : enquiry
            ? ""
            : f.field_key === "enquiry_date"
              ? new Date().toISOString().slice(0, 10)
              : (f.default_value ?? "");
    }
    return initial;
  });
  const [busy, setBusy] = useState(false);

  const missing = fields
    .filter((f) => f.is_required && isEmptyValue(values[f.field_key]))
    .map((f) => f.label);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{enquiry ? "Edit Enquiry" : "New Enquiry"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((f) => (
            <div
              key={f.id}
              className={`space-y-1.5 ${f.field_type === "textarea" || f.field_type === "multiselect" ? "sm:col-span-2" : ""}`}
            >
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                {f.label}
                {f.is_required ? " *" : ""}
              </Label>
              <FieldInput
                field={f}
                value={values[f.field_key]}
                options={
                  hasOptions(f) ? optionsFor(f.field_key, [values[f.field_key]]) : []
                }
                onChange={(v) => setValues((prev) => ({ ...prev, [f.field_key]: v }))}
              />
            </div>
          ))}
        </div>
        {missing.length > 0 && (
          <p className="text-xs text-destructive">Required: {missing.join(", ")}</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy || missing.length > 0}
            className="bg-gold-gradient text-gold-foreground shadow-gold"
            onClick={async () => {
              setBusy(true);
              try {
                await onSave(values);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
