import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdminOrManager(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_any_role", {
    _user_id: ctx.userId,
    _roles: ["admin", "owner", "manager"],
  });
  if (!data) throw new Error("Forbidden: admin/manager role required");
}

const VerificationStatus = z.enum([
  "pending_assignment",
  "assigned",
  "in_progress",
  "additional_documents_required",
  "on_hold",
  "approved",
  "rejected",
  "completed",
]);

// Create a Verification Partner user (auth + role + row on staff table for photo/designation reuse)
export const createVerificationPartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      fullName: string;
      email: string;
      mobileNumber: string;
      password: string;
      profilePhotoUrl?: string | null;
      designation?: string;
    }) =>
      z
        .object({
          fullName: z.string().min(2),
          email: z.string().email(),
          mobileNumber: z.string().min(6),
          password: z.string().min(6),
          profilePhotoUrl: z.string().url().nullable().optional(),
          designation: z.string().optional(),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdminOrManager(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, verification_partner: true },
    });
    if (cErr) throw new Error(cErr.message);
    const uid = created.user!.id;

    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: uid, role: "verification_partner" });
    if (rErr) {
      await supabaseAdmin.auth.admin.deleteUser(uid);
      throw new Error(rErr.message);
    }

    const { data: row, error: sErr } = await supabaseAdmin
      .from("staff")
      .insert({
        user_id: uid,
        full_name: data.fullName,
        designation: data.designation ?? "Verification Partner",
        mobile_number: data.mobileNumber,
        email: data.email,
        profile_photo_url: data.profilePhotoUrl ?? null,
        joining_date: new Date().toISOString().slice(0, 10),
      })
      .select("*")
      .single();
    if (sErr) {
      await supabaseAdmin.auth.admin.deleteUser(uid);
      throw new Error(sErr.message);
    }
    return row;
  });

// Assign a verification case to a partner (by user_id)
export const assignVerificationCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { caseId: string; partnerUserId: string; partnerName: string }) =>
    z
      .object({
        caseId: z.string().uuid(),
        partnerUserId: z.string().uuid(),
        partnerName: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdminOrManager(context);
    const { data: row, error } = await context.supabase
      .from("verification_cases")
      .update({
        assigned_partner_user_id: data.partnerUserId,
        assigned_partner_name: data.partnerName,
        assigned_at: new Date().toISOString(),
        status: "assigned",
      })
      .eq("id", data.caseId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// Partner or admin updates verification case
export const updateVerificationCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      caseId: string;
      status?: z.infer<typeof VerificationStatus>;
      scheduled_date?: string | null;
      actual_verification_date?: string | null;
      completion_date?: string | null;
      verification_time?: string | null;
      verification_location?: string | null;
      verification_remarks?: string | null;
    }) =>
      z
        .object({
          caseId: z.string().uuid(),
          status: VerificationStatus.optional(),
          scheduled_date: z.string().nullable().optional(),
          actual_verification_date: z.string().nullable().optional(),
          completion_date: z.string().nullable().optional(),
          verification_time: z.string().nullable().optional(),
          verification_location: z.string().nullable().optional(),
          verification_remarks: z.string().max(2000).nullable().optional(),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { caseId, ...patch } = data;
    // RLS will allow admins/managers or assigned partner
    const { data: row, error } = await context.supabase
      .from("verification_cases")
      .update(patch)
      .eq("id", caseId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const VDOC_TYPES = ["noc_certificate", "police_verification", "site_visit_photo", "supporting"] as const;

export const recordVerificationDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      caseId: string;
      documentType: (typeof VDOC_TYPES)[number];
      filePath: string;
      fileName: string;
      fileSizeBytes?: number;
      mimeType?: string;
      remarks?: string;
    }) =>
      z
        .object({
          caseId: z.string().uuid(),
          documentType: z.enum(VDOC_TYPES),
          filePath: z.string().min(1),
          fileName: z.string().min(1),
          fileSizeBytes: z.number().int().positive().optional(),
          mimeType: z.string().optional(),
          remarks: z.string().max(500).optional(),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: userStaff } = await context.supabase
      .from("staff")
      .select("full_name")
      .eq("user_id", context.userId)
      .maybeSingle();
    const { data: row, error } = await context.supabase
      .from("verification_documents")
      .insert({
        verification_case_id: data.caseId,
        document_type: data.documentType,
        file_path: data.filePath,
        file_name: data.fileName,
        file_size_bytes: data.fileSizeBytes ?? null,
        mime_type: data.mimeType ?? null,
        remarks: data.remarks ?? null,
        uploaded_by: context.userId,
        uploaded_by_name: userStaff?.full_name ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteVerificationDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: doc } = await context.supabase
      .from("verification_documents")
      .select("file_path")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await context.supabase.from("verification_documents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    if (doc?.file_path) {
      await context.supabase.storage.from("verification-documents").remove([doc.file_path]);
    }
    return { ok: true };
  });

// List verification partners available for assignment (admin/manager only)
export const listVerificationPartners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminOrManager(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: partners } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "verification_partner");
    const ids = (partners ?? []).map((p: any) => p.user_id);
    if (ids.length === 0) return [];
    const { data: staffRows } = await supabaseAdmin
      .from("staff")
      .select("id, user_id, full_name, email, mobile_number, profile_photo_url, is_active")
      .in("user_id", ids);
    return staffRows ?? [];
  });
