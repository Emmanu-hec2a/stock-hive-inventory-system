import { useEffect, useMemo, useState } from "react";
import api from "../api/client";
import { PLAN_PRICES } from "../constants/plans";
import { useAuth } from "../state/AuthContext";

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
    features: ["1 shop", "200 products", "5 staff", "Advanced reports, exports, low-stock alerts"],
  },
  {
    key: "pro",
    title: "Pro",
    price: PLAN_PRICES.pro,
    features: ["3 shops", "Unlimited products", "15 staff", "Multi-branch + priority support"],
  },
  {
    key: "enterprise",
    title: "Business Enterprise",
    price: PLAN_PRICES.enterprise,
    features: ["Unlimited shops", "Unlimited products", "Unlimited staff", "All features enabled"],
  },
];

export default function BillingPage() {
  const { subscription, refreshSubscription, shops } = useAuth();
  const [history, setHistory] = useState([]);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [checkoutId, setCheckoutId] = useState("");

  const loadBilling = async () => {
    const [subRes, historyRes] = await Promise.all([
      api.get("/billing/subscription/"),
      api.get("/billing/history/"),
    ]);
    await refreshSubscription();
    setHistory(historyRes.data);
    return subRes.data;
  };

  useEffect(() => {
    loadBilling().catch(() => setMessage("Could not load billing data."));
  }, []);

  useEffect(() => {
    if (!checkoutId) return;
    let attempts = 0;
    const timer = setInterval(async () => {
      attempts += 1;
      const res = await api.get(`/billing/status/${checkoutId}/`);
      if (res.data.status === "success") {
        clearInterval(timer);
        setMessage("Payment successful. Subscription activated.");
        setCheckoutId("");
        loadBilling();
      } else if (res.data.status === "failed" || attempts >= 20) {
        clearInterval(timer);
        setMessage("Payment failed or timed out. Please try again.");
        setCheckoutId("");
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [checkoutId]);

  const onSubscribe = async (plan) => {
    try {
      const res = await api.post("/billing/subscribe/", { plan, phone });
      setCheckoutId(res.data.checkout_request_id);
      setMessage("STK Push sent to your phone. Complete payment and wait for confirmation.");
    } catch (error) {
      setMessage(error?.response?.data?.error || "Could not initiate payment.");
    }
  };

  const onCancelRenew = async () => {
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
      {message && <div className="alert-bar">⚠ {message}</div>}
      {expiryText && <div className="alert-bar">⚠ {expiryText}</div>}
      {proShopsNudge && <div className="alert-bar">⚠ {proShopsNudge}</div>}

      <div className="grid">
        <article className="card stat-card stat-amber">
          <p className="meta-label">Current Plan</p>
          <p className="stat-value">{subscription?.plan || "-"}</p>
        </article>
        <article className="card stat-card stat-blue">
          <p className="meta-label">Status</p>
          <p className="mini-stat">{subscription?.status || "-"}</p>
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

      <div className="card">
        <h3 className="section-title">Choose a plan</h3>
        <div className="row">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="2547XXXXXXXX" />
          <button className="ghost-btn" type="button" onClick={onCancelRenew}>
            Cancel Auto-Renew
          </button>
        </div>
        <div className="plan-grid">
          {planCards.map((plan) => (
            <article
              key={plan.key}
              className={`card plan-card ${subscription?.plan === plan.key ? "plan-card-active" : ""}`}
            >
              <p className="meta-label">Plan</p>
              <h4 className="section-title">{plan.title}</h4>
              <p className="mini-stat">KES {plan.price}/month</p>
              <ul className="plan-features">
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              {plan.key !== "free" && (
                <button className="primary-btn" type="button" onClick={() => onSubscribe(plan.key)}>
                  Subscribe
                </button>
              )}
            </article>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 className="section-title">Payment History</h3>
        <table>
          <thead>
            <tr>
              <th>Plan</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Receipt</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {history.map((item) => (
              <tr key={item.id}>
                <td>{item.plan}</td>
                <td>{item.amount}</td>
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
                    {item.status}
                  </span>
                </td>
                <td>{item.mpesa_receipt || "-"}</td>
                <td>{new Date(item.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
