import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { FieldConfig, FieldOption } from "@/lib/field-config";

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
  const [roles, setRoles] = useState<MasterRole[]>([]);
  const [allFields, setAllFields] = useState<FieldConfig[]>([]);
  const [options, setOptions] = useState<FieldOption[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [r, f, o] = await Promise.all([
      supabase.from("master_roles").select("*").order("sort_order").order("name"),
      supabase.from("field_configs").select("*").order("sort_order"),
      (supabase.from("field_options" as any) as any).select("*").order("sort_order"),
    ]);
    setRoles((r.data as MasterRole[]) ?? []);
    setAllFields(
      ((f.data as any[]) ?? []).map((x) => ({
        ...x,
        module: x.module ?? "workflow",
        options: Array.isArray(x.options) ? x.options : [],
      })) as FieldConfig[],
    );
    setOptions((o.data as FieldOption[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
    const handler = () => reload();
    window.addEventListener(EVENT, handler);

    // Live sync — configuration changes appear everywhere without a refresh.
    // Channel names must be unique per subscriber; a shared name makes the
    // second mount attach callbacks to an already-subscribed channel and throw.
    const channel = supabase
      .channel(`field-config-sync-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "field_configs" }, handler)
      .on("postgres_changes", { event: "*", schema: "public", table: "field_options" }, handler)
      .subscribe();

    return () => {
      window.removeEventListener(EVENT, handler);
      supabase.removeChannel(channel);
    };
  }, [reload]);

  /** Workflow/registration fields — the default module. */
  const fields = allFields.filter((f) => (f.module ?? "workflow") === "workflow");
  const enquiryFields = allFields.filter((f) => f.module === "enquiry");

  const fieldsFor = useCallback(
    (module: string) => allFields.filter((f) => (f.module ?? "workflow") === module),
    [allFields],
  );

  /** Active choices for a field, plus any historical value so old records stay readable. */
  const optionsFor = useCallback(
    (
      fieldKey: string,
      includeValues: (string | null | undefined)[] = [],
      module: string = "workflow",
    ) => {
      const field = allFields.find(
        (f) => f.field_key === fieldKey && (f.module ?? "workflow") === module,
      );
      const list = field
        ? options
            .filter((o) => o.field_config_id === field.id && o.is_active)
            .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label))
            .map((o) => o.label)
        : [];
      const extras = includeValues.filter(
        (v): v is string => Boolean(v) && !list.includes(v as string),
      );
      return [...list, ...extras];
    },
    [allFields, options],
  );

  const allOptionsFor = useCallback(
    (fieldConfigId: string) =>
      options
        .filter((o) => o.field_config_id === fieldConfigId)
        .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label)),
    [options],
  );

  return {
    roles,
    fields,
    enquiryFields,
    fieldsFor,
    allFields,
    options,
    optionsFor,
    allOptionsFor,
    loading,
    reload,
  };
}

