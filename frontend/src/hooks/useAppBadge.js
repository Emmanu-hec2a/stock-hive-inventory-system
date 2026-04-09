import { useEffect } from "react";
import api from "../api/client";
import { useAuth } from "../state/AuthContext";
import { clearNativeAppBadge, setNativeAppBadge, supportsAppBadge } from "../utils/appBadge";

const POLL_INTERVAL_MS = 60_000;

export function useAppBadge() {
  const { token, scopedQuery } = useAuth();

  useEffect(() => {
    if (!token) {
      clearNativeAppBadge();
      return undefined;
    }

    if (!supportsAppBadge()) {
      return undefined;
    }

    let isActive = true;

    const updateBadge = async () => {
      try {
        const response = await api.get(`/alerts/notifications/unread-count/${scopedQuery}`);
        if (!isActive) return;

        const unreadCount = Number(response.data?.unread_count || 0);
        await setNativeAppBadge(unreadCount);
      } catch (error) {
        // Keep the in-app bell as the source of truth if badge refresh fails.
      }
    };

    updateBadge();

    const intervalId = window.setInterval(updateBadge, POLL_INTERVAL_MS);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        updateBadge();
      }
    };
    const handleOnline = () => updateBadge();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
    };
  }, [token, scopedQuery]);
}
