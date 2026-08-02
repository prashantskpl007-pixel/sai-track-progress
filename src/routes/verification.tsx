import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ShieldCheck,
  LogOut,
  Upload,
  FileText,
  Download,
  Clock,
  CheckCircle2,
  XCircle,
  PauseCircle,
  AlertCircle,
  Loader2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import {
  VERIFICATION_STATUSES,
  VERIFICATION_SORT_ORDER,
  VERIFICATION_DOCUMENT_TYPES,
  verificationStatusLabel,
  verificationDocTypeLabel,
  type VerificationStatus,
  type VerificationDocumentType,
} from "@/lib/status";
import {
  updateVerificationCase,
  recordVerificationDocument,
  deleteVerificationDocument,
} from "@/lib/verification.functions";
import { KycPanel } from "@/components/KycPanel";
import { WhatsAppFloatingButton } from "@/components/WhatsAppButton";

export const Route = createFileRoute("/verification")({
  head: () => ({
    meta: [
      { title: "Verification Partner — Sai Enterprise" },
      { name: "description", content: "Verification Partner dashboard for assigned cases." },
    ],
  }),
  component: VerificationDashboard,
});

type CaseRow = {
  id: string;
  customer_id: string;
  status: VerificationStatus;
  scheduled_date: string | null;
  actual_verification_date: string | null;
  completion_date: string | null;
  verification_time: string | null;
  verification_location: string | null;
  verification_remarks: string | null;
  assigned_at: string | null;
  customer: {
    application_number: string;
    customer_name: string;
    mobile_number: string;
    property_address: string | null;
    agreement_type: string;
  } | null;
};

