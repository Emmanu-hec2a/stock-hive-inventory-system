import { useState, useEffect, useRef } from "react";
import { X, CheckCircle, AlertCircle, Loader2, Phone, RefreshCw, Smartphone } from "lucide-react";
import api from "../api/client";

const STEPS = {
  IDLE: "IDLE",
  INITIATING: "INITIATING",
  WAITING: "WAITING",
  VERIFYING: "VERIFYING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
};

export default function MpesaCheckoutModal({ plan, price, onClose, onSuccess }) {
  const [step, setStep] = useState(STEPS.IDLE);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [checkoutId, setCheckoutId] = useState(null);
  const [timer, setTimer] = useState(120); // Phase 3: Increased from 60s to 120s for slow networks
  const pollingRef = useRef(null);

  useEffect(() => {
    let countdown;
    if (step === STEPS.WAITING && timer > 0) {
      countdown = setInterval(() => setTimer((t) => t - 1), 1000);
    } else if (timer === 0 && step === STEPS.WAITING) {
      setStep(STEPS.VERIFYING);
    }
    return () => clearInterval(countdown);
  }, [step, timer]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const initiatePayment = async (e) => {
    e.preventDefault();
    setError("");
    setStep(STEPS.INITIATING);

    // Basic Kenyan phone validation (allows 2547... or 07...)
    let cleanPhone = phone.trim().replace(/\s+/g, "");
    if (cleanPhone.startsWith("0")) cleanPhone = "254" + cleanPhone.slice(1);
    if (!/^254(7|1)\d{8}$/.test(cleanPhone)) {
      setError("Please enter a valid M-Pesa number (e.g., 0712345678).");
      setStep(STEPS.IDLE);
      return;
    }

    try {
      const response = await api.post("/billing/subscribe/", { plan, phone: cleanPhone });
      setCheckoutId(response.data.checkout_request_id);
      setStep(STEPS.WAITING);
      startPolling(response.data.checkout_request_id);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to initiate payment. Please try again.");
      setStep(STEPS.IDLE);
    }
  };

  const startPolling = (id) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const response = await api.get(`/billing/status/${id}/`);
        if (response.data.status === "success") {
          finishSuccess();
        } else if (response.data.status === "failed") {
          setStep(STEPS.FAILED);
          if (pollingRef.current) clearInterval(pollingRef.current);
        }
      } catch (err) {
        console.error("Polling error", err);
      }
    }, 3000);
  };

  const checkStatusManually = async () => {
    if (!checkoutId) return;
    setStep(STEPS.VERIFYING);
    if (pollingRef.current) clearInterval(pollingRef.current);

    try {
      const response = await api.post(`/billing/reconcile/${checkoutId}/`);
      if (response.data.status === "success") {
        finishSuccess();
      } else {
        setStep(STEPS.FAILED);
        setError(response.data.result_desc || "Payment was not successful.");
      }
    } catch (err) {
      setError("Unable to verify status. Please check your phone for any messages from M-Pesa.");
      setStep(STEPS.FAILED);
    }
  };

  const finishSuccess = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setStep(STEPS.SUCCESS);
    setTimeout(() => {
        onSuccess();
        onClose();
    }, 3000);
  };

  const renderContent = () => {
    switch (step) {
      case STEPS.IDLE:
        return (
          <form onSubmit={initiatePayment}>
            <p className="modal-desc">Upgrade to <strong>{plan.toUpperCase()}</strong> for KES {price.toLocaleString()}</p>
            <div className="input-group">
              <Phone size={18} className="input-icon" />
              <input
                autoFocus
                placeholder="07XX XXX XXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="primary-btn checkout-btn">Initiate Payment</button>
          </form>
        );

      case STEPS.INITIATING:
        return (
          <div className="status-container">
            <Loader2 className="spinner" size={40} />
            <p>Initiating STK Push...</p>
            <span className="muted">Check your phone in a moment</span>
          </div>
        );

      case STEPS.WAITING:
        return (
          <div className="status-container">
            <div className="countdown-ring">{timer}s</div>
            <h3>Check your phone</h3>
            <p className="muted">Enter your M-Pesa PIN to complete the transaction of KES {price.toLocaleString()}.</p>
            <div className="btn-group-v">
                <button className="ghost-btn btn-small" onClick={checkStatusManually}>
                    <RefreshCw size={14} /> Already Paid? Check Status
                </button>
            </div>
          </div>
        );

      case STEPS.VERIFYING:
        return (
          <div className="status-container">
            <Loader2 className="spinner" size={40} />
            <p>Verifying with Safaricom...</p>
            <span className="muted">Hold on, we're double checking the status</span>
          </div>
        );

      case STEPS.SUCCESS:
        return (
          <div className="status-container success">
            <CheckCircle size={60} color="var(--emerald)" />
            <h2>Payment Successful!</h2>
            <p>Welcome to the {plan.toUpperCase()} plan. Your features are being unlocked.</p>
          </div>
        );

      case STEPS.FAILED:
        return (
          <div className="status-container failed">
            <AlertCircle size={60} color="var(--crimson)" />
            <h2>Payment Failed</h2>
            <p className="muted">{error || "Something went wrong during the payment process."}</p>
            <button className="primary-btn" onClick={() => setStep(STEPS.IDLE)}>Try Again</button>
          </div>
        );
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card mpesa-modal">
        <div className="modal-header">
          <h2 className="modal-title">M-Pesa Checkout</h2>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body">
          {renderContent()}
          {error && step === STEPS.IDLE && <div className="alert-bar">{error}</div>}
        </div>
        <div className="modal-footer">
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <Smartphone size={24} style={{ color: "var(--amber)" }} />
            <span style={{ fontWeight: "600", color: "var(--amber)" }}>M-PESA</span>
          </div>
          <span className="security-tag">Secured by Safaricom</span>
        </div>
      </div>
    </div>
  );
}
