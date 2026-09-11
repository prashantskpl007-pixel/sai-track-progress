import { supabase } from "@/integrations/supabase/client";

export function customerEmail(applicationNumber: string) {
  return `${applicationNumber.trim().toLowerCase()}@customer.sai-enterprise.local`;
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

export type MobileApplication = {
  application_number: string;
  customer_name: string;
  current_status: string;
  agreement_type: string;
};

export async function findApplicationsByMobile(mobile: string) {
  const { data, error } = await supabase.rpc("find_applications_by_mobile", {
    _mobile: mobile.trim(),
  });
  if (error) throw error;
  return (data ?? []) as MobileApplication[];
}
