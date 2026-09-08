import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileCheck, Loader2 } from "lucide-react";
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
      <div className="flex min-h-screen items-center justify-center bg-navy-gradient">
        <Loader2 className="h-6 w-6 animate-spin text-primary-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-gradient px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-elegant">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gold-gradient">
            <FileCheck className="h-7 w-7 text-primary" />
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold">SMART FUTURE GROUP</h1>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Workflow Management
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSignIn}>
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button
            type="submit"
            size="lg"
            disabled={busy}
            className="w-full bg-navy-gradient text-primary-foreground shadow-elegant"
          >
            {busy ? "Signing in..." : "Sign In"}
          </Button>
          <button
            type="button"
            onClick={forgotPassword}
            className="w-full text-center text-xs text-muted-foreground underline"
          >
            Forgot password?
          </button>
        </form>
      </div>
    </div>
  );
}
