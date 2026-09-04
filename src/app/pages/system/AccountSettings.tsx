import { useState } from "react";
import { Button } from "@/app/components/ui/Button";
import { Label } from "@/app/components/ui/Label";
import { toast } from "sonner";
import { translate } from "@/app/i18n";
import { KeyRound, User, Eye, EyeOff } from "lucide-react";
import { getAdminRole, getStoredPassword, setStoredPassword, ROLE_LABELS, ROLE_PORTAL } from "@/app/lib/auth";
import { ActionModal } from "@/app/components/ui/ActionModal";

const MIN_PASSWORD_LENGTH = 4;

// Same show/hide-on-focus password field LoginPage.tsx already uses (Eye/
// EyeOff toggle, absolutely-positioned inside the field) — one shared shape
// so a password field looks and behaves the same wherever this app has one,
// rather than this modal growing its own slightly-different version.
function PasswordField({
  label, value, onChange, autoFocus,
}: { label: string; value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <Label>{label}</Label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-slate-200 rounded-lg pl-3 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
        >
          {show ? <Eye size={15} /> : <EyeOff size={15} />}
        </button>
      </div>
    </div>
  );
}

// Reachable from both portals (ops/account, portal/account — see
// routes.tsx) via the same clickable footer identity block every role
// already sees in Sidebar.tsx. Modeled on the reference ThaiPass CMS
// Admin's own Account Management screen (profile card + a Security section
// with Reset Password) — the one piece of that page this demo can actually
// back with something real: getStoredPassword/setStoredPassword already
// existed in auth.ts with zero callers anywhere, clearly staged for exactly
// this and never wired up.
//
// One real difference from the reference, said plainly in the copy below
// rather than glossed over: this demo has no per-user accounts at all — one
// shared password gates every role on both portals (LoginPage.tsx's own
// getStoredPassword() check). Resetting it here changes what *everyone*
// signs in with next time, not just this session's own role, so there's no
// "my email" row to show either — there isn't one, nothing in this app's
// data model tracks who's actually behind a given role.

function ResetPasswordModal({ onClose }: { onClose: () => void }) {
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  // Checked live, not just on submit — same "disable Confirm until the form
  // is actually valid" treatment LoginPage.tsx's own submit button already
  // uses (canSubmit), rather than letting a bad attempt through to an error
  // message after the fact.
  const mismatch = confirm.length > 0 && next !== confirm;
  const canConfirm = next.length >= MIN_PASSWORD_LENGTH && next === confirm;

  function handleConfirm() {
    if (!canConfirm) return;
    setStoredPassword(next);
    toast.success(translate("Password reset — that's what every role on both portals signs in with now."));
    onClose();
  }

  return (
    <ActionModal title="Reset Password" subtitle="Shared across every role, both portals" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <PasswordField label="New password" value={next} onChange={setNext} autoFocus />
          <p className="text-[11px] text-slate-400 mt-1.5">
            Must be at least {MIN_PASSWORD_LENGTH} characters.
          </p>
        </div>
        <div>
          <PasswordField label="Confirm new password" value={confirm} onChange={setConfirm} />
          {mismatch && <p className="text-xs text-red-500 mt-1.5">Passwords don't match.</p>}
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="md" className="flex-1 px-0 py-2" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="md" className="flex-1 px-0 py-2"
            disabled={!canConfirm}
            onClick={handleConfirm}
          >
            Confirm
          </Button>
        </div>
      </div>
    </ActionModal>
  );
}

export function AccountSettings() {
  const role = getAdminRole();
  const portal = role ? ROLE_PORTAL[role] : "fleetco";
  const [showReset, setShowReset] = useState(false);
  // Dot count follows the real stored password's length rather than a fixed
  // number — same "show something true, not a decorative placeholder"
  // standard the rest of this app holds its demo stand-ins to.
  const dots = "•".repeat(Math.max(getStoredPassword().length, 4));

  return (
    <div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4">
          <div className="w-11 h-11 rounded-full bg-[var(--portal-accent)] flex items-center justify-center text-white shrink-0">
            <User size={18} strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{role ? ROLE_LABELS[role] : "Signed in"}</p>
            <p className="text-xs text-slate-400">{portal === "client" ? "Thailand Post — Client Portal" : "FleetCo Team"}</p>
          </div>
        </div>

        <div className="border-t border-slate-100 px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-3">Security</p>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-500 mb-1.5">Password</p>
              <p className="text-slate-800 tracking-widest">{dots}</p>
            </div>
            <button
              onClick={() => setShowReset(true)}
              className="flex items-center gap-1.5 h-8 px-3 bg-[var(--portal-accent-light)] text-[var(--portal-accent)] rounded-lg text-xs font-medium hover:opacity-80 cursor-pointer shrink-0"
            >
              <KeyRound size={13} /> Reset Password
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
            Demo mode — there's no per-user account behind this: every role on both portals checks in against this one
            shared password (see the login screen). Resetting it updates what everyone signs in with next time, not
            just this session.
          </p>
        </div>
      </div>

      {showReset && <ResetPasswordModal onClose={() => setShowReset(false)} />}
    </div>
  );
}
