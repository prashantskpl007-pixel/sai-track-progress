import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageSquare, Loader2, Search } from "lucide-react";
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
import { updateCustomer, addCustomerRemark } from "@/lib/customer-admin.functions";
import { STATUS_STEPS, statusLabel, WORK_TYPES, PENDING_OPTIONS, NOC_OPTIONS } from "@/lib/status";

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
  onSave,
}: {
  value: string | number | null;
  type?: "text" | "number" | "date";
  className?: string;
  placeholder?: string;
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

  if (editing) {
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
}: {
  value: string | null;
  options: { value: string; label: string }[];
  onSave: (v: string) => Promise<void>;
  placeholder?: string;
}) {
  return (
    <Select value={value ?? undefined} onValueChange={(v) => onSave(v)}>
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

  const [remarksFor, setRemarksFor] = useState<WorkflowRow | null>(null);
  const [remarkCounts, setRemarkCounts] = useState<Record<string, number>>({});

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
      if (fDate && (c.registration_date ?? "").slice(0, 10) !== fDate) return false;
      if (fToken && !String(c.token_number ?? "").toLowerCase().includes(fToken.toLowerCase())) return false;
      if (fSource !== "all" && c.source_agent !== fSource) return false;
      if (fStaff !== "all" && c.assigned_staff_id !== fStaff) return false;
      if (fWorkType !== "all" && c.work_type !== fWorkType) return false;
      if (fPending !== "all" && (c.pending_item ?? "") !== fPending) return false;
      if (fStatus !== "all" && c.current_status !== fStatus) return false;
      if (!query) return true;
      return (
        String(c.customer_name ?? "").toLowerCase().includes(query) ||
        String(c.mobile_number ?? "").includes(query) ||
        String(c.token_number ?? "").toLowerCase().includes(query) ||
        String(c.property_address ?? "").toLowerCase().includes(query)
      );
    });
  }, [customers, q, fDate, fToken, fSource, fStaff, fWorkType, fPending, fStatus]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-2xl border bg-card p-4 shadow-elegant md:grid-cols-4">
        <div className="md:col-span-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Search</Label>
          <div className="relative mt-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Name, mobile, token, address..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
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
        <FilterSelect label="Pending" value={fPending} onChange={setFPending} options={PENDING_OPTIONS.map((p) => ({ value: p, label: p }))} allLabel="All pending" />
        <FilterSelect label="Status" value={fStatus} onChange={setFStatus} options={STATUS_STEPS.map((s) => ({ value: s.key, label: s.label }))} allLabel="All statuses" />
        <div className="flex items-end">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setQ(""); setFDate(""); setFToken(""); setFSource("all"); setFStaff("all");
              setFWorkType("all"); setFPending("all"); setFStatus("all");
            }}
          >
            Clear filters
          </Button>
        </div>
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
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={11} className="py-10 text-center text-muted-foreground">No records match the current filters.</td></tr>
              ) : (
                rows.map((c) => {
                  const fees = Number(c.total_amount) || 0;
                  const received = Number(c.payment_received) || 0;
                  const balance = Math.max(0, fees - received);
                  return (
                    <tr key={c.id} className="border-t align-top hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <EditableCell type="date" value={(c.registration_date ?? "").slice(0, 10)} onSave={(v) => patch(c, { registration_date: v })} />
                      </td>
                      <td className="px-3 py-2 font-mono font-semibold">
                        <EditableCell value={c.token_number} placeholder="Set token" onSave={(v) => patch(c, { token_number: v || null })} />
                      </td>
                      <td className="px-3 py-2">
                        <EditableCell value={c.source_agent} onSave={(v) => patch(c, { source_agent: v || null })} />
                      </td>
                      <td className="max-w-64 px-3 py-2">
                        <EditableCell value={c.property_address} className="whitespace-pre-wrap" onSave={(v) => patch(c, { property_address: v || null })} />
                      </td>
                      <td className="px-3 py-2">
                        <SelectCell
                          value={c.verification_noc_status}
                          options={NOC_OPTIONS.map((o) => ({ value: o, label: o }))}
                          onSave={(v) => patch(c, { verification_noc_status: v })}
                        />
                        <div className="px-1.5 pt-1">
                          <WorkflowBadge value={c.verification_noc_status} kind="noc" />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <EditableCell type="number" value={fees} onSave={(v) => saveFees(c, Number(v) || 0)} />
                      </td>
                      <td className="px-3 py-2">
                        <EditableCell type="number" value={received} onSave={(v) => saveReceived(c, Number(v) || 0)} />
                      </td>
                      <td className="px-3 py-2">
                        <span className={balance > 0 ? "font-semibold text-destructive" : "font-semibold text-success"}>{INR(balance)}</span>
                      </td>
                      <td className="px-3 py-2">
                        <SelectCell
                          value={c.pending_item}
                          options={PENDING_OPTIONS.map((p) => ({ value: p, label: p }))}
                          onSave={(v) => patch(c, { pending_item: v })}
                        />
                        <div className="px-1.5 pt-1">
                          <WorkflowBadge value={c.pending_item} kind="pending" />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <SelectCell
                          value={c.current_status}
                          options={STATUS_STEPS.map((s) => ({ value: s.key, label: s.label }))}
                          onSave={(v) => patch(c, { current_status: v })}
                        />
                        <div className="px-1.5 pt-1">
                          <WorkflowBadge value={c.current_status} kind="status" />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Button size="sm" variant="outline" onClick={() => setRemarksFor(c)}>
                          <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                          {remarkCounts[c.id] ?? 0}
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

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
