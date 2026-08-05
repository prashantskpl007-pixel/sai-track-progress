import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Plus, Trash2, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { upsertMasterItem, deleteMasterItem } from "@/lib/master.functions";
import {
  createStaff,
  updateStaff,
  deleteStaff,
  resetStaffPassword,
} from "@/lib/staff-admin.functions";
import { useMasters, notifyMastersChanged, type MasterRole } from "@/hooks/use-masters";
import { FieldConfigManager } from "@/components/FieldConfigManager";
import { PermissionsManager } from "@/components/PermissionsManager";

type Staff = Record<string, any>;

export function MasterModule({
  staff,
  onStaffChanged,
}: {
  staff: Staff[];
  onStaffChanged: () => Promise<void> | void;
}) {
  return (
    <Tabs defaultValue="fields" className="w-full">
      <TabsList className="mb-6 flex w-full flex-wrap justify-start gap-1 bg-secondary p-1">
        <TabsTrigger value="fields">Field Configuration</TabsTrigger>
        <TabsTrigger value="permissions">Role Permissions</TabsTrigger>
        <TabsTrigger value="staff">Staff Management</TabsTrigger>
        <TabsTrigger value="roles">Role Management</TabsTrigger>
      </TabsList>
      <TabsContent value="fields">
        <FieldConfigManager />
      </TabsContent>
      <TabsContent value="permissions">
        <PermissionsManager />
      </TabsContent>
      <TabsContent value="staff">
        <StaffManager staff={staff} onChanged={onStaffChanged} />
      </TabsContent>
      <TabsContent value="roles">
        <RoleManager />
      </TabsContent>
    </Tabs>
  );
}

function RenameDialog({
  initial,
  title,
  onClose,
  onSave,
}: {
  initial: string;
  title: string;
  onClose: () => void;
  onSave: (v: string) => Promise<void>;
}) {
  const [v, setV] = useState(initial);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <Input value={v} onChange={(e) => setV(e.target.value)} autoFocus />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(v)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Role master ---------------- */

const BASE_ROLES = [
  { value: "owner", label: "Owner (full access)" },
  { value: "manager", label: "Manager" },
  { value: "staff", label: "Staff" },
  { value: "viewer", label: "Viewer (read-only)" },
  { value: "verification_partner", label: "Verification Partner" },
];

function RoleManager() {
  const { roles, reload } = useMasters();
  const upsertFn = useServerFn(upsertMasterItem);
  const deleteFn = useServerFn(deleteMasterItem);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MasterRole | null>(null);

  async function remove(r: MasterRole) {
    if (!confirm(`Delete role "${r.name}"?`)) return;
    try {
      await deleteFn({ data: { kind: "role", id: r.id } });
      await reload();
      notifyMastersChanged();
      toast.success("Role deleted");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl border bg-card p-4 shadow-elegant">
        <div>
          <h3 className="font-display text-lg font-semibold">Role Master</h3>
          <p className="text-sm text-muted-foreground">Roles available when adding a team member.</p>
        </div>
        <Button className="bg-gold-gradient text-gold-foreground shadow-gold" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Add Role
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-elegant">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Access level</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2 font-medium">{r.name}</td>
                <td className="px-4 py-2"><Badge variant="outline">{r.base_role}</Badge></td>
                <td className="px-4 py-2 text-muted-foreground">{r.description ?? "—"}</td>
                <td className="px-4 py-2 text-right">
                  <Button size="sm" variant="outline" className="mr-2" onClick={() => { setEditing(r); setOpen(true); }}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => remove(r)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <RoleDialog
          role={editing}
          onClose={() => setOpen(false)}
          onSave={async (values) => {
            try {
              await upsertFn({
                data: {
                  kind: "role",
                  id: editing?.id ?? null,
                  label: values.name,
                  description: values.description,
                  baseRole: values.baseRole as any,
                },
              });
              setOpen(false);
              await reload();
              notifyMastersChanged();
              toast.success("Role saved");
            } catch (e: any) {
              toast.error(e.message);
            }
          }}
        />
      )}
    </div>
  );
}

