/**
 * Skeleton Loading Components
 * Provides reusable skeleton loaders for different content types
 */

/**
 * Generic Skeleton pulse component
 */
export function Skeleton({ width = "100%", height = "20px", className = "" }) {
  return (
    <div
      className={`skeleton-pulse ${className}`}
      style={{
        width,
        height,
        borderRadius: "var(--radius-control)",
      }}
    />
  );
}

/**
 * Skeleton Table Loader
 */
export function SkeletonTable({ rows = 5, columns = 5 }) {
  return (
    <div className="skeleton-table-wrapper">
      <table className="skeleton-table">
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i}>
                <Skeleton height="16px" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr key={rowIdx}>
              {Array.from({ length: columns }).map((_, colIdx) => (
                <td key={colIdx}>
                  <Skeleton height="18px" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Skeleton Stat Cards
 */
export function SkeletonStatCards({ count = 4 }) {
  return (
    <div className="skeleton-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card skeleton-card">
          <Skeleton width="60%" height="14px" className="skeleton-label" />
          <Skeleton width="80%" height="32px" className="skeleton-value" />
          <Skeleton width="40%" height="12px" className="skeleton-meta" />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton List Items
 */
export function SkeletonList({ items = 6, showAvatar = true }) {
  return (
    <div className="skeleton-list">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="skeleton-list-item">
          {showAvatar && <Skeleton width="40px" height="40px" className="skeleton-avatar" />}
          <div className="skeleton-list-content">
            <Skeleton width="70%" height="16px" />
            <Skeleton width="50%" height="12px" className="skeleton-meta-small" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton Chart Area
 */
export function SkeletonChart({ height = "300px" }) {
  return (
    <div className="skeleton-chart" style={{ height }}>
      <Skeleton width="100%" height="100%" />
    </div>
  );
}

/**
 * Skeleton Form (for product/stock entry forms)
 */
export function SkeletonForm({ fields = 6 }) {
  return (
    <div className="card skeleton-form">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="skeleton-form-field">
          <Skeleton width="40%" height="12px" className="skeleton-label-form" />
          <Skeleton width="100%" height="38px" className="skeleton-input" />
        </div>
      ))}
      <Skeleton width="100px" height="40px" className="skeleton-button" />
    </div>
  );
}

/**
 * Skeleton Modal (for bulk import, receipts, etc.)
 */
export function SkeletonModal() {
  return (
    <div className="modal-backdrop">
      <div className="modal-content skeleton-modal">
        <Skeleton width="60%" height="24px" className="skeleton-title" />
        <div className="skeleton-modal-body">
          <Skeleton width="100%" height="200px" />
        </div>
        <div className="skeleton-modal-footer">
          <Skeleton width="100px" height="40px" />
          <Skeleton width="100px" height="40px" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton Product Row (for product listings)
 */
export function SkeletonProductRow() {
  return (
    <div className="skeleton-product-row">
      <Skeleton width="30px" height="30px" className="skeleton-checkbox" />
      <Skeleton width="150px" height="16px" />
      <Skeleton width="100px" height="16px" />
      <Skeleton width="80px" height="16px" />
      <Skeleton width="80px" height="16px" />
      <Skeleton width="100px" height="32px" className="skeleton-badge" />
    </div>
  );
}

/**
 * Skeleton Sales Item (for sales page)
 */
export function SkeletonSalesItem() {
  return (
    <div className="skeleton-sales-item">
      <Skeleton width="100%" height="16px" className="skeleton-product-name" />
      <div className="skeleton-sales-row">
        <Skeleton width="80px" height="36px" />
        <Skeleton width="80px" height="36px" />
        <Skeleton width="100px" height="36px" />
      </div>
    </div>
  );
}

/**
 * Dashboard Overview Skeleton
 */
export function SkeletonDashboard() {
  return (
    <div>
      {/* Header */}
      <Skeleton width="200px" height="28px" style={{ marginBottom: "24px" }} />

      {/* Stat Cards */}
      <SkeletonStatCards count={4} />

      {/* Recent Sales / Stock Section */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginTop: "24px" }}>
        <div className="card">
          <Skeleton width="150px" height="18px" style={{ marginBottom: "16px" }} />
          <SkeletonList items={5} showAvatar={false} />
        </div>
        <div className="card">
          <Skeleton width="150px" height="18px" style={{ marginBottom: "16px" }} />
          <SkeletonList items={5} showAvatar={false} />
        </div>
      </div>

      {/* Chart Section */}
      <div className="card" style={{ marginTop: "24px" }}>
        <Skeleton width="150px" height="18px" style={{ marginBottom: "16px" }} />
        <SkeletonChart height="250px" />
      </div>
    </div>
  );
}

/**
 * Analytics Page Skeleton
 */
export function SkeletonAnalytics() {
  return (
    <div>
      {/* Header */}
      <Skeleton width="200px" height="28px" style={{ marginBottom: "24px" }} />

      {/* Tabs/Controls */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} width="80px" height="36px" />
        ))}
      </div>

      {/* Stat Cards */}
      <SkeletonStatCards count={4} />

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginTop: "24px" }}>
        <div className="card">
          <Skeleton width="150px" height="18px" style={{ marginBottom: "16px" }} />
          <SkeletonChart height="300px" />
        </div>
        <div className="card">
          <Skeleton width="150px" height="18px" style={{ marginBottom: "16px" }} />
          <SkeletonChart height="300px" />
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ marginTop: "24px" }}>
        <Skeleton width="150px" height="18px" style={{ marginBottom: "16px" }} />
        <SkeletonTable rows={5} columns={5} />
      </div>
    </div>
  );
}
