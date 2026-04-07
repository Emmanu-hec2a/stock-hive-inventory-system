import { useEffect, useState } from "react";
import api from "../api/client";
import { PLAN_LIMITS } from "../constants/plans";
import { useAuth } from "../state/AuthContext";

const initialForm = {
  name: "",
  sku: "",
  buying_price: "",
  selling_price: "",
  unit: "pieces",
  low_stock_threshold: 10,
};

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const { user, scopedQuery, selectedShopId, subscription } = useAuth();

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
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>SKU</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td>{product.name}</td>
                <td>{product.sku}</td>
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
