import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { useAuth } from "../state/AuthContext";
import axiosInstance from "../api/client";
import "./NotificationBell.css";

export default function NotificationBell() {
  const { token } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  // Poll unread count every 60 seconds
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [token]);

  const fetchUnreadCount = async () => {
    try {
      const response = await axiosInstance.get("/alerts/notifications/unread-count/");
      setUnreadCount(response.data.unread_count || 0);
    } catch (error) {
      console.error("Failed to fetch unread count:", error);
    }
  };

  const fetchNotifications = async () => {
    if (!isOpen) return;
    
    setLoading(true);
    try {
      const response = await axiosInstance.get("/alerts/notifications/");
      // Get latest 5
      setNotifications(response.data.slice(0, 5));
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const markAsRead = async (notificationId) => {
    try {
      await axiosInstance.patch(`/alerts/notifications/${notificationId}/`);
      setNotifications(notifications.filter(n => n.id !== notificationId));
      setUnreadCount(Math.max(0, unreadCount - 1));
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axiosInstance.post("/alerts/notifications/mark-all-read/");
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "low_stock":
      case "out_of_stock":
        return "⚠️";
      case "subscription_expiring":
        return "📅";
      case "payment_success":
        return "✅";
      case "payment_failed":
        return "❌";
      default:
        return "🔔";
    }
  };

  return (
    <div className="notification-bell-wrapper">
      <button
        className="notification-bell-btn"
        onClick={() => setIsOpen(!isOpen)}
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
                    <div className="notification-icon">
                      {getNotificationIcon(notification.type)}
                    </div>
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
