import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../state/AuthContext";
import { formatNumber } from "../utils/formatters";

export default function SalesPage() {
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    payment_method: "cash",
    items: [{ product_id: "", quantity: 1 }],
  });
  const { user, scopedQuery, selectedShopId } = useAuth();

  const loadData = async () => {
    try {
      if (user?.role === "super_admin" && !selectedShopId) return;
      const [productsResponse, salesResponse] = await Promise.all([
        api.get(`/products/${scopedQuery}`),
        api.get(`/sales/${scopedQuery}`),
      ]);
      setProducts(productsResponse.data);
      setSales(salesResponse.data);
      setError("");
    } catch (err) {
      setError("Could not load sales for selected shop.");
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedShopId, user?.role, scopedQuery]);

  const updateItem = (idx, key, value) => {
    setForm((prev) => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], [key]: value };
      return { ...prev, items };
    });
  };

  const addItem = () => {
    setForm((prev) => ({ ...prev, items: [...prev.items, { product_id: "", quantity: 1 }] }));
  };

  const isFormValid = form.items.length > 0 && form.items.every(item => item.product_id);

  const submitSale = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    // Validate all items have products selected
    const invalidItems = form.items.filter(item => !item.product_id);
    if (invalidItems.length > 0) {
      setError("Please select a product for all items before submitting.");
      return;
    }

    if (form.items.length === 0) {
      setError("Please add at least one item to the sale.");
      return;
    }

    try {
      const response = await api.post(`/sales/${scopedQuery}`, form);
      console.log("Sale created successfully:", response.data);
      setForm({ payment_method: "cash", items: [{ product_id: "", quantity: 1 }] });
      setError("");
      setSuccess(`Sale recorded! Total: ${formatNumber(response.data.total_amount)}`);
      setTimeout(() => setSuccess(""), 3000);
      loadData();
    } catch (err) {
      console.error("Sale creation error:", err.response?.data);
      setError(err?.response?.data?.detail || err?.response?.data?.items?.[0] || "Could not create sale.");
    }
  };

  return (
    <section>
      <h1 className="page-title">Sales</h1>
      <form className="card" onSubmit={submitSale}>
        <select
          value={form.payment_method}
          onChange={(event) => setForm((prev) => ({ ...prev, payment_method: event.target.value }))}
        >
          <option value="cash">Cash</option>
          <option value="mpesa">Mpesa</option>
          <option value="credit">Credit</option>
        </select>
        {form.items.map((item, idx) => (
          <div className="row" key={`${idx}-${item.product_id}`}>
            <select
              value={item.product_id}
              onChange={(event) => updateItem(idx, "product_id", event.target.value)}
              required
            >
              <option value="">Select product</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              value={item.quantity}
              onChange={(event) => updateItem(idx, "quantity", Number(event.target.value))}
              required
            />
          </div>
        ))}
        <div className="row">
          <button type="button" onClick={addItem}>
            Add Item
          </button>
          <button type="submit" disabled={!isFormValid}>
            Record Sale
          </button>
        </div>
      </form>
      {error && <div className="alert-bar">⚠ {error}</div>}
      {success && <div style={{ background: "#1a5c1a", color: "#4ade80", padding: "12px", borderRadius: "4px", marginBottom: "16px" }}>✓ {success}</div>}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Sale ID</th>
              <th>Amount</th>
              <th>Payment</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={sale.id}>
                <td>{sale.id}</td>
                <td>{formatNumber(sale.total_amount)}</td>
                <td>{sale.payment_method}</td>
                <td>{new Date(sale.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
