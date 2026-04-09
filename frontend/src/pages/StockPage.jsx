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
  const [transferForm, setTransferForm] = useState({ product: '', to_shop: '', quantity: 1, reference: '' });
  const [error, setError] = useState("");
  const { user, scopedQuery, selectedShopId, subscription } = useAuth();

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

  const handleTransfer = async (event) => {
    event.preventDefault();
    if (subscription?.plan !== 'pro' && subscription?.plan !== 'enterprise') {
      setError('Stock transfers require Pro or Enterprise plan.');
      return;
    }
    try {
      const data = {
        product: transferForm.product,
        to_shop: transferForm.to_shop,
        quantity: Number(transferForm.quantity),
        reference: transferForm.reference,
        from_shop: selectedShopId
      };
      await api.post(`/stock/transfers/${scopedQuery}`, data);
      alert('Stock transferred successfully!');
      setTransferForm({ product: '', to_shop: '', quantity: 1, reference: '' });
      loadData();
    } catch (err) {
      setError('Transfer failed: ' + (err.response?.data || err.message));
    }
  };

  const loadShops = () => {
    // Placeholder - load business shops for super_admin
    return [{ id: '1', name: 'Main Shop' }, { id: '2', name: 'Branch 1' }];
  };

  const shops = loadShops();

  return (
    <section>
      <h1 className="page-title">Stock</h1>

      {/* Stock Entry Form */}
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

      {/* Stock Transfer Form */}
      <div className="card" style={{ marginTop: '24px' }}>
        <h3>Transfer Stock (Pro+)</h3>
        <form className="form-grid" onSubmit={handleTransfer}>
          <select
            value={transferForm.from_shop}
            onChange={(e) => setTransferForm(prev => ({ ...prev, from_shop: e.target.value }))}
            required
          >
            <option value="">From Shop</option>
            <option value={user.shop?.id}>{user.shop?.name}</option>
          </select>
          <select
            value={transferForm.to_shop}
            onChange={(e) => setTransferForm(prev => ({ ...prev, to_shop: e.target.value }))}
            required
          >
            <option value="">To Shop</option>
            {shops.map(shop => (
              <option key={shop.id} value={shop.id}>
                {shop.name}
              </option>
            ))}
          </select>
          <select
            value={transferForm.product}
            onChange={(e) => setTransferForm(prev => ({ ...prev, product: e.target.value }))}
            required
          >
            <option value="">Select product</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} ({product.current_stock})
              </option>
            ))}
          </select>
          <input
            type="number"
            value={transferForm.quantity}
            onChange={(e) => setTransferForm(prev => ({ ...prev, quantity: e.target.value }))}
            placeholder="Quantity" 
            required
            min="1"
          />
          <input
            value={transferForm.reference}
            onChange={(e) => setTransferForm(prev => ({ ...prev, reference: e.target.value }))}
            placeholder="Reference #"
          />
          <button type="submit" className="btn btn-secondary">Transfer Stock</button>
        </form>
      </div>

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
