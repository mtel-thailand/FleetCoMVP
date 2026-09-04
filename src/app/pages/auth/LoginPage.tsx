import { useState } from "react";
import { Modal, ModalTitle } from "@/app/components/ui/Modal";
import { useNavigate, Navigate, Link } from "react-router";
import { EyeOff, Eye, Truck, Building2, ChevronRight } from "lucide-react";
import fleetcoLogo from "@/assets/fleetco-logo.svg";
import thailandPostLogo from "@/assets/thailand-post-logo.png";
import {
  getStoredPassword,
  isAuthenticated,
  setAuthenticated,
  setAdminRole,
  ROLE_LABELS,
  ROLE_DEFAULT,
  type AdminRole,
} from "@/app/lib/auth";
import { LanguageToggle, useI18n } from "@/app/i18n";

// ── Role selection modal ────────────────────────────────────────────────────
// Demo-mode only: in production each portal has its own login/SSO and the
// role comes from the authenticated account, not a manual picker.

const FLEETCO_ROLES: AdminRole[] = ["platform_admin", "ops_manager", "account_manager", "finance", "read_only"];
const CLIENT_ROLES: AdminRole[] = ["client_admin", "client_approver", "client_requester", "client_finance"];

type Portal = "fleetco" | "client";

// ── Portal toggle ────────────────────────────────────────────────────────
// Demo-mode only, same spirit as the role picker below: in production the
// portal is determined by which domain/app the person is on, not a switch
// on the login screen. Picking a side here just scopes which role group
// the modal below shows, and rebrands the card so it's obvious which
// sign-in you're about to do.
function PortalToggle({ value, onChange }: { value: Portal; onChange: (v: Portal) => void }) {
  return (
    <div className="inline-flex items-center gap-1 bg-white/10 backdrop-blur rounded-full p-1 border border-white/10">
      <button
        type="button"
        onClick={() => onChange("fleetco")}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
          value === "fleetco" ? "bg-white text-slate-900 shadow-sm" : "text-slate-300 hover:text-white"
        }`}
      >
        <Truck size={13} /> FleetCo
      </button>
      <button
        type="button"
        onClick={() => onChange("client")}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
          value === "client" ? "bg-white text-slate-900 shadow-sm" : "text-slate-300 hover:text-white"
        }`}
      >
        <Building2 size={13} /> Thailand Post
      </button>
    </div>
  );
}

