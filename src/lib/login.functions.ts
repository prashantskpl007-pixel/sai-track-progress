import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const LoginInput = z.object({
  userId: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(200),
});

const GENERIC = "Invalid User ID or password.";

/** Staff/Admin sign-in by User ID. Resolves User ID → auth account on the server only. */
export const signInWithUserId = createServerFn({ method: "POST" })
  .inputValidator((d: z.infer<typeof LoginInput>) => LoginInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: staff } = await supabaseAdmin
      .from("staff")
      .select("user_id, is_active")
      .ilike("username", data.userId)
      .maybeSingle();
    if (!staff?.user_id) throw new Error(GENERIC);
    if (!staff.is_active) throw new Error("This account is inactive. Contact the Owner.");

    const { data: u } = await supabaseAdmin.auth.admin.getUserById(staff.user_id);
    const email = u?.user?.email;
    if (!email) throw new Error(GENERIC);

    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const client = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { data: s, error } = await client.auth.signInWithPassword({ email, password: data.password });
    if (error || !s.session) throw new Error(GENERIC);
    return { access_token: s.session.access_token, refresh_token: s.session.refresh_token };
  });
