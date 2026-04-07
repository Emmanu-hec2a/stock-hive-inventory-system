import { useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import WhatsAppConnection from "../components/WhatsAppConnection";
import "../styles/SettingsPage.css";

export default function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Only allow shop admins and above to access settings
  if (user?.role === "cashier") {
    navigate("/");
    return null;
  }

  return (
    <div className="settings-page">
      <h1 className="page-title">Settings</h1>

      <div className="settings-container">
        <div className="settings-row">
          {/* Notification Settings Section */}
          <section className="settings-section">
            <h2 className="settings-heading">Notification Preferences</h2>
            <p className="settings-description">
              Configure how you receive low stock alerts and other important notifications.
            </p>

            <div className="settings-content">
              <WhatsAppConnection />
            </div>
          </section>

          {/* About Section */}
          <section className="settings-section">
            <h2 className="settings-heading">About Your Account</h2>
            
            <div className="settings-content">
              <div className="info-card">
                <div className="info-item">
                  <span className="info-label">Name:</span>
                  <span className="info-value">{user?.full_name}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Email:</span>
                  <span className="info-value">{user?.email}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Role:</span>
                  <span className="info-value role-badge">
                    {user?.role?.replace("_", " ").toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
