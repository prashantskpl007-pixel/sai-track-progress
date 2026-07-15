import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DOC_TYPES = [
  "aadhaar",
  "pan",
  "passport",
  "driving_license",
  "property_tax_receipt",
  "electricity_bill",
  "property_documents",
  "photograph",
  "other",
] as const;

async function assertUploader(ctx: { supabase: any; userId: string }, customerId: string) {
  const { data: any1 } = await ctx.supabase.rpc("has_any_role", {
    _user_id: ctx.userId,
    _roles: ["admin", "owner", "manager"],
  });
  if (any1) return { role: "admin", name: null as string | null };

  const { data: staff } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "staff" });
  if (staff) {
    // RLS on kyc_documents will further restrict to assigned customers
    const { data: s } = await ctx.supabase.from("staff").select("full_name").eq("user_id", ctx.userId).maybeSingle();
    return { role: "staff", name: s?.full_name ?? null };
  }
  throw new Error("Forbidden");
}

// Record KYC document metadata after client-side upload to storage.
export const recordKycUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      customerId: string;
      documentType: (typeof DOC_TYPES)[number];
      filePath: string;
      fileName: string;
      fileSizeBytes?: number;
      mimeType?: string;
      remarks?: string;
    }) =>
      z
        .object({
          customerId: z.string().uuid(),
          documentType: z.enum(DOC_TYPES),
          filePath: z.string().min(1),
          fileName: z.string().min(1),
          fileSizeBytes: z.number().int().positive().optional(),
          mimeType: z.string().optional(),
          remarks: z.string().max(500).optional(),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    const who = await assertUploader(context, data.customerId);
    const { data: row, error } = await context.supabase
      .from("kyc_documents")
      .insert({
        customer_id: data.customerId,
        document_type: data.documentType,
        file_path: data.filePath,
        file_name: data.fileName,
        file_size_bytes: data.fileSizeBytes ?? null,
        mime_type: data.mimeType ?? null,
        remarks: data.remarks ?? null,
        uploaded_by: context.userId,
        uploaded_by_name: who.name,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const replaceKycDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      id: string;
      filePath: string;
      fileName: string;
      fileSizeBytes?: number;
      mimeType?: string;
      remarks?: string;
    }) =>
      z
        .object({
          id: z.string().uuid(),
          filePath: z.string().min(1),
          fileName: z.string().min(1),
          fileSizeBytes: z.number().int().positive().optional(),
          mimeType: z.string().optional(),
          remarks: z.string().max(500).optional(),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("kyc_documents")
      .update({
        file_path: data.filePath,
        file_name: data.fileName,
        file_size_bytes: data.fileSizeBytes ?? null,
        mime_type: data.mimeType ?? null,
        remarks: data.remarks ?? null,
      })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteKycDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    // Get file path first so we can delete from storage
    const { data: doc } = await context.supabase
      .from("kyc_documents")
      .select("file_path")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await context.supabase.from("kyc_documents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    if (doc?.file_path) {
      await context.supabase.storage.from("kyc-documents").remove([doc.file_path]);
    }
    return { ok: true };
  });

export const listKycDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { customerId: string }) =>
    z.object({ customerId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("kyc_documents")
      .select("*")
      .eq("customer_id", data.customerId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// Log a KYC download event to the audit log
export const logKycDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { documentId: string }) =>
    z.object({ documentId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: doc } = await context.supabase
      .from("kyc_documents")
      .select("id, customer_id, document_type, file_name")
      .eq("id", data.documentId)
      .maybeSingle();
    if (!doc) throw new Error("Document not found");
    await context.supabase.from("audit_log").insert({
      actor_user_id: context.userId,
      action: "KYC_DOWNLOAD",
      entity_type: "kyc_documents",
      entity_id: doc.id,
      details: doc,
    });
    return { ok: true };
  });
