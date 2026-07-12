import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CustomerInput = z.object({
  customerName: z.string().min(2),
  mobileNumber: z.string().min(6),
  agreementType: z.string().min(2),
  propertyAddress: z.string().optional().nullable(),
  appointmentDate: z.string().optional().nullable(),
  appointmentLocation: z.string().optional().nullable(),
  paymentStatus: z.enum(["pending", "partial", "paid"]).default("pending"),
  paymentAmount: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

function customerEmail(appNumber: string) {
  return `${appNumber.trim().toLowerCase()}@customer.sai-enterprise.local`;
}

/** Generate next SE#### application number by scanning existing rows. */
async function nextApplicationNumber(supabase: any): Promise<string> {
  const { data } = await supabase
    .from("customers")
    .select("application_number")
    .like("application_number", "SE%")
    .order("application_number", { ascending: false })
    .limit(1);
  const last = data?.[0]?.application_number as string | undefined;
  const n = last ? parseInt(last.replace("SE", ""), 10) : 0;
  const next = Number.isFinite(n) ? n + 1 : 1;
  return `SE${String(next).padStart(4, "0")}`;
}

export const createCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof CustomerInput>) => CustomerInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const applicationNumber = await nextApplicationNumber(context.supabase);
    const email = customerEmail(applicationNumber);
    const password = data.mobileNumber.replace(/\s+/g, "");

    // Create auth user (email pre-confirmed so customer can sign in immediately)
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { customer_name: data.customerName, application_number: applicationNumber },
    });
    if (createErr) throw new Error(`Auth create failed: ${createErr.message}`);
    const authUserId = created.user!.id;

    // Grant customer role
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: authUserId, role: "customer" });
    if (roleErr) throw new Error(roleErr.message);

    // Insert customer row
    const { data: row, error: insErr } = await supabaseAdmin
      .from("customers")
      .insert({
        user_id: authUserId,
        customer_name: data.customerName,
        mobile_number: data.mobileNumber,
        application_number: applicationNumber,
        agreement_type: data.agreementType,
        property_address: data.propertyAddress ?? null,
        appointment_date: data.appointmentDate ?? null,
        appointment_location: data.appointmentLocation ?? null,
        payment_status: data.paymentStatus,
        payment_amount: data.paymentAmount ?? null,
        notes: data.notes ?? null,
      })
      .select("*")
      .single();
    if (insErr) {
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
      throw new Error(insErr.message);
    }
    return row;
  });

const UpdateInput = z.object({
  id: z.string().uuid(),
  patch: z.object({
    customer_name: z.string().optional(),
    mobile_number: z.string().optional(),
    agreement_type: z.string().optional(),
    property_address: z.string().nullable().optional(),
    current_status: z
      .enum([
        "application_created",
        "documents_received",
        "draft_prepared",
        "appointment_scheduled",
        "biometric_completed",
        "registration_submitted",
        "registration_completed",
        "agreement_ready",
      ])
      .optional(),
    appointment_date: z.string().nullable().optional(),
    appointment_location: z.string().nullable().optional(),
    payment_status: z.enum(["pending", "partial", "paid"]).optional(),
    payment_amount: z.number().nullable().optional(),
    agreement_pdf_path: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  }),
});

export const updateCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof UpdateInput>) => UpdateInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row, error } = await context.supabase
      .from("customers")
      .update(data.patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: c } = await context.supabase
      .from("customers")
      .select("user_id")
      .eq("id", data.id)
      .single();
    await context.supabase.from("customers").delete().eq("id", data.id);
    if (c?.user_id) {
      await supabaseAdmin.auth.admin.deleteUser(c.user_id);
    }
    return { ok: true };
  });

export const claimFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("claim_first_admin", {
      _user_id: context.userId,
    });
    if (error) throw new Error(error.message);
    return { claimed: Boolean(data) };
  });

/** Seed 3 demo customers on first setup. Only works if the caller is admin. */
export const seedDemoCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count } = await supabaseAdmin
      .from("customers")
      .select("*", { count: "exact", head: true });
    if ((count ?? 0) > 0) return { skipped: true, message: "Customers already exist" };

    const samples = [
      {
        name: "Rahul Sharma",
        mobile: "9876543210",
        type: "Rent Agreement (Leave & License)",
        address: "Flat 302, Sai Residency, Kalyan West, Maharashtra",
        status: "documents_received",
      },
      {
        name: "Priya Patel",
        mobile: "9123456780",
        type: "Sale Deed",
        address: "Plot 14, Golden Nest Society, Dombivli East, Maharashtra",
        status: "appointment_scheduled",
      },
      {
        name: "Amit Desai",
        mobile: "9988776655",
        type: "Power of Attorney",
        address: "B-701, Vrindavan Complex, Thane, Maharashtra",
        status: "agreement_ready",
      },
    ] as const;

    let n = 1;
    for (const s of samples) {
      const applicationNumber = `SE${String(n++).padStart(4, "0")}`;
      const email = `${applicationNumber.toLowerCase()}@customer.sai-enterprise.local`;
      const { data: u, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: s.mobile,
        email_confirm: true,
      });
      if (error) continue;
      const uid = u.user!.id;
      await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: "customer" });
      await supabaseAdmin.from("customers").insert({
        user_id: uid,
        customer_name: s.name,
        mobile_number: s.mobile,
        application_number: applicationNumber,
        agreement_type: s.type,
        property_address: s.address,
        current_status: s.status,
        appointment_date:
          s.status === "appointment_scheduled"
            ? new Date(Date.now() + 3 * 86400000).toISOString()
            : null,
        appointment_location:
          s.status === "appointment_scheduled" ? "Sub-Registrar Office, Kalyan" : null,
        payment_status: s.status === "agreement_ready" ? "paid" : "partial",
        payment_amount: 4500,
      });
    }
    return { seeded: 3 };
  });
