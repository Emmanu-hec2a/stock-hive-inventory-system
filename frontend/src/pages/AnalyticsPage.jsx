import { useEffect, useState } from "react";
import { useAuth } from "../state/AuthContext";
import api from "../api/client";
import {
  SalesLineChart,
  PaymentMethodChart,
  TopProductsChart,
  CategoryPerformanceChart,
  StaffPerformanceChart,
} from "../components/AnalyticsCharts";
import {
  BarChart3,
  TrendingUp,
  Package,
  Users,
  DollarSign,
  AlertCircle,
  Loader,
} from "lucide-react";
import "../Analytics.css";

export default function AnalyticsPage() {
  const { user, selectedShopId, shops } = useAuth();
  const [activeTab, setActiveTab] = useState("sales");
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Analytics data states
  const [salesData, setSalesData] = useState(null);
  const [inventoryData, setInventoryData] = useState(null);
  const [productsData, setProductsData] = useState(null);
  const [profitData, setProfitData] = useState(null);
  const [staffData, setStaffData] = useState(null);

  const shopId = user?.role === "super_admin" ? selectedShopId : user?.shop?.id;

  useEffect(() => {
    fetchAnalytics();
  }, [days, shopId]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();
      params.append("days", days);
      if (user?.role === "super_admin" && shopId) {
        params.append("shop_id", shopId);
      }

      const [salesRes, inventoryRes, productsRes, profitRes, staffRes] =
        await Promise.all([
          api.get(`/analytics/sales/?${params}`),
          api.get(`/analytics/inventory/?${params}`),
          api.get(`/analytics/products/?${params}`),
          api.get(`/analytics/profit/?${params}`),
          api.get(`/analytics/staff/?${params}`),
        ]);

      // Normalize sales data: backend returns 'overview' for super_admin, 'summary' for others
      const normalizedSalesData = {
        summary: salesRes.data.summary || salesRes.data.overview,
        daily_trend: salesRes.data.daily_trend || [],
        payment_analysis: salesRes.data.payment_analysis || [],
      };

      setSalesData(normalizedSalesData);
      setInventoryData(inventoryRes.data);
      setProductsData(productsRes.data);
      setProfitData(profitRes.data);
      setStaffData(staffRes.data);
    } catch (err) {
      console.error("Analytics fetch error:", err);
      setError(
        err.response?.data?.error ||
          err.message ||
          "Failed to load analytics"
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-center">
          <Loader size={32} className="loading-spinner" />
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-description">
            Business insights and performance metrics
          </p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Controls */}
      <div className="analytics-controls">
        <div className="controls-group">
          <label>Period:</label>
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            className="select-input"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last 365 days</option>
          </select>
        </div>

        {user?.role === "super_admin" && shops.length > 1 && (
          <div className="controls-group">
            <label>Shop:</label>
            <select
              value={selectedShopId}
              onChange={(e) => {
                // Note: this requires implementing selectShop in AuthContext
                // For now, this is informational
              }}
              className="select-input"
              disabled
            >
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="analytics-tabs">
        <button
          className={`tab-btn ${activeTab === "sales" ? "active" : ""}`}
          onClick={() => setActiveTab("sales")}
        >
          <BarChart3 size={16} />
          Sales
        </button>
        <button
          className={`tab-btn ${activeTab === "products" ? "active" : ""}`}
          onClick={() => setActiveTab("products")}
        >
          <Package size={16} />
          Products
        </button>
        <button
          className={`tab-btn ${activeTab === "profit" ? "active" : ""}`}
          onClick={() => setActiveTab("profit")}
        >
          <DollarSign size={16} />
          Profit
        </button>
        <button
          className={`tab-btn ${activeTab === "inventory" ? "active" : ""}`}
          onClick={() => setActiveTab("inventory")}
        >
          <TrendingUp size={16} />
          Inventory
        </button>
        {user?.role !== "cashier" && (
          <button
            className={`tab-btn ${activeTab === "staff" ? "active" : ""}`}
            onClick={() => setActiveTab("staff")}
          >
            <Users size={16} />
            Staff
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="analytics-content">
        {/* Sales Tab */}
        {activeTab === "sales" && salesData && salesData.summary && (
          <div className="analytics-section">
            {/* Summary Cards */}
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-label">Total Revenue</div>
                <div className="metric-value">
                  KES {(salesData.summary.total_revenue || 0).toLocaleString()}
                </div>
                <div className="metric-subtitle">
                  {salesData.summary.transaction_count || 0} transactions
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Average Transaction</div>
                <div className="metric-value">
                  KES {(salesData.summary.average_transaction || 0).toLocaleString()}
                </div>
                <div className="metric-subtitle">Per transaction</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Daily Average</div>
                <div className="metric-value">
                  KES{" "}
                  {(
                    (salesData.summary.total_revenue || 0) /
                    (salesData.summary.period_days || 1)
                  ).toLocaleString()}
                </div>
                <div className="metric-subtitle">Per day</div>
              </div>
            </div>

            {/* Charts */}
            <div className="chart-container">
              <div className="chart-section">
                <h3 className="section-subtitle">Sales Trend</h3>
                <SalesLineChart data={salesData.daily_trend || []} />
              </div>

              <div className="chart-section">
                <h3 className="section-subtitle">Payment Methods</h3>
                <PaymentMethodChart data={salesData.payment_analysis || []} />
              </div>
            </div>
          </div>
        )}

        {/* Products Tab */}
        {activeTab === "products" && productsData && (
          <div className="analytics-section">
            <div className="chart-container">
              <div className="chart-section">
                <h3 className="section-subtitle">Top Products</h3>
                <TopProductsChart data={productsData.top_products || []} />
              </div>

              <div className="chart-section">
                <h3 className="section-subtitle">Category Performance</h3>
                <CategoryPerformanceChart
                  data={productsData.category_performance || []}
                />
              </div>
            </div>

            {/* Top Products List */}
            {productsData.top_products && productsData.top_products.length > 0 && (
              <div className="data-table">
                <h3 className="section-subtitle">Top Products (Detailed)</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Product Name</th>
                      <th>SKU</th>
                      <th>Quantity Sold</th>
                      <th>Revenue</th>
                      <th>Avg Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productsData.top_products.map((product) => (
                      <tr key={product.product_id}>
                        <td>{product.name}</td>
                        <td className="sku-cell">{product.sku}</td>
                        <td>{product.quantity_sold}</td>
                        <td>KES {product.revenue.toLocaleString()}</td>
                        <td>KES {product.average_price.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Profit Tab */}
        {activeTab === "profit" && profitData && (
          <div className="analytics-section">
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-label">Total Revenue</div>
                <div className="metric-value">
                  KES {(profitData.total_revenue || 0).toLocaleString()}
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Cost of Goods Sold</div>
                <div className="metric-value">
                  KES {(profitData.total_cogs || 0).toLocaleString()}
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Gross Profit</div>
                <div className="metric-value profit">
                  KES {(profitData.total_profit || 0).toLocaleString()}
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Profit Margin</div>
                <div className="metric-value profit">
                  {((profitData.profit_margin_percent || 0).toFixed(2))}%
                </div>
              </div>
            </div>

            {/* Profit Breakdown */}
            <div className="profit-breakdown">
              <div className="breakdown-item">
                <div className="breakdown-label">Revenue</div>
                <div className="breakdown-bar">
                  <div className="breakdown-fill revenue"></div>
                </div>
                <div className="breakdown-value">
                  KES {(profitData.total_revenue || 0).toLocaleString()}
                </div>
              </div>
              <div className="breakdown-item">
                <div className="breakdown-label">COGS</div>
                <div className="breakdown-bar">
                  <div className="breakdown-fill cogs"></div>
                </div>
                <div className="breakdown-value">
                  KES {(profitData.total_cogs || 0).toLocaleString()}
                </div>
              </div>
              <div className="breakdown-item">
                <div className="breakdown-label">Profit</div>
                <div className="breakdown-bar">
                  <div className="breakdown-fill profit"></div>
                </div>
                <div className="breakdown-value">
                  KES {(profitData.total_profit || 0).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Inventory Tab */}
        {activeTab === "inventory" && inventoryData && (
          <div className="analytics-section">
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-label">Total Products</div>
                <div className="metric-value">
                  {inventoryData.total_products || 0}
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Inventory Value</div>
                <div className="metric-value">
                  KES {(inventoryData.inventory_value || 0).toLocaleString()}
                </div>
              </div>
              <div className="metric-card alert">
                <div className="metric-label">Low Stock Items</div>
                <div className="metric-value warning">
                  {inventoryData.low_stock_count || 0}
                </div>
              </div>
              <div className="metric-card alert">
                <div className="metric-label">Out of Stock</div>
                <div className="metric-value error">
                  {inventoryData.out_of_stock_count || 0}
                </div>
              </div>
            </div>

            {/* Low Stock Items */}
            {inventoryData.low_stock_items && inventoryData.low_stock_items.length > 0 && (
              <div className="data-table warning-table">
                <h3 className="section-subtitle">Low Stock Items</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>SKU</th>
                      <th>Current Stock</th>
                      <th>Threshold</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryData.low_stock_items.map((item) => (
                      <tr key={item.product_id}>
                        <td>{item.name}</td>
                        <td className="sku-cell">{item.sku}</td>
                        <td className="warning">
                          {item.current_stock} units
                        </td>
                        <td>{item.threshold} units</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Out of Stock Items */}
            {inventoryData.out_of_stock_items && inventoryData.out_of_stock_items.length > 0 && (
              <div className="data-table error-table">
                <h3 className="section-subtitle">Out of Stock Items</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>SKU</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryData.out_of_stock_items.map((item) => (
                      <tr key={item.product_id}>
                        <td>{item.name}</td>
                        <td className="sku-cell">{item.sku}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Staff Tab */}
        {activeTab === "staff" && staffData && (
          <div className="analytics-section">
            <div className="chart-container">
              <div className="chart-section">
                <h3 className="section-subtitle">Staff Performance</h3>
                <StaffPerformanceChart data={staffData.staff_performance || []} />
              </div>
            </div>

            {/* Staff Performance Table */}
            {staffData.staff_performance && staffData.staff_performance.length > 0 && (
              <div className="data-table">
                <h3 className="section-subtitle">Staff Performance (Detailed)</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Staff Member</th>
                      <th>Total Sales</th>
                      <th>Transactions</th>
                      <th>Avg Transaction</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffData.staff_performance.map((staff) => (
                      <tr key={staff.staff_id}>
                        <td>{staff.name}</td>
                        <td>
                          KES {(staff.total_sales || 0).toLocaleString()}
                        </td>
                        <td>{staff.transaction_count || 0}</td>
                        <td>
                          KES {(staff.average_transaction || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
