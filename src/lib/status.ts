export type RegistrationStatus =
  | "application_created"
  | "documents_received"
  | "kyc_uploaded"
  | "noc_initiated"
  | "noc_completed"
  | "draft_prepared"
  | "appointment_scheduled"
  | "biometric_completed"
  | "registration_submitted"
  | "registration_completed"
  | "agreement_ready";

export const STATUS_STEPS: { key: RegistrationStatus; label: string; description: string }[] = [
  { key: "application_created", label: "Application Created", description: "Your file has been opened by Sai Enterprise." },
  { key: "documents_received", label: "Documents Received", description: "All required documents have been collected." },
  { key: "kyc_uploaded", label: "KYC Documents Uploaded", description: "Your KYC documents have been uploaded and recorded." },
  { key: "noc_initiated", label: "NOC / Police Verification Initiated", description: "Verification has been assigned to a partner." },
  { key: "noc_completed", label: "NOC / Police Verification Completed", description: "Verification has been completed successfully." },
  { key: "draft_prepared", label: "Agreement Draft Prepared", description: "Your agreement draft is ready for review." },
  { key: "appointment_scheduled", label: "Appointment Scheduled", description: "Your registration appointment is booked." },
  { key: "biometric_completed", label: "Biometric Verification Completed", description: "Biometric verification is complete." },
  { key: "registration_submitted", label: "Registration Submitted", description: "Documents submitted to the sub-registrar office." },
  { key: "registration_completed", label: "Registration Completed", description: "Government registration is complete." },
  { key: "agreement_ready", label: "Agreement Ready for Download", description: "Final agreement PDF is ready to download." },
];

export function statusIndex(s: RegistrationStatus) {
  return STATUS_STEPS.findIndex((x) => x.key === s);
}

export function statusLabel(s: RegistrationStatus) {
  return STATUS_STEPS.find((x) => x.key === s)?.label ?? s;
}

export const AGREEMENT_TYPES = [
  "Rent Agreement (Leave & License)",
  "Sale Deed",
  "Gift Deed",
  "Power of Attorney",
  "Affidavit",
  "MOU / Agreement",
  "Other",
];

// ---- Verification ----

export type VerificationStatus =
  | "pending_assignment"
  | "assigned"
  | "in_progress"
  | "partial_completed"
  | "additional_documents_required"
  | "on_hold"
  | "approved"
  | "rejected"
  | "completed";

export const VERIFICATION_STATUSES: { key: VerificationStatus; label: string }[] = [
  { key: "pending_assignment", label: "Pending" },
  { key: "assigned", label: "Assigned" },
  { key: "in_progress", label: "In Progress" },
  { key: "partial_completed", label: "Partial Completed" },
  { key: "additional_documents_required", label: "Additional Documents Required" },
  { key: "on_hold", label: "On Hold" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "completed", label: "Completed" },
];

export function verificationStatusLabel(s: VerificationStatus) {
  return VERIFICATION_STATUSES.find((x) => x.key === s)?.label ?? s;
}

// UI sort order (Pending first, Completed last)
export const VERIFICATION_SORT_ORDER: VerificationStatus[] = [
  "pending_assignment",
  "assigned",
  "additional_documents_required",
  "in_progress",
  "partial_completed",
  "on_hold",
  "rejected",
  "approved",
  "completed",
];

export type KycDocumentType =
  | "aadhaar"
  | "pan"
  | "passport"
  | "driving_license"
  | "property_tax_receipt"
  | "electricity_bill"
  | "property_documents"
  | "photograph"
  | "other";

export const KYC_DOCUMENT_TYPES: { key: KycDocumentType; label: string }[] = [
  { key: "aadhaar", label: "Aadhaar Card" },
  { key: "pan", label: "PAN Card" },
  { key: "passport", label: "Passport" },
  { key: "driving_license", label: "Driving License" },
  { key: "property_tax_receipt", label: "Property Tax Receipt" },
  { key: "electricity_bill", label: "Electricity Bill" },
  { key: "property_documents", label: "Property Documents" },
  { key: "photograph", label: "Photograph" },
  { key: "other", label: "Other Document" },
];

export function kycTypeLabel(t: KycDocumentType) {
  return KYC_DOCUMENT_TYPES.find((x) => x.key === t)?.label ?? t;
}

export type VerificationDocumentType =
  | "noc_certificate"
  | "police_verification"
  | "site_visit_photo"
  | "supporting";

export const VERIFICATION_DOCUMENT_TYPES: { key: VerificationDocumentType; label: string }[] = [
  { key: "noc_certificate", label: "NOC Certificate" },
  { key: "police_verification", label: "Police Verification Certificate" },
  { key: "site_visit_photo", label: "Site Visit Photo" },
  { key: "supporting", label: "Supporting Document" },
];

export function verificationDocTypeLabel(t: VerificationDocumentType) {
  return VERIFICATION_DOCUMENT_TYPES.find((x) => x.key === t)?.label ?? t;
}

export const KYC_ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
];

export const KYC_MAX_BYTES = 20 * 1024 * 1024; // 20 MB

// ---- Workflow Management System options ----

export const WORK_TYPES: string[] = [
  "Rent Agreement",
  "Sale Deed",
  "Gift Deed",
  "Power of Attorney",
  "Affidavit",
  "MOU / Agreement",
  "Notary",
  "Other",
];

export const REGISTRATION_HANDLING_TYPES: string[] = [
  "Office Registration",
  "Doorstep (Home Visit)",
  "Sub-Registrar Office",
  "Online / e-Registration",
];

export const PENDING_OPTIONS: string[] = [
  "No Pending",
  "Fees Pending",
  "NOC Pending",
  "Documents Pending",
  "Biometric Pending",
  "Overdue",
];

export const NOC_OPTIONS: string[] = [
  "Not Required",
  "NOC Pending",
  "In Progress",
  "Completed",
  "Rejected",
];
