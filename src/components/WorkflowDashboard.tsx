import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageSquare, Loader2, Search, SlidersHorizontal, Trash2 } from "lucide-react";
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

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { supabase } from "@/integrations/supabase/client";
import { updateCustomer, addCustomerRemark, softDeleteCustomer } from "@/lib/customer-admin.functions";
import { STATUS_STEPS, statusLabel, WORK_TYPES, NOC_OPTIONS } from "@/lib/status";
import { useMasters } from "@/hooks/use-masters";
import { useSession } from "@/hooks/use-session";
import { History } from "lucide-react";

export type WorkflowRow = Record<string, any>;

const INR = (n: number | null | undefined) =>
  `₹${(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

/** Color-coded badge for workflow states */
export function WorkflowBadge({ value, kind }: { value: string | null; kind: "status" | "pending" | "noc" }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const v = value.toLowerCase();
  let cls = "bg-muted text-muted-foreground border-transparent";
  if (kind === "status") {
    if (v === "agreement_ready" || v === "registration_completed" || v.includes("complet"))
      cls = "bg-success/15 text-success border-success/30";
    else if (v === "application_created" || v.includes("pending"))
      cls = "bg-gold/20 text-gold-foreground border-gold/40";
    else cls = "bg-primary/10 text-primary border-primary/30";
  } else if (kind === "pending") {
    if (v === "none" || v === "no pending") cls = "bg-success/15 text-success border-success/30";
    else if (v.includes("overdue")) cls = "bg-destructive text-destructive-foreground border-transparent";
    else if (v.includes("fees")) cls = "bg-destructive/15 text-destructive border-destructive/30";
    else if (v.includes("noc")) cls = "bg-gold/20 text-gold-foreground border-gold/40";
    else cls = "bg-primary/10 text-primary border-primary/30";
  } else {
    if (v.includes("complet") || v.includes("approved")) cls = "bg-success/15 text-success border-success/30";
    else if (v.includes("reject")) cls = "bg-destructive/15 text-destructive border-destructive/30";
    else if (v.includes("pending")) cls = "bg-gold/20 text-gold-foreground border-gold/40";
    else cls = "bg-primary/10 text-primary border-primary/30";
  }
  const label = kind === "status" ? statusLabel(value as any) : value;
  return <Badge className={`whitespace-nowrap border ${cls}`}>{label}</Badge>;
}

/** Inline-editable text / number cell — saves on blur or Enter */
function EditableCell({
  value,
  type = "text",
  className = "",
  placeholder = "—",
  disabled = false,
  onSave,
}: {
  value: string | number | null;
  type?: "text" | "number" | "date";
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  onSave: (v: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(value == null ? "" : String(value));
  }, [value, editing]);

  async function commit() {
    setEditing(false);
    const original = value == null ? "" : String(value);
    if (draft === original) return;
    setBusy(true);
    try {
      await onSave(draft);
    } finally {
      setBusy(false);
    }
  }

  if (editing && !disabled) {
    return (
      <Input
        autoFocus
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setEditing(false);
        }}
        className={`h-8 min-w-24 text-sm ${className}`}
      />
    );
  }
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setEditing(true)}
      className={`min-h-8 w-full rounded px-1.5 py-1 text-left hover:bg-muted ${className}`}
      title="Click to edit"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (value == null || value === "" ? <span className="text-muted-foreground">{placeholder}</span> : String(value))}
    </button>
  );
}

function SelectCell({
  value,
  options,
  onSave,
  placeholder = "Select",
  disabled = false,
}: {
  value: string | null;
  options: { value: string; label: string }[];
  onSave: (v: string) => Promise<void>;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <Select value={value ?? undefined} disabled={disabled} onValueChange={(v) => onSave(v)}>
      <SelectTrigger className="h-8 min-w-36 border-transparent bg-transparent px-1.5 text-sm hover:bg-muted">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function WorkflowDashboard({
  customers,
  staff,
  onChanged,
}: {
  customers: WorkflowRow[];
  staff: { id: string; full_name: string }[];
  onChanged: () => Promise<void> | void;
}) {
  const updateFn = useServerFn(updateCustomer);
  const addRemarkFn = useServerFn(addCustomerRemark);
  const { pendingReasons, statuses } = useMasters();
  const { isAdmin, isManager, isStaff, isViewer } = useSession();
  const [myStaffId, setMyStaffId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: row } = await supabase
        .from("staff")
        .select("id")
        .eq("user_id", data.user.id)
        .maybeSingle();
      setMyStaffId(row?.id ?? null);
    });
  }, []);

  const canEditAll = isAdmin || isManager;
  function canEdit(row: WorkflowRow) {
    if (isViewer && !canEditAll && !isStaff) return false;
    if (canEditAll) return true;
    if (isStaff) return Boolean(myStaffId) && row.assigned_staff_id === myStaffId;
    return false;
  }

  const pendingOptionList = [
    ...pendingReasons.filter((p) => p.is_active).map((p) => p.label),
    "Other",
  ];
  const statusOptionList = [
    ...statuses.filter((s) => s.is_active).map((s) => s.label),
    "Other",
  ];

  const [remarksFor, setRemarksFor] = useState<WorkflowRow | null>(null);
  const [historyFor, setHistoryFor] = useState<WorkflowRow | null>(null);
  const [otherFor, setOtherFor] = useState<{ row: WorkflowRow; field: "pending" | "status" } | null>(null);
  const [remarkCounts, setRemarkCounts] = useState<Record<string, number>>({});
  const [deleteFor, setDeleteFor] = useState<WorkflowRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const softDeleteFn = useServerFn(softDeleteCustomer);
  const canDelete = canEditAll;

  const [q, setQ] = useState("");

  const [fDate, setFDate] = useState("");
  const [fToken, setFToken] = useState("");
  const [fSource, setFSource] = useState("all");
  const [fStaff, setFStaff] = useState("all");
  const [fWorkType, setFWorkType] = useState("all");
  const [fPending, setFPending] = useState("all");
  const [fStatus, setFStatus] = useState("all");

  useEffect(() => {
    loadCounts();
  }, [customers.length]);

  async function loadCounts() {
    const { data } = await supabase.from("customer_remarks").select("customer_id");
    const map: Record<string, number> = {};
    (data ?? []).forEach((r: any) => {
      map[r.customer_id] = (map[r.customer_id] ?? 0) + 1;
    });
    setRemarkCounts(map);
  }

  async function patch(row: WorkflowRow, p: Record<string, any>) {
    try {
      await updateFn({ data: { id: row.id, patch: p } });
      await onChanged();
      toast.success("Saved");
    } catch (e: any) {
      toast.error(e.message ?? "Could not save");
    }
  }

  async function saveFees(row: WorkflowRow, fees: number) {
    const received = Number(row.payment_received) || 0;
    await patch(row, {
      total_amount: fees,
      payment_amount: fees,
      balance_amount: Math.max(0, fees - received),
    });
  }

  async function saveReceived(row: WorkflowRow, received: number) {
    const fees = Number(row.total_amount) || 0;
    await patch(row, {
      payment_received: received,
      balance_amount: Math.max(0, fees - received),
      payment_status: received <= 0 ? "pending" : received >= fees ? "paid" : "partial",
    });
  }

  const sources = Array.from(new Set(customers.map((c) => c.source_agent).filter(Boolean))) as string[];
  const workTypes = Array.from(
    new Set([...WORK_TYPES, ...customers.map((c) => c.work_type).filter(Boolean)]),
  ) as string[];

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return customers.filter((c) => {
      if (c.deleted_at) return false;
      if (fDate && (c.registration_date ?? "").slice(0, 10) !== fDate) return false;
      if (fToken && !String(c.token_number ?? "").toLowerCase().includes(fToken.toLowerCase())) return false;
      if (fSource !== "all" && c.source_agent !== fSource) return false;
      if (fStaff !== "all" && c.assigned_staff_id !== fStaff) return false;
      if (fWorkType !== "all" && c.work_type !== fWorkType) return false;
      if (fPending !== "all" && (c.pending_item ?? "") !== fPending) return false;
      if (fStatus !== "all" && (c.workflow_status ?? statusLabel(c.current_status)) !== fStatus) return false;
      if (!query) return true;
      return (
        String(c.customer_name ?? "").toLowerCase().includes(query) ||
        String(c.mobile_number ?? "").includes(query) ||
        String(c.token_number ?? "").toLowerCase().includes(query) ||
        String(c.property_address ?? "").toLowerCase().includes(query)
      );
    });
  }, [customers, q, fDate, fToken, fSource, fStaff, fWorkType, fPending, fStatus]);

  const activeFilterCount =
    (fDate ? 1 : 0) + (fToken ? 1 : 0) +
    [fSource, fStaff, fWorkType, fPending, fStatus].filter((v) => v !== "all").length;

  return (
    <div className="space-y-4">
      {/* Compact search bar */}
      <div className="rounded-2xl border bg-card p-2.5 shadow-elegant">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="h-9 pl-9"
              placeholder="Search name, mobile, token or address..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            className="h-9"
            onClick={() => setShowFilters((s) => !s)}
          >
            <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1.5 rounded-full bg-gold px-1.5 text-[10px] font-bold text-gold-foreground">
                {activeFilterCount}
              </span>
            )}
          </Button>
          {(activeFilterCount > 0 || q) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9"
              onClick={() => {
                setQ(""); setFDate(""); setFToken(""); setFSource("all"); setFStaff("all");
                setFWorkType("all"); setFPending("all"); setFStatus("all");
              }}
            >
              Clear
            </Button>
          )}
          <span className="ml-auto text-xs text-muted-foreground">{rows.length} records</span>
        </div>

        {showFilters && (
          <div className="mt-3 grid gap-3 border-t pt-3 md:grid-cols-4">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Date</Label>
              <Input className="mt-1" type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Token Number</Label>
              <Input className="mt-1" placeholder="Token" value={fToken} onChange={(e) => setFToken(e.target.value)} />
            </div>
            <FilterSelect label="Source (Agent)" value={fSource} onChange={setFSource} options={sources.map((s) => ({ value: s, label: s }))} allLabel="All sources" />
            <FilterSelect label="Staff" value={fStaff} onChange={setFStaff} options={staff.map((s) => ({ value: s.id, label: s.full_name }))} allLabel="All staff" />
            <FilterSelect label="Work Type" value={fWorkType} onChange={setFWorkType} options={workTypes.map((t) => ({ value: t, label: t }))} allLabel="All work types" />
            <FilterSelect label="Pending" value={fPending} onChange={setFPending} options={pendingOptionList.map((p) => ({ value: p, label: p }))} allLabel="All pending" />
            <FilterSelect label="Status" value={fStatus} onChange={setFStatus} options={[...statusOptionList, ...STATUS_STEPS.map((s) => s.label)].map((s) => ({ value: s, label: s }))} allLabel="All statuses" />
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-elegant">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3">Token Number</th>
                <th className="px-3 py-3">Source (Agent)</th>
                <th className="px-3 py-3">Property Address</th>
                <th className="px-3 py-3">Verification/NOC</th>
                <th className="px-3 py-3">Fees</th>
                <th className="px-3 py-3">Received</th>
                <th className="px-3 py-3">Balance</th>
                <th className="px-3 py-3">Pending</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Remarks</th>
                {canDelete && <th className="px-3 py-3 text-right">Delete</th>}
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={canDelete ? 12 : 11} className="py-10 text-center text-muted-foreground">No records match the current filters.</td></tr>
              ) : (
                rows.map((c) => {
                  const fees = Number(c.total_amount) || 0;
                  const received = Number(c.payment_received) || 0;
                  const balance = Math.max(0, fees - received);
                  return (
                    <tr key={c.id} className="border-t align-top hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <EditableCell disabled={!canEdit(c)} type="date" value={(c.registration_date ?? "").slice(0, 10)} onSave={(v) => patch(c, { registration_date: v })} />
                      </td>
                      <td className="px-3 py-2 font-mono font-semibold">
                        <EditableCell disabled={!canEdit(c)} value={c.token_number} placeholder="Set token" onSave={(v) => patch(c, { token_number: v || null })} />
                      </td>
                      <td className="px-3 py-2">
                        <EditableCell disabled={!canEdit(c)} value={c.source_agent} onSave={(v) => patch(c, { source_agent: v || null })} />
                      </td>
                      <td className="max-w-64 px-3 py-2">
                        <EditableCell disabled={!canEdit(c)} value={c.property_address} className="whitespace-pre-wrap" onSave={(v) => patch(c, { property_address: v || null })} />
                      </td>
                      <td className="px-3 py-2">
                        <SelectCell
                          disabled={!canEdit(c)}
                          value={c.verification_noc_status}
                          options={NOC_OPTIONS.map((o) => ({ value: o, label: o }))}
                          onSave={(v) => patch(c, { verification_noc_status: v })}
                        />
                        <div className="px-1.5 pt-1">
                          <WorkflowBadge value={c.verification_noc_status} kind="noc" />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <EditableCell disabled={!canEdit(c)} type="number" value={fees} onSave={(v) => saveFees(c, Number(v) || 0)} />
                      </td>
                      <td className="px-3 py-2">
                        <EditableCell disabled={!canEdit(c)} type="number" value={received} onSave={(v) => saveReceived(c, Number(v) || 0)} />
                      </td>
                      <td className="px-3 py-2">
                        <span className={balance > 0 ? "font-semibold text-destructive" : "font-semibold text-success"}>{INR(balance)}</span>
                      </td>
                      <td className="px-3 py-2">
                        <SelectCell
                          value={c.pending_item}
                          options={pendingOptionList.map((p) => ({ value: p, label: p }))}
                          onSave={(v) => patch(c, { pending_item: v })}
                        />
                        <div className="px-1.5 pt-1">
                          <WorkflowBadge value={c.pending_item} kind="pending" />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <SelectCell
                          disabled={!canEdit(c)}
                          value={c.workflow_status ?? statusLabel(c.current_status)}
                          options={statusOptionList.map((s) => ({ value: s, label: s }))}
                          onSave={async (v) => {
                            if (v === "Other") return setOtherFor({ row: c, field: "status" });
                            await patch(c, { workflow_status: v });
                          }}
                        />
                        <div className="px-1.5 pt-1">
                          <WorkflowBadge value={c.workflow_status ?? c.current_status} kind="status" />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => setRemarksFor(c)}>
                            <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                            {remarkCounts[c.id] ?? 0}
                          </Button>
                          <Button size="sm" variant="ghost" title="Payment history" onClick={() => setHistoryFor(c)}>
                            <History className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                      {canDelete && (
                        <td className="px-3 py-2 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Delete record"
                            onClick={() => setDeleteFor(c)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </td>
                      )}
                    </tr>

                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AlertDialog open={Boolean(deleteFor)} onOpenChange={(o) => !o && setDeleteFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this record?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteFor
                ? `"${deleteFor.customer_name}" (Token ${deleteFor.token_number ?? "—"}) will be removed from the dashboard. The record is archived, not erased, and can be restored by the owner.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={async (e) => {
                e.preventDefault();
                if (!deleteFor) return;
                setDeleting(true);
                try {
                  await softDeleteFn({ data: { id: deleteFor.id } });
                  toast.success("Record deleted");
                  setDeleteFor(null);
                  await onChanged();
                } catch (err: any) {
                  toast.error(err.message ?? "Could not delete");
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {historyFor && (
        <PaymentHistoryDialog customer={historyFor} onClose={() => setHistoryFor(null)} />
      )}

      {otherFor && (
        <OtherReasonDialog
          field={otherFor.field}
          onClose={() => setOtherFor(null)}
          onSave={async (text) => {
            await patch(
              otherFor.row,
              otherFor.field === "pending" ? { pending_item: text } : { workflow_status: text },
            );
            setOtherFor(null);
          }}
        />
      )}

      {remarksFor && (
        <RemarksDialog
          customer={remarksFor}
          onClose={() => setRemarksFor(null)}
          addRemarkFn={addRemarkFn}
          onAdded={loadCounts}
        />
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  allLabel: string;
}) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function RemarksDialog({
  customer,
  onClose,
  addRemarkFn,
  onAdded,
}: {
  customer: WorkflowRow;
  onClose: () => void;
  addRemarkFn: (args: { data: { customerId: string; message: string } }) => Promise<any>;
  onAdded: () => void;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    load();
  }, [customer.id]);

  async function load() {
    const { data } = await supabase
      .from("customer_remarks")
      .select("*")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false });
    setItems(data ?? []);
  }

  async function add() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await addRemarkFn({ data: { customerId: customer.id, message: text.trim() } });
      setText("");
      await load();
      onAdded();
      toast.success("Remark added");
    } catch (e: any) {
      toast.error(e.message ?? "Could not add remark");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Remarks — {customer.token_number ? `Token ${customer.token_number}` : customer.application_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <Textarea rows={3} placeholder="Write a remark..." value={text} onChange={(e) => setText(e.target.value)} />
          <Button disabled={busy || !text.trim()} onClick={add} className="bg-navy-gradient text-primary-foreground">
            {busy ? "Adding..." : "Add remark"}
          </Button>
        </div>

        <div className="mt-2 space-y-3 border-t pt-3">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No remarks yet.</p>
          ) : (
            items.map((r) => {
              const d = new Date(r.created_at);
              return (
                <div key={r.id} className="rounded-lg border bg-secondary/30 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{r.author_name}</span>
                    <span>{d.toLocaleDateString("en-IN")}</span>
                    <span>{d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{r.message}</p>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function OtherReasonDialog({
  field,
  onClose,
  onSave,
}: {
  field: "pending" | "status";
  onClose: () => void;
  onSave: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{field === "pending" ? "Specify Pending Reason" : "Specify Status"}</DialogTitle>
        </DialogHeader>
        <Input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Required" />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!text.trim()}
            onClick={() => onSave(text.trim())}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentHistoryDialog({ customer, onClose }: { customer: WorkflowRow; onClose: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    supabase
      .from("payment_history")
      .select("*")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setItems(data ?? []));
  }, [customer.id]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Payment history — {customer.token_number ?? customer.customer_name}</DialogTitle>
        </DialogHeader>
        {items.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground">No fee or payment changes recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {items.map((h) => (
              <div key={h.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{h.field}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(h.created_at).toLocaleString("en-IN")}
                  </span>
                </div>
                <p className="mt-1">
                  {INR(Number(h.previous_amount))} → <span className="font-semibold">{INR(Number(h.new_amount))}</span>
                </p>
                <p className="text-xs text-muted-foreground">Updated by {h.updated_by_name ?? "—"}</p>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
