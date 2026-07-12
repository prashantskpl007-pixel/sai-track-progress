import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  FileCheck,
  LogOut,
  Plus,
  Search,
  Users,
  Clock,
  CheckCircle2,
  Calendar as CalIcon,
  Upload,
  Trash2,
  Pencil,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { useSession } from "@/hooks/use-session";
import {
  createCustomer,
  updateCustomer,
  deleteCustomer,
  seedDemoCustomers,
} from "@/lib/customer-admin.functions";
import { AGREEMENT_TYPES, STATUS_STEPS, statusLabel, type RegistrationStatus } from "@/lib/status";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin — Sai Enterprise" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminPanel,
});

type Customer = {
  id: string;
  customer_name: string;
  mobile_number: string;
  application_number: string;
  agreement_type: string;
  property_address: string | null;
  registration_date: string;
  current_status: RegistrationStatus;
  appointment_date: string | null;
  appointment_location: string | null;
  payment_status: "pending" | "partial" | "paid";
  payment_amount: number | null;
  agreement_pdf_path: string | null;
  notes: string | null;
};

function AdminPanel() {
  const navigate = useNavigate();
  const { session, loading, isAdmin } = useSession();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [fetching, setFetching] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  const createFn = useServerFn(createCustomer);
  const updateFn = useServerFn(updateCustomer);
  const deleteFn = useServerFn(deleteCustomer);
  const seedFn = useServerFn(seedDemoCustomers);

  useEffect(() => {
    if (loading) return;
    if (!session) return navigate({ to: "/auth" });
    if (!isAdmin) return navigate({ to: "/dashboard" });
    load();
  }, [session, loading, isAdmin]);

  async function load() {
    setFetching(true);
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setCustomers((data as Customer[]) ?? []);
    setFetching(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  async function handleSeed() {
    try {
      const r = await seedFn({});
      if ((r as { skipped?: boolean }).skipped) toast.info("Sample data already exists");
      else toast.success("Sample customers created (SE0001–SE0003)");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return customers.filter((c) => {
      if (statusFilter !== "all" && c.current_status !== statusFilter) return false;
      if (typeFilter !== "all" && c.agreement_type !== typeFilter) return false;
      if (!query) return true;
      return (
        c.customer_name.toLowerCase().includes(query) ||
        c.mobile_number.includes(query) ||
        c.application_number.toLowerCase().includes(query)
      );
    });
  }, [customers, q, statusFilter, typeFilter]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    return {
      total: customers.length,
      pending: customers.filter((c) => c.current_status !== "agreement_ready").length,
      completed: customers.filter((c) => c.current_status === "agreement_ready").length,
      todayAppts: customers.filter(
        (c) => c.appointment_date && c.appointment_date.slice(0, 10) === today,
      ).length,
      thisWeek: customers.filter((c) => new Date(c.registration_date) >= weekAgo).length,
    };
  }, [customers]);

  const uniqueTypes = Array.from(new Set(customers.map((c) => c.agreement_type)));

  if (loading || (!session && !loading)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-navy-gradient text-primary-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold-gradient">
              <FileCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-gold">Sai Enterprise</p>
              <p className="font-display text-base font-semibold">Admin Panel</p>
            </div>
          </div>
          <div className="flex gap-2">
            {customers.length === 0 && (
              <Button
                variant="outline"
                className="border-white/30 bg-white/5 text-primary-foreground hover:bg-white/10"
                onClick={handleSeed}
              >
                <Sparkles className="mr-2 h-4 w-4" /> Add sample data
              </Button>
            )}
            <Button variant="ghost" className="text-primary-foreground hover:bg-white/10" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard icon={Users} label="Total registrations" value={stats.total} />
          <StatCard icon={Clock} label="Pending" value={stats.pending} tone="gold" />
          <StatCard icon={CheckCircle2} label="Completed" value={stats.completed} tone="success" />
          <StatCard icon={CalIcon} label="Today's appointments" value={stats.todayAppts} />
          <StatCard icon={Users} label="This week" value={stats.thisWeek} />
        </div>

        {/* Toolbar */}
        <div className="mt-8 flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4 shadow-elegant">
          <div className="min-w-56 flex-1">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Search</Label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Name, mobile, or SE0001..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="w-52">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUS_STEPS.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-52">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Type</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {uniqueTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="bg-gold-gradient text-gold-foreground shadow-gold">
                <Plus className="mr-2 h-4 w-4" /> New Registration
              </Button>
            </DialogTrigger>
            <CustomerFormDialog
              onSubmit={async (values) => {
                try {
                  await createFn({ data: values });
                  toast.success("Customer created");
                  setCreateOpen(false);
                  await load();
                } catch (e: any) {
                  toast.error(e.message);
                }
              }}
            />
          </Dialog>
        </div>

        {/* Table */}
        <div className="mt-6 overflow-hidden rounded-2xl border bg-card shadow-elegant">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">App #</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Mobile</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {fetching ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-muted-foreground">
                      Loading...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-muted-foreground">
                      No customers yet. Click "New Registration" or "Add sample data".
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => (
                    <tr key={c.id} className="border-t hover:bg-muted/40">
                      <td className="px-4 py-3 font-mono font-semibold">{c.application_number}</td>
                      <td className="px-4 py-3">{c.customer_name}</td>
                      <td className="px-4 py-3">{c.mobile_number}</td>
                      <td className="px-4 py-3">{c.agreement_type}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{statusLabel(c.current_status)}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            c.payment_status === "paid"
                              ? "text-success"
                              : c.payment_status === "partial"
                                ? "text-gold"
                                : "text-destructive"
                          }
                        >
                          {c.payment_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            if (!confirm(`Delete ${c.application_number}?`)) return;
                            try {
                              await deleteFn({ data: { id: c.id } });
                              toast.success("Deleted");
                              await load();
                            } catch (e: any) {
                              toast.error(e.message);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <EditCustomerDialog
            customer={editing}
            onClose={() => setEditing(null)}
            onSaved={async () => {
              setEditing(null);
              await load();
            }}
            updateFn={updateFn}
          />
        </Dialog>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: any;
  label: string;
  value: number;
  tone?: "gold" | "success";
}) {
  const toneClass =
    tone === "gold" ? "bg-gold-gradient text-gold-foreground" : tone === "success" ? "bg-success text-success-foreground" : "bg-navy-gradient text-primary-foreground";
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-elegant">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className="font-display text-2xl font-bold">{value}</p>
        </div>
      </div>
    </div>
  );
}

function CustomerFormDialog({
  onSubmit,
}: {
  onSubmit: (values: any) => Promise<void>;
}) {
  const [values, setValues] = useState({
    customerName: "",
    mobileNumber: "",
    agreementType: AGREEMENT_TYPES[0],
    propertyAddress: "",
    paymentStatus: "pending" as "pending" | "partial" | "paid",
    paymentAmount: "",
    notes: "",
  });
  const [busy, setBusy] = useState(false);

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>New Customer Registration</DialogTitle>
      </DialogHeader>
      <div className="grid gap-3">
        <Field label="Customer Name">
          <Input
            value={values.customerName}
            onChange={(e) => setValues({ ...values, customerName: e.target.value })}
          />
        </Field>
        <Field label="Mobile Number">
          <Input
            inputMode="numeric"
            value={values.mobileNumber}
            onChange={(e) => setValues({ ...values, mobileNumber: e.target.value })}
          />
        </Field>
        <Field label="Agreement Type">
          <Select
            value={values.agreementType}
            onValueChange={(v) => setValues({ ...values, agreementType: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AGREEMENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Property Address">
          <Textarea
            value={values.propertyAddress}
            onChange={(e) => setValues({ ...values, propertyAddress: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Payment Status">
            <Select
              value={values.paymentStatus}
              onValueChange={(v: any) => setValues({ ...values, paymentStatus: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Amount (₹)">
            <Input
              type="number"
              value={values.paymentAmount}
              onChange={(e) => setValues({ ...values, paymentAmount: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea
            value={values.notes}
            onChange={(e) => setValues({ ...values, notes: e.target.value })}
          />
        </Field>
      </div>
      <DialogFooter>
        <Button
          disabled={busy || !values.customerName || !values.mobileNumber}
          onClick={async () => {
            setBusy(true);
            await onSubmit({
              customerName: values.customerName,
              mobileNumber: values.mobileNumber,
              agreementType: values.agreementType,
              propertyAddress: values.propertyAddress || null,
              paymentStatus: values.paymentStatus,
              paymentAmount: values.paymentAmount ? Number(values.paymentAmount) : null,
              notes: values.notes || null,
            });
            setBusy(false);
          }}
          className="bg-navy-gradient text-primary-foreground"
        >
          {busy ? "Creating..." : "Create registration"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function EditCustomerDialog({
  customer,
  onClose,
  onSaved,
  updateFn,
}: {
  customer: Customer;
  onClose: () => void;
  onSaved: () => void;
  updateFn: ReturnType<typeof useServerFn<typeof updateCustomer>>;
}) {
  const [status, setStatus] = useState<RegistrationStatus>(customer.current_status);
  const [apptDate, setApptDate] = useState(customer.appointment_date?.slice(0, 16) ?? "");
  const [apptLoc, setApptLoc] = useState(customer.appointment_location ?? "");
  const [payStatus, setPayStatus] = useState(customer.payment_status);
  const [payAmount, setPayAmount] = useState<string>(String(customer.payment_amount ?? ""));
  const [notes, setNotes] = useState(customer.notes ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      let pdfPath = customer.agreement_pdf_path;
      if (file) {
        const path = `${customer.application_number}-${Date.now()}.pdf`;
        const { error } = await supabase.storage.from("agreements").upload(path, file, {
          contentType: "application/pdf",
          upsert: true,
        });
        if (error) throw error;
        pdfPath = path;
      }
      await updateFn({
        data: {
          id: customer.id,
          patch: {
            current_status: status,
            appointment_date: apptDate ? new Date(apptDate).toISOString() : null,
            appointment_location: apptLoc || null,
            payment_status: payStatus,
            payment_amount: payAmount ? Number(payAmount) : null,
            notes: notes || null,
            agreement_pdf_path: pdfPath,
          },
        },
      });
      toast.success("Updated");
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>
          Edit {customer.application_number} · {customer.customer_name}
        </DialogTitle>
      </DialogHeader>
      <div className="grid gap-3">
        <Field label="Current Status">
          <Select value={status} onValueChange={(v: any) => setStatus(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_STEPS.map((s) => (
                <SelectItem key={s.key} value={s.key}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Appointment Date & Time">
            <Input type="datetime-local" value={apptDate} onChange={(e) => setApptDate(e.target.value)} />
          </Field>
          <Field label="Appointment Location">
            <Input value={apptLoc} onChange={(e) => setApptLoc(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Payment Status">
            <Select value={payStatus} onValueChange={(v: any) => setPayStatus(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Amount (₹)">
            <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
          </Field>
        </div>
        <Field label="Notes / Remarks">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Field label="Upload Agreement PDF">
          <div className="flex items-center gap-2">
            <Input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {customer.agreement_pdf_path && !file && (
              <span className="text-xs text-muted-foreground">
                <Upload className="mr-1 inline h-3 w-3" />
                Already uploaded
              </span>
            )}
          </div>
        </Field>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} disabled={busy} className="bg-navy-gradient text-primary-foreground">
          {busy ? "Saving..." : "Save changes"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
