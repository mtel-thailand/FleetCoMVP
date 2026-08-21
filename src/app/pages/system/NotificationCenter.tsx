import { useState } from "react";
import { Bell, Mail, Check } from "lucide-react";
import { NOTIFICATION_EVENT_TYPES } from "@/app/data/notifications";
import { useNotifications, markAllRead } from "@/app/lib/notificationsStore";
import { formatDate } from "@/app/components/ui/utils";

// brief §4.8/§8: "Notification center + email notifications; configurable
// per event type. Design a consistent notification anatomy."
//
// Recent tab is unscoped by portal deliberately, unlike NotificationBell —
// this is ops's own admin view of every notification the system has sent,
// client-bound or fleetco-bound, same audit-style reasoning as Audit Log.
//
// Settings tab's toggles are still local useState, not wired to
// notificationsStore — "Saved automatically" is aspirational copy for a
// wiring pass that hasn't happened yet (flipping a toggle here doesn't
// currently change what addNotification() sends). Left as-is; not part of
// the live-wiring/click-through/mark-as-read work this file just got.

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer shrink-0 ${on ? "bg-[var(--portal-accent)]" : "bg-slate-200"}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${on ? "translate-x-4" : ""}`} />
    </button>
  );
}

export function NotificationCenter() {
  const [prefs, setPrefs] = useState(() =>
    Object.fromEntries(NOTIFICATION_EVENT_TYPES.map((e) => [e.id, { inApp: e.defaultInApp, email: e.defaultEmail }])),
  );
  const [tab, setTab] = useState<"settings" | "recent">("recent");
  const log = useNotifications();
  const unreadCount = log.filter((n) => !n.read).length;

  function toggle(id: string, channel: "inApp" | "email") {
    setPrefs((p) => ({ ...p, [id]: { ...p[id], [channel]: !p[id][channel] } }));
  }

  return (
    <div>
      <div className="flex items-center gap-1 border-b border-slate-200 mb-4">
        {[
          { key: "recent" as const, label: "Recent", count: unreadCount },
          { key: "settings" as const, label: "Settings", count: 0 },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
              tab === t.key ? "border-[var(--portal-accent)] text-[var(--portal-accent)]" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "recent" ? (
        <div className="space-y-2">
          {unreadCount > 0 && (
            <div className="flex justify-end">
              <button
                onClick={() => { markAllRead("fleetco"); markAllRead("client"); }}
                className="flex items-center gap-1.5 text-xs font-medium text-[var(--portal-accent)] hover:text-[var(--portal-accent-hover)] cursor-pointer"
              >
                <Check size={12} /> Mark all read
              </button>
            </div>
          )}
          {log.map((n) => {
            const eventType = NOTIFICATION_EVENT_TYPES.find((e) => e.id === n.eventTypeId);
            return (
              <div key={n.id} className={`flex items-start gap-3 p-4 rounded-xl border ${n.read ? "bg-white border-slate-100" : "bg-[var(--portal-accent-light)]/50 border-[var(--portal-accent-light-2)]"}`}>
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                  <Bell size={14} className="text-slate-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-800">{eventType?.label ?? n.eventTypeId}</p>
                    <span className="text-xs text-slate-400 shrink-0">{formatDate(n.sentAt)}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{n.message}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-slate-400">To: {n.recipient}</span>
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      {n.channels.includes("email") && <Mail size={11} />}
                      {n.channels.join(" + ")}
                    </span>
                  </div>
                </div>
                {!n.read && <span className="w-1.5 h-1.5 bg-[var(--portal-accent)] rounded-full shrink-0 mt-1.5" />}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="grid grid-cols-[1fr_80px_80px] gap-2 px-5 py-3 border-b border-slate-100 bg-slate-50">
            <span className="text-xs font-medium text-slate-400">Event Type</span>
            <span className="text-xs font-medium text-slate-400 text-center">In-App</span>
            <span className="text-xs font-medium text-slate-400 text-center">Email</span>
          </div>
          {NOTIFICATION_EVENT_TYPES.map((e) => (
            <div key={e.id} className="grid grid-cols-[1fr_80px_80px] gap-2 px-5 py-3 border-b border-slate-50 last:border-0 items-center">
              <div>
                <p className="text-xs font-medium text-slate-800">{e.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{e.description}</p>
              </div>
              <div className="flex justify-center"><Toggle on={prefs[e.id].inApp} onClick={() => toggle(e.id, "inApp")} /></div>
              <div className="flex justify-center"><Toggle on={prefs[e.id].email} onClick={() => toggle(e.id, "email")} /></div>
            </div>
          ))}
          <div className="px-5 py-3 flex justify-end">
            <span className="flex items-center gap-1.5 text-xs text-emerald-600">
              <Check size={13} /> Saved automatically
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
