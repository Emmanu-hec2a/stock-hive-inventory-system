import { useEffect, useState } from "react";
import api from "../api/client";
import FeatureGate from "../components/FeatureGate";
import { PLAN_LIMITS } from "../constants/plans";
import { useAuth } from "../state/AuthContext";
import { downloadCsvExport } from "../utils/downloads";

const initialForm = {
  name: "",
  sku: "",
  barcode: "",
  buying_price: "",
  selling_price: "",
  unit: "pieces",
  low_stock_threshold: 10,
};

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [cloneTo, setCloneTo] = useState("");
  const [isCloning, setIsCloning] = useState(false);
  const { user, scopedQuery, selectedShopId, subscription, shops: allShops } = useAuth();

  const loadProducts = async () => {
    try {
      if (user?.role === "super_admin" && !selectedShopId) return;
      const response = await api.get(`/products/${scopedQuery}`);
      setProducts(response.data);
      setError("");
    } catch (err) {
      setError("Could not load products for selected shop.");
    }
  };

  useEffect(() => {
    loadProducts();
  }, [selectedShopId, user?.role, scopedQuery]);

  const onChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    try {
      await api.post(`/products/${scopedQuery}`, form);
      setForm(initialForm);
      loadProducts();
    } catch (err) {
      setError("Failed to create product.");
    }
  };

  const exportProducts = async () => {
    setError("");
    setIsExporting(true);

    try {
      await downloadCsvExport("products", scopedQuery, "products.csv");
    } catch (err) {
      setError("Failed to export products.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleCloneCatalog = async () => {
    if (!cloneTo) {
      setError("Please select a destination shop to clone the catalog.");
      return;
    }

    const sourceShopName = allShops.find(s => s.id === selectedShopId)?.name || 'this shop';
    const destShopName = allShops.find(s => s.id === cloneTo)?.name || 'destination shop';

    const confirm = window.confirm(
      `Sync catalog from "${sourceShopName}" to "${destShopName}"?\n\nThis will copy all product names, SKUs, and prices. Stock levels in the new shop will remain at 0.`
    );

    if (!confirm) return;

    setIsCloning(true);
    setError("");

    try {
      const response = await api.post(`/products/clone_catalog/${scopedQuery}`, {
        to_shop_id: cloneTo
      });
      alert(response.data.message);
      setCloneTo("");
    } catch (err) {
      setError("Catalog sync failed: " + (err.response?.data?.error || err.message));
    } finally {
      setIsCloning(false);
    }
  };

  const exportDisabled = user?.role === "super_admin" && !selectedShopId;

  return (
    <section>
      <h1 className="page-title">Products</h1>
      {(() => {
        const plan = subscription?.plan || "free";
        const max = PLAN_LIMITS[plan]?.products;
        if (!max) return null;
        if (products.length >= Math.ceil(max * 0.8)) {
          return (
            <div className="alert-bar">
              ⚠ You’re using {products.length}/{max} products. Upgrade to add more.
            </div>
          );
        }
        return null;
      })()}
      <form className="card form-grid" onSubmit={onSubmit}>
        <input name="name" value={form.name} onChange={onChange} placeholder="Name" required />
        <input name="sku" value={form.sku} onChange={onChange} placeholder="SKU" required />
        <FeatureGate feature="barcodes" inline>
            <input name="barcode" value={form.barcode} onChange={onChange} placeholder="Barcode" />
        </FeatureGate>
        <input
          name="buying_price"
          type="number"
          step="0.01"
          value={form.buying_price}
          onChange={onChange}
          placeholder="Buying Price"
          required
        />
        <input
          name="selling_price"
          type="number"
          step="0.01"
          value={form.selling_price}
          onChange={onChange}
          placeholder="Selling Price"
          required
        />
        <input name="unit" value={form.unit} onChange={onChange} placeholder="Unit" required />
        <input
          name="low_stock_threshold"
          type="number"
          value={form.low_stock_threshold}
          onChange={onChange}
          placeholder="Low stock threshold"
          required
        />
        <button type="submit">Add Product</button>
      </form>
      {error && <div className="alert-bar">⚠ {error}</div>}

      <div className="card" style={{ marginBottom: '24px' }}>
          <h3 className="section-title">Catalog Sync (Rapid Branch Setup)</h3>
          <p className="muted" style={{ fontSize: '12px', marginBottom: '16px' }}>
              Push your entire product list (Names, SKUs, Prices) to another branch. <strong>Stock will not be moved.</strong>
          </p>
          <div className="row" style={{ alignItems: 'center' }}>
              <select
                  value={cloneTo}
                  onChange={(e) => setCloneTo(e.target.value)}
                  style={{ maxWidth: '254px' }}
                  disabled={exportDisabled || isCloning}
              >
                  <option value="">Sync catalog to...</option>
                  {allShops?.filter(s => s.id !== selectedShopId).map(shop => (
                      <option key={shop.id} value={shop.id}>
                          {shop.name}
                      </option>
                  ))}
              </select>
              <button
                  className="ghost-btn"
                  onClick={handleCloneCatalog}
                  disabled={exportDisabled || isCloning || !cloneTo}
              >
                  {isCloning ? "Syncing Catalog..." : "Copy Catalog to Branch"}
              </button>
          </div>
      </div>

      <div className="card" style={{ position: "relative" }}>
        <div style={{ position: "absolute", top: "8px", right: "16px" }}>
          <button
            type="button"
            className="btn btn-small"
            onClick={exportProducts}
            disabled={exportDisabled || isExporting}
          >
            {isExporting ? "Exporting..." : "Export CSV"}
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>SKU / Barcode</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td>{product.name}</td>
                <td>
                    <div>{product.sku}</div>
                    <div style={{ fontSize: '0.75rem', color: '#666' }}>{product.barcode || '-'}</div>
                </td>
                <td>{product.selling_price}</td>
                <td>
                  <div className="stock-cell">
                    <div className="stock-track">
                      <div
                        className={`stock-fill ${
                          product.current_stock <= product.low_stock_threshold
                            ? "stock-red"
                            : product.current_stock <= product.low_stock_threshold * 2
                              ? "stock-amber"
                              : "stock-green"
                        }`}
                        style={{ width: `${Math.min(100, product.current_stock * 5)}%` }}
                      />
                    </div>
                    <span>{product.current_stock}</span>
                  </div>
                </td>
                <td>
                  <span
                    className={`pill ${
                      product.current_stock <= product.low_stock_threshold
                        ? "pill-red"
                        : product.current_stock <= product.low_stock_threshold * 2
                          ? "pill-amber"
                          : "pill-green"
                    }`}
                  >
                    {product.current_stock <= product.low_stock_threshold
                      ? "LOW"
                      : product.current_stock <= product.low_stock_threshold * 2
                        ? "MEDIUM"
                        : "HEALTHY"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
