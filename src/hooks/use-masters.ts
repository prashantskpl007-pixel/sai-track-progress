import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type MasterItem = { id: string; label: string; is_active: boolean; sort_order: number };
export type MasterRole = {
  id: string;
  name: string;
  description: string | null;
  base_role: string;
  is_active: boolean;
  sort_order: number;
};

const EVENT = "sai-masters-changed";
export function notifyMastersChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

export function useMasters() {
  const [pendingReasons, setPendingReasons] = useState<MasterItem[]>([]);
  const [statuses, setStatuses] = useState<MasterItem[]>([]);
  const [roles, setRoles] = useState<MasterRole[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [p, s, r] = await Promise.all([
      supabase.from("master_pending_reasons").select("*").order("sort_order").order("label"),
      supabase.from("master_workflow_statuses").select("*").order("sort_order").order("label"),
      supabase.from("master_roles").select("*").order("sort_order").order("name"),
    ]);
    setPendingReasons((p.data as MasterItem[]) ?? []);
    setStatuses((s.data as MasterItem[]) ?? []);
    setRoles((r.data as MasterRole[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
    const handler = () => reload();
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, [reload]);

  return { pendingReasons, statuses, roles, loading, reload };
}
