import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { splitEnquiryValues } from "@/lib/field-config";

async function assertEnquiry(
  ctx: { supabase: any; userId: string },
  action: "view" | "add" | "edit" | "delete",
) {
  const { data, error } = await ctx.supabase.rpc("has_permission", {
    _user_id: ctx.userId,
    _module: "enquiry",
    _action: action,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Forbidden: you do not have permission to ${action} enquiries`);
}

async function actorName(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase
    .from("staff")
    .select("full_name")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  return (data as any)?.full_name ?? null;
}

const ValuesInput = z.object({
  values: z.record(z.string(), z.any()),
});

export const createEnquiry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof ValuesInput>) => ValuesInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertEnquiry(context, "add");
    const { columns, custom } = splitEnquiryValues(data.values);
    if (!columns["client_name"]) throw new Error("Client Name is required");
    const payload = {
      ...columns,
      enquiry_date: columns["enquiry_date"] || new Date().toISOString().slice(0, 10),
      custom_fields: custom,
      created_by: context.userId,
      created_by_name: await actorName(context),
    };
    const { data: row, error } = await (context.supabase.from("enquiries") as any)
      .insert(payload)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const UpdateInput = z.object({
  id: z.string().uuid(),
  values: z.record(z.string(), z.any()),
});

export const updateEnquiry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof UpdateInput>) => UpdateInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertEnquiry(context, "edit");
    const { columns, custom } = splitEnquiryValues(data.values);

    const { data: existing, error: readErr } = await context.supabase
      .from("enquiries")
      .select("custom_fields")
      .eq("id", data.id)
      .single();
    if (readErr) throw new Error(readErr.message);
    const current =
      (existing as any)?.custom_fields && typeof (existing as any).custom_fields === "object"
        ? (existing as any).custom_fields
        : {};

    const { data: row, error } = await (context.supabase.from("enquiries") as any)
      .update({ ...columns, custom_fields: { ...current, ...custom } })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/** Soft delete — the record is hidden but never lost. */
export const softDeleteEnquiry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertEnquiry(context, "delete");
    const { error } = await (context.supabase.from("enquiries") as any)
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: context.userId,
        deleted_by_name: await actorName(context),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
