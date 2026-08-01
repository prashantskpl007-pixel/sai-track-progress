import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CustomerInput = z.object({
  customerName: z.string().min(2),
  mobileNumber: z.string().min(6),
  agreementType: z.string().min(2),
  propertyAddress: z.string().optional().nullable(),
  customerEmail: z.string().email().optional().nullable(),
  appointmentDate: z.string().optional().nullable(),
  appointmentTime: z.string().optional().nullable(),
  appointmentLocation: z.string().optional().nullable(),
  paymentStatus: z.enum(["pending", "partial", "paid"]).default("pending"),
  paymentAmount: z.number().optional().nullable(),
  agreementCharges: z.number().optional().nullable(),
  registrationCharges: z.number().optional().nullable(),
  serviceCharges: z.number().optional().nullable(),
  otherCharges: z.number().optional().nullable(),
  paymentReceived: z.number().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  paymentDate: z.string().optional().nullable(),
  // Workflow fields
  registrationDate: z.string().optional().nullable(),
  tokenNumber: z.string().min(1),
  sourceAgent: z.string().optional().nullable(),
  workType: z.string().optional().nullable(),
  registrationHandlingType: z.string().optional().nullable(),
  verificationNocStatus: z.string().optional().nullable(),
  pendingItem: z.string().optional().nullable(),
  currentStatus: z.string().optional().nullable(),
  totalFees: z.number().optional().nullable(),
  // Registration Staff — MANDATORY
  assignedStaffId: z.string().uuid(),
  // Verification Partner — optional
  verificationPartnerUserId: z.string().uuid().optional().nullable(),
  verificationPartnerName: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});


async function assertAdminOrStaff(ctx: { supabase: any; userId: string }) {
  const { data: a } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (a) return "admin";
  const { data: s } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "staff" });
  if (s) return "staff";
  throw new Error("Forbidden");
}

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

function computeTotals(v: z.infer<typeof CustomerInput>) {
  const ac = v.agreementCharges ?? 0;
  const rc = v.registrationCharges ?? 0;
  const sc = v.serviceCharges ?? 0;
  const oc = v.otherCharges ?? 0;
  const sum = ac + rc + sc + oc;
  const total = v.totalFees != null && v.totalFees > 0 ? v.totalFees : sum;
  const received = v.paymentReceived ?? 0;
  return { total, balance: Math.max(0, total - received) };
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

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { customer_name: data.customerName, application_number: applicationNumber },
    });
    if (createErr) throw new Error(`Auth create failed: ${createErr.message}`);
    const authUserId = created.user!.id;

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: authUserId, role: "customer" });
    if (roleErr) throw new Error(roleErr.message);

    const totals = computeTotals(data);
    const { data: row, error: insErr } = await supabaseAdmin
      .from("customers")
      .insert({
        user_id: authUserId,
        customer_name: data.customerName,
        mobile_number: data.mobileNumber,
        customer_email: data.customerEmail ?? null,
        application_number: applicationNumber,
        agreement_type: data.agreementType,
        property_address: data.propertyAddress ?? null,
        appointment_date: data.appointmentDate ?? null,
        appointment_location: data.appointmentLocation ?? null,
        payment_status: data.paymentStatus,
        payment_amount: data.paymentAmount ?? totals.total,
        agreement_charges: data.agreementCharges ?? 0,
        registration_charges: data.registrationCharges ?? 0,
        service_charges: data.serviceCharges ?? 0,
        other_charges: data.otherCharges ?? 0,
        total_amount: totals.total,
        payment_received: data.paymentReceived ?? 0,
        balance_amount: totals.balance,
        payment_method: data.paymentMethod ?? null,
        payment_date: data.paymentDate ?? null,
        assigned_staff_id: data.assignedStaffId,
        verification_partner_user_id: data.verificationPartnerUserId,
        verification_partner_name: data.verificationPartnerName,
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
    customer_email: z.string().nullable().optional(),
    agreement_type: z.string().optional(),
    property_address: z.string().nullable().optional(),
    current_status: z
      .enum([
        "application_created",
        "documents_received",
        "kyc_uploaded",
        "noc_initiated",
        "noc_completed",
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
    agreement_charges: z.number().nullable().optional(),
    registration_charges: z.number().nullable().optional(),
    service_charges: z.number().nullable().optional(),
    other_charges: z.number().nullable().optional(),
    total_amount: z.number().nullable().optional(),
    payment_received: z.number().nullable().optional(),
    balance_amount: z.number().nullable().optional(),
    payment_method: z.string().nullable().optional(),
    payment_date: z.string().nullable().optional(),
    assigned_staff_id: z.string().uuid().nullable().optional(),
    agreement_pdf_path: z.string().nullable().optional(),
    last_contacted_at: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  }),
});

export const updateCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof UpdateInput>) => UpdateInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdminOrStaff(context);
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

/** Internal notes CRUD */
export const addInternalNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { customerId: string; text: string }) =>
    z.object({ customerId: z.string().uuid(), text: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdminOrStaff(context);
    const { data: row, error } = await context.supabase
      .from("internal_notes")
      .insert({
        customer_id: data.customerId,
        note_text: data.text,
        created_by: context.userId,
        updated_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteInternalNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdminOrStaff(context);
    const { error } = await context.supabase.from("internal_notes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Mark a smart alert as resolved for a customer */
export const resolveAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { alertKey: string; customerId: string }) =>
    z.object({ alertKey: z.string().min(1), customerId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdminOrStaff(context);
    const { error } = await context.supabase.from("alert_resolutions").upsert({
      alert_key: data.alertKey,
      customer_id: data.customerId,
      resolved_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Mark agreement as downloaded (customer trigger) */
export const markAgreementDownloaded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { customerId: string }) =>
    z.object({ customerId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("customers")
      .update({ agreement_downloaded_at: new Date().toISOString() })
      .eq("id", data.customerId);
    return { ok: true };
  });

/** Seed 3 demo customers on first setup. */
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
        agreement_charges: 3000,
        registration_charges: 1000,
        service_charges: 500,
        total_amount: 4500,
        payment_received: s.status === "agreement_ready" ? 4500 : 2000,
        balance_amount: s.status === "agreement_ready" ? 0 : 2500,
        payment_amount: 4500,
      });
    }
    return { seeded: 3 };
  });
