import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { FileCheck, ArrowLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  signInCustomer,
  signInAdmin,
  signUpAdmin,
  findApplicationsByMobile,
  type MobileApplication,
} from "@/lib/auth-helpers";
import { supabase } from "@/integrations/supabase/client";
import { statusLabel, type RegistrationStatus } from "@/lib/status";
import { WhatsAppFloatingButton } from "@/components/WhatsAppButton";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Sai Enterprise" },
      { name: "description", content: "Sign in to track your agreement registration status." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"customer" | "admin">("customer");
  const [mobile, setMobile] = useState("");
  const [appNum, setAppNum] = useState("");
  const [apps, setApps] = useState<MobileApplication[] | null>(null);
  const [loading, setLoading] = useState(false);

  const [adminMode, setAdminMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  async function afterLoginRedirect() {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.session.user.id);
    const set = new Set((roles ?? []).map((r) => r.role));
    if (set.has("admin") || set.has("owner") || set.has("manager") || set.has("staff") || set.has("viewer")) {
      navigate({ to: "/admin" });
    } else if (set.has("verification_partner")) {
      navigate({ to: "/verification" });
    } else {
      navigate({ to: "/dashboard" });
    }
  }

  async function signInWithApp(applicationNumber: string) {
    setLoading(true);
    const { error } = await signInCustomer(applicationNumber, mobile);
    setLoading(false);
    if (error) {
      toast.error("Login failed", { description: "Please contact Sai Enterprise." });
      return;
    }
    toast.success("Welcome!");
    afterLoginRedirect();
  }

  async function handleCustomerLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!mobile.trim()) return toast.error("Enter your mobile number");
    setLoading(true);
    try {
      if (appNum.trim()) {
        return void (await signInWithApp(appNum.trim()));
      }
      const list = await findApplicationsByMobile(mobile);
      if (list.length === 0) {
        toast.error("No applications found for this mobile number.", {
          description: "Please contact Sai Enterprise.",
        });
      } else if (list.length === 1) {
        await signInWithApp(list[0].application_number);
      } else {
        setApps(list);
      }
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdmin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    if (adminMode === "signin") {
      const { error } = await signInAdmin(email, password);
      setLoading(false);
      if (error) return toast.error(error.message);
      afterLoginRedirect();
    } else {
      const { error } = await signUpAdmin(email, password, name);
      if (error) {
        setLoading(false);
        return toast.error(error.message);
      }
      const { data: session } = await supabase.auth.getSession();
      if (session.session) {
        await supabase.rpc("claim_first_admin", { _user_id: session.session.user.id });
      }
      setLoading(false);
      toast.success("Admin account created");
      afterLoginRedirect();
    }
  }

  return (
    <div className="min-h-screen bg-navy-gradient">
      <div className="mx-auto max-w-md px-4 py-10">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-primary-foreground/80 hover:text-primary-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>

        <div className="rounded-2xl border bg-card p-6 shadow-elegant sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gold-gradient">
              <FileCheck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold">Sai Enterprise</h1>
              <p className="text-xs text-muted-foreground">Sign in to continue</p>
            </div>
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as "customer" | "admin")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="customer">Customer</TabsTrigger>
              <TabsTrigger value="admin">Staff / Admin</TabsTrigger>
            </TabsList>

            <TabsContent value="customer" className="mt-6">
              {apps ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    We found {apps.length} applications linked to this mobile. Choose one:
                  </p>
                  {apps.map((a) => (
                    <button
                      key={a.application_number}
                      onClick={() => signInWithApp(a.application_number)}
                      disabled={loading}
                      className="flex w-full items-center justify-between rounded-xl border bg-card p-3 text-left transition hover:border-gold hover:shadow-elegant"
                    >
                      <div>
                        <p className="font-mono font-semibold">{a.application_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.customer_name} · {a.agreement_type}
                        </p>
                        <p className="text-xs">
                          Status: {statusLabel(a.current_status as RegistrationStatus)}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                  <Button variant="outline" className="w-full" onClick={() => setApps(null)}>
                    Back
                  </Button>
                </div>
              ) : (
                <form className="space-y-4" onSubmit={handleCustomerLogin}>
                  <div className="space-y-2">
                    <Label htmlFor="mobile">Mobile Number</Label>
                    <Input
                      id="mobile"
                      inputMode="numeric"
                      placeholder="10-digit mobile number"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="appnum">Application Number (optional)</Label>
                    <Input
                      id="appnum"
                      placeholder="e.g. SE0001 (leave blank to see all)"
                      value={appNum}
                      onChange={(e) => setAppNum(e.target.value.toUpperCase())}
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-navy-gradient text-primary-foreground shadow-elegant"
                    size="lg"
                  >
                    {loading ? "Searching..." : "Track my application"}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Enter your mobile number to see all your applications.
                  </p>
                </form>
              )}
            </TabsContent>

            <TabsContent value="admin" className="mt-6">
              <form className="space-y-4" onSubmit={handleAdmin}>
                {adminMode === "signup" && (
                  <div className="space-y-2">
                    <Label htmlFor="name">Your Name</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pw">Password</Label>
                  <Input
                    id="pw"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gold-gradient text-gold-foreground shadow-gold"
                  size="lg"
                >
                  {loading
                    ? "Please wait..."
                    : adminMode === "signin"
                      ? "Sign in"
                      : "Create admin account"}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  {adminMode === "signin" ? (
                    <>
                      No account yet?{" "}
                      <button type="button" className="underline" onClick={() => setAdminMode("signup")}>
                        Create one
                      </button>{" "}
                      (first person to sign up becomes admin).
                    </>
                  ) : (
                    <>
                      Already have an account?{" "}
                      <button type="button" className="underline" onClick={() => setAdminMode("signin")}>
                        Sign in
                      </button>
                    </>
                  )}
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <WhatsAppFloatingButton />
    </div>
  );
}
