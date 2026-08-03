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
    z.object({ kind: z.enum(["pending", "status", "role"]), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertMasterAdmin(context);
    const table = MASTER_TABLES[data.kind as MasterKind];
    const { error } = await context.supabase.from(table).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
