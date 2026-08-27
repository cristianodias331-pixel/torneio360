import { useCallback, useEffect, useState } from "react";
import { loadMyNotifications } from "../../services/notificationApi.mjs";

export const NOTIFICATION_STATE_EVENT = "torneio360:notifications-changed";

export function broadcastUnreadNotificationCount(unreadCount) {
  window.dispatchEvent(new CustomEvent(NOTIFICATION_STATE_EVENT, {
    detail: { unreadCount: Math.max(0, Number(unreadCount) || 0) },
  }));
}

export default function useUnreadNotificationCount({ supabase, enabled = true } = {}) {
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!enabled || !supabase) {
      setUnreadCount(0);
      return 0;
    }
    try {
      const result = await loadMyNotifications({ supabase, limit: 100 });
      const nextCount = result.notifications.filter((item) => !item.read_at).length;
      setUnreadCount(nextCount);
      return nextCount;
    } catch (error) {
      console.warn("Indicador de notificações indisponível:", error);
      return 0;
    }
  }, [enabled, supabase]);

  useEffect(() => {
    if (!enabled || !supabase) return undefined;
    void refresh();

    const handleNotificationState = (event) => {
      if (Number.isFinite(Number(event?.detail?.unreadCount))) {
        setUnreadCount(Math.max(0, Number(event.detail.unreadCount)));
      } else {
        void refresh();
      }
    };
    const handleFocus = () => { void refresh(); };
    const intervalId = window.setInterval(refresh, 30000);
    window.addEventListener(NOTIFICATION_STATE_EVENT, handleNotificationState);
    window.addEventListener("focus", handleFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener(NOTIFICATION_STATE_EVENT, handleNotificationState);
      window.removeEventListener("focus", handleFocus);
    };
  }, [enabled, refresh, supabase]);

  return { unreadCount, refresh };
}
