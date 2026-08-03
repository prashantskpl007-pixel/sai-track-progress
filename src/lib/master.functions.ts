import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MASTER_TABLES = {
  pending: "master_pending_reasons",
  status: "master_workflow_statuses",
  noc: "master_verification_statuses",
  role: "master_roles",
} as const;

type MasterKind = keyof typeof MASTER_TABLES;

async function assertMasterAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_permission", {
    _user_id: ctx.userId,
    _module: "master",
    _action: "edit",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: you do not have permission to change master data");
}

async function assertOwner(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_any_role", {
    _user_id: ctx.userId,
    _roles: ["admin", "owner"],
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: Owner only");
}

const UpsertInput = z.object({
  kind: z.enum(["pending", "status", "noc", "role"]),
  id: z.string().uuid().optional().nullable(),
  label: z.string().trim().min(1).max(120),
  description: z.string().trim().max(300).optional().nullable(),
  baseRole: z
    .enum(["admin", "owner", "manager", "staff", "verification_partner", "viewer"])
    .optional()
    .nullable(),
  sortOrder: z.number().int().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const upsertMasterItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof UpsertInput>) => UpsertInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertMasterAdmin(context);
    const table = MASTER_TABLES[data.kind as MasterKind];
    const payload: Record<string, unknown> =
      data.kind === "role"
        ? {
            name: data.label,
            description: data.description ?? null,
            base_role: data.baseRole ?? "staff",
          }
        : { label: data.label };
    if (data.sortOrder != null) payload["sort_order"] = data.sortOrder;
    if (data.isActive != null) payload["is_active"] = data.isActive;

    const q = data.id
      ? (context.supabase.from(table) as any).update(payload).eq("id", data.id)
      : (context.supabase.from(table) as any).insert(payload);

    const { data: row, error } = await q.select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteMasterItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { kind: MasterKind; id: string }) =>
    z.object({ kind: z.enum(["pending", "status", "noc", "role"]), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertMasterAdmin(context);
    const table = MASTER_TABLES[data.kind as MasterKind];
    const { error } = await context.supabase.from(table).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Registration & workflow field configuration ---------------- */

const FieldInput = z.object({
  id: z.string().uuid().optional().nullable(),
  fieldKey: z.string().trim().min(1).max(60).optional().nullable(),
  label: z.string().trim().min(1).max(120),
  fieldType: z.string().trim().min(1).max(30),
  options: z.array(z.string()).optional(),
  isEnabled: z.boolean().optional(),
  isRequired: z.boolean().optional(),
  showInRegistration: z.boolean().optional(),
  showInWorkflow: z.boolean().optional(),
  sortOrder: z.number().int().optional().nullable(),
});

export const upsertFieldConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof FieldInput>) => FieldInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const payload: Record<string, unknown> = {
      label: data.label,
      field_type: data.fieldType,
      options: data.options ?? [],
    };
    if (data.isEnabled != null) payload["is_enabled"] = data.isEnabled;
    if (data.isRequired != null) payload["is_required"] = data.isRequired;
    if (data.showInRegistration != null) payload["show_in_registration"] = data.showInRegistration;
    if (data.showInWorkflow != null) payload["show_in_workflow"] = data.showInWorkflow;
    if (data.sortOrder != null) payload["sort_order"] = data.sortOrder;

    if (data.id) {
      const { data: row, error } = await (context.supabase.from("field_configs") as any)
        .update(payload)
        .eq("id", data.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return row;
    }

    const key =
      (data.fieldKey ?? data.label)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "") || `field_${Date.now()}`;
    const { count } = await context.supabase
      .from("field_configs")
      .select("*", { count: "exact", head: true });
    payload["field_key"] = key;
    payload["is_system"] = false;
    if (data.sortOrder == null) payload["sort_order"] = (count ?? 0) + 1;

    const { data: row, error } = await (context.supabase.from("field_configs") as any)
      .insert(payload)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteFieldConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { data: row } = await context.supabase
      .from("field_configs")
      .select("is_system, label")
      .eq("id", data.id)
      .single();
    if ((row as any)?.is_system) {
      throw new Error(`"${(row as any).label}" is a system field and cannot be deleted.`);
    }
    const { error } = await context.supabase.from("field_configs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderFieldConfigs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ids: string[] }) =>
    z.object({ ids: z.array(z.string().uuid()).min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    for (let i = 0; i < data.ids.length; i++) {
      await (context.supabase.from("field_configs") as any)
        .update({ sort_order: i + 1 })
        .eq("id", data.ids[i]);
    }
    return { ok: true };
  });

/* ---------------- Role permissions ---------------- */

const PermInput = z.object({
  roleName: z.string().trim().min(1),
  rows: z.array(
    z.object({
      module: z.string().min(1),
      can_view: z.boolean(),
      can_add: z.boolean(),
      can_edit: z.boolean(),
      can_delete: z.boolean(),
      can_export: z.boolean(),
      menu_visible: z.boolean(),
    }),
  ),
});

export const saveRolePermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof PermInput>) => PermInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const rows = data.rows.map((r) => ({ ...r, role_name: data.roleName.toLowerCase() }));
    const { error } = await (context.supabase.from("role_permissions") as any).upsert(rows, {
      onConflict: "role_name,module",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
