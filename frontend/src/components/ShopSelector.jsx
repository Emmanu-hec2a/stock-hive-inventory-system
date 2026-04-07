import { useAuth } from "../state/AuthContext";

export default function ShopSelector() {
  const { user, shops, selectedShopId, selectShop } = useAuth();

  if (user?.role !== "super_admin") {
    return (
      <div className="shop-badge">
        <p className="meta-label">Current Shop</p>
        <p className="shop-name">{user?.shop_id ? "Assigned Shop" : "No shop assigned"}</p>
        <p className="shop-status">
          <span className="status-dot" />
          Active
        </p>
        <span className="pill pill-blue">{user?.role}</span>
      </div>
    );
  }

  const currentShop = shops.find((shop) => shop.id === selectedShopId);

  return (
    <div className="shop-badge">
      <p className="meta-label">Current Shop</p>
      <p className="shop-name">{currentShop?.name || "Select a shop"}</p>
      <p className="shop-status">
        <span className="status-dot" />
        Active
      </p>
      <select value={selectedShopId} onChange={(event) => selectShop(event.target.value)}>
        {shops.length === 0 && <option value="">No shops found</option>}
        {shops.map((shop) => (
          <option key={shop.id} value={shop.id}>
            {shop.name}
          </option>
        ))}
      </select>
      <span className="pill pill-amber">{user?.role}</span>
    </div>
  );
}
