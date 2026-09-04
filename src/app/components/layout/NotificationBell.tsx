import { useEffect, useRef, useState } from "react";
import { Bell, Check } from "lucide-react";
import { useNavigate } from "react-router";
import { NOTIFICATION_EVENT_TYPES } from "@/app/data/notifications";
import { useNotifications, markAllRead, markNotificationRead } from "@/app/lib/notificationsStore";
import { formatDate } from "@/app/components/ui/utils";
import { translate } from "@/app/i18n";

// Brief §8: "in-app notification center + email for every step of the
// commercial chain." Backed by notificationsStore.ts now, not a static
// sample — every row here is something that actually happened in this
// session (or the seed data a fresh session starts from). Filtered by
// n.portal, the field the store's own addNotification() call sites set
// directly, replacing the old recipient.startsWith("Thailand Post"/
// "FleetCo") string-matching. NotificationCenter.tsx (the ops full page)
// reads the same store; the client portal has no full page of its own, so
// this dropdown is its only surface.
export function NotificationBell({ portal }: { portal: "fleetco" | "client" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const all = useNotifications();

  const scoped = all
    .filter((n) => n.portal === portal && n.channels.includes("in_app"))
    .slice()
    .sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1));
  const unread = scoped.filter((n) => !n.read).length;
  const recent = scoped.slice(0, 6);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function eventLabel(id: string) {
    return translate(NOTIFICATION_EVENT_TYPES.find((e) => e.id === id)?.label ?? id);
  }

  function openNotification(n: (typeof scoped)[number]) {
    if (!n.read) markNotificationRead(n.id);
    setOpen(false);
    if (n.bookingId) navigate(portal === "client" ? `/portal/bookings/${n.bookingId}` : `/ops/bookings/${n.bookingId}`);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
        title={translate("Notifications")}
        aria-label={unread > 0 ? translate("Notifications ({count} unread)", { count: unread }) : translate("Notifications")}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls="notification-menu"
      >
        <Bell size={19} />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-semibold flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div id="notification-menu" role="menu" className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-900">{translate("Notifications")}</span>
            {unread > 0 && (
              <button
                onClick={() => markAllRead(portal)}
                className="flex items-center gap-1 text-xs text-[var(--portal-accent)] hover:text-[var(--portal-accent-hover)] cursor-pointer"
              >
                <Check size={12} /> {translate("Mark all as read")}
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-50">
            {recent.length === 0 ? (
              <p className="px-4 py-6 text-xs text-slate-400 text-center">{translate("No notifications")}</p>
            ) : (
              recent.map((n) => (
                <button
                  key={n.id}
                  role="menuitem"
                  onClick={() => openNotification(n)}
                  className={`w-full text-left px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors ${!n.read ? "bg-[var(--portal-accent-light)]/40" : ""}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-[var(--portal-accent)] mt-1.5 shrink-0" />}
                    <div className={n.read ? "pl-3.5" : ""}>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide">{eventLabel(n.eventTypeId)}</p>
                      <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">{n.message}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{formatDate(n.sentAt)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
