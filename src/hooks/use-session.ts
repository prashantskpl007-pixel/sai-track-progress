import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "customer" | "staff" | "owner" | "manager" | "verification_partner" | "viewer";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);

  async function loadRoles(userId: string) {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    setRoles((data ?? []).map((r) => r.role as AppRole));
  }

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session) await loadRoles(data.session.user.id);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s);
      if (s) await loadRoles(s.user.id);
      else setRoles([]);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const has = (r: AppRole) => roles.includes(r);
  const isAdmin = has("admin") || has("owner");
  const isManager = has("manager");
  const isStaff = has("staff");
  const isVerificationPartner = has("verification_partner");
  const isViewer = has("viewer");
  const hasBackofficeAccess = isAdmin || isManager || isStaff || isViewer;

  return {
    session,
    loading,
    roles,
    isAdmin,
    isManager,
    isStaff,
    isVerificationPartner,
    isViewer,
    hasBackofficeAccess,
  };
}
