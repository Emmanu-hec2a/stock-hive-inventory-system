import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../state/AuthContext";

const entryDefaults = {
  product: "",
  quantity: 1,
  buying_price_at_entry: "",
  supplier: "",
  supplier_name: "",
  note: "",
};

export default function StockPage() {
  const [entries, setEntries] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState(entryDefaults);
  const [transferForm, setTransferForm] = useState({ product: '', to_shop: '', quantity: 1, reference: '' });
  const [error, setError] = useState("");
  const { user, scopedQuery, selectedShopId, subscription, shops: allShops } = useAuth();

  const loadData = async () => {
    try {
      if (user?.role === "super_admin" && !selectedShopId) return;
      const [productsResponse, entriesResponse, suppliersResponse] = await Promise.all([
        api.get(`/products/${scopedQuery}`),
        api.get(`/stock/entries/${scopedQuery}`),
        api.get("/suppliers/"),
      ]);
      setProducts(productsResponse.data);
      setEntries(entriesResponse.data);
      setSuppliers(suppliersResponse.data);
      setError("");
    } catch (err) {
      setError("Could not load stock data.");
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
        <select
          value={form.supplier}
          onChange={(event) => setForm((prev) => ({ ...prev, supplier: event.target.value }))}
        >
          <option value="">Link to supplier (Optional)</option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </select>
        <input
          value={form.supplier_name}
          onChange={(event) => setForm((prev) => ({ ...prev, supplier_name: event.target.value }))}
          placeholder="Manual Supplier Name"
        />
        <input
          value={form.note}
          onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
          placeholder="Note"
        />
        <button type="submit">Add Entry</button>
      </form>

      <div className="card" style={{ marginTop: '24px' }}>
        <h3>Transfer Stock (Pro+)</h3>
        <form className="form-grid" onSubmit={handleTransfer}>
          <select
            value={selectedShopId}
            disabled
          >
            <option value={selectedShopId}>{allShops.find(s => s.id === selectedShopId)?.name || 'Current Shop'}</option>
          </select>
          <select
            value={transferForm.to_shop}
            onChange={(e) => setTransferForm(prev => ({ ...prev, to_shop: e.target.value }))}
            required
          >
            <option value="">To Shop</option>
            {allShops.filter(s => s.id !== selectedShopId).map(shop => (
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
            {entries.map((entry) => {
              const product = products.find(p => p.id === entry.product);
              return (
                <tr key={entry.id}>
                  <td>{product?.name || entry.product}</td>
                  <td>{entry.quantity}</td>
                  <td>{entry.buying_price_at_entry}</td>
                  <td>{entry.supplier_display_name || entry.supplier_name || "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
