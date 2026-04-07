import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../state/AuthContext";

const entryDefaults = {
  product: "",
  quantity: 1,
  buying_price_at_entry: "",
  supplier_name: "",
  note: "",
};

export default function StockPage() {
  const [entries, setEntries] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(entryDefaults);
  const [error, setError] = useState("");
  const { user, scopedQuery, selectedShopId } = useAuth();

  const loadData = async () => {
    try {
      if (user?.role === "super_admin" && !selectedShopId) return;
      const [productsResponse, entriesResponse] = await Promise.all([
        api.get(`/products/${scopedQuery}`),
        api.get(`/stock/entries/${scopedQuery}`),
      ]);
      setProducts(productsResponse.data);
      setEntries(entriesResponse.data);
      setError("");
    } catch (err) {
      setError("Could not load stock data for selected shop.");
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedShopId, user?.role, scopedQuery]);

  const onSubmit = async (event) => {
    event.preventDefault();
    try {
      await api.post(`/stock/entries/${scopedQuery}`, form);
      setForm(entryDefaults);
      loadData();
    } catch (err) {
      setError("Failed to create stock entry.");
    }
  };

  return (
    <section>
      <h1 className="page-title">Stock Entries</h1>

      <form className="card form-grid" onSubmit={onSubmit}>
        <select
          value={form.product}
          onChange={(event) => setForm((prev) => ({ ...prev, product: event.target.value }))}
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
          value={form.quantity}
          onChange={(event) => setForm((prev) => ({ ...prev, quantity: Number(event.target.value) }))}
          placeholder="Quantity"
          required
        />
        <input
          type="number"
          step="0.01"
          value={form.buying_price_at_entry}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, buying_price_at_entry: event.target.value }))
          }
          placeholder="Buying price"
          required
        />
        <input
          value={form.supplier_name}
          onChange={(event) => setForm((prev) => ({ ...prev, supplier_name: event.target.value }))}
          placeholder="Supplier"
        />
        <input
          value={form.note}
          onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
          placeholder="Note"
        />
        <button type="submit">Add Entry</button>
      </form>

      {error && <div className="alert-bar">⚠ {error}</div>}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Qty</th>
              <th>Buying Price</th>
              <th>Supplier</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.product}</td>
                <td>{entry.quantity}</td>
                <td>{entry.buying_price_at_entry}</td>
                <td>{entry.supplier_name || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
