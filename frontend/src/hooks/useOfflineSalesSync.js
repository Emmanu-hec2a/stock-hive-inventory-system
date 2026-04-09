import { useEffect, useRef, useState } from "react";
import { useAuth } from "../state/AuthContext";
import { countPendingSales, OFFLINE_SALES_EVENT, syncPendingSales } from "../utils/offlineSales";

export function useOfflineSalesSync() {
  const { token, user } = useAuth();
  const [pendingSalesCount, setPendingSalesCount] = useState(0);
  const syncInFlightRef = useRef(false);
  const actorId = user?.id || user?.email || "default";

  useEffect(() => {
    if (!token) {
      setPendingSalesCount(0);
      return undefined;
    }

    let isActive = true;

    const refreshCount = async () => {
      try {
        const pendingCount = await countPendingSales(actorId);
        if (isActive) {
          setPendingSalesCount(pendingCount);
        }
      } catch (error) {
        if (isActive) {
          setPendingSalesCount(0);
        }
      }
    };

    const runSync = async () => {
      if (syncInFlightRef.current || !navigator.onLine) return;

      syncInFlightRef.current = true;

      try {
        const result = await syncPendingSales({ actorId });
        if (isActive) {
          setPendingSalesCount(result.pendingCount || 0);
        }
      } finally {
        syncInFlightRef.current = false;
      }
    };

    refreshCount();
    runSync();

    const handleOnline = () => {
      runSync();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshCount();
        runSync();
      }
    };

    const handleOfflineSalesChanged = () => {
      refreshCount();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener(OFFLINE_SALES_EVENT, handleOfflineSalesChanged);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isActive = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener(OFFLINE_SALES_EVENT, handleOfflineSalesChanged);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [token, actorId]);

  return { pendingSalesCount };
}
