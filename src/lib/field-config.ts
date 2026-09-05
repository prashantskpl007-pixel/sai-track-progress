/**
 * Central field-configuration engine.
 *
 * Every configurable field (registration form, edit form, workflow dashboard)
 * is described by a row in `field_configs`. Dropdown / multi-select / radio
 * choices live in `field_options`. This module is the single source of truth
 * for how those rows are interpreted by the UI.
 */

export type FieldConfig = {
  id: string;
  field_key: string;
  label: string;
  field_type: string;
  options: string[];
  default_value: string | null;
  is_system: boolean;
  is_enabled: boolean;
  is_required: boolean;
  show_in_registration: boolean;
  show_in_workflow: boolean;
  sort_order: number;
};

export type FieldOption = {
  id: string;
  field_config_id: string;
  label: string;
  sort_order: number;
  is_active: boolean;
};

export const OPTION_FIELD_TYPES = ["dropdown", "multiselect", "radio"];

export function hasOptions(f: { field_type: string }) {
  return OPTION_FIELD_TYPES.includes(f.field_type);
}

/** Real columns on `customers`. Anything else is stored inside `custom_fields`. */
export const CUSTOMER_COLUMNS = new Set([
  "registration_date",
  "token_number",
  "source_agent",
  "customer_name",
  "mobile_number",
  "customer_email",
  "property_address",
  "work_type",
  "registration_handling_type",
  "assigned_staff_id",
  "verification_noc_status",
  "verification_partner_user_id",
  "total_amount",
  "payment_received",
  "balance_amount",
  "payment_method",
  "payment_date",
  "pending_item",
  "workflow_status",
  "appointment_date",
  "appointment_time",
  "notes",
  "source_commission",
  "commission_paid",
]);

/** Fields the system computes — never editable, never configurable. */
export const DERIVED_FIELDS = [
  { key: "balance_amount", label: "Balance" },
  { key: "excess_amount", label: "Excess Amount" },
  { key: "payment_status_calc", label: "Payment Status" },
  { key: "collection_pct", label: "Collection %" },
  { key: "commission_pending", label: "Commission Pending / Excess" },
  { key: "commission_status", label: "Commission Status" },
];


export function isCustomField(f: { field_key: string }) {
  return !CUSTOMER_COLUMNS.has(f.field_key);
}

export function readFieldValue(row: Record<string, any>, key: string) {
  if (CUSTOMER_COLUMNS.has(key)) return row[key];
  const cf = row["custom_fields"];
  return cf && typeof cf === "object" ? cf[key] : undefined;
}

/** Build the patch that saves one field value on a customer row. */
export function buildFieldPatch(row: Record<string, any>, key: string, value: any) {
  if (CUSTOMER_COLUMNS.has(key)) return { [key]: value === "" ? null : value };
  const current = (row["custom_fields"] && typeof row["custom_fields"] === "object"
    ? row["custom_fields"]
    : {}) as Record<string, any>;
  return { custom_fields: { ...current, [key]: value } };
}

/* ------------------------- Financial calculations ------------------------- */

export type PaymentState = "pending" | "paid" | "excess";

export type Finance = {
  fees: number;
  received: number;
  balance: number;
  excess: number;
  state: PaymentState;
  statusLabel: string;
  collectionPct: number;
};

export function deriveFinance(feesRaw: any, receivedRaw: any): Finance {
  const fees = Number(feesRaw) || 0;
  const received = Number(receivedRaw) || 0;
  const balance = Math.max(0, fees - received);
  const excess = Math.max(0, received - fees);
  const state: PaymentState = received > fees ? "excess" : received === fees && fees > 0 ? "paid" : "pending";
  const statusLabel =
    state === "excess" ? "Excess Received" : state === "paid" ? "Fully Paid" : "Pending Payment";
  const collectionPct = fees > 0 ? (received / fees) * 100 : 0;
  return { fees, received, balance, excess, state, statusLabel, collectionPct };
}

/* ------------------------- Commission calculations ------------------------ */

export type CommissionState = "pending" | "paid" | "excess";

export type Commission = {
  commission: number;
  paid: number;
  pending: number;
  excess: number;
  state: CommissionState;
  statusLabel: string;
};

/**
 * Agent / source commission. Completely independent of the customer's
 * fees, received and balance figures.
 */
export function deriveCommission(commissionRaw: any, paidRaw: any): Commission {
  const commission = Number(commissionRaw) || 0;
  const paid = Number(paidRaw) || 0;
  const pending = Math.max(0, commission - paid);
  const excess = Math.max(0, paid - commission);
  const state: CommissionState =
    paid > commission ? "excess" : paid >= commission && commission > 0 ? "paid" : "pending";
  const statusLabel =
    state === "excess" ? "Excess Paid" : state === "paid" ? "Fully Paid" : "Pending";
  return { commission, paid, pending, excess, state, statusLabel };
}

export const COMMISSION_STATE_CLASS: Record<CommissionState, string> = {
  pending: "bg-gold/20 text-gold-foreground border-gold/40",
  paid: "bg-success/15 text-success border-success/30",
  excess: "bg-primary/10 text-primary border-primary/30",
};

export const PAYMENT_STATE_LABELS: Record<PaymentState, string> = {
  pending: "Pending Payment",
  paid: "Fully Paid",
  excess: "Excess Received",
};

export const PAYMENT_STATE_CLASS: Record<PaymentState, string> = {
  pending: "bg-gold/20 text-gold-foreground border-gold/40",
  paid: "bg-success/15 text-success border-success/30",
  excess: "bg-primary/10 text-primary border-primary/30",
};

/** Legacy `payment_status` enum column kept in sync with the derived state. */
export function legacyPaymentStatus(f: Finance): "pending" | "partial" | "paid" {
  if (f.received <= 0) return "pending";
  if (f.received >= f.fees) return "paid";
  return "partial";
}

export const INR = (n: number | null | undefined) =>
  `₹${(Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

/* --------------------------- Validation helpers --------------------------- */

export function isEmptyValue(v: any) {
  if (v == null) return true;
  if (Array.isArray(v)) return v.length === 0;
  return String(v).trim() === "";
}

export function validateFields(
  fields: FieldConfig[],
  values: Record<string, any>,
): string[] {
  return fields
    .filter((f) => f.is_enabled && f.show_in_registration && f.is_required)
    .filter((f) => isEmptyValue(values[f.field_key]))
    .map((f) => f.label);
}
