import { useState } from "react";
import { Button } from "@/app/components/ui/Button";
import { Label } from "@/app/components/ui/Label";
import { toast } from "sonner";
import { translate } from "@/app/i18n";
import { KeyRound, User, Eye, EyeOff } from "lucide-react";
import { getAdminRole, getStoredPassword, setStoredPassword, ROLE_LABELS, ROLE_PORTAL } from "@/app/lib/auth";
import { ActionModal } from "@/app/components/ui/ActionModal";

const MIN_PASSWORD_LENGTH = 8;
const PASSWORD_CHARACTERS = /^[A-Za-z0-9!@#$%^&*()[\]{};:'",.?/\\|`~_+=-]+$/;

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
          className="w-full rounded-lg border border-slate-200 pl-3 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent-ring)]"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Hide password" : "Show password"}
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
// One real difference from the reference: this demo has no per-user accounts
// at all — one shared password gates every role on both portals
// (LoginPage.tsx's own getStoredPassword() check). There is no email row to
// show because the data model does not track an individual behind each role.

function ResetPasswordModal({ onClose }: { onClose: () => void }) {
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  // Checked live, not just on submit — same "disable Confirm until the form
  // is actually valid" treatment LoginPage.tsx's own submit button already
  // uses (canSubmit), rather than letting a bad attempt through to an error
  // message after the fact.
  const mismatch = confirm.length > 0 && next !== confirm;
  const hasAllowedCharacters = next.length > 0 && PASSWORD_CHARACTERS.test(next);
  const canConfirm = next.length >= MIN_PASSWORD_LENGTH && hasAllowedCharacters && next === confirm;

  function handleConfirm() {
    if (!canConfirm) return;
    setStoredPassword(next);
    toast.success(translate("Password reset successfully."));
    onClose();
  }

  return (
    <ActionModal title="Reset Password" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <PasswordField label="New password" value={next} onChange={setNext} autoFocus />
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
            Must be at least {MIN_PASSWORD_LENGTH} characters using letters (A–Z, a–z), numbers (0–9), or symbols.
          </p>
          {next.length > 0 && !hasAllowedCharacters && (
            <p className="mt-1.5 text-xs text-rose-600">Use only letters, numbers, or symbols.</p>
          )}
        </div>
        <div>
          <PasswordField label="Confirm new password" value={confirm} onChange={setConfirm} />
          {mismatch && <p className="mt-1.5 text-xs text-rose-600">Passwords don&apos;t match.</p>}
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
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--portal-accent)] text-white">
            <User size={18} strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{role ? ROLE_LABELS[role] : "Signed in"}</p>
            <p className="text-xs text-slate-400">{portal === "client" ? "Thailand Post — Client Portal" : "FleetCo Team"}</p>
          </div>
        </div>

        <div className="px-5 py-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Security</p>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="mb-1.5 text-xs text-slate-500">Password</p>
              <p className="tracking-widest text-slate-600">{dots}</p>
            </div>
            <button
              onClick={() => setShowReset(true)}
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-[var(--portal-accent-light)] px-3 text-xs font-medium text-[var(--portal-accent)] transition-colors hover:opacity-80 cursor-pointer"
            >
              <KeyRound size={13} /> Reset Password
            </button>
          </div>
        </div>
      </div>

      {showReset && <ResetPasswordModal onClose={() => setShowReset(false)} />}
    </div>
  );
}
