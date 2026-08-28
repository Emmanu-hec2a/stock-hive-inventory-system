import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Building2, CreditCard, LayoutDashboard, LogOut, Package, Settings, ShoppingCart, Store, Menu, X, Sliders, Truck, History, BarChart3 } from "lucide-react";
import { useAuth } from "../state/AuthContext";
import NotificationBell from "./NotificationBell";

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout, subscription, shops, selectedShopId, selectShop } = useAuth();
  const navigate = useNavigate();

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const closeSidebar = () => setSidebarOpen(false);

  const onLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const canManageInventory = user?.role !== "cashier";
  const isAdmin = user?.role === "super_admin" || user?.role === "shop_admin";

  const expiryDays = subscription?.end_date
    ? Math.ceil((new Date(subscription.end_date) - new Date()) / (1000 * 60 * 60 * 24))
    : null;
  const isExpired = subscription && !subscription.is_active;

  return (
    <div className="app-shell">
      <header className="app-header">
        <h2 className="logo-wordmark">
          <span>Stock</span>
          <span className="logo-accent">Hive</span>
        </h2>
        <div className="header-right">
          <NotificationBell />
          <button className="mobile-sidebar-toggle" onClick={toggleSidebar} title="Toggle menu">
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>
      <aside className={`sidebar ${sidebarOpen ? "mobile-open" : ""}`}>
        <button className="mobile-sidebar-toggle sidebar-close-btn" onClick={closeSidebar}>
          <X size={20} />
        </button>
        <p className="meta-label nav-group-label">Main</p>
        <nav>
          {user?.role === "super_admin" && (
            <NavLink to="/overview" onClick={closeSidebar}><Building2 size={15} />Overview</NavLink>
          )}
          <NavLink to="/" onClick={closeSidebar}><LayoutDashboard size={15} />Dashboard</NavLink>
          {canManageInventory && (
            <NavLink to="/analytics" onClick={closeSidebar}>
              <BarChart3 size={15} />Analytics
            </NavLink>
          )}
          {canManageInventory && <NavLink to="/products" onClick={closeSidebar}><Package size={15} />Products</NavLink>}
          {canManageInventory && (
              <NavLink to="/stock" onClick={closeSidebar}>
                  <Store size={15} />Stock
                  {subscription?.plan === 'free' && <span className="nav-pro-badge">PRO</span>}
              </NavLink>
          )}
          {canManageInventory && (
              <NavLink to="/suppliers" onClick={closeSidebar}>
                  <Truck size={15} />Suppliers
                  {subscription?.plan !== 'pro' && subscription?.plan !== 'enterprise' && <span className="nav-pro-badge">PRO</span>}
              </NavLink>
          )}
          <NavLink to="/sales" onClick={closeSidebar}><ShoppingCart size={15} />Sales</NavLink>
          {isAdmin && (
            <NavLink to="/audit-logs" onClick={closeSidebar}>
                <History size={15} />Audit Logs
                {subscription?.plan !== 'pro' && subscription?.plan !== 'enterprise' && <span className="nav-pro-badge">PRO</span>}
            </NavLink>
          )}
          {user?.role === 'super_admin' && <NavLink to="/billing" onClick={closeSidebar}><CreditCard size={15} />Billing</NavLink>}
          {isAdmin && (
            <NavLink to="/staff" onClick={closeSidebar}><Settings size={15} />Staff</NavLink>
          )}
          {isAdmin && (
            <NavLink to="/settings" onClick={closeSidebar}><Sliders size={15} />Settings</NavLink>
          )}
        </nav>
        {user?.role === "super_admin" && (
          <>
            <p className="meta-label nav-group-label">Shops</p>
            <div className="shops-list">
              {shops.map((shop) => (
                <button
                  type="button"
                  key={shop.id}
                  className={`shop-item ${selectedShopId === shop.id ? "active" : ""}`}
                  onClick={() => {
                    selectShop(shop.id);
                    closeSidebar();
                    navigate("/");
                  }}
                >
                  <Building2 size={14} />
                  <span>{shop.name}</span>
                </button>
              ))}
              <NavLink to="/shops" className="shop-manage-link" onClick={closeSidebar}>
                <Settings size={14} />
                Manage Shops
              </NavLink>
            </div>
          </>
        )}
        <div className="sidebar-footer">
          <div className="avatar">{user?.full_name?.slice(0, 1)?.toUpperCase() || "U"}</div>
          <div className="sidebar-user-info">
            <p className="sidebar-user">{user?.full_name}</p>
          </div>
          <button className="sidebar-logout-btn" onClick={onLogout} title="Logout">
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <div className={`mobile-sidebar-backdrop ${sidebarOpen ? "mobile-open" : ""}`} onClick={closeSidebar} />
      <main className="content">
        {subscription?.is_active && expiryDays !== null && expiryDays <= 5 && subscription.plan !== "free" && (
          <div className="alert-bar">
            ⚠ Your plan expires in {Math.max(expiryDays, 0)} days. Renew to avoid interruption.
          </div>
        )}
        {isExpired && (
          <div className="expired-overlay">
            <div className="card expired-modal">
              <h2 className="section-title">Your plan has expired</h2>
              <p className="muted">Renew now to continue using premium features.</p>
              <button className="primary-btn" onClick={() => navigate("/billing")}>
                Renew Subscription
              </button>
            </div>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
