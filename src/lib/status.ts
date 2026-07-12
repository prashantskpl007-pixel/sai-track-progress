export type RegistrationStatus =
  | "application_created"
  | "documents_received"
  | "draft_prepared"
  | "appointment_scheduled"
  | "biometric_completed"
  | "registration_submitted"
  | "registration_completed"
  | "agreement_ready";

export const STATUS_STEPS: { key: RegistrationStatus; label: string; description: string }[] = [
  { key: "application_created", label: "Application Created", description: "Your file has been opened by Sai Enterprise." },
  { key: "documents_received", label: "Documents Received", description: "All required documents have been collected." },
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
