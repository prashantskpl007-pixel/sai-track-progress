import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { FileCheck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { signInCustomer, signInAdmin, signUpAdmin } from "@/lib/auth-helpers";
import { supabase } from "@/integrations/supabase/client";

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

  // customer form
  const [appNum, setAppNum] = useState("");
  const [mobile, setMobile] = useState("");
  const [loading, setLoading] = useState(false);

  // admin form
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
    const isAdmin = roles?.some((r) => r.role === "admin");
    navigate({ to: isAdmin ? "/admin" : "/dashboard" });
  }

  async function handleCustomerLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await signInCustomer(appNum, mobile);
    setLoading(false);
    if (error) {
      toast.error("Invalid application number or mobile number", {
        description: "Please check the details Sai Enterprise gave you.",
      });
      return;
    }
    toast.success("Welcome back!");
    afterLoginRedirect();
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
      // Try to claim first-admin role (only succeeds if no admin exists yet)
      const { data: session } = await supabase.auth.getSession();
      if (session.session) {
        await supabase.rpc("claim_first_admin", { _user_id: session.session.user.id });
      }
      setLoading(false);
      toast.success("Admin account created", {
        description: "If you are the first admin, your role has been activated automatically.",
      });
      afterLoginRedirect();
    }
  }

  return (
    <div className="min-h-screen bg-navy-gradient">
      <div className="mx-auto max-w-md px-4 py-10">
        <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-primary-foreground/80 hover:text-primary-foreground">
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
              <form className="space-y-4" onSubmit={handleCustomerLogin}>
                <div className="space-y-2">
                  <Label htmlFor="appnum">Application Number</Label>
                  <Input
                    id="appnum"
                    placeholder="e.g. SE0001"
                    value={appNum}
                    onChange={(e) => setAppNum(e.target.value.toUpperCase())}
                    required
                  />
                </div>
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
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-navy-gradient text-primary-foreground shadow-elegant"
                  size="lg"
                >
                  {loading ? "Signing in..." : "Track my application"}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Given by Sai Enterprise at the time of registration.
                </p>
              </form>
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
                  {loading ? "Please wait..." : adminMode === "signin" ? "Sign in as Admin" : "Create admin account"}
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
    </div>
  );
}
