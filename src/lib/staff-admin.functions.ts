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

/** Resolve a master role name to its access level on the server; never trust the client. */
async function resolveRole(ctx: { supabase: any; userId: string }, admin: any, roleName: string) {
  const { data: role, error } = await admin
    .from("master_roles")
    .select("name, base_role, is_active")
    .ilike("name", roleName.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!role || !role.is_active) throw new Error(`Role "${roleName}" does not exist or is inactive.`);
  if (role.base_role === "owner" || role.base_role === "admin") {
    const { data: isOwner } = await ctx.supabase.rpc("has_any_role", {
      _user_id: ctx.userId,
      _roles: ["admin", "owner"],
    });
    if (!isOwner) throw new Error("Only the Owner can assign the Owner role.");
  }
  return { name: role.name as string, baseRole: role.base_role as string };
}

const BASE_ROLES = ["admin", "owner", "manager", "staff", "verification_partner", "viewer"] as const;

const USER_ID = z
  .string()
  .trim()
  .min(3, "User ID must be at least 3 characters")
  .max(40)
  .regex(/^[A-Za-z0-9._-]+$/, "User ID can only contain letters, numbers, dot, dash and underscore");

const StaffInput = z.object({
  userId: USER_ID,
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().trim().min(2, "Name is required"),
  designation: z.string().trim().optional().default(""),
  mobileNumber: z.string().trim().optional().default(""),
  roleName: z.string().trim().min(1, "Role is required"),
  baseRole: z.enum(BASE_ROLES).optional(),
  isActive: z.boolean().default(true),
});

async function setBaseRole(admin: any, userId: string, baseRole: string) {
  const { data: existing } = await admin.from("user_roles").select("role").eq("user_id", userId);
  const roles = (existing ?? []).map((r: any) => r.role);
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
    const username = data.userId.toLowerCase();
    const role = await resolveRole(context, supabaseAdmin, data.roleName);

    const { data: dup } = await supabaseAdmin.from("staff").select("id").ilike("username", username).maybeSingle();
    if (dup) throw new Error(`User ID "${data.userId}" is already in use.`);

    const loginEmail = `${username}@staff.smartfuturegroup.local`;
    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email: loginEmail,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, user_id: username, staff: true },
    });
    if (cErr || !created.user) throw new Error(cErr?.message ?? "Could not create login");
    const uid = created.user.id;

    const { data: row, error: sErr } = await supabaseAdmin
      .from("staff")
      .insert({
        user_id: uid,
        username,
        full_name: data.fullName,
        designation: data.designation || "—",
        mobile_number: data.mobileNumber || "—",
        email: loginEmail,
        role_name: role.name,
        is_active: data.isActive,
        joining_date: new Date().toISOString().slice(0, 10),
      })
      .select("*")
      .single();
    if (sErr) {
      await supabaseAdmin.auth.admin.deleteUser(uid);
      throw new Error(sErr.message);
    }
    try {
      await setBaseRole(supabaseAdmin, uid, role.baseRole);
    } catch (e) {
      await supabaseAdmin.from("staff").delete().eq("id", row.id);
      await supabaseAdmin.auth.admin.deleteUser(uid);
      throw e;
    }
    return row;
  });

const StaffPatch = z.object({
  userId: z.string().trim().min(1),
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
    const patch = { ...data.patch };
    let baseRole: string | null = null;
    if (patch.role_name) {
      const role = await resolveRole(context, supabaseAdmin, patch.role_name);
      patch.role_name = role.name;
      baseRole = role.baseRole;
    }
    const { data: row, error } = await supabaseAdmin
      .from("staff")
      .update(patch)
      .ilike("username", data.userId)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("No staff member found for this User ID.");
    if (baseRole && row.user_id) await setBaseRole(supabaseAdmin, row.user_id, baseRole);
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
    if (!s?.user_id) throw new Error("This user has no login account linked.");
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
