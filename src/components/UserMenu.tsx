import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { changeMyPassword } from "@/lib/profile.functions";
import type { UserProfile } from "@/hooks/use-permissions";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function UserMenu({
  profile,
  roleName,
  isOwner,
  onSignOut,
}: {
  profile: UserProfile;
  roleName: string;
  isOwner: boolean;
  onSignOut: () => void;
}) {
  const [pwdOpen, setPwdOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const displayRole = isOwner ? roleName || "Owner" : roleName || "—";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-white/10">
            <Avatar className="h-9 w-9 border border-white/30">
              {profile.photoUrl && <AvatarImage src={profile.photoUrl} alt={profile.fullName} />}
              <AvatarFallback className="bg-gold-gradient text-xs font-bold text-primary">
                {initials(profile.fullName) || "SE"}
              </AvatarFallback>
            </Avatar>
            <div className="hidden leading-tight sm:block">
              <p className="text-[10px] uppercase tracking-widest text-gold">Welcome</p>
              <p className="text-sm font-semibold">{profile.fullName}</p>
              <p className="text-[11px] text-primary-foreground/70">
                {profile.designation || displayRole}
                {profile.designation && displayRole !== profile.designation ? ` · ${displayRole}` : ""}
              </p>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel>
            <p className="font-semibold">{profile.fullName}</p>
            <p className="text-xs font-normal text-muted-foreground">{profile.email}</p>
            <p className="text-xs font-normal text-muted-foreground">
              {profile.designation || "—"} · {displayRole}
            </p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setProfileOpen(true)}>
            <User className="mr-2 h-4 w-4" /> My Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPwdOpen(true)}>
            <KeyRound className="mr-2 h-4 w-4" /> Change Password
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onSignOut}>
            <LogOut className="mr-2 h-4 w-4" /> Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {profileOpen && (
        <Dialog open onOpenChange={(o) => !o && setProfileOpen(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>My Profile</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <Row label="Full Name" value={profile.fullName} />
              <Row label="Designation" value={profile.designation || "—"} />
              <Row label="Role" value={displayRole} />
              <Row label="Email" value={profile.email} />
              <Row label="Mobile" value={profile.mobile || "—"} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setProfileOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {pwdOpen && <ChangePasswordDialog onClose={() => setPwdOpen(false)} />}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const changeFn = useServerFn(changeMyPassword);
  const [pwd, setPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Change Password</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>New password</Label>
            <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Confirm password</Label>
            <Input
              type="password"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy || pwd.length < 6 || pwd !== confirmPwd}
            onClick={async () => {
              setBusy(true);
              try {
                await changeFn({ data: { password: pwd } });
                toast.success("Password updated");
                onClose();
              } catch (e: any) {
                toast.error(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Saving..." : "Update"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