function RoleModal({ portal, onClose, onSelect }: { portal: Portal; onClose: () => void; onSelect: (role: AdminRole) => void }) {
  const roles = portal === "fleetco" ? FLEETCO_ROLES : CLIENT_ROLES;
  const [selected, setSelected] = useState<AdminRole>(roles[0]);

  return (
    <Modal
      onClose={onClose}
      overlayClassName="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      contentClassName="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
      // data-portal drives the accent-colour override in theme.css. It has to stay
      // on the overlay itself: Modal portals this out to document.body, so the
      // attribute no longer inherits from the page wrapper the way it did when
      // this overlay was rendered inline.
      overlayProps={{ "data-portal": portal }}

    >
        <div className="px-6 pt-6 pb-4 border-b border-slate-100">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--portal-accent)] mb-1">Demo Mode</p>
          <ModalTitle asChild><h2 className="text-slate-900 text-lg font-semibold">
            {portal === "fleetco" ? "Sign in as — FleetCo Team" : "Sign in as — Thailand Post"}
          </h2></ModalTitle>
          <p className="text-slate-400 text-sm mt-1">In production this comes from the account, not a picker.</p>
        </div>

        <div className="px-6 py-4 space-y-2 max-h-[60vh] overflow-y-auto">
          {roles.map((role) => {
            const isChosen = selected === role;
            return (
              <button
                key={role}
                onClick={() => setSelected(role)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-all cursor-pointer
                  ${isChosen ? "border-[var(--portal-accent-soft)] bg-white ring-2 ring-[var(--portal-accent-ring)]" : "border-slate-200 bg-white hover:border-slate-300"}`}
              >
                <span className={`text-sm font-medium ${isChosen ? "text-[var(--portal-accent)]" : "text-slate-700"}`}>
                  {ROLE_LABELS[role]}
                </span>
                <div className={`shrink-0 w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center
                  ${isChosen ? "border-[var(--portal-accent)]" : "border-slate-300"}`}
                >
                  {isChosen && <div className="w-2 h-2 rounded-full bg-[var(--portal-accent)]" />}
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-6 pb-6 pt-2">
          <button
            onClick={() => onSelect(selected)}
            className="w-full h-12 rounded-xl text-sm font-semibold bg-[var(--portal-accent)] hover:bg-[var(--portal-accent-hover)] text-white transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
          >
            Continue <ChevronRight size={16} />
          </button>
        </div>
      </Modal>
  );
}

// ── Login page ────────────────────────────────────────────────────────────

export function LoginPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  // Demo mode only — pre-filled so the common path is just "hit Log in".
  // Real credential fields obviously wouldn't ship pre-populated like this.
  const [username, setUsername] = useState("demo");
  const [password, setPassword] = useState(getStoredPassword());
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [portal, setPortal] = useState<Portal>("fleetco");

  if (isAuthenticated()) {
    return <Navigate to="/ops/dashboard" replace />;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== getStoredPassword()) {
      setError(t("Invalid username or password"));
      return;
    }
    setError("");
    // For now, skip the role picker and always sign in as the main admin
    // role for whichever portal is selected (roles[0] in FLEETCO_ROLES/
    // CLIENT_ROLES — platform_admin / client_admin, the same role the
    // picker itself defaulted to). RoleModal/showRoleModal are left in
    // place, not deleted, in case picking a different demo role is wanted
    // again later — this just bypasses opening it.
    const roles = portal === "fleetco" ? FLEETCO_ROLES : CLIENT_ROLES;
    handleRoleSelect(roles[0]);
  }

  function handleRoleSelect(role: AdminRole) {
    setAuthenticated(true);
    setAdminRole(role);
    navigate(ROLE_DEFAULT[role]);
  }

  function handlePasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPassword(e.target.value);
    if (error) setError("");
  }

  const canSubmit = username.trim().length > 0 && password.length > 0;

  return (
    <>
      <div
        className="relative min-h-screen flex flex-col items-center justify-center gap-5 p-4 overflow-hidden"
        data-portal={portal}
        style={{
          backgroundColor: "#0f172a",
          backgroundImage:
            portal === "fleetco"
              ? "radial-gradient(circle at 20% 20%, rgba(59,130,246,0.15), transparent 40%), radial-gradient(circle at 80% 80%, rgba(59,130,246,0.12), transparent 40%)"
              : "radial-gradient(circle at 20% 20%, rgba(136,19,55,0.22), transparent 40%), radial-gradient(circle at 80% 80%, rgba(136,19,55,0.18), transparent 40%)",
        }}
      >
        <div className="absolute top-4 right-4 z-10">
          <LanguageToggle inverse />
        </div>

        <div className="relative z-10 flex items-center gap-2">
          <PortalToggle value={portal} onChange={setPortal} />
        </div>

        {/* Login card */}
        <div className="relative z-10 w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Logo */}
          <div className="flex flex-col items-center pt-12 pb-3 px-6">
            {/* Both portals now have their real marks — FleetCo's
                (src/assets/fleetco-logo.svg) and Thailand Post's actual
                logo (src/assets/thailand-post-logo.png, their real
                checkmark wordmark). Both render directly on the card's
                white background rather than boxed in the accent-colored
                square the old Truck/Building2 icons used, since each mark
                already carries its own coloring and doesn't need a
                backdrop to read. */}
            <img
              src={portal === "fleetco" ? fleetcoLogo : thailandPostLogo}
              alt={portal === "fleetco" ? "FleetCo Platform" : "Thailand Post"}
              className="h-[60px] w-auto mb-3"
            />
            {/* Both marks already spell out their own name (FleetCo's as a
                wordmark, Thailand Post's real logo the same way) —
                repeating it in a text line right underneath would just be
                the same name twice in a row, so neither portal gets one
                anymore. */}
            <div className="text-slate-400 text-xs">{portal === "fleetco" ? "B2B Fleet Management" : "Client Self-Service Portal"}</div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 pt-7 pb-8 space-y-3">
            <div className={`bg-white border rounded-2xl px-4 pt-2 pb-2 focus-within:ring-2 transition ${error ? "border-red-400 focus-within:border-red-400 focus-within:ring-red-500/10" : "border-slate-200 focus-within:border-[var(--portal-accent-soft)] focus-within:ring-[var(--portal-accent-ring)]"}`}>
              <label className="block text-sm font-medium text-slate-700 mb-0.5">Username</label>
              <input
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => { setUsername(e.target.value); if (error) setError(""); }}
                className="w-full text-sm text-slate-900 placeholder-slate-400 bg-transparent outline-none"
              />
            </div>

            <div className={`relative bg-white border rounded-2xl px-4 pt-2 pb-2 focus-within:ring-2 transition ${error ? "border-red-400 focus-within:border-red-400 focus-within:ring-red-500/10" : "border-slate-200 focus-within:border-[var(--portal-accent-soft)] focus-within:ring-[var(--portal-accent-ring)]"}`}>
              <label className="block text-sm font-medium text-slate-700 mb-0.5">Password</label>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={handlePasswordChange}
                className="w-full pr-8 text-sm text-slate-900 placeholder-slate-400 bg-transparent outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>

            <div className="pt-5">
              <button
                type="submit"
                disabled={!canSubmit}
                className={`w-full h-12 rounded-xl text-sm font-semibold transition-all
                  ${canSubmit ? "bg-[var(--portal-accent)] hover:bg-[var(--portal-accent-hover)] text-white shadow-sm cursor-pointer" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}
              >
                Log in
              </button>
            </div>

            {/* The demo-password helper text used to sit here unconditionally — removed
                for clarity, since real users of this login page shouldn't
                see demo/test credentials called out on it. The error path
                stays: username/password are still validated against
                getStoredPassword() (see handleSubmit above), this just no
                longer advertises what the right answer is when nothing's
                wrong yet. */}
            {error && (
              <p className="text-xs text-center min-h-[1rem] pt-2">
                <span className="text-red-500">{error}</span>
              </p>
            )}
          </form>
        </div>
      </div>

      {showRoleModal && <RoleModal portal={portal} onClose={() => setShowRoleModal(false)} onSelect={handleRoleSelect} />}
    </>
  );
}