function statusColor(s: VerificationStatus, isOverdue: boolean): string {
  if (isOverdue) return "bg-destructive text-destructive-foreground";
  if (s === "completed" || s === "approved") return "bg-success text-success-foreground";
  if (s === "rejected") return "bg-destructive text-destructive-foreground";
  if (s === "on_hold" || s === "additional_documents_required") return "bg-warning text-warning-foreground";
  return "bg-gold text-gold-foreground";
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function VerificationDashboard() {
  const navigate = useNavigate();
  const { session, loading, isVerificationPartner, isAdmin, isManager } = useSession();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [active, setActive] = useState<CaseRow | null>(null);

  const updateFn = useServerFn(updateVerificationCase);

  const load = useCallback(async () => {
    setFetching(true);
    const { data, error } = await supabase
      .from("verification_cases")
      .select(`
        id, customer_id, status, scheduled_date, actual_verification_date,
        completion_date, verification_time, verification_location, verification_remarks,
        rejection_reason, pending_work_details, missing_documents, assigned_at,
        customer:customers(application_number, customer_name, mobile_number, property_address, agreement_type, registration_date)
      `)
      .order("assigned_at", { ascending: false, nullsFirst: false });
    if (error) toast.error(error.message);
    setCases((data as any) ?? []);
    setFetching(false);
  }, []);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/" });
  }, [loading, session, navigate]);

  useEffect(() => {
    if (session && (isVerificationPartner || isAdmin || isManager)) load();
  }, [session, isVerificationPartner, isAdmin, isManager, load]);

  const sorted = useMemo(() => {
    return [...cases].sort(
      (a, b) => VERIFICATION_SORT_ORDER.indexOf(a.status) - VERIFICATION_SORT_ORDER.indexOf(b.status),
    );
  }, [cases]);

  const kpis = useMemo(() => {
    const pending = cases.filter((c) => c.status === "pending_assignment" || c.status === "assigned" || c.status === "in_progress").length;
    const completed = cases.filter((c) => c.status === "completed" || c.status === "approved").length;
    const rejected = cases.filter((c) => c.status === "rejected").length;
    const onHold = cases.filter((c) => c.status === "on_hold").length;
    const completedTimes = cases
      .filter((c) => c.completion_date && c.assigned_at)
      .map((c) => new Date(c.completion_date!).getTime() - new Date(c.assigned_at!).getTime());
    const avgDays = completedTimes.length
      ? Math.round(completedTimes.reduce((a, b) => a + b, 0) / completedTimes.length / (1000 * 60 * 60 * 24))
      : 0;
    return { pending, completed, rejected, onHold, avgDays };
  }, [cases]);

  if (loading) return <div className="p-8">Loading...</div>;
  if (!isVerificationPartner && !isAdmin && !isManager) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="text-muted-foreground">This dashboard is only for Verification Partners.</p>
        <Button onClick={() => navigate({ to: "/" })} className="mt-4">Back to sign in</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="border-b bg-navy-gradient text-primary-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold-gradient">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold">Verification Dashboard</h1>
              <p className="text-xs text-primary-foreground/70">Sai Enterprise — Partner Portal</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="text-primary-foreground"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/" });
            }}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Kpi icon={Clock} label="Pending" value={String(kpis.pending)} tone="gold" />
          <Kpi icon={CheckCircle2} label="Completed" value={String(kpis.completed)} tone="success" />
          <Kpi icon={XCircle} label="Rejected" value={String(kpis.rejected)} tone="danger" />
          <Kpi icon={PauseCircle} label="On Hold" value={String(kpis.onHold)} tone="warn" />
          <Kpi icon={AlertCircle} label="Avg Days" value={String(kpis.avgDays)} tone="navy" />
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border bg-card shadow-elegant">
          <div className="border-b bg-secondary/50 px-4 py-3">
            <h2 className="font-display font-semibold">Assigned Cases</h2>
          </div>
          {fetching ? (
            <div className="p-10 text-center text-muted-foreground">Loading cases...</div>
          ) : sorted.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">No cases assigned yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">App #</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Mobile</th>
                    <th className="px-4 py-3">Property</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Age</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((c) => {
                    const age = daysSince(c.assigned_at);
                    const overdue = age !== null && age > 7 && c.status !== "completed" && c.status !== "approved";
                    return (
                      <tr key={c.id} className="border-t hover:bg-muted/40">
                        <td className="px-4 py-3 font-mono font-semibold">{c.customer?.application_number}</td>
                        <td className="px-4 py-3">{c.customer?.customer_name}</td>
                        <td className="px-4 py-3">{c.customer?.mobile_number}</td>
                        <td className="px-4 py-3 max-w-xs truncate text-xs text-muted-foreground">
                          {c.customer?.property_address ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={statusColor(c.status, overdue)}>
                            {verificationStatusLabel(c.status)}
                          </Badge>
                        </td>
                        <td className={`px-4 py-3 text-xs ${overdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                          {age === null ? "—" : `${age}d`}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" variant="outline" onClick={() => setActive(c)}>
                            Open
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {active && (
        <Dialog open onOpenChange={(o) => !o && setActive(null)}>
          <CaseDialog
            row={active}
            onClose={() => setActive(null)}
            onSaved={async () => { setActive(null); await load(); }}
            updateFn={updateFn}
          />
        </Dialog>
      )}
      <WhatsAppFloatingButton />
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone }: any) {
  const toneClass =
    tone === "gold" ? "bg-gold-gradient text-gold-foreground" :
    tone === "success" ? "bg-success text-success-foreground" :
    tone === "danger" ? "bg-destructive text-destructive-foreground" :
    tone === "warn" ? "bg-warning text-warning-foreground" :
    "bg-navy-gradient text-primary-foreground";
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-elegant">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className="font-display text-xl font-bold">{value}</p>
        </div>
      </div>
    </div>
  );
}

function CaseDialog({ row, onClose, onSaved, updateFn }: any) {
  const [status, setStatus] = useState<VerificationStatus>(row.status);
  const [scheduled, setScheduled] = useState(row.scheduled_date ? row.scheduled_date.slice(0, 16) : "");
  const [actual, setActual] = useState(row.actual_verification_date ? row.actual_verification_date.slice(0, 16) : "");
  const [completion, setCompletion] = useState(row.completion_date ? row.completion_date.slice(0, 16) : "");
  const [time, setTime] = useState(row.verification_time ?? "");
  const [location, setLocation] = useState(row.verification_location ?? "");
  const [remarks, setRemarks] = useState(row.verification_remarks ?? "");
  const [rejectionReason, setRejectionReason] = useState(row.rejection_reason ?? "");
  const [pendingWork, setPendingWork] = useState(row.pending_work_details ?? "");
  const [missingDocs, setMissingDocs] = useState(row.missing_documents ?? "");
  const [busy, setBusy] = useState(false);

  const rejectedRequired = status === "rejected";
  const partialRequired = status === "partial_completed";
  const addlDocsRequired = status === "additional_documents_required";

  async function save() {
    // Client-side pre-checks (server also enforces)
    if (rejectedRequired && !rejectionReason.trim()) return toast.error("Rejection reason is mandatory");
    if (partialRequired && (!remarks.trim() || !pendingWork.trim()))
      return toast.error("Remarks and Pending work details are mandatory for Partial Completed");
    if (addlDocsRequired && (!missingDocs.trim() || !remarks.trim()))
      return toast.error("Missing documents and Remarks are mandatory");

    setBusy(true);
    try {
      await updateFn({
        data: {
          caseId: row.id,
          status,
          scheduled_date: scheduled ? new Date(scheduled).toISOString() : null,
          actual_verification_date: actual ? new Date(actual).toISOString() : null,
          completion_date: completion ? new Date(completion).toISOString() : null,
          verification_time: time || null,
          verification_location: location || null,
          verification_remarks: remarks || null,
          rejection_reason: rejectionReason || null,
          pending_work_details: pendingWork || null,
          missing_documents: missingDocs || null,
        },
      });
      toast.success("Case updated");
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle>
          {row.customer?.application_number} · {row.customer?.customer_name}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <div className="rounded-lg bg-secondary/40 p-3 text-sm">
          <p><span className="text-muted-foreground">Mobile:</span> {row.customer?.mobile_number}</p>
          <p><span className="text-muted-foreground">Agreement Type:</span> {row.customer?.agreement_type}</p>
          <p><span className="text-muted-foreground">Property:</span> {row.customer?.property_address ?? "—"}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Verification Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as VerificationStatus)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {VERIFICATION_STATUSES.map((s) => (
                  <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Verification Location</Label>
            <Input className="mt-1" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Scheduled Date</Label>
            <Input type="datetime-local" className="mt-1" value={scheduled} onChange={(e) => setScheduled(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Actual Verification Date</Label>
            <Input type="datetime-local" className="mt-1" value={actual} onChange={(e) => setActual(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Completion Date</Label>
            <Input type="datetime-local" className="mt-1" value={completion} onChange={(e) => setCompletion(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Verification Time / Notes</Label>
            <Input className="mt-1" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>

        <div>
          <Label className="text-xs">
            Verification Remarks{(partialRequired || addlDocsRequired) && <span className="text-destructive"> *</span>}
          </Label>
          <Textarea className="mt-1" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </div>

        {rejectedRequired && (
          <div>
            <Label className="text-xs">Rejection Reason <span className="text-destructive">*</span></Label>
            <Textarea className="mt-1" rows={3} value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} />
          </div>
        )}

        {partialRequired && (
          <div>
            <Label className="text-xs">Pending Work Details <span className="text-destructive">*</span></Label>
            <Textarea className="mt-1" rows={3} value={pendingWork} onChange={(e) => setPendingWork(e.target.value)} />
          </div>
        )}

        {addlDocsRequired && (
          <div>
            <Label className="text-xs">Missing Document Details <span className="text-destructive">*</span></Label>
            <Textarea className="mt-1" rows={3} value={missingDocs} onChange={(e) => setMissingDocs(e.target.value)} />
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy} className="bg-gold-gradient text-gold-foreground">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Case
          </Button>
        </div>

        <div className="rounded-lg border bg-card p-3">
          <h4 className="mb-2 font-display font-semibold">Verification Documents</h4>
          <p className="mb-3 text-xs text-muted-foreground">NOC, Police Verification, Site Visit Photos, Supporting docs.</p>
          <VerificationDocuments caseId={row.id} applicationNumber={row.customer?.application_number ?? "case"} />
        </div>

        <div className="rounded-lg border bg-card p-3">
          <h4 className="mb-2 font-display font-semibold">Customer KYC Documents (view / download)</h4>
          <KycPanel customerId={row.customer_id} applicationNumber={row.customer?.application_number ?? "case"} readOnly />
        </div>
      </div>
    </DialogContent>
  );
}

type VDoc = {
  id: string;
  document_type: VerificationDocumentType;
  file_path: string;
  file_name: string;
  file_size_bytes: number | null;
  remarks: string | null;
  created_at: string;
  uploaded_by_name: string | null;
};

function VerificationDocuments({ caseId, applicationNumber }: { caseId: string; applicationNumber: string }) {
  const [docs, setDocs] = useState<VDoc[]>([]);
  const [dtype, setDtype] = useState<VerificationDocumentType>("noc_certificate");
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);

  const recordFn = useServerFn(recordVerificationDocument);
  const deleteFn = useServerFn(deleteVerificationDocument);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("verification_documents")
      .select("*")
      .eq("verification_case_id", caseId)
      .order("created_at", { ascending: false });
    setDocs((data as any) ?? []);
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  async function upload(file: File) {
    if (file.size > 20 * 1024 * 1024) return toast.error("Max 20 MB");
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${applicationNumber}/${dtype}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("verification-documents")
        .upload(path, file, { contentType: file.type });
      if (error) throw error;
      await recordFn({
        data: {
          caseId,
          documentType: dtype,
          filePath: path,
          fileName: file.name,
          fileSizeBytes: file.size,
          mimeType: file.type,
          remarks: remarks.trim() || undefined,
        },
      });
      toast.success("Uploaded");
      setRemarks("");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function download(d: VDoc) {
    const { data, error } = await supabase.storage.from("verification-documents").createSignedUrl(d.file_path, 300);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  }

  async function remove(id: string) {
    if (!confirm("Delete this verification document?")) return;
    try {
      await deleteFn({ data: { id } });
      toast.success("Deleted");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <Select value={dtype} onValueChange={(v) => setDtype(v as VerificationDocumentType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {VERIFICATION_DOCUMENT_TYPES.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input placeholder="Remarks (optional)" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        <label className="flex">
          <input
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/*"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.currentTarget.value = ""; }}
          />
          <Button asChild variant="outline" className="w-full" disabled={busy}>
            <span>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Upload</span>
          </Button>
        </label>
      </div>

      {docs.length === 0 ? (
        <p className="text-xs text-muted-foreground">No verification documents uploaded.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-2 p-2 text-sm">
              <FileText className="h-4 w-4 text-primary" />
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{verificationDocTypeLabel(d.document_type)}</Badge>
                  <span>{d.file_name}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(d.created_at).toLocaleString()}
                  {d.uploaded_by_name ? ` · ${d.uploaded_by_name}` : ""}
                  {d.remarks ? ` · ${d.remarks}` : ""}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => download(d)}><Download className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => remove(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
