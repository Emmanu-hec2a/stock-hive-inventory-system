import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: "24px",
      left: "24px",
      backgroundColor: "#ef4444",
      color: "#fef2f2",
      padding: "12px 16px",
      borderRadius: "8px",
      display: "flex",
      gap: "8px",
      alignItems: "center",
      zIndex: 40,
      fontSize: "14px",
      fontWeight: "500",
      boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
    }}>
      <WifiOff size={16} />
      <span>Offline Mode - Sales will sync when online</span>
    </div>
  );
}