function RoleDialog({
  role,
  onClose,
  onSave,
}: {
  role: MasterRole | null;
  onClose: () => void;
  onSave: (v: { name: string; description: string | null; baseRole: string }) => Promise<void>;
}) {
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [baseRole, setBaseRole] = useState(role?.base_role ?? "staff");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{role ? "Edit Role" : "Add Role"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Role name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Registration Executive" />
          </div>
          <div className="space-y-2">
            <Label>Access level</Label>
            <Select value={baseRole} onValueChange={setBaseRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BASE_ROLES.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Input value={description ?? ""} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave({ name: name.trim(), description: description || null, baseRole })}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Staff management ---------------- */

function StaffManager({ staff, onChanged }: { staff: Staff[]; onChanged: () => Promise<void> | void }) {
  const { roles } = useMasters();
  const createFn = useServerFn(createStaff);
  const updateFn = useServerFn(updateStaff);
  const deleteFn = useServerFn(deleteStaff);
  const resetFn = useServerFn(resetStaffPassword);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [pwdFor, setPwdFor] = useState<Staff | null>(null);
  const [pwd, setPwd] = useState("");

  async function remove(s: Staff) {
    if (!confirm(`Delete ${s.full_name}? This removes their login too.`)) return;
    try {
      await deleteFn({ data: { id: s.id } });
      await onChanged();
      toast.success("Staff deleted");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function toggleActive(s: Staff, active: boolean) {
    try {
      await updateFn({ data: { id: s.id, patch: { is_active: active } } });
      await onChanged();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl border bg-card p-4 shadow-elegant">
        <div>
          <h3 className="font-display text-lg font-semibold">Staff Management</h3>
          <p className="text-sm text-muted-foreground">Team members with individual logins.</p>
        </div>
        <Button className="bg-gold-gradient text-gold-foreground shadow-gold" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Add Staff
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-elegant">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Mobile</th>
                <th className="px-4 py-3">Designation</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.length === 0 ? (
                <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">No staff yet.</td></tr>
              ) : (
                staff.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="px-4 py-2 font-medium">{s.full_name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{s.email}</td>
                    <td className="px-4 py-2">{s.mobile_number}</td>
                    <td className="px-4 py-2">{s.designation}</td>
                    <td className="px-4 py-2">{s.role_name ? <Badge variant="outline">{s.role_name}</Badge> : "—"}</td>
                    <td className="px-4 py-2">
                      <Switch checked={Boolean(s.is_active)} onCheckedChange={(v) => toggleActive(s, v)} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right">
                      <Button size="sm" variant="outline" className="mr-2" onClick={() => { setEditing(s); setOpen(true); }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="outline" className="mr-2" onClick={() => { setPwdFor(s); setPwd(""); }}>
                        <KeyRound className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => remove(s)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <StaffDialog
          staff={editing}
          roles={roles}
          onClose={() => setOpen(false)}
          onSave={async (v) => {
            try {
              if (editing) {
                await updateFn({
                  data: {
                    id: editing.id,
                    patch: {
                      full_name: v.fullName,
                      designation: v.designation,
                      mobile_number: v.mobileNumber,
                      email: v.email,
                      role_name: v.roleName,
                      is_active: v.isActive,
                    },
                  },
                });
              } else {
                await createFn({
                  data: {
                    fullName: v.fullName,
                    designation: v.designation,
                    mobileNumber: v.mobileNumber,
                    email: v.email,
                    password: v.password,
                    roleName: v.roleName,
                    baseRole: v.baseRole as any,
                  },
                });
              }
              setOpen(false);
              await onChanged();
              toast.success("Staff saved");
            } catch (e: any) {
              toast.error(e.message);
            }
          }}
        />
      )}

      {pwdFor && (
        <Dialog open onOpenChange={(o) => !o && setPwdFor(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Reset password — {pwdFor.full_name}</DialogTitle></DialogHeader>
            <Input type="text" placeholder="New password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setPwdFor(null)}>Cancel</Button>
              <Button
                onClick={async () => {
                  try {
                    await resetFn({ data: { id: pwdFor.id, password: pwd } });
                    setPwdFor(null);
                    toast.success("Password updated");
                  } catch (e: any) {
                    toast.error(e.message);
                  }
                }}
              >
                Update
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function StaffDialog({
  staff,
  roles,
  onClose,
  onSave,
}: {
  staff: Staff | null;
  roles: MasterRole[];
  onClose: () => void;
  onSave: (v: {
    fullName: string;
    email: string;
    mobileNumber: string;
    designation: string;
    password: string;
    roleName: string;
    baseRole: string;
    isActive: boolean;
  }) => Promise<void>;
}) {
  const [fullName, setFullName] = useState(staff?.full_name ?? "");
  const [email, setEmail] = useState(staff?.email ?? "");
  const [mobileNumber, setMobile] = useState(staff?.mobile_number ?? "");
  const [designation, setDesignation] = useState(staff?.designation ?? "");
  const [password, setPassword] = useState("");
  const [roleName, setRoleName] = useState(staff?.role_name ?? "");
  const [isActive, setIsActive] = useState(staff ? Boolean(staff.is_active) : true);

  useEffect(() => {
    if (!roleName && roles.length) setRoleName(roles[0].name);
  }, [roles.length]);

  const baseRole = roles.find((r) => r.name === roleName)?.base_role ?? "staff";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>{staff ? "Edit Staff" : "Add Staff"}</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Full Name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email Address</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Mobile Number</Label>
            <Input value={mobileNumber} onChange={(e) => setMobile(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Designation</Label>
            <Input value={designation} onChange={(e) => setDesignation(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Assigned Role</Label>
            <Select value={roleName} onValueChange={setRoleName}>
              <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
              <SelectContent>
                {roles.map((r) => <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {!staff && (
            <div className="space-y-2 sm:col-span-2">
              <Label>Password</Label>
              <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 6 characters" />
            </div>
          )}
          <div className="flex items-center gap-3 sm:col-span-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <Label>Status: {isActive ? "Active" : "Inactive"}</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-gold-gradient text-gold-foreground shadow-gold"
            onClick={() =>
              onSave({ fullName, email, mobileNumber, designation, password, roleName, baseRole, isActive })
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
