import { useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import axiosInstance from "../api/client.js";
import WhatsAppConnection from "../components/WhatsAppConnection";
import { PLAN_FEATURES } from "../constants/plans";
import "../styles/SettingsPage.css";

export default function SettingsPage() {
  const { user, subscription } = useAuth();
  const navigate = useNavigate();
  const plan = subscription?.plan || "free";
  const planFeatures = PLAN_FEATURES[plan] || [];
  const canSubmitSupportTicket = planFeatures.includes("*") || planFeatures.includes("priority_support");

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

{subscription && subscription.plan !== 'free' && (
              <div className="info-item">
                <span className="info-label">Plan:</span>
                <span className="info-value plan-badge">
                  {subscription.plan.toUpperCase()}
                </span>
              </div>
            )}
          
          <button className="btn btn-primary" disabled={!canSubmitSupportTicket} onClick={async () => {
            try {
              await axiosInstance.post('/alerts/tickets/', {
                subject: 'General Support Request',
                description: `Need help with my account.\n\nUser: ${user?.full_name || 'N/A'}\nEmail: ${user?.email || 'N/A'}\nRole: ${user?.role || 'N/A'}`
              });
              alert('Support ticket submitted! Admin will contact you within 24hrs.');
            } catch (err) {
              console.error('Ticket error:', err);
              const errorMessage =
                err?.response?.data?.detail ||
                err?.response?.data?.business?.[0] ||
                err?.response?.data?.subject?.[0] ||
                err?.response?.data?.description?.[0] ||
                'Could not submit ticket.';
              alert(errorMessage);
            }
          }}> Submit Support Ticket</button>
          {!canSubmitSupportTicket && (
            <p className="settings-description">
              Support tickets are available on Pro and Enterprise plans.
            </p>
          )}
        </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
