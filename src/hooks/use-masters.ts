import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { FieldConfig } from "@/lib/permissions";

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
  const [nocStatuses, setNocStatuses] = useState<MasterItem[]>([]);
  const [roles, setRoles] = useState<MasterRole[]>([]);
  const [fields, setFields] = useState<FieldConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [p, s, n, r, f] = await Promise.all([
      supabase.from("master_pending_reasons").select("*").order("sort_order").order("label"),
      supabase.from("master_workflow_statuses").select("*").order("sort_order").order("label"),
      supabase.from("master_verification_statuses").select("*").order("sort_order").order("label"),
      supabase.from("master_roles").select("*").order("sort_order").order("name"),
      supabase.from("field_configs").select("*").order("sort_order"),
    ]);
    setPendingReasons((p.data as MasterItem[]) ?? []);
    setStatuses((s.data as MasterItem[]) ?? []);
    setNocStatuses((n.data as MasterItem[]) ?? []);
    setRoles((r.data as MasterRole[]) ?? []);
    setFields(
      ((f.data as any[]) ?? []).map((x) => ({
        ...x,
        options: Array.isArray(x.options) ? x.options : [],
      })) as FieldConfig[],
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
    const handler = () => reload();
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, [reload]);

  return { pendingReasons, statuses, nocStatuses, roles, fields, loading, reload };
}
