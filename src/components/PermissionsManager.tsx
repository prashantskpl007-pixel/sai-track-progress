import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { saveRolePermissions } from "@/lib/master.functions";
import { useMasters } from "@/hooks/use-masters";
import { notifyPermissionsChanged } from "@/hooks/use-permissions";
import {
  ACTION_LABELS,
  EMPTY_ACTIONS,
  MODULES,
  MODULE_ACTIONS,
  type ModuleActions,
  type ModuleKey,
} from "@/lib/permissions";

const BUILT_IN = ["manager", "staff", "viewer"];

export function PermissionsManager() {
  const { roles } = useMasters();
  const saveFn = useServerFn(saveRolePermissions);

  const roleNames = Array.from(
    new Set([
      ...BUILT_IN,
      ...roles.filter((r) => r.base_role !== "owner" && r.base_role !== "admin").map((r) => r.name),
    ]),
  );

  const [role, setRole] = useState(roleNames[0] ?? "manager");
  const [grid, setGrid] = useState<Record<string, ModuleActions>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    load(role);
  }, [role]);

  async function load(r: string) {
    setLoading(true);
    const { data } = await supabase.from("role_permissions").select("*").ilike("role_name", r);
    const map: Record<string, ModuleActions> = {};
    MODULES.forEach((m) => (map[m.key] = { ...EMPTY_ACTIONS }));
    (data ?? []).forEach((row: any) => {
      map[row.module] = {
        can_view: row.can_view,
        can_add: row.can_add,
        can_edit: row.can_edit,
        can_delete: row.can_delete,
        can_export: row.can_export,
        menu_visible: row.menu_visible,
      };
    });
    setGrid(map);
    setLoading(false);
  }

  function set(module: ModuleKey, action: keyof ModuleActions, value: boolean) {
    setGrid((g) => ({ ...g, [module]: { ...(g[module] ?? EMPTY_ACTIONS), [action]: value } }));
  }

  async function save() {
    setBusy(true);
    try {
      await saveFn({
        data: {
          roleName: role,
          rows: MODULES.map((m) => ({
            module: m.key,
            ...(grid[m.key] ?? EMPTY_ACTIONS),
          })),
        },
      });
      notifyPermissionsChanged();
      toast.success(`Permissions saved for ${role}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border bg-card p-4 shadow-elegant">
        <div>
          <h3 className="font-display text-lg font-semibold">Role Permissions &amp; Menu Visibility</h3>
          <p className="text-sm text-muted-foreground">
            The Owner always has full access. Everyone else only gets what you tick here — hidden
            menus never appear, and restricted pages stay blocked even if a web address is typed
            manually.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="mt-1 w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleNames.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={save}
            disabled={busy}
            className="bg-gold-gradient text-gold-foreground shadow-gold"
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
            Save permissions
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-elegant">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Module</th>
                  {(["can_view", "can_add", "can_edit", "can_delete", "can_export", "menu_visible"] as const).map(
                    (a) => (
                      <th key={a} className="px-4 py-3">
                        {ACTION_LABELS[a]}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {MODULES.map((m) => (
                  <tr key={m.key} className="border-t">
                    <td className="px-4 py-2 font-medium">{m.label}</td>
                    {(["can_view", "can_add", "can_edit", "can_delete", "can_export", "menu_visible"] as const).map(
                      (a) => (
                        <td key={a} className="px-4 py-2">
                          {MODULE_ACTIONS[m.key].includes(a) ? (
                            <Switch
                              checked={Boolean(grid[m.key]?.[a])}
                              onCheckedChange={(v) => set(m.key, a, v)}
                            />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
