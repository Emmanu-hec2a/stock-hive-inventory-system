import { useEffect, useState } from "react";
import { RotateCcw, ChevronRight } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../state/AuthContext";
import { useNavigate } from "react-router-dom";
import { formatNumber, formatCurrency } from "../utils/formatters";

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [shops, setShops] = useState([]);
  const [salesTrend, setSalesTrend] = useState([]);
  const [error, setError] = useState("");
  const { user, scopedQuery, selectedShopId, selectShop } = useAuth();
  const navigate = useNavigate();

  const isSuperAdmin = user?.role === "super_admin";

  useEffect(() => {
    if (isSuperAdmin && !selectedShopId) {
      fetchBusinessData();
    } else if (!isSuperAdmin || selectedShopId) {
      fetchShopData();
    }
  }, [selectedShopId, user?.role, scopedQuery]);

  const fetchBusinessData = async () => {
    try {
      setError("");
      const overviewResponse = await api.get("/reports/overview/");
      console.log("Business overview data:", overviewResponse.data);
      setShops(overviewResponse.data.shops || []);
      setData(overviewResponse.data);
      setSalesTrend([]);
    } catch (err) {
      console.error("Business data fetch error:", err);
      setError("Could not load business overview.");
    }
  };

  const fetchShopData = async () => {
    try {
      setError("");
      const requests = [
        api.get(`/reports/dashboard/${scopedQuery}`),
        api.get(`/reports/sales/${scopedQuery}`),
      ];
      
      // Super admins also fetch overview data for branch performance
      if (isSuperAdmin) {
        requests.push(api.get("/reports/overview/"));
      }
      
      const responses = await Promise.all(requests);
      console.log("Dashboard data:", responses[0].data);
      setData(responses[0].data);
      setSalesTrend(Array.isArray(responses[1].data) ? responses[1].data : responses[1].data.sales_trend || []);
      
      // Set shops based on user role
      if (isSuperAdmin && responses[2]) {
        // Super admin: Show all shops
        setShops(responses[2].data.shops || []);
      } else if (user?.role === "shop_admin" || (isSuperAdmin && selectedShopId)) {
        // Shop admin or super admin viewing specific shop: Show their own shop
        const dashboardData = responses[0].data;
        const shopData = {
          id: user?.shop?.id || selectedShopId,
          name: user?.shop?.name || "Current Shop",
          location: user?.shop?.location || "",
          total_revenue: dashboardData.total_sales_today || 0,
          product_count: dashboardData.product_count || 0,
          stock_value: dashboardData.stock_value || 0,
          low_stock_count: dashboardData.low_stock_count || 0,
        };
        setShops([shopData]);
      }
    } catch (err) {
      console.error("Shop data fetch error:", err);
      setError("Could not load dashboard for selected shop.");
    }
  };

  const refreshDashboard = async () => {
    if (isSuperAdmin && !selectedShopId) {
      await fetchBusinessData();
    } else {
      await fetchShopData();
    }
  };

  const maxBar = Math.max(1, ...salesTrend.map((item) => Number(item.total || 0)));

  // Super Admin Business Overview
  if (isSuperAdmin && !selectedShopId) {
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

        {error && <div className="alert-bar">⚠ {error}</div>}

        {/* Stats Grid */}
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <article className="card stat-card stat-amber">
            <p className="meta-label">Total Revenue (Month)</p>
            <p className="stat-value">{formatCurrency(data?.total_revenue_month)}</p>
            {data?.revenue_change && (
              <p style={{ fontSize: "12px", color: "#888", marginTop: "8px" }}>
                {data.revenue_change > 0 ? "+" : ""}{data.revenue_change}% vs last month
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

        {/* Branch Performance */}
        {shops.length > 0 && (
          <div style={{ marginTop: "40px" }}>
            <h2 style={{ fontFamily: "\"Syne\", sans-serif", fontSize: "18px", fontWeight: 700, marginBottom: "20px" }}>Branch Performance</h2>
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
                      <h3 style={{ fontFamily: "\"Syne\", sans-serif", fontSize: "14px", fontWeight: 700, margin: "0 0 4px" }}>{shop.name}</h3>
                      <p style={{ fontSize: "12px", color: "#888", margin: 0 }}>📍 {shop.location}</p>
                    </div>
                    <span style={{ width: "8px", height: "8px", background: "#00ff00", borderRadius: "50%", marginTop: "4px" }} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div>
                      <p style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 4px" }}>Revenue</p>
                      <p style={{ fontFamily: "\"Syne\", sans-serif", fontSize: "15px", fontWeight: 700, color: "#ffa500", margin: 0 }}>
                        {formatCurrency(shop.total_revenue || 0)}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 4px" }}>Products</p>
                      <p style={{ fontFamily: "\"Syne\", sans-serif", fontSize: "15px", fontWeight: 700, color: "#666", margin: 0 }}>
                        {shop.product_count || 0}
                      </p>
                    </div>

                    <div>
                      <p style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 4px" }}>Stock Value</p>
                      <p style={{ fontFamily: "\"Syne\", sans-serif", fontSize: "15px", fontWeight: 700, color: "#00ff00", margin: 0 }}>
                        {formatCurrency(shop.stock_value || 0)}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 4px" }}>Low Stock</p>
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
      </section>
    );
  }

  // Shop-specific Dashboard
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
      {error && <div className="alert-bar">⚠ {error}</div>}
      <div className="grid">
        <article className="card stat-card stat-amber">
          <p className="meta-label">Sales Today</p>
          <p className="stat-value">{formatNumber(data?.total_sales_today)}</p>
        </article>
        <article className="card stat-card stat-blue">
          <p className="meta-label">Stock Value</p>
          <p className="stat-value">{formatNumber(data?.stock_value)}</p>
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
      <div className="dashboard-flex-container">
        {/* Branch Performance - visible for super admins and shop admins */}
        {shops.length > 0 && (
          <div className="dashboard-branch-section">
            <h2 style={{ fontFamily: "\"Syne\", sans-serif", fontSize: "18px", fontWeight: 700, marginBottom: "20px" }}>
              {isSuperAdmin ? "Branch Performance" : "Branch Overview"}
            </h2>
            <div className="branch-card-grid">
              {shops.map((shop) => (
                <article
                  key={shop.id}
                  className="card"
                  style={{
                    borderTop: "2px solid #ffa500",
                    cursor: isSuperAdmin ? "pointer" : "default",
                  }}
                  onClick={() => {
                    if (isSuperAdmin) {
                      selectShop(shop.id);
                      navigate("/");
                    }
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "16px" }}>
                    <div>
                      <h3 style={{ fontFamily: "\"Syne\", sans-serif", fontSize: "14px", fontWeight: 700, margin: "0 0 4px" }}>{shop.name}</h3>
                      <p style={{ fontSize: "12px", color: "#888", margin: 0 }}>📍 {shop.location}</p>
                    </div>
                    <span style={{ width: "8px", height: "8px", background: "#00ff00", borderRadius: "50%", marginTop: "4px" }} />
                  </div>

                  <div className="branch-card-stats">
                    <div style={{ background: "#111", padding: "12px", borderRadius: "4px" }}>
                      <p style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 6px" }}>Revenue</p>
                      <p style={{ fontFamily: "\"Syne\", sans-serif", fontSize: "15px", fontWeight: 700, color: "#ffa500", margin: 0 }}>
                        {formatCurrency(shop.total_revenue || 0)}
                      </p>
                    </div>
                    <div style={{ background: "#111", padding: "12px", borderRadius: "4px" }}>
                      <p style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 6px" }}>Products</p>
                      <p style={{ fontFamily: "\"Syne\", sans-serif", fontSize: "15px", fontWeight: 700, color: "#666", margin: 0 }}>
                        {shop.product_count || 0}
                      </p>
                    </div>

                    <div style={{ background: "#111", padding: "12px", borderRadius: "4px" }}>
                      <p style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 6px" }}>Stock Val</p>
                      <p style={{ fontFamily: "\"Syne\", sans-serif", fontSize: "15px", fontWeight: 700, color: "#00ff00", margin: 0 }}>
                        {formatCurrency(shop.stock_value || 0)}
                      </p>
                    </div>
                    <div style={{ background: "#111", padding: "12px", borderRadius: "4px" }}>
                      <p style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 6px" }}>Low Stock</p>
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

        <article className="card dashboard-weekly-sales">
          <h3 className="section-title">Weekly Sales</h3>
          <div className="mini-chart" style={{ flex: 1 }}>
            {salesTrend.map((item) => (
              <div key={item.day} className="bar-wrap">
                <div
                  className="bar"
                  style={{ height: `${Math.max(6, (Number(item.total || 0) / maxBar) * 80)}px` }}
                />
                <span>{item.day?.slice(5) || "--"}</span>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
