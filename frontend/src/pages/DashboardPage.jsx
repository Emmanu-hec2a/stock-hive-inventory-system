import { useEffect, useState } from "react";
import { ChevronRight, RotateCcw, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../state/AuthContext";
import { formatCurrency, formatNumber } from "../utils/formatters";
import { SkeletonStatCards, SkeletonDashboard, SkeletonList } from "../components/SkeletonLoaders";

function getPaymentPillClass(paymentMethod) {
  if (paymentMethod === "mpesa") return "pill-green";
  if (paymentMethod === "credit") return "pill-blue";
  return "pill-amber";
}

function getStockToneClass(currentStock, lowStockThreshold) {
  if (currentStock <= lowStockThreshold) return "stock-red";
  if (currentStock <= lowStockThreshold * 2) return "stock-amber";
  return "stock-green";
}

function formatSaleTime(createdAt) {
  return new Date(createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCompactSaleId(saleId) {
  const compactId = String(saleId || "").split("-")[0]?.slice(-4).toUpperCase();
  return compactId ? `SL-${compactId}` : "--";
}

function formatStockCount(value) {
  return new Intl.NumberFormat().format(Number(value || 0));
}

function getStockMeta(product) {
  if (product?.unit && /[A-Za-z]/.test(product.unit)) {
    return product.unit;
  }

  return product?.sku ? `SKU ${product.sku}` : "Stock item";
}

function formatSalesTrendLabel(day) {
  if (!day) return "--";
  return new Date(day).toLocaleDateString([], { weekday: "short" });
}

function getRecentSalesLabel(recentSales) {
  if (!recentSales.length) return "Latest";

  const today = new Date().toDateString();
  return recentSales.every((sale) => new Date(sale.created_at).toDateString() === today)
    ? "Today"
    : "Latest";
}

export default function DashboardPage({ forceBusinessOverview = false }) {
  const [data, setData] = useState(null);
  const [shops, setShops] = useState([]);
  const [salesTrend, setSalesTrend] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const { user, scopedQuery, selectedShopId, selectShop } = useAuth();
  const navigate = useNavigate();

  const isSuperAdmin = user?.role === "super_admin";
  const showBusinessOverview = isSuperAdmin && (forceBusinessOverview || !selectedShopId);

  useEffect(() => {
    if (showBusinessOverview) {
      fetchBusinessData();
    } else if (!isSuperAdmin || selectedShopId) {
      fetchShopData();
    }
  }, [selectedShopId, user?.role, scopedQuery, showBusinessOverview]);

  const fetchBusinessData = async () => {
    try {
      setIsLoading(true);
      setError("");
      const overviewResponse = await api.get("/reports/overview/");
      console.log("Business overview data:", overviewResponse.data);
      setShops(overviewResponse.data.shops || []);
      setData(overviewResponse.data);
      setSalesTrend([]);
    } catch (err) {
      console.error("Business data fetch error:", err);
      setError("Could not load business overview.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchShopData = async () => {
    try {
      setIsLoading(true);
      setError("");
      const [dashboardResponse, salesResponse] = await Promise.all([
        api.get(`/reports/dashboard/${scopedQuery}`),
        api.get(`/reports/sales/${scopedQuery}`),
      ]);

      console.log("Dashboard data:", dashboardResponse.data);
      setData(dashboardResponse.data);
      setSalesTrend(Array.isArray(salesResponse.data) ? salesResponse.data : salesResponse.data.sales_trend || []);
    } catch (err) {
      console.error("Shop data fetch error:", err);
      setError("Could not load dashboard for selected shop.");
    } finally {
      setIsLoading(false);
    }
  };

  const refreshDashboard = async () => {
    if (showBusinessOverview) {
      await fetchBusinessData();
    } else {
      await fetchShopData();
    }
  };

  const maxBar = Math.max(1, ...salesTrend.map((item) => Number(item.total || 0)));
  const recentSales = data?.recent_sales || [];
  const stockLevels = data?.stock_levels || [];
  const recentSalesLabel = getRecentSalesLabel(recentSales);

  if (showBusinessOverview) {
    return (
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h1 className="page-title">Business Overview</h1>
          <a
            href="/shops"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 16px",
              background: "#ffa500",
              color: "#000",
              cursor: "pointer",
              borderRadius: "4px",
              fontSize: "14px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Manage Shops <ChevronRight size={16} />
          </a>
        </div>

        <p style={{ color: "#888", fontSize: "13px", marginBottom: "20px" }}>
          Consolidated stats across all branches · Today
        </p>

        {error && <div className="alert-bar">as  {error}</div>}

        {isLoading ? (
          <>
            <SkeletonStatCards count={4} />
            <div style={{ marginTop: "40px" }}>
              <h2 style={{ fontFamily: "\"Syne\", sans-serif", fontSize: "18px", fontWeight: 700, marginBottom: "20px" }}>
                Branch Performance
              </h2>
              <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
                <SkeletonList items={4} showAvatar={false} />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <article className="card stat-card stat-amber">
            <p className="meta-label">Total Revenue (Month)</p>
            <p className="stat-value">{formatCurrency(data?.total_revenue_month)}</p>
            {data?.revenue_change && (
              <p style={{ fontSize: "12px", color: "#888", marginTop: "8px" }}>
                {data.revenue_change > 0 ? "+" : ""}
                {data.revenue_change}% vs last month
              </p>
            )}
          </article>

          <article className="card stat-card stat-blue">
            <p className="meta-label">Total Stock Value</p>
            <p className="stat-value">{formatCurrency(data?.total_stock_value)}</p>
            {data?.active_shops && (
              <p style={{ fontSize: "12px", color: "#888", marginTop: "8px" }}>
                Across {data.active_shops} branches
              </p>
            )}
          </article>

          <article className="card stat-card stat-red">
            <p className="meta-label">Low Stock Alerts</p>
            <p className="stat-value">{formatNumber(data?.total_low_stock)}</p>
            {data?.total_low_stock > 0 && (
              <p style={{ fontSize: "12px", color: "#888", marginTop: "8px" }}>
                Items need restocking
              </p>
            )}
          </article>

          <article className="card stat-card stat-green">
            <p className="meta-label">Active Branches</p>
            <p className="stat-value">{data?.active_shops || 0}</p>
            {data?.active_shops && (
              <p style={{ fontSize: "12px", color: "#888", marginTop: "8px" }}>
                All operational
              </p>
            )}
          </article>
        </div>

        {shops.length > 0 && (
          <div style={{ marginTop: "40px" }}>
            <h2 style={{ fontFamily: "\"Syne\", sans-serif", fontSize: "18px", fontWeight: 700, marginBottom: "20px" }}>
              Branch Performance
            </h2>
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
              {shops.map((shop) => (
                <article
                  key={shop.id}
                  className="card"
                  style={{
                    borderTop: "2px solid #ffa500",
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    selectShop(shop.id);
                    navigate("/");
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "16px" }}>
                    <div>
                      <h3 style={{ fontFamily: "\"Syne\", sans-serif", fontSize: "14px", fontWeight: 700, margin: "0 0 4px" }}>
                        {shop.name}
                      </h3>
                      <p style={{ fontSize: "12px", color: "#888", margin: 0, display: "flex", alignItems: "center", gap: "4px" }}>
                        <MapPin size={12} />
                        {shop.location}
                      </p>
                    </div>
                    <span style={{ width: "8px", height: "8px", background: "#00ff00", borderRadius: "50%", marginTop: "4px" }} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div>
                      <p style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 4px" }}>
                        Revenue
                      </p>
                      <p style={{ fontFamily: "\"Syne\", sans-serif", fontSize: "15px", fontWeight: 700, color: "#ffa500", margin: 0 }}>
                        {formatCurrency(shop.total_revenue || 0)}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 4px" }}>
                        Products
                      </p>
                      <p style={{ fontFamily: "\"Syne\", sans-serif", fontSize: "15px", fontWeight: 700, color: "#666", margin: 0 }}>
                        {shop.product_count || 0}
                      </p>
                    </div>

                    <div>
                      <p style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 4px" }}>
                        Stock Value
                      </p>
                      <p style={{ fontFamily: "\"Syne\", sans-serif", fontSize: "15px", fontWeight: 700, color: "#00ff00", margin: 0 }}>
                        {formatCurrency(shop.stock_value || 0)}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 4px" }}>
                        Low Stock
                      </p>
                      <p style={{ fontFamily: "\"Syne\", sans-serif", fontSize: "15px", fontWeight: 700, color: "#ff4444", margin: 0 }}>
                        {shop.low_stock_count || 0}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
          </>
        )}
      </section>
    );
  }

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 className="page-title">Dashboard</h1>
        <button
          onClick={refreshDashboard}
          style={{
            display: "flex",
            alignItems: "center",
            padding: "6px",
            background: "none",
            border: "none",
            color: "#888",
            cursor: "pointer",
            borderRadius: "4px",
            fontSize: "14px",
            transition: "color 0.2s",
          }}
          onMouseEnter={(e) => (e.target.style.color = "#ccc")}
          onMouseLeave={(e) => (e.target.style.color = "#888")}
          title="Refresh dashboard"
        >
          <RotateCcw size={18} />
        </button>
      </div>
      {error && <div className="alert-bar">as  {error}</div>}
      {isLoading ? (
        <SkeletonStatCards count={4} />
      ) : (
        <div className="grid">
          <article className="card stat-card stat-amber">
            <p className="meta-label">Sales Today</p>
            <p className="stat-value">{formatCurrency(data?.total_sales_today)}</p>
          </article>
          <article className="card stat-card stat-blue">
            <p className="meta-label">Stock Value</p>
            <p className="stat-value">{formatCurrency(data?.stock_value)}</p>
          </article>
          <article className="card stat-card stat-red">
            <p className="meta-label">Low Stock</p>
            <p className="stat-value">{formatNumber(data?.low_stock_count)}</p>
          </article>
          <article className="card stat-card stat-green">
            <p className="meta-label">Shop Status</p>
            <p className="mini-stat">ACTIVE</p>
          </article>
        </div>
      )}
      {isLoading ? (
        <SkeletonDashboard />
      ) : (
        <div className="dashboard-flex-container">
        <article className="card dashboard-recent-sales">
          <div className="dashboard-card-header">
            <h3 className="section-title">Recent Sales</h3>
            <span className="dashboard-card-kicker">{recentSalesLabel}</span>
          </div>
          {recentSales.length > 0 ? (
            <div className="dashboard-sales-table-wrap">
              <table className="dashboard-sales-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Time</th>
                    <th>Cashier</th>
                    <th>Total</th>
                    <th>Discount</th>
                    <th>Method</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.map((sale) => (
                    <tr key={sale.id}>
                      <td className="dashboard-sales-id">{formatCompactSaleId(sale.id)}</td>
                      <td className="dashboard-sales-time">{formatSaleTime(sale.created_at)}</td>
                      <td className="dashboard-sales-cashier">{sale.cashier_name}</td>
                      <td className="dashboard-sales-total">{formatCurrency(sale.total_amount)}</td>
                      <td className="dashboard-sales-discount">
                        {sale.discount_amount && sale.discount_amount > 0 ? (
                          <span style={{ color: '#4ade80', fontWeight: '600' }}>
                            -{formatCurrency(sale.discount_amount)}
                          </span>
                        ) : (
                          <span style={{ color: '#666' }}>—</span>
                        )}
                      </td>
                      <td>
                        <span className={`pill ${getPaymentPillClass(sale.payment_method)}`}>
                          {sale.payment_method}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted dashboard-empty-state">No sales recorded for this shop yet.</p>
          )}
        </article>

        <div className="dashboard-side-stack">
          <article className="card dashboard-weekly-sales">
            <h3 className="section-title">Weekly Sales</h3>
            {salesTrend.length > 0 ? (
              <div className="mini-chart" style={{ flex: 1 }}>
                {salesTrend.map((item) => (
                  <div key={item.day} className="bar-wrap">
                    <div
                      className="bar"
                      style={{ height: `${Math.max(6, (Number(item.total || 0) / maxBar) * 80)}px` }}
                    />
                    <span>{formatSalesTrendLabel(item.day)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted dashboard-empty-state">No sales trend available yet.</p>
            )}
          </article>

          <article className="card dashboard-stock-levels">
            <h3 className="section-title">Stock Levels</h3>
            {stockLevels.length > 0 ? (
              <div className="dashboard-stock-list">
                {stockLevels.map((product) => (
                  <div key={product.id} className="dashboard-stock-row">
                    <div className="dashboard-stock-copy">
                      <p className="dashboard-stock-name">{product.name}</p>
                      <p className="dashboard-stock-meta">{getStockMeta(product)}</p>
                    </div>
                    <span
                      className={`dashboard-stock-value ${getStockToneClass(product.current_stock, product.low_stock_threshold)}`}
                    >
                      {formatStockCount(product.current_stock)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted dashboard-empty-state">No stock items available yet.</p>
            )}
          </article>
        </div>
        </div>
      )}
    </section>
  );
}
