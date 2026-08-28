import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useAuth } from '../state/AuthContext';
import { PLAN_FEATURES } from '../constants/plans';

export default function FeatureGate({ feature, children, fallback = null, inline = false, invert = false }) {
  const { subscription } = useAuth();
  const navigate = useNavigate();

  const plan = subscription?.plan || 'free';
  const allowedFeatures = PLAN_FEATURES[plan] || [];
  const isAllowed = allowedFeatures.includes('*') || allowedFeatures.includes(feature);

  // If invert is true, show children when feature is NOT allowed
  if (invert) {
    return isAllowed ? null : <>{children}</>;
  }

  // Normal behavior: show children when feature IS allowed
  if (isAllowed) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (inline) {
    return (
      <div
        className="feature-gate-inline"
        onClick={() => navigate('/billing')}
        title={`Upgrade to unlock ${feature.replace('_', ' ')}`}
      >
        <div className="feature-gate-blur">{children}</div>
        <div className="feature-gate-lock">
          <Lock size={14} />
          <span>Unlock</span>
        </div>
      </div>
    );
  }

  return (
    <div className="feature-gate-block card">
      <div className="feature-gate-overlay">
        <Lock size={48} className="lock-icon" />
        <h2 className="section-title">Premium Feature</h2>
        <p className="muted">
          The <strong>{feature.replace('_', ' ')}</strong> tool is available on higher plans.
          Upgrade now to grow your business.
        </p>
        <button className="primary-btn" onClick={() => navigate('/billing')}>
          View Pricing & Upgrade
        </button>
      </div>
      <div className="feature-gate-content-preview">
        {children}
      </div>
    </div>
  );
}
