import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Upload, FileText, Download, Trash2, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  KYC_DOCUMENT_TYPES,
  KYC_ALLOWED_MIME,
  KYC_MAX_BYTES,
  kycTypeLabel,
  type KycDocumentType,
} from "@/lib/status";
import {
  recordKycUpload,
  deleteKycDocument,
  listKycDocuments,
  logKycDownload,
  replaceKycDocument,
} from "@/lib/kyc.functions";

type KycRow = {
  id: string;
  customer_id: string;
  document_type: KycDocumentType;
  file_path: string;
  file_name: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  remarks: string | null;
  uploaded_by_name: string | null;
  created_at: string;
};

function formatBytes(b: number | null) {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function validateFile(f: File): string | null {
  if (f.size > KYC_MAX_BYTES) return "File exceeds 20 MB limit.";
  if (!KYC_ALLOWED_MIME.includes(f.type)) return "Only PDF, JPG, or PNG allowed.";
  return null;
}

export function KycPanel({
  customerId,
  applicationNumber,
  readOnly = false,
}: {
  customerId: string;
  applicationNumber: string;
  readOnly?: boolean;
}) {
  const [docs, setDocs] = useState<KycRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [docType, setDocType] = useState<KycDocumentType>("aadhaar");
  const [remarks, setRemarks] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);

  const listFn = useServerFn(listKycDocuments);
  const recordFn = useServerFn(recordKycUpload);
  const replaceFn = useServerFn(replaceKycDocument);
  const deleteFn = useServerFn(deleteKycDocument);
  const logFn = useServerFn(logKycDownload);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listFn({ data: { customerId } });
      setDocs(rows as KycRow[]);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [customerId, listFn]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpload(file: File) {
    const err = validateFile(file);
    if (err) return toast.error(err);
    setUploading(true);
    setProgress(20);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${applicationNumber}/${docType}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("kyc-documents")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      setProgress(75);
      await recordFn({
        data: {
          customerId,
          documentType: docType,
          filePath: path,
          fileName: file.name,
          fileSizeBytes: file.size,
          mimeType: file.type,
          remarks: remarks.trim() || undefined,
        },
      });
      setProgress(100);
      toast.success("Document uploaded");
      setRemarks("");
      if (fileInput.current) fileInput.current.value = "";
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  async function handleReplace(id: string, file: File) {
    const err = validateFile(file);
    if (err) return toast.error(err);
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${applicationNumber}/replace-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("kyc-documents")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      await replaceFn({
        data: {
          id,
          filePath: path,
          fileName: file.name,
          fileSizeBytes: file.size,
          mimeType: file.type,
        },
      });
      toast.success("Document replaced");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Replace failed");
    } finally {
      setUploading(false);
      setReplacingId(null);
    }
  }

  async function handleDownload(d: KycRow) {
    try {
      const { data, error } = await supabase.storage
        .from("kyc-documents")
        .createSignedUrl(d.file_path, 300);
      if (error) throw error;
      await logFn({ data: { documentId: d.id } });
      window.open(data.signedUrl, "_blank");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleDelete(d: KycRow) {
    if (!confirm(`Delete ${d.file_name}?`)) return;
    try {
      await deleteFn({ data: { id: d.id } });
      toast.success("Deleted");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="rounded-xl border bg-secondary/30 p-4">
          <h4 className="mb-3 font-display font-semibold">Upload KYC Document</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Document Type</Label>
              <Select value={docType} onValueChange={(v) => setDocType(v as KycDocumentType)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KYC_DOCUMENT_TYPES.map((t) => (
                    <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Remarks (optional)</Label>
              <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={200} className="mt-1" />
            </div>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleUpload(f);
            }}
            className={`mt-3 rounded-lg border-2 border-dashed p-6 text-center transition ${
              dragOver ? "border-gold bg-gold/10" : "border-border"
            }`}
          >
            <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Drag and drop a file here, or click Browse to select
            </p>
            <p className="mt-1 text-xs text-muted-foreground">PDF / JPG / PNG · Max 20 MB</p>
            <div className="mt-3 flex justify-center gap-2">
              <Button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
                variant="outline"
              >
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Browse
              </Button>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
              }}
            />
            {uploading && (
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div className="h-full bg-gold-gradient transition-all" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card">
        <div className="border-b px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground">
          Uploaded Documents ({docs.length})
        </div>
        {loading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading...</div>
        ) : docs.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No KYC documents uploaded yet.</div>
        ) : (
          <ul className="divide-y">
            {docs.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 p-3">
                <FileText className="h-5 w-5 text-primary" />
                <div className="min-w-40 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{kycTypeLabel(d.document_type)}</Badge>
                    <span className="text-sm font-medium">{d.file_name}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(d.created_at).toLocaleString()} · {formatBytes(d.file_size_bytes)}
                    {d.uploaded_by_name ? ` · by ${d.uploaded_by_name}` : ""}
                    {d.remarks ? ` · ${d.remarks}` : ""}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => handleDownload(d)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  {!readOnly && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setReplacingId(d.id);
                          replaceInput.current?.click();
                        }}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(d)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <input
        ref={replaceInput}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && replacingId) handleReplace(replacingId, f);
          if (replaceInput.current) replaceInput.current.value = "";
        }}
      />
    </div>
  );
}
