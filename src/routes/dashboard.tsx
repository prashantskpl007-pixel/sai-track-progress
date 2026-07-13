import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  FileCheck,
  LogOut,
  Phone,
  MapPin,
  Calendar,
  Download,
  CheckCircle2,
  Circle,
  Loader2,
  IndianRupee,
  Bell,
  UserCircle2,
  ArrowLeftRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { STATUS_STEPS, statusIndex, type RegistrationStatus } from "@/lib/status";
import { toast } from "sonner";
import { WhatsAppFloatingButton } from "@/components/WhatsAppButton";
import { findApplicationsByMobile, signInCustomer, type MobileApplication } from "@/lib/auth-helpers";
import { markAgreementDownloaded } from "@/lib/customer-admin.functions";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [{ title: "My Registration — Sai Enterprise" }, { name: "robots", content: "noindex" }],
  }),
  component: Dashboard,
});

type Customer = {
  id: string;
  customer_name: string;
  application_number: string;
  agreement_type: string;
  property_address: string | null;
  registration_date: string;
  current_status: RegistrationStatus;
  appointment_date: string | null;
  appointment_location: string | null;
  payment_status: "pending" | "partial" | "paid";
  payment_amount: number | null;
  total_amount: number | null;
  payment_received: number | null;
  balance_amount: number | null;
  agreement_pdf_path: string | null;
  support_number: string | null;
  mobile_number: string;
  assigned_staff_id: string | null;
};

