import { useState, useEffect } from "react";
import { MessageCircle, Check, X } from "lucide-react";
import axiosInstance from "../api/client";
import "./WhatsAppConnection.css";

export default function WhatsAppConnection() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessageAt, setLastMessageAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchConnectionStatus();
  }, []);

  const fetchConnectionStatus = async () => {
    try {
      const response = await axiosInstance.get("/alerts/whatsapp/");
      setIsConnected(response.data.connected);
      if (response.data.connected) {
        setPhoneNumber(response.data.phone_number);
        setLastMessageAt(response.data.last_message_at);
      }
    } catch (error) {
      console.error("Failed to fetch WhatsApp status:", error);
    }
  };

  const validatePhoneNumber = (phone) => {
    // Kenya format: 2547XXXXXXXX (12 digits) or 07XXXXXXXX (10 digits)
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10 && cleaned.startsWith("7")) {
      return "254" + cleaned;
    }
    if (cleaned.length === 12 && cleaned.startsWith("254")) {
      return cleaned;
    }
    return null;
  };

  const handleConnect = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const validatedPhone = validatePhoneNumber(phoneNumber);
    if (!validatedPhone) {
      setError("Invalid phone number. Use 254XXXXXXXXX or 07XXXXXXXXX format.");
      return;
    }

    setLoading(true);
    try {
      const response = await axiosInstance.post("/alerts/whatsapp/", {
        phone_number: validatedPhone,
      });
      setIsConnected(true);
      setPhoneNumber(validatedPhone);
      setSuccess("WhatsApp alerts connected successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      setError(error.response?.data?.error || "Failed to connect WhatsApp.");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Are you sure you want to disconnect WhatsApp alerts?")) {
      return;
    }

    setLoading(true);
    try {
      await axiosInstance.delete("/alerts/whatsapp/");
      setIsConnected(false);
      setPhoneNumber("");
      setLastMessageAt(null);
      setSuccess("WhatsApp alerts disconnected.");
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      setError("Failed to disconnect WhatsApp.");
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="whatsapp-connection-card">
      <div className="whatsapp-header">
        <div className="whatsapp-title-group">
          <MessageCircle size={24} className="whatsapp-icon" />
          <div>
            <h3>WhatsApp Alerts</h3>
            <p>Get low stock alerts on WhatsApp</p>
          </div>
        </div>
        {isConnected && <Check size={20} className="connected-badge" />}
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="whatsapp-content">
        {!isConnected ? (
          <form onSubmit={handleConnect} className="whatsapp-form">
            <div className="form-group">
              <label htmlFor="phone">Phone Number</label>
              <input
                id="phone"
                type="tel"
                placeholder="254712345678 or 0712345678"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={loading}
                className="form-input"
              />
              <small className="form-hint">
                Enter your WhatsApp number (Kenya format: 254 + phone number)
              </small>
            </div>

            <button type="submit" disabled={loading} className="primary-btn">
              {loading ? "Connecting..." : "Connect WhatsApp"}
            </button>
          </form>
        ) : (
          <div className="whatsapp-status">
            <div className="status-item">
              <span className="status-label">Connected Number:</span>
              <span className="status-value">{phoneNumber}</span>
            </div>
            {lastMessageAt && (
              <div className="status-item">
                <span className="status-label">Last Alert Sent:</span>
                <span className="status-value">{formatTimeAgo(lastMessageAt)}</span>
              </div>
            )}

            <div className="status-info">
              <p>✓ Low stock alerts are now enabled on WhatsApp</p>
              <p>✓ You'll receive alerts when products run low</p>
            </div>

            <button
              onClick={handleDisconnect}
              disabled={loading}
              className="danger-btn"
            >
              {loading ? "Disconnecting..." : "Disconnect WhatsApp"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
