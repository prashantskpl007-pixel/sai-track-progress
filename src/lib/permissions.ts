export const MODULES = [
  { key: "enquiry", label: "Enquiry" },
  { key: "workflow", label: "Workflow" },
  { key: "schedule", label: "Schedule" },
  { key: "dashboard", label: "Overview" },
  { key: "analytics", label: "Analytics" },
  { key: "master", label: "Master" },
  { key: "reports", label: "Reports" },
] as const;


export type ModuleKey = (typeof MODULES)[number]["key"];

export type ModuleActions = {
  can_view: boolean;
  can_add: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_export: boolean;
  menu_visible: boolean;
};

export const EMPTY_ACTIONS: ModuleActions = {
  can_view: false,
  can_add: false,
  can_edit: false,
  can_delete: false,
  can_export: false,
  menu_visible: false,
};

export const FULL_ACTIONS: ModuleActions = {
  can_view: true,
  can_add: true,
  can_edit: true,
  can_delete: true,
  can_export: true,
  menu_visible: true,
};

/** Modules that expose each action checkbox in the permission editor. */
export const MODULE_ACTIONS: Record<ModuleKey, (keyof ModuleActions)[]> = {
  dashboard: ["can_view", "menu_visible"],
  enquiry: ["can_view", "can_add", "can_edit", "can_delete", "can_export", "menu_visible"],

  workflow: ["can_view", "can_add", "can_edit", "can_delete", "menu_visible"],
  schedule: ["can_view", "can_add", "can_edit", "can_delete", "menu_visible"],
  analytics: ["can_view", "menu_visible"],
  master: ["can_view", "can_add", "can_edit", "can_delete", "menu_visible"],
  reports: ["can_view", "can_export", "menu_visible"],
};

export const ACTION_LABELS: Record<keyof ModuleActions, string> = {
  can_view: "View",
  can_add: "Add",
  can_edit: "Edit",
  can_delete: "Delete",
  can_export: "Export",
  menu_visible: "Menu visible",
};

export const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "currency", label: "Currency" },
  { value: "date", label: "Date" },
  { value: "datetime", label: "Date & Time" },
  { value: "time", label: "Time" },
  { value: "dropdown", label: "Dropdown" },
  { value: "multiselect", label: "Multi Select" },
  { value: "checkbox", label: "Checkbox" },
  { value: "radio", label: "Radio Button" },
  { value: "textarea", label: "Text Area" },
  { value: "mobile", label: "Mobile Number" },
  { value: "email", label: "Email" },
  { value: "file", label: "File Upload" },
] as const;

export type { FieldConfig } from "./field-config";
