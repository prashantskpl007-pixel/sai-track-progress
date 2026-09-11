import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  EMPTY_ACTIONS,
  FULL_ACTIONS,
  MODULES,
  type ModuleActions,
  type ModuleKey,
} from "@/lib/permissions";

export type UserProfile = {
  staffId: string | null;
  fullName: string;
  designation: string;
  email: string;
  mobile: string;
  photoUrl: string | null;
  roleName: string;
};

const PERMISSIONS_EVENT = "smart-future-permissions-changed";

export function notifyPermissionsChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PERMISSIONS_EVENT));
}

const DEFAULT_PROFILE: UserProfile = {
  staffId: null,
  fullName: "",
  designation: "",
  email: "",
  mobile: "",
  photoUrl: null,
  roleName: "",
};

export function usePermissions() {
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [roleName, setRoleName] = useState<string>("");
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [perms, setPerms] = useState<Record<string, ModuleActions>>({});

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) {
      setLoading(false);
      return;
    }

    const [rolesRes, staffRes, effRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase.from("staff").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.rpc("effective_role_name", { _user_id: user.id }),
    ]);

    const baseRoles = (rolesRes.data ?? []).map((r: any) => r.role as string);
    const owner = baseRoles.includes("owner") || baseRoles.includes("admin");
    setIsOwner(owner);

    const s: any = staffRes.data;
    const effective = (effRes.data as string | null) ?? baseRoles[0] ?? "";
    setRoleName(s?.role_name ?? effective);

    setProfile({
      staffId: s?.id ?? null,
      fullName: s?.full_name ?? (user.user_metadata as any)?.["full_name"] ?? user.email ?? "User",
      designation: s?.designation ?? (owner ? "Owner" : ""),
      email: s?.email ?? user.email ?? "",
      mobile: s?.mobile_number ?? "",
      photoUrl: s?.profile_photo_url ?? null,
      roleName: s?.role_name ?? effective,
    });

    const map: Record<string, ModuleActions> = {};
    if (owner) {
      MODULES.forEach((m) => (map[m.key] = { ...FULL_ACTIONS }));
    } else {
      const { data: rows } = await supabase
        .from("role_permissions")
        .select("*")
        .ilike("role_name", effective ?? "");
      MODULES.forEach((m) => (map[m.key] = { ...EMPTY_ACTIONS }));
      (rows ?? []).forEach((r: any) => {
        map[r.module] = {
          can_view: r.can_view,
          can_add: r.can_add,
          can_edit: r.can_edit,
          can_delete: r.can_delete,
          can_export: r.can_export,
          menu_visible: r.menu_visible,
        };
      });
    }
    setPerms(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const handlePermissionsChanged = () => load();
    window.addEventListener(PERMISSIONS_EVENT, handlePermissionsChanged);
    return () => window.removeEventListener(PERMISSIONS_EVENT, handlePermissionsChanged);
  }, [load]);

  function can(module: ModuleKey, action: keyof ModuleActions) {
    if (isOwner) return true;
    return Boolean(perms[module]?.[action]);
  }

  return { loading, isOwner, roleName, profile, perms, can, reload: load };
}
