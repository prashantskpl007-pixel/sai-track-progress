import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Change the password of the currently signed-in user. */
export const changeMyPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { password: string }) =>
    z.object({ password: z.string().min(6) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Update the signed-in user's own profile details. */
export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { fullName?: string; mobileNumber?: string; designation?: string }) =>
    z
      .object({
        fullName: z.string().min(2).optional(),
        mobileNumber: z.string().min(6).optional(),
        designation: z.string().min(2).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.fullName) patch["full_name"] = data.fullName;
    if (data.mobileNumber) patch["mobile_number"] = data.mobileNumber;
    if (data.designation) patch["designation"] = data.designation;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await context.supabase
      .from("staff")
      .update(patch)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
