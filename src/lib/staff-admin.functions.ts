import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_any_role", {
    _user_id: ctx.userId,
    _roles: ["admin", "owner", "manager"],
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: Owner / Manager / Admin only");
}

const BASE_ROLES = ["admin", "owner", "manager", "staff", "verification_partner", "viewer"] as const;

const StaffInput = z.object({
  userId: z.string().trim().uuid("User ID must be a valid user ID from the login system"),
  fullName: z.string().trim().min(2, "Name is required"),
  designation: z.string().trim().optional().default(""),
  mobileNumber: z.string().trim().optional().default(""),
  roleName: z.string().optional().nullable(),
  baseRole: z.enum(BASE_ROLES).default("staff"),
  isActive: z.boolean().default(true),
});

async function setBaseRole(admin: any, userId: string, baseRole: string) {
  const { data: existing } = await admin.from("user_roles").select("role").eq("user_id", userId);
  const roles = (existing ?? []).map((r: any) => r.role);
  // Never downgrade an Owner/Admin account from here.
  if (roles.includes("owner") || roles.includes("admin")) return;
  const { error: dErr } = await admin.from("user_roles").delete().eq("user_id", userId);
  if (dErr) throw new Error(dErr.message);
  const { error } = await admin.from("user_roles").insert({ user_id: userId, role: baseRole });
  if (error) throw new Error(error.message);
}

export const createStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.input<typeof StaffInput>) => StaffInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: found, error: uErr } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (uErr || !found?.user) throw new Error("This User ID does not exist in the login system.");
    const authUser = found.user;

    const { data: dup } = await supabaseAdmin.from("staff").select("id").eq("user_id", data.userId).maybeSingle();
    if (dup) throw new Error("A staff member with this User ID already exists.");

    const { data: row, error: sErr } = await supabaseAdmin
      .from("staff")
      .insert({
        user_id: data.userId,
        full_name: data.fullName,
        designation: data.designation || "—",
        mobile_number: data.mobileNumber || "—",
        email: authUser.email ?? `${data.userId}@users.local`,
        role_name: data.roleName ?? null,
        is_active: data.isActive,
        joining_date: new Date().toISOString().slice(0, 10),
      })
      .select("*")
      .single();
    if (sErr) throw new Error(sErr.message);

    try {
      await setBaseRole(supabaseAdmin, data.userId, data.baseRole);
    } catch (e) {
      await supabaseAdmin.from("staff").delete().eq("id", row.id);
      throw e;
    }
    return row;
  });

const StaffPatch = z.object({
  userId: z.string().uuid(),
  baseRole: z.enum(BASE_ROLES).optional(),
  patch: z.object({
    full_name: z.string().trim().min(2).optional(),
    designation: z.string().optional(),
    mobile_number: z.string().optional(),
    profile_photo_url: z.string().url().nullable().optional(),
    is_active: z.boolean().optional(),
    role_name: z.string().nullable().optional(),
  }),
});

export const updateStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof StaffPatch>) => StaffPatch.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("staff")
      .update(data.patch)
      .eq("user_id", data.userId)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("No staff member found for this User ID.");
    if (data.baseRole) await setBaseRole(supabaseAdmin, data.userId, data.baseRole);
    return row;
  });

export const resetStaffPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; password: string }) =>
    z.object({ id: z.string().uuid(), password: z.string().min(6) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s } = await supabaseAdmin.from("staff").select("user_id").eq("id", data.id).maybeSingle();
    if (!s?.user_id) throw new Error("Staff login not linked");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(s.user_id, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s } = await supabaseAdmin.from("staff").select("user_id").eq("id", data.id).maybeSingle();
    if (!s) throw new Error("Staff member not found.");
    const { error } = await supabaseAdmin.from("staff").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    if (s.user_id) {
      const { data: r } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", s.user_id);
      const roles = (r ?? []).map((x: any) => x.role);
      if (!roles.includes("owner") && !roles.includes("admin")) {
        await supabaseAdmin.from("user_roles").delete().eq("user_id", s.user_id);
      }
    }
    return { ok: true };
  });
