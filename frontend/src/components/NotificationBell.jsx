import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import axiosInstance from "../api/client";
import { useAuth } from "../state/AuthContext";
import { clearNativeAppBadge, setNativeAppBadge } from "../utils/appBadge";
import "./NotificationBell.css";

function getNotificationIcon(type) {
  switch (type) {
    case "low_stock":
    case "out_of_stock":
      return "[!]";
    case "subscription_expiring":
      return "[plan]";
    case "payment_success":
      return "[ok]";
    case "payment_failed":
      return "[x]";
    default:
      return "[bell]";
  }
}

export default function NotificationBell() {
  const { token, scopedQuery } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const withScope = (path) => `${path}${scopedQuery}`;

  const fetchUnreadCount = async () => {
    try {
      const response = await axiosInstance.get(withScope("/alerts/notifications/unread-count/"));
      const count = Number(response.data?.unread_count || 0);
      setUnreadCount(count);
      await setNativeAppBadge(count);
    } catch (error) {
      console.error("Failed to fetch unread count:", error);
    }
  };

  const fetchNotifications = async () => {
    if (!isOpen) return;

    setLoading(true);

    try {
      const response = await axiosInstance.get(withScope("/alerts/notifications/"));
      setNotifications(response.data.slice(0, 5));
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      setUnreadCount(0);
      return undefined;
    }

    fetchUnreadCount();
    const intervalId = window.setInterval(fetchUnreadCount, 60_000);
    return () => window.clearInterval(intervalId);
  }, [token, scopedQuery]);

  useEffect(() => {
    if (!isOpen) return;

    fetchNotifications();
    clearNativeAppBadge();
  }, [isOpen, scopedQuery]);

  const markAsRead = async (notificationId) => {
    try {
      await axiosInstance.patch(withScope(`/alerts/notifications/${notificationId}/`));
      setNotifications((current) => current.filter((notification) => notification.id !== notificationId));
      setUnreadCount((current) => {
        const nextCount = Math.max(0, current - 1);
        setNativeAppBadge(nextCount);
        return nextCount;
      });
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axiosInstance.post(withScope("/alerts/notifications/mark-all-read/"));
      setNotifications([]);
      setUnreadCount(0);
      await clearNativeAppBadge();
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  return (
    <div className="notification-bell-wrapper">
      <button
        className="notification-bell-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        title="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="notification-backdrop" onClick={() => setIsOpen(false)} />
          <div className="notification-dropdown">
            <div className="notification-header">
              <h3>Notifications</h3>
              <button
                className="close-btn"
                onClick={() => setIsOpen(false)}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="notification-list">
              {loading ? (
                <div className="notification-loading">Loading...</div>
              ) : notifications.length === 0 ? (
                <div className="notification-empty">No new notifications</div>
              ) : (
                notifications.map((notification) => (
                  <div key={notification.id} className="notification-card">
                    <div className="notification-icon">{getNotificationIcon(notification.type)}</div>
                    <div className="notification-content">
                      <h4>{notification.title}</h4>
                      <p>{notification.message}</p>
                      <small>{notification.time_ago}</small>
                    </div>
                    <button
                      className="notification-dismiss"
                      onClick={() => markAsRead(notification.id)}
                      title="Dismiss"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {notifications.length > 0 && (
              <div className="notification-footer">
                <button className="mark-all-read-btn" onClick={markAllAsRead}>
                  Mark all as read
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
