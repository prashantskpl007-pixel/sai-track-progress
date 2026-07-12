import { supabase } from "@/integrations/supabase/client";

/** Deterministic synthetic email used for customer auth accounts. */
export function customerEmail(applicationNumber: string) {
  return `${applicationNumber.trim().toLowerCase()}@customer.sai-enterprise.local`;
}

/** Password used for customer auth accounts (their mobile number). */
export function customerPassword(mobileNumber: string) {
  return mobileNumber.replace(/\s+/g, "");
}

export async function signInCustomer(applicationNumber: string, mobileNumber: string) {
  return supabase.auth.signInWithPassword({
    email: customerEmail(applicationNumber),
    password: customerPassword(mobileNumber),
  });
}

export async function signInAdmin(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpAdmin(email: string, password: string, name: string) {
  return supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
      emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
    },
  });
}
