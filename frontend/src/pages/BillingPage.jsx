import { useEffect, useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";
import api from "../api/client";
import { PLAN_PRICES } from "../constants/plans";
import { useAuth } from "../state/AuthContext";
import MpesaCheckoutModal from "../components/MpesaCheckoutModal";
import { SkeletonTable, SkeletonStatCards } from "../components/SkeletonLoaders";

const planCards = [
  {
    key: "free",
    title: "Free",
    price: 0,
    features: ["1 shop", "30 products", "2 staff", "Sales + stock + basic reports"],
  },
  {
    key: "basic",
    title: "Basic",
    price: PLAN_PRICES.basic,
    features: ["2 shops", "200 products", "5 staff", "Advanced reports, exports, barcodes"],
  },
  {
    key: "pro",
    title: "Pro",
    price: PLAN_PRICES.pro,
    features: ["3 shops", "Unlimited products", "15 staff", "Multi-branch, suppliers, audit logs", "Barcodes, receipt printing"],
  },
  {
    key: "enterprise",
    title: "Business Enterprise",
    price: null, // Custom pricing - negotiated with sales team
    features: ["Unlimited shops", "Unlimited products", "Unlimited staff", "All features enabled"],
  },
];

export default function BillingPage() {
  const { subscription, refreshSubscription, shops } = useAuth();
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [checkoutConfig, setCheckoutConfig] = useState(null); // { plan, price }

  const loadBilling = async () => {
    try {
      setIsLoading(true);
      const historyRes = await api.get("/billing/history/");
      await refreshSubscription();
      setHistory(historyRes.data);
    } catch (err) {
      setMessage("Could not load billing history.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBilling();
  }, []);

  const onCancelRenew = async () => {
    if (!window.confirm("Are you sure you want to cancel auto-renew?")) return;
    try {
      await api.post("/billing/cancel/");
      setMessage("Auto-renew cancelled.");
      loadBilling();
    } catch (error) {
      setMessage("Could not cancel auto-renew.");
    }
  };

  const proShopsNudge =
    subscription?.plan === "pro" && shops.length >= 3
      ? "Pro supports up to 3 branches. Upgrade to Enterprise for unlimited."
      : "";

  const expiryText = useMemo(() => {
    if (!subscription?.end_date || subscription.plan === "free") return "";
    const days = Math.ceil((new Date(subscription.end_date) - new Date()) / (1000 * 60 * 60 * 24));
    return days <= 5 ? `Your plan expires in ${Math.max(days, 0)} days. Renew to avoid interruption.` : "";
  }, [subscription]);

  return (
    <section>
      <h1 className="page-title">Subscription & Billing</h1>
      {message && (
        <div className="alert-bar" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <AlertCircle size={18} />
          {message}
        </div>
      )}
      {expiryText && (
        <div className="alert-bar" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <AlertCircle size={18} />
          {expiryText}
        </div>
      )}
      {proShopsNudge && (
        <div className="alert-bar" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <AlertCircle size={18} />
          {proShopsNudge}
        </div>
      )}

      {isLoading ? (
        <SkeletonStatCards count={4} />
      ) : (
        <div className="grid">
          <article className="card stat-card stat-amber">
            <p className="meta-label">Current Plan</p>
            <p className="stat-value">{subscription?.plan?.toUpperCase() || "-"}</p>
          </article>
          <article className="card stat-card stat-blue">
            <p className="meta-label">Status</p>
            <p className="mini-stat">{subscription?.status?.toUpperCase() || "-"}</p>
          </article>
          <article className="card stat-card stat-green">
            <p className="meta-label">Ends On</p>
            <p className="mini-stat">{subscription?.end_date || "Never"}</p>
          </article>
          <article className="card stat-card stat-red">
            <p className="meta-label">Auto Renew</p>
            <p className="mini-stat">{subscription?.auto_renew ? "ON" : "OFF"}</p>
          </article>
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 className="section-title" style={{ margin: 0 }}>Choose a plan</h3>
            {subscription?.auto_renew && subscription.plan !== 'free' && (
                <button className="ghost-btn btn-small" type="button" onClick={onCancelRenew}>
                    Cancel Auto-Renew
                </button>
            )}
        </div>
        <div className="plan-grid">
          {planCards.map((plan) => (
            <article
              key={plan.key}
              className={`card plan-card ${subscription?.plan === plan.key ? "plan-card-active" : ""}`}
            >
              <p className="meta-label">Plan</p>
              <h4 className="section-title">{plan.title}</h4>
              <p className="mini-stat">
                {plan.price !== null ? `KES ${plan.price.toLocaleString()}/month` : "Custom Pricing"}
              </p>
              <ul className="plan-features" style={{ listStyle: 'none', padding: 0 }}>
                {plan.features.map((feature) => (
                  <li key={feature} style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--emerald)' }}>✓</span> {feature}
                  </li>
                ))}
              </ul>
              {plan.key === "enterprise" && subscription?.plan !== plan.key && (
                <a
                    href="mailto:sales@stockhive.com?subject=Enterprise%20Plan%20Inquiry"
                    className="primary-btn checkout-btn"
                    style={{ textDecoration: 'none', display: 'block', textAlign: 'center' }}
                >
                  Contact Sales
                </a>
              )}
              {plan.key !== "free" && plan.key !== "enterprise" && subscription?.plan !== plan.key && (
                <button
                    className="primary-btn checkout-btn"
                    type="button"
                    onClick={() => setCheckoutConfig({ plan: plan.key, price: plan.price })}
                >
                  {subscription?.plan === 'free' ? 'Upgrade Now' : 'Switch Plan'}
                </button>
              )}
              {subscription?.plan === plan.key && (
                  <div className="pill pill-green" style={{ width: '100%', textAlign: 'center', padding: '8px' }}>Your Current Plan</div>
              )}
            </article>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 className="section-title">Payment History</h3>
        {isLoading ? (
          <SkeletonTable rows={6} columns={5} />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Plan</th>
                <th>Amount (KES)</th>
                <th>Status</th>
                <th>Receipt</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id}>
                  <td style={{ textTransform: 'uppercase' }}>{item.plan}</td>
                  <td style={{ fontWeight: 'bold' }}>{Number(item.amount).toLocaleString()}</td>
                  <td>
                    <span
                      className={`pill ${
                        item.status === "success"
                          ? "pill-green"
                          : item.status === "failed"
                            ? "pill-red"
                            : "pill-amber"
                      }`}
                    >
                      {item.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'monospace' }}>{item.mpesa_receipt || "-"}</td>
                  <td>{new Date(item.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {history.length === 0 && (
                  <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }} className="muted">No payment history found.</td>
                  </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {checkoutConfig && (
          <MpesaCheckoutModal
            plan={checkoutConfig.plan}
            price={checkoutConfig.price}
            onClose={() => setCheckoutConfig(null)}
            onSuccess={loadBilling}
          />
      )}
    </section>
  );
}
