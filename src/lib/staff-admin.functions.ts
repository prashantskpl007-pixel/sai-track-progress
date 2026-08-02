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

const StaffInput = z.object({
  fullName: z.string().min(2),
  designation: z.string().min(2),
  mobileNumber: z.string().min(6),
  email: z.string().email(),
  username: z.string().optional().nullable(),
  password: z.string().min(6),
  roleName: z.string().optional().nullable(),
  baseRole: z
    .enum(["admin", "owner", "manager", "staff", "verification_partner", "viewer"])
    .default("staff"),
  profilePhotoUrl: z.string().url().optional().nullable(),
  joiningDate: z.string().optional().nullable(),
});

export const createStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof StaffInput>) => StaffInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, staff: true },
    });
    if (cErr) throw new Error(cErr.message);
    const uid = created.user!.id;

    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: uid, role: data.baseRole });
    if (rErr) {
      await supabaseAdmin.auth.admin.deleteUser(uid);
      throw new Error(rErr.message);
    }

    const { data: row, error: sErr } = await supabaseAdmin
      .from("staff")
      .insert({
        user_id: uid,
        full_name: data.fullName,
        designation: data.designation,
        mobile_number: data.mobileNumber,
        email: data.email,
        username: data.username ?? null,
        role_name: data.roleName ?? null,
        profile_photo_url: data.profilePhotoUrl ?? null,
        joining_date: data.joiningDate ?? new Date().toISOString().slice(0, 10),
      })
      .select("*")
      .single();
    if (sErr) {
      await supabaseAdmin.auth.admin.deleteUser(uid);
      throw new Error(sErr.message);
    }
    return row;
  });

const StaffPatch = z.object({
  id: z.string().uuid(),
  patch: z.object({
    full_name: z.string().optional(),
    designation: z.string().optional(),
    mobile_number: z.string().optional(),
    email: z.string().email().optional(),
    username: z.string().nullable().optional(),
    profile_photo_url: z.string().url().nullable().optional(),
    joining_date: z.string().optional(),
    is_active: z.boolean().optional(),
    role_name: z.string().nullable().optional(),
  }),
});

export const updateStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof StaffPatch>) => StaffPatch.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row, error } = await context.supabase
      .from("staff")
      .update(data.patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
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
    const { data: s } = await context.supabase.from("staff").select("user_id").eq("id", data.id).single();
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
    const { data: s } = await context.supabase.from("staff").select("user_id").eq("id", data.id).single();
    await supabaseAdmin.from("staff").delete().eq("id", data.id);
    if (s?.user_id) await supabaseAdmin.auth.admin.deleteUser(s.user_id);
    return { ok: true };
  });
