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
  IndianRupee,
  AlertTriangle,
  UserCog,
  BarChart3,
  History,
  KeyRound,
  StickyNote,
  ShieldCheck,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import {
  createCustomer,
  updateCustomer,
  deleteCustomer,
  seedDemoCustomers,
  addInternalNote,
  deleteInternalNote,
  resolveAlert,
} from "@/lib/customer-admin.functions";
import {
  createStaff,
  updateStaff,
  deleteStaff,
  resetStaffPassword,
} from "@/lib/staff-admin.functions";
import { AGREEMENT_TYPES, STATUS_STEPS, statusLabel, type RegistrationStatus } from "@/lib/status";
import { KycPanel } from "@/components/KycPanel";
import {
  listVerificationPartners,
  assignVerificationCase,
} from "@/lib/verification.functions";

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
  customer_email: string | null;
  application_number: string;
  agreement_type: string;
  property_address: string | null;
  registration_date: string;
  current_status: RegistrationStatus;
  appointment_date: string | null;
  appointment_location: string | null;
  payment_status: "pending" | "partial" | "paid";
  payment_amount: number | null;
  agreement_charges: number | null;
  registration_charges: number | null;
  service_charges: number | null;
  other_charges: number | null;
  total_amount: number | null;
  payment_received: number | null;
  balance_amount: number | null;
  payment_method: string | null;
  payment_date: string | null;
  assigned_staff_id: string | null;
  agreement_pdf_path: string | null;
  notes: string | null;
  created_at: string;
  last_contacted_at: string | null;
};

type Staff = {
  id: string;
  full_name: string;
  designation: string;
  mobile_number: string;
  email: string;
  username: string | null;
  profile_photo_url: string | null;
  joining_date: string;
  is_active: boolean;
  user_id: string | null;
};

const PIE_COLORS = ["#0f2a56", "#c8a24a", "#1f6f4a", "#c85450", "#5b6cbd", "#8a5cbf", "#c17a2f", "#3b7a8a"];

