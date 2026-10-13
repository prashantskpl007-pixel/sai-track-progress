import { statusLabel, type RegistrationStatus } from "@/lib/status";

type Row = { workflow_status?: string | null; current_status: RegistrationStatus | string };

/** Calendar date (YYYY-MM-DD) in India time — the business operates in Kalyan. */
export function istDate(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** Status exactly as the Workflow table shows it. */
export function workflowStatusOf(c: Row): string {
  return c.workflow_status?.trim() || statusLabel(c.current_status as RegistrationStatus);
}

/** A record is completed when its Workflow status is "Closed", or (with no Workflow status) the legacy stage is final. */
export function isCompleted(c: Row): boolean {
  const ws = c.workflow_status?.trim();
  if (ws) return /^(closed|completed?)$/i.test(ws);
  return c.current_status === "agreement_ready" || c.current_status === "registration_completed";
}
