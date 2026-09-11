import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileCheck, Loader2, Lock, Mail, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — SMART FUTURE GROUP Workflow" },
      {
        name: "description",
        content:
          "SMART FUTURE GROUP internal workflow management system — sign in to manage registrations, fees and verification.",
      },
      { property: "og:title", content: "SMART FUTURE GROUP Workflow" },
      {
        property: "og:description",
        content: "Internal workflow management for agreement and document registration.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

async function redirectForUser(userId: string, navigate: ReturnType<typeof useNavigate>) {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const set = new Set((roles ?? []).map((r) => r.role));
  if (set.has("verification_partner") && set.size === 1) {
    navigate({ to: "/verification" });
    return;
  }
  navigate({ to: "/admin" });
}

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) redirectForUser(data.session.user.id, navigate);
      else setChecking(false);
    });
  }, []);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error || !data.user) {
      toast.error("Sign in failed", { description: error?.message });
      return;
    }
    toast.success("Welcome back");
    await redirectForUser(data.user.id, navigate);
  }

  async function forgotPassword() {
    if (!email.trim()) return toast.error("Enter your email address first");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return toast.error(error.message);
    toast.success("Password reset link sent to your email");
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-login-glow">
        <Loader2 className="h-6 w-6 animate-spin text-primary-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-login-glow px-4 py-10">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border bg-card p-8 shadow-elegant">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gold-gradient" />

        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-gradient shadow-gold">
            <FileCheck className="h-8 w-8 text-primary" strokeWidth={2.5} />
          </div>
          <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-foreground">
            SMART FUTURE GROUP
          </h1>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Internal Workflow Management System
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSignIn}>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              Email Address
            </Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 w-full rounded-lg border bg-muted/40 pl-10 text-sm transition-colors placeholder:text-muted-foreground/70 hover:bg-muted/60 focus:bg-background focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">
              Password
            </Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 w-full rounded-lg border bg-muted/40 pl-10 pr-10 text-sm transition-colors placeholder:text-muted-foreground/70 hover:bg-muted/60 focus:bg-background focus-visible:ring-1 focus-visible:ring-ring"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground focus:outline-none"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={busy}
            className="h-11 w-full bg-navy-gradient text-sm font-semibold text-primary-foreground shadow-elegant transition-all hover:shadow-gold disabled:opacity-70"
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {busy ? "Signing in..." : "Sign In"}
          </Button>

          <button
            type="button"
            onClick={forgotPassword}
            className="block w-full text-center text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
          >
            Forgot password?
          </button>
        </form>

        <div className="mt-8 border-t pt-5 text-center">
          <p className="font-display text-sm font-semibold text-foreground">Smart Future Group</p>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Internal Workflow Management System
          </p>
        </div>
      </div>
    </div>
  );
}