const INR = (n: number | null | undefined) =>
  `₹${(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

function AdminPanel() {
  const navigate = useNavigate();
  const { session, loading, isAdmin } = useSession();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [fetching, setFetching] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [staffCreateOpen, setStaffCreateOpen] = useState(false);
  const [staffEditing, setStaffEditing] = useState<Staff | null>(null);
  const [staffPwdFor, setStaffPwdFor] = useState<Staff | null>(null);
  const [kycFor, setKycFor] = useState<Customer | null>(null);
  const [verificationCases, setVerificationCases] = useState<any[]>([]);
  const [verificationPartners, setVerificationPartners] = useState<any[]>([]);

  const createFn = useServerFn(createCustomer);
  const updateFn = useServerFn(updateCustomer);
  const deleteFn = useServerFn(deleteCustomer);
  const seedFn = useServerFn(seedDemoCustomers);
  const createStaffFn = useServerFn(createStaff);
  const updateStaffFn = useServerFn(updateStaff);
  const deleteStaffFn = useServerFn(deleteStaff);
  const resetPwdFn = useServerFn(resetStaffPassword);
  const resolveAlertFn = useServerFn(resolveAlert);
  const addNoteFn = useServerFn(addInternalNote);
  const deleteNoteFn = useServerFn(deleteInternalNote);
  const listPartnersFn = useServerFn(listVerificationPartners);
  const assignCaseFn = useServerFn(assignVerificationCase);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/auth" });
      return;
    }
    if (!isAdmin) {
      navigate({ to: "/dashboard" });
      return;
    }
    load();
  }, [session, loading, isAdmin]);

  async function load() {
    setFetching(true);
    const [cRes, sRes] = await Promise.all([
      supabase.from("customers").select("*").order("created_at", { ascending: false }),
      supabase.from("staff").select("*").order("created_at", { ascending: false }),
    ]);
    if (cRes.error) toast.error(cRes.error.message);
    if (sRes.error && sRes.error.code !== "PGRST116") toast.error(sRes.error.message);
    setCustomers((cRes.data as Customer[]) ?? []);
    setStaff((sRes.data as Staff[]) ?? []);
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
    const totalRev = customers.reduce((s, c) => s + (c.total_amount ?? 0), 0);
    const receivedRev = customers.reduce((s, c) => s + (c.payment_received ?? 0), 0);
    const pendingRev = customers.reduce((s, c) => s + (c.balance_amount ?? 0), 0);
    return {
      total: customers.length,
      pending: customers.filter((c) => c.current_status !== "agreement_ready").length,
      completed: customers.filter((c) => c.current_status === "agreement_ready").length,
      todayAppts: customers.filter(
        (c) => c.appointment_date && c.appointment_date.slice(0, 10) === today,
      ).length,
      thisWeek: customers.filter((c) => new Date(c.registration_date) >= weekAgo).length,
      totalRev,
      receivedRev,
      pendingRev,
    };
  }, [customers]);

  // Charts data
  const monthlyData = useMemo(() => {
    const map = new Map<string, { month: string; registrations: number; revenue: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0, 7);
      const label = d.toLocaleString("en-IN", { month: "short", year: "2-digit" });
      map.set(key, { month: label, registrations: 0, revenue: 0 });
    }
    customers.forEach((c) => {
      const key = c.registration_date?.slice(0, 7);
      const row = map.get(key);
      if (row) {
        row.registrations += 1;
        row.revenue += c.payment_received ?? 0;
      }
    });
    return Array.from(map.values());
  }, [customers]);

  const typeDistribution = useMemo(() => {
    const map = new Map<string, number>();
    customers.forEach((c) => map.set(c.agreement_type, (map.get(c.agreement_type) ?? 0) + 1));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [customers]);

  const statusDistribution = useMemo(() => {
    const map = new Map<string, number>();
    customers.forEach((c) =>
      map.set(statusLabel(c.current_status), (map.get(statusLabel(c.current_status)) ?? 0) + 1),
    );
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [customers]);

  const staffPerf = useMemo(() => {
    const map = new Map<string, { name: string; total: number; completed: number }>();
    staff.forEach((s) => map.set(s.id, { name: s.full_name, total: 0, completed: 0 }));
    customers.forEach((c) => {
      if (!c.assigned_staff_id) return;
      const row = map.get(c.assigned_staff_id);
      if (row) {
        row.total += 1;
        if (c.current_status === "agreement_ready") row.completed += 1;
      }
    });
    return Array.from(map.values());
  }, [staff, customers]);

  // Smart alerts
  const alerts = useMemo(() => {
    const list: { key: string; customerId: string; type: "danger" | "warn"; text: string }[] = [];
    const now = Date.now();
    customers.forEach((c) => {
      if ((c.balance_amount ?? 0) > 0 && c.current_status === "agreement_ready") {
        list.push({
          key: `pay-${c.id}`,
          customerId: c.id,
          type: "danger",
          text: `${c.application_number} · ${c.customer_name}: ₹${c.balance_amount} pending after completion`,
        });
      }
      if (c.appointment_date) {
        const apptTime = new Date(c.appointment_date).getTime();
        if (apptTime < now && c.current_status === "appointment_scheduled") {
          list.push({
            key: `miss-${c.id}`,
            customerId: c.id,
            type: "danger",
            text: `${c.application_number} · ${c.customer_name}: appointment missed on ${new Date(c.appointment_date).toLocaleDateString("en-IN")}`,
          });
        } else if (apptTime - now > 0 && apptTime - now < 2 * 86400000) {
          list.push({
            key: `up-${c.id}`,
            customerId: c.id,
            type: "warn",
            text: `${c.application_number} · ${c.customer_name}: appointment in <48h (${new Date(c.appointment_date).toLocaleString("en-IN")})`,
          });
        }
      }
      const stale = c.last_contacted_at
        ? now - new Date(c.last_contacted_at).getTime()
        : now - new Date(c.created_at).getTime();
      if (stale > 7 * 86400000 && c.current_status !== "agreement_ready") {
        list.push({
          key: `stale-${c.id}`,
          customerId: c.id,
          type: "warn",
          text: `${c.application_number} · ${c.customer_name}: no update in ${Math.floor(stale / 86400000)} days`,
        });
      }
    });
    return list;
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
            <Button
              variant="outline"
              className="border-white/30 bg-white/5 text-primary-foreground hover:bg-white/10"
              onClick={() => navigate({ to: "/verification" })}
            >
              <ShieldCheck className="mr-2 h-4 w-4" /> Verification
            </Button>
            <Button variant="ghost" className="text-primary-foreground hover:bg-white/10" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="mb-6 flex w-full flex-wrap justify-start gap-1 bg-secondary p-1">
            <TabsTrigger value="overview"><BarChart3 className="mr-1.5 h-4 w-4" />Overview</TabsTrigger>
            <TabsTrigger value="customers"><Users className="mr-1.5 h-4 w-4" />Customers</TabsTrigger>
            <TabsTrigger value="staff"><UserCog className="mr-1.5 h-4 w-4" />Staff</TabsTrigger>
            <TabsTrigger value="alerts">
              <AlertTriangle className="mr-1.5 h-4 w-4" />Alerts
              {alerts.length > 0 && (
                <span className="ml-1.5 rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                  {alerts.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="analytics"><BarChart3 className="mr-1.5 h-4 w-4" />Analytics</TabsTrigger>
          </TabsList>

          {/* ===== OVERVIEW ===== */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={Users} label="Total registrations" value={String(stats.total)} />
              <StatCard icon={Clock} label="Pending" value={String(stats.pending)} tone="gold" />
              <StatCard icon={CheckCircle2} label="Completed" value={String(stats.completed)} tone="success" />
              <StatCard icon={CalIcon} label="Today's appointments" value={String(stats.todayAppts)} />
              <StatCard icon={IndianRupee} label="Total revenue" value={INR(stats.totalRev)} tone="gold" />
              <StatCard icon={IndianRupee} label="Received" value={INR(stats.receivedRev)} tone="success" />
              <StatCard icon={IndianRupee} label="Outstanding" value={INR(stats.pendingRev)} />
              <StatCard icon={Users} label="Active staff" value={String(staff.filter((s) => s.is_active).length)} />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <ChartCard title="Monthly registrations & revenue (last 6 months)">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis yAxisId="left" fontSize={12} />
                    <YAxis yAxisId="right" orientation="right" fontSize={12} />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="registrations" stroke="#0f2a56" strokeWidth={2} />
                    <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#c8a24a" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Status distribution">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={statusDistribution} dataKey="value" nameKey="name" outerRadius={90} label>
                      {statusDistribution.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Agreement types">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={typeDistribution} dataKey="value" nameKey="name" outerRadius={90} label>
                      {typeDistribution.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Staff workload">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={staffPerf}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="total" fill="#0f2a56" name="Assigned" />
                    <Bar dataKey="completed" fill="#c8a24a" name="Completed" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </TabsContent>

          {/* ===== CUSTOMERS ===== */}
          <TabsContent value="customers">
            <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4 shadow-elegant">
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
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {STATUS_STEPS.map((s) => (
                      <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-52">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Type</Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {uniqueTypes.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
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
                  staff={staff}
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
                      <th className="px-4 py-3">Assigned</th>
                      <th className="px-4 py-3">Balance</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fetching ? (
                      <tr><td colSpan={8} className="py-10 text-center text-muted-foreground">Loading...</td></tr>
                    ) : filtered.length === 0 ? (
                      <tr><td colSpan={8} className="py-10 text-center text-muted-foreground">
                        No customers yet. Click "New Registration" or "Add sample data".
                      </td></tr>
                    ) : (
                      filtered.map((c) => {
                        const s = staff.find((x) => x.id === c.assigned_staff_id);
                        return (
                          <tr key={c.id} className="border-t hover:bg-muted/40">
                            <td className="px-4 py-3 font-mono font-semibold">{c.application_number}</td>
                            <td className="px-4 py-3">{c.customer_name}</td>
                            <td className="px-4 py-3">{c.mobile_number}</td>
                            <td className="px-4 py-3">{c.agreement_type}</td>
                            <td className="px-4 py-3"><Badge variant="outline">{statusLabel(c.current_status)}</Badge></td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{s?.full_name ?? "—"}</td>
                            <td className="px-4 py-3">
                              <span className={(c.balance_amount ?? 0) > 0 ? "text-destructive font-semibold" : "text-success"}>
                                {INR(c.balance_amount)}
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
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* ===== STAFF ===== */}
          <TabsContent value="staff">
            <div className="flex items-center justify-between rounded-2xl border bg-card p-4 shadow-elegant">
              <div>
                <h2 className="font-display text-lg font-semibold">Staff members</h2>
                <p className="text-sm text-muted-foreground">Team members with individual logins.</p>
              </div>
              <Dialog open={staffCreateOpen} onOpenChange={setStaffCreateOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gold-gradient text-gold-foreground shadow-gold">
                    <Plus className="mr-2 h-4 w-4" /> Add Staff
                  </Button>
                </DialogTrigger>
                <StaffFormDialog
                  onSubmit={async (values) => {
                    try {
                      await createStaffFn({ data: values });
                      toast.success("Staff added");
                      setStaffCreateOpen(false);
                      await load();
                    } catch (e: any) {
                      toast.error(e.message);
                    }
                  }}
                />
              </Dialog>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {staff.length === 0 ? (
                <div className="col-span-full rounded-2xl border bg-card p-10 text-center text-muted-foreground shadow-elegant">
                  No staff yet. Click "Add Staff" to create the first team member.
                </div>
              ) : (
                staff.map((s) => (
                  <div key={s.id} className="rounded-2xl border bg-card p-5 shadow-elegant">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-14 w-14">
                        <AvatarImage src={s.profile_photo_url ?? undefined} />
                        <AvatarFallback>{s.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-display font-semibold">{s.full_name}</p>
                          {!s.is_active && <Badge variant="outline" className="text-xs">Inactive</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">{s.designation}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{s.email}</p>
                        <p className="text-xs text-muted-foreground">{s.mobile_number}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => setStaffEditing(s)}>
                        <Pencil className="mr-1 h-3 w-3" /> Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setStaffPwdFor(s)}>
                        <KeyRound className="mr-1 h-3 w-3" /> Password
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          if (!confirm(`Delete ${s.full_name}?`)) return;
                          try {
                            await deleteStaffFn({ data: { id: s.id } });
                            toast.success("Deleted");
                            await load();
                          } catch (e: any) {
                            toast.error(e.message);
                          }
                        }}
                      >
                        <Trash2 className="mr-1 h-3 w-3 text-destructive" /> Delete
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {/* ===== ALERTS ===== */}
          <TabsContent value="alerts">
            <div className="rounded-2xl border bg-card p-6 shadow-elegant">
              <h2 className="font-display text-lg font-semibold">Smart Alerts</h2>
              <p className="text-sm text-muted-foreground">Missed appointments, pending payments, and stale files.</p>
              <div className="mt-4 space-y-2">
                {alerts.length === 0 ? (
                  <p className="py-8 text-center text-muted-foreground">All clear — no active alerts.</p>
                ) : (
                  alerts.map((a) => (
                    <div
                      key={a.key}
                      className={`flex items-start justify-between gap-3 rounded-lg border p-3 ${
                        a.type === "danger" ? "border-destructive/40 bg-destructive/5" : "border-gold/40 bg-gold/5"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className={`mt-0.5 h-4 w-4 ${a.type === "danger" ? "text-destructive" : "text-gold"}`} />
                        <p className="text-sm">{a.text}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          try {
                            await resolveAlertFn({ data: { alertKey: a.key, customerId: a.customerId } });
                            toast.success("Marked resolved");
                          } catch (e: any) {
                            toast.error(e.message);
                          }
                        }}
                      >
                        Resolve
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          {/* ===== ANALYTICS ===== */}
          <TabsContent value="analytics">
            <div className="grid gap-6 lg:grid-cols-2">
              <ChartCard title="Peak months">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="registrations" fill="#0f2a56" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Revenue by month">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip formatter={(v: any) => INR(Number(v))} />
                    <Bar dataKey="revenue" fill="#c8a24a" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              <div className="rounded-2xl border bg-card p-6 shadow-elegant lg:col-span-2">
                <h3 className="font-display font-semibold">Staff performance</h3>
                <table className="mt-3 w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground">
                    <tr><th className="py-2">Staff</th><th>Assigned</th><th>Completed</th><th>Completion %</th></tr>
                  </thead>
                  <tbody>
                    {staffPerf.map((s) => (
                      <tr key={s.name} className="border-t">
                        <td className="py-2">{s.name}</td>
                        <td>{s.total}</td>
                        <td>{s.completed}</td>
                        <td>{s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <EditCustomerDialog
            customer={editing}
            staff={staff}
            onClose={() => setEditing(null)}
            onSaved={async () => {
              setEditing(null);
              await load();
            }}
            updateFn={updateFn}
            addNoteFn={addNoteFn}
            deleteNoteFn={deleteNoteFn}
          />
        </Dialog>
      )}

      {staffEditing && (
        <Dialog open onOpenChange={(o) => !o && setStaffEditing(null)}>
          <StaffEditDialog
            staff={staffEditing}
            onClose={() => setStaffEditing(null)}
            onSaved={async () => {
              setStaffEditing(null);
              await load();
            }}
            updateFn={updateStaffFn}
          />
        </Dialog>
      )}

      {staffPwdFor && (
        <Dialog open onOpenChange={(o) => !o && setStaffPwdFor(null)}>
          <StaffPasswordDialog
            staff={staffPwdFor}
            onClose={() => setStaffPwdFor(null)}
            resetFn={resetPwdFn}
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
  value: string;
  tone?: "gold" | "success";
}) {
  const toneClass =
    tone === "gold"
      ? "bg-gold-gradient text-gold-foreground"
      : tone === "success"
        ? "bg-success text-success-foreground"
        : "bg-navy-gradient text-primary-foreground";
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

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-elegant">
      <h3 className="mb-3 font-display font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function CustomerFormDialog({
  onSubmit,
  staff,
}: {
  onSubmit: (values: any) => Promise<void>;
  staff: Staff[];
}) {
  const [values, setValues] = useState({
    customerName: "",
    mobileNumber: "",
    customerEmail: "",
    agreementType: AGREEMENT_TYPES[0],
    propertyAddress: "",
    paymentStatus: "pending" as "pending" | "partial" | "paid",
    agreementCharges: "",
    registrationCharges: "",
    serviceCharges: "",
    otherCharges: "",
    paymentReceived: "",
    paymentMethod: "",
    assignedStaffId: "",
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const total =
    (Number(values.agreementCharges) || 0) +
    (Number(values.registrationCharges) || 0) +
    (Number(values.serviceCharges) || 0) +
    (Number(values.otherCharges) || 0);

  return (
    <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
      <DialogHeader><DialogTitle>New Customer Registration</DialogTitle></DialogHeader>
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Customer Name">
            <Input value={values.customerName} onChange={(e) => setValues({ ...values, customerName: e.target.value })} />
          </Field>
          <Field label="Mobile Number">
            <Input inputMode="numeric" value={values.mobileNumber} onChange={(e) => setValues({ ...values, mobileNumber: e.target.value })} />
          </Field>
        </div>
        <Field label="Email (optional)">
          <Input type="email" value={values.customerEmail} onChange={(e) => setValues({ ...values, customerEmail: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Agreement Type">
            <Select value={values.agreementType} onValueChange={(v) => setValues({ ...values, agreementType: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{AGREEMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Assigned Staff">
            <Select value={values.assignedStaffId || "none"} onValueChange={(v) => setValues({ ...values, assignedStaffId: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {staff.filter((s) => s.is_active).map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field label="Property Address">
          <Textarea rows={2} value={values.propertyAddress} onChange={(e) => setValues({ ...values, propertyAddress: e.target.value })} />
        </Field>
        <div className="rounded-lg border bg-secondary/30 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Revenue breakdown (₹)</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Agreement charges">
              <Input type="number" value={values.agreementCharges} onChange={(e) => setValues({ ...values, agreementCharges: e.target.value })} />
            </Field>
            <Field label="Registration charges">
              <Input type="number" value={values.registrationCharges} onChange={(e) => setValues({ ...values, registrationCharges: e.target.value })} />
            </Field>
            <Field label="Service charges">
              <Input type="number" value={values.serviceCharges} onChange={(e) => setValues({ ...values, serviceCharges: e.target.value })} />
            </Field>
            <Field label="Other charges">
              <Input type="number" value={values.otherCharges} onChange={(e) => setValues({ ...values, otherCharges: e.target.value })} />
            </Field>
          </div>
          <p className="mt-2 text-sm font-semibold">Total: {INR(total)}</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Payment Status">
            <Select value={values.paymentStatus} onValueChange={(v: any) => setValues({ ...values, paymentStatus: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Received (₹)">
            <Input type="number" value={values.paymentReceived} onChange={(e) => setValues({ ...values, paymentReceived: e.target.value })} />
          </Field>
          <Field label="Method">
            <Input placeholder="Cash / UPI / Cheque" value={values.paymentMethod} onChange={(e) => setValues({ ...values, paymentMethod: e.target.value })} />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea rows={2} value={values.notes} onChange={(e) => setValues({ ...values, notes: e.target.value })} />
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
              customerEmail: values.customerEmail || null,
              agreementType: values.agreementType,
              propertyAddress: values.propertyAddress || null,
              paymentStatus: values.paymentStatus,
              agreementCharges: Number(values.agreementCharges) || 0,
              registrationCharges: Number(values.registrationCharges) || 0,
              serviceCharges: Number(values.serviceCharges) || 0,
              otherCharges: Number(values.otherCharges) || 0,
              paymentReceived: Number(values.paymentReceived) || 0,
              paymentMethod: values.paymentMethod || null,
              assignedStaffId: values.assignedStaffId || null,
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
  staff,
  onClose,
  onSaved,
  updateFn,
  addNoteFn,
  deleteNoteFn,
}: {
  customer: Customer;
  staff: Staff[];
  onClose: () => void;
  onSaved: () => void;
  updateFn: ReturnType<typeof useServerFn<typeof updateCustomer>>;
  addNoteFn: ReturnType<typeof useServerFn<typeof addInternalNote>>;
  deleteNoteFn: ReturnType<typeof useServerFn<typeof deleteInternalNote>>;
}) {
  const [status, setStatus] = useState<RegistrationStatus>(customer.current_status);
  const [apptDate, setApptDate] = useState(customer.appointment_date?.slice(0, 16) ?? "");
  const [apptLoc, setApptLoc] = useState(customer.appointment_location ?? "");
  const [payStatus, setPayStatus] = useState(customer.payment_status);
  const [assignedStaff, setAssignedStaff] = useState(customer.assigned_staff_id ?? "");
  const [agreementCharges, setAgreementCharges] = useState(String(customer.agreement_charges ?? ""));
  const [registrationCharges, setRegistrationCharges] = useState(String(customer.registration_charges ?? ""));
  const [serviceCharges, setServiceCharges] = useState(String(customer.service_charges ?? ""));
  const [otherCharges, setOtherCharges] = useState(String(customer.other_charges ?? ""));
  const [paymentReceived, setPaymentReceived] = useState(String(customer.payment_received ?? ""));
  const [paymentMethod, setPaymentMethod] = useState(customer.payment_method ?? "");
  const [notes, setNotes] = useState(customer.notes ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [internalNotes, setInternalNotes] = useState<{ id: string; note_text: string; created_at: string }[]>([]);
  const [newNote, setNewNote] = useState("");

  const total =
    (Number(agreementCharges) || 0) +
    (Number(registrationCharges) || 0) +
    (Number(serviceCharges) || 0) +
    (Number(otherCharges) || 0);
  const balance = Math.max(0, total - (Number(paymentReceived) || 0));

  useEffect(() => {
    loadNotes();
  }, []);

  async function loadNotes() {
    const { data } = await supabase
      .from("internal_notes")
      .select("id, note_text, created_at")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false });
    setInternalNotes(data ?? []);
  }

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
            assigned_staff_id: assignedStaff || null,
            agreement_charges: Number(agreementCharges) || 0,
            registration_charges: Number(registrationCharges) || 0,
            service_charges: Number(serviceCharges) || 0,
            other_charges: Number(otherCharges) || 0,
            total_amount: total,
            payment_received: Number(paymentReceived) || 0,
            balance_amount: balance,
            payment_method: paymentMethod || null,
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
    <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Edit {customer.application_number} · {customer.customer_name}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Current Status">
            <Select value={status} onValueChange={(v: any) => setStatus(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_STEPS.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Assigned Staff">
            <Select value={assignedStaff || "none"} onValueChange={(v) => setAssignedStaff(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {staff.filter((s) => s.is_active).map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Appointment Date & Time">
            <Input type="datetime-local" value={apptDate} onChange={(e) => setApptDate(e.target.value)} />
          </Field>
          <Field label="Appointment Location">
            <Input value={apptLoc} onChange={(e) => setApptLoc(e.target.value)} />
          </Field>
        </div>
        <div className="rounded-lg border bg-secondary/30 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Revenue (₹)</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Agreement"><Input type="number" value={agreementCharges} onChange={(e) => setAgreementCharges(e.target.value)} /></Field>
            <Field label="Registration"><Input type="number" value={registrationCharges} onChange={(e) => setRegistrationCharges(e.target.value)} /></Field>
            <Field label="Service"><Input type="number" value={serviceCharges} onChange={(e) => setServiceCharges(e.target.value)} /></Field>
            <Field label="Other"><Input type="number" value={otherCharges} onChange={(e) => setOtherCharges(e.target.value)} /></Field>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Field label="Received"><Input type="number" value={paymentReceived} onChange={(e) => setPaymentReceived(e.target.value)} /></Field>
            <Field label="Method"><Input value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} /></Field>
            <Field label="Status">
              <Select value={payStatus} onValueChange={(v: any) => setPayStatus(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <p className="mt-2 text-sm">Total: <span className="font-semibold">{INR(total)}</span> · Balance: <span className={balance > 0 ? "text-destructive font-semibold" : "text-success font-semibold"}>{INR(balance)}</span></p>
        </div>
        <Field label="Customer-visible notes">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Field label="Upload Agreement PDF">
          <div className="flex items-center gap-2">
            <Input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {customer.agreement_pdf_path && !file && (
              <span className="text-xs text-muted-foreground">
                <Upload className="mr-1 inline h-3 w-3" />
                Already uploaded
              </span>
            )}
          </div>
        </Field>

        <div className="rounded-lg border bg-secondary/30 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <StickyNote className="h-3 w-3" /> Internal notes (staff-only)
          </p>
          <div className="flex gap-2">
            <Input placeholder="Add a private note..." value={newNote} onChange={(e) => setNewNote(e.target.value)} />
            <Button
              size="sm"
              onClick={async () => {
                if (!newNote.trim()) return;
                try {
                  await addNoteFn({ data: { customerId: customer.id, text: newNote } });
                  setNewNote("");
                  await loadNotes();
                } catch (e: any) {
                  toast.error(e.message);
                }
              }}
            >
              Add
            </Button>
          </div>
          <div className="mt-2 space-y-1">
            {internalNotes.map((n) => (
              <div key={n.id} className="flex items-start justify-between rounded bg-card px-2 py-1.5 text-sm">
                <div>
                  <p>{n.note_text}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString("en-IN")}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    try {
                      await deleteNoteFn({ data: { id: n.id } });
                      await loadNotes();
                    } catch (e: any) {
                      toast.error(e.message);
                    }
                  }}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy} className="bg-navy-gradient text-primary-foreground">
          {busy ? "Saving..." : "Save changes"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function StaffFormDialog({ onSubmit }: { onSubmit: (values: any) => Promise<void> }) {
  const [values, setValues] = useState({
    fullName: "",
    designation: "Field Executive",
    mobileNumber: "",
    email: "",
    password: "",
    profilePhotoUrl: "",
  });
  const [busy, setBusy] = useState(false);

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>Add Staff Member</DialogTitle></DialogHeader>
      <div className="grid gap-3">
        <Field label="Full Name"><Input value={values.fullName} onChange={(e) => setValues({ ...values, fullName: e.target.value })} /></Field>
        <Field label="Designation"><Input value={values.designation} onChange={(e) => setValues({ ...values, designation: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mobile"><Input value={values.mobileNumber} onChange={(e) => setValues({ ...values, mobileNumber: e.target.value })} /></Field>
          <Field label="Email (login)"><Input type="email" value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} /></Field>
        </div>
        <Field label="Password (min 6 chars)">
          <Input type="text" value={values.password} onChange={(e) => setValues({ ...values, password: e.target.value })} />
        </Field>
        <Field label="Profile Photo URL (optional)">
          <Input value={values.profilePhotoUrl} onChange={(e) => setValues({ ...values, profilePhotoUrl: e.target.value })} />
        </Field>
      </div>
      <DialogFooter>
        <Button
          disabled={busy || !values.fullName || !values.email || values.password.length < 6}
          onClick={async () => {
            setBusy(true);
            await onSubmit({
              fullName: values.fullName,
              designation: values.designation,
              mobileNumber: values.mobileNumber,
              email: values.email,
              password: values.password,
              profilePhotoUrl: values.profilePhotoUrl || null,
            });
            setBusy(false);
          }}
          className="bg-navy-gradient text-primary-foreground"
        >
          {busy ? "Adding..." : "Add staff"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function StaffEditDialog({
  staff,
  onClose,
  onSaved,
  updateFn,
}: {
  staff: Staff;
  onClose: () => void;
  onSaved: () => void;
  updateFn: ReturnType<typeof useServerFn<typeof updateStaff>>;
}) {
  const [fullName, setFullName] = useState(staff.full_name);
  const [designation, setDesignation] = useState(staff.designation);
  const [mobile, setMobile] = useState(staff.mobile_number);
  const [photo, setPhoto] = useState(staff.profile_photo_url ?? "");
  const [active, setActive] = useState(staff.is_active);
  const [busy, setBusy] = useState(false);

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>Edit {staff.full_name}</DialogTitle></DialogHeader>
      <div className="grid gap-3">
        <Field label="Full Name"><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></Field>
        <Field label="Designation"><Input value={designation} onChange={(e) => setDesignation(e.target.value)} /></Field>
        <Field label="Mobile"><Input value={mobile} onChange={(e) => setMobile(e.target.value)} /></Field>
        <Field label="Profile Photo URL"><Input value={photo} onChange={(e) => setPhoto(e.target.value)} /></Field>
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <Switch checked={active} onCheckedChange={setActive} />
          <Label>Active</Label>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await updateFn({
                data: {
                  id: staff.id,
                  patch: {
                    full_name: fullName,
                    designation,
                    mobile_number: mobile,
                    profile_photo_url: photo || null,
                    is_active: active,
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
          }}
          className="bg-navy-gradient text-primary-foreground"
        >
          {busy ? "Saving..." : "Save"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function StaffPasswordDialog({
  staff,
  onClose,
  resetFn,
}: {
  staff: Staff;
  onClose: () => void;
  resetFn: ReturnType<typeof useServerFn<typeof resetStaffPassword>>;
}) {
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>Reset password · {staff.full_name}</DialogTitle></DialogHeader>
      <Field label="New password (min 6 chars)">
        <Input type="text" value={pwd} onChange={(e) => setPwd(e.target.value)} />
      </Field>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button
          disabled={busy || pwd.length < 6}
          onClick={async () => {
            setBusy(true);
            try {
              await resetFn({ data: { id: staff.id, password: pwd } });
              toast.success("Password updated");
              onClose();
            } catch (e: any) {
              toast.error(e.message);
            } finally {
              setBusy(false);
            }
          }}
          className="bg-navy-gradient text-primary-foreground"
        >
          {busy ? "Saving..." : "Update password"}
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
