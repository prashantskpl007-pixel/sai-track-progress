import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  FileCheck,
  LogOut,
  Phone,
  MessageCircle,
  MapPin,
  Calendar,
  Download,
  CheckCircle2,
  Circle,
  Loader2,
  IndianRupee,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { STATUS_STEPS, statusIndex, type RegistrationStatus } from "@/lib/status";
import { toast } from "sonner";

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
  agreement_pdf_path: string | null;
  support_number: string | null;
  mobile_number: string;
};

function Dashboard() {
  const navigate = useNavigate();
  const { session, loading, isAdmin } = useSession();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/auth" });
      return;
    }
    if (isAdmin) {
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
      setCustomer(data as Customer | null);
      setBusy(false);
    })();
  }, [session, loading, isAdmin, navigate]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  async function downloadAgreement() {
    if (!customer?.agreement_pdf_path) return;
    const { data, error } = await supabase.storage
      .from("agreements")
      .createSignedUrl(customer.agreement_pdf_path, 300);
    if (error || !data) return toast.error("Could not open agreement");
    window.open(data.signedUrl, "_blank");
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
      </div>
    );
  }

  const currentIdx = statusIndex(customer.current_status);
  const support = customer.support_number ?? "+919876543210";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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
            <Badge className="bg-gold-gradient text-gold-foreground">
              {customer.agreement_type}
            </Badge>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InfoRow label="Customer">{customer.customer_name}</InfoRow>
            <InfoRow label="Mobile">{customer.mobile_number}</InfoRow>
            <InfoRow label="Property">
              {customer.property_address ?? <span className="text-muted-foreground">—</span>}
            </InfoRow>
            <InfoRow label="Payment">
              <span className="inline-flex items-center gap-1">
                <IndianRupee className="h-3.5 w-3.5" />
                {customer.payment_amount ?? "—"} ·{" "}
                <span
                  className={
                    customer.payment_status === "paid"
                      ? "text-success"
                      : customer.payment_status === "partial"
                        ? "text-gold"
                        : "text-destructive"
                  }
                >
                  {customer.payment_status.toUpperCase()}
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
            <a
              href={`https://wa.me/${support.replace(/[^0-9]/g, "")}`}
              target="_blank"
              rel="noreferrer"
            >
              <Button className="bg-navy-gradient text-primary-foreground">
                <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
              </Button>
            </a>
          </div>
        </section>
      </main>
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