type Notification = {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

type HandledBy = {
  full_name: string;
  designation: string;
  mobile_number: string;
  profile_photo_url: string | null;
};

function Dashboard() {
  const navigate = useNavigate();
  const { session, loading, isAdmin, isStaff } = useSession();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [handledBy, setHandledBy] = useState<HandledBy | null>(null);
  const [siblings, setSiblings] = useState<MobileApplication[]>([]);
  const [busy, setBusy] = useState(true);
  const markDownloaded = useServerFn(markAgreementDownloaded);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/auth" });
      return;
    }
    if (isAdmin || isStaff) {
      navigate({ to: "/admin" });
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (error) toast.error(error.message);
      const c = data as Customer | null;
      setCustomer(c);
      if (c) {
        const [n, hb, sib] = await Promise.all([
          supabase
            .from("notifications")
            .select("*")
            .eq("customer_id", c.id)
            .order("created_at", { ascending: false })
            .limit(20),
          supabase.rpc("get_handled_by", { _customer_id: c.id }).maybeSingle(),
          findApplicationsByMobile(c.mobile_number).catch(() => []),
        ]);
        setNotifs((n.data ?? []) as Notification[]);
        setHandledBy((hb.data as HandledBy | null) ?? null);
        setSiblings(sib.filter((a) => a.application_number !== c.application_number));
      }
      setBusy(false);
    })();
  }, [session, loading, isAdmin, isStaff, navigate]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  async function switchApp(appNum: string) {
    if (!customer) return;
    await supabase.auth.signOut();
    const { error } = await signInCustomer(appNum, customer.mobile_number);
    if (error) toast.error("Could not switch application");
    else window.location.reload();
  }

  async function downloadAgreement() {
    if (!customer?.agreement_pdf_path) return;
    const { data, error } = await supabase.storage
      .from("agreements")
      .createSignedUrl(customer.agreement_pdf_path, 300);
    if (error || !data) return toast.error("Could not open agreement");
    window.open(data.signedUrl, "_blank");
    try {
      await markDownloaded({ data: { customerId: customer.id } });
    } catch {
      /* non-fatal */
    }
  }

  async function markAllRead() {
    if (!customer) return;
    const unread = notifs.filter((n) => !n.is_read).map((n) => n.id);
    if (unread.length === 0) return;
    await supabase.from("notifications").update({ is_read: true }).in("id", unread);
    setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  if (loading || busy) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md text-center">
          <h1 className="font-display text-2xl font-bold">Your record is not ready yet</h1>
          <p className="mt-2 text-muted-foreground">
            Please contact Sai Enterprise to complete your registration setup.
          </p>
          <Button onClick={signOut} variant="outline" className="mt-6">
            Sign out
          </Button>
        </div>
        <WhatsAppFloatingButton mobile={session?.user.email ?? undefined} />
      </div>
    );
  }

  const currentIdx = statusIndex(customer.current_status);
  const support = customer.support_number ?? "+919702279566";
  const unreadCount = notifs.filter((n) => !n.is_read).length;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-navy-gradient text-primary-foreground">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold-gradient">
              <FileCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-gold">Sai Enterprise</p>
              <p className="font-display text-base font-semibold leading-tight">
                Welcome, {customer.customer_name.split(" ")[0]}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="text-primary-foreground hover:bg-white/10"
            onClick={signOut}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {siblings.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border bg-secondary p-3">
            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Your other applications:</span>
            {siblings.map((s) => (
              <button
                key={s.application_number}
                onClick={() => switchApp(s.application_number)}
                className="rounded-md bg-card px-2 py-1 font-mono text-xs font-semibold shadow-sm hover:bg-muted"
              >
                {s.application_number}
              </button>
            ))}
          </div>
        )}

        {/* Summary card */}
        <div className="rounded-2xl border bg-card p-6 shadow-elegant">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Application Number
              </p>
              <p className="font-display text-3xl font-bold">{customer.application_number}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Registration date: {new Date(customer.registration_date).toLocaleDateString("en-IN")}
              </p>
            </div>
            <Badge className="bg-gold-gradient text-gold-foreground">{customer.agreement_type}</Badge>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InfoRow label="Customer">{customer.customer_name}</InfoRow>
            <InfoRow label="Mobile">{customer.mobile_number}</InfoRow>
            <InfoRow label="Property">
              {customer.property_address ?? <span className="text-muted-foreground">—</span>}
            </InfoRow>
            <InfoRow label="Total / Received / Balance">
              <span className="inline-flex items-center gap-1">
                <IndianRupee className="h-3.5 w-3.5" />
                {customer.total_amount ?? 0} · {customer.payment_received ?? 0} ·{" "}
                <span className={customer.balance_amount ? "text-destructive" : "text-success"}>
                  {customer.balance_amount ?? 0}
                </span>
              </span>
            </InfoRow>
            <InfoRow label="Appointment">
              {customer.appointment_date ? (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(customer.appointment_date).toLocaleString("en-IN")}
                </span>
              ) : (
                <span className="text-muted-foreground">Not scheduled yet</span>
              )}
            </InfoRow>
            <InfoRow label="Appointment location">
              {customer.appointment_location ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {customer.appointment_location}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </InfoRow>
          </div>

          {customer.agreement_pdf_path && (
            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                onClick={downloadAgreement}
                className="bg-gold-gradient text-gold-foreground shadow-gold"
                size="lg"
              >
                <Download className="mr-2 h-4 w-4" /> Download Agreement PDF
              </Button>
            </div>
          )}
        </div>

        {/* Handled By */}
        {handledBy && (
          <section className="mt-6 rounded-2xl border bg-card p-5 shadow-elegant">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Handled By</p>
            <div className="mt-2 flex items-center gap-4">
              {handledBy.profile_photo_url ? (
                <img
                  src={handledBy.profile_photo_url}
                  alt={handledBy.full_name}
                  className="h-14 w-14 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-navy-gradient text-primary-foreground">
                  <UserCircle2 className="h-8 w-8" />
                </div>
              )}
              <div className="flex-1">
                <p className="font-display text-lg font-semibold">{handledBy.full_name}</p>
                <p className="text-sm text-muted-foreground">{handledBy.designation}</p>
                <a
                  href={`tel:${handledBy.mobile_number}`}
                  className="mt-1 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <Phone className="h-3.5 w-3.5" /> {handledBy.mobile_number}
                </a>
              </div>
            </div>
          </section>
        )}

        {/* Notifications */}
        <section className="mt-6 rounded-2xl border bg-card p-6 shadow-elegant">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-gold" />
              <h2 className="font-display text-xl font-bold">Notifications</h2>
              {unreadCount > 0 && (
                <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold text-destructive-foreground">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <Button size="sm" variant="ghost" onClick={markAllRead}>
                Mark all read
              </Button>
            )}
          </div>
          {notifs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            <ul className="space-y-3">
              {notifs.map((n) => (
                <li
                  key={n.id}
                  className={`rounded-lg border p-3 ${n.is_read ? "bg-background" : "bg-secondary"}`}
                >
                  <p className="font-semibold">{n.title}</p>
                  <p className="text-sm text-muted-foreground">{n.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(n.created_at).toLocaleString("en-IN")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Progress timeline */}
        <section className="mt-8 rounded-2xl border bg-card p-6 shadow-elegant">
          <h2 className="font-display text-xl font-bold">Registration progress</h2>
          <p className="text-sm text-muted-foreground">
            Follow every step, from application to final agreement.
          </p>
          <ol className="mt-6 space-y-4">
            {STATUS_STEPS.map((step, i) => {
              const done = i < currentIdx;
              const active = i === currentIdx;
              return (
                <li key={step.key} className="flex gap-4">
                  <div className="mt-0.5">
                    {done ? (
                      <CheckCircle2 className="h-6 w-6 text-success" />
                    ) : active ? (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gold-gradient shadow-gold">
                        <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                      </div>
                    ) : (
                      <Circle className="h-6 w-6 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className={active ? "" : done ? "opacity-90" : "opacity-50"}>
                    <p className="font-semibold">{step.label}</p>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Support */}
        <section className="mt-8 rounded-2xl border bg-secondary p-6">
          <h2 className="font-display text-xl font-bold">Need help?</h2>
          <p className="text-sm text-muted-foreground">
            Our team in Kalyan is happy to assist you.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href={`tel:${support}`}>
              <Button variant="outline">
                <Phone className="mr-2 h-4 w-4" /> Call {support}
              </Button>
            </a>
          </div>
        </section>
      </main>

      <WhatsAppFloatingButton
        applicationNumber={customer.application_number}
        customerName={customer.customer_name}
        mobile={customer.mobile_number}
      />
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{children}</p>
    </div>
  );
}
