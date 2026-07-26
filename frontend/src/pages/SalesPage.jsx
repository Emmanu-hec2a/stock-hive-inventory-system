import { useEffect, useRef, useState } from "react";
import api from "../api/client";
import { useAuth } from "../state/AuthContext";
import { downloadCsvExport } from "../utils/downloads";
import { formatNumber } from "../utils/formatters";
import { saveSaleOffline } from "../utils/offlineSales";

const initialForm = {
  payment_method: "cash",
  items: [{ product_id: "", product_search: "", quantity: 1 }],
};

function formatProductOption(product) {
  if (!product) return "";
  return product.sku ? `${product.name} (${product.sku})` : product.name;
}

function matchesProduct(product, query) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [product.name, product.sku, product.unit]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery));
}

function findExactProduct(products, query) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return null;

  return (
    products.find((product) => formatProductOption(product).toLowerCase() === normalizedQuery)
    || products.find((product) => product.name.toLowerCase() === normalizedQuery)
    || products.find((product) => String(product.sku || "").toLowerCase() === normalizedQuery)
  );
}

function isNetworkFailure(error) {
  return !error?.response || error?.code === "ERR_NETWORK" || !navigator.onLine;
}

function ProductSearchField({ products, query, onQueryChange, onProductSelect, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredProducts = products.filter((product) => matchesProduct(product, query)).slice(0, 8);

  return (
    <div className="sales-product-search" ref={wrapperRef}>
      <input
        type="text"
        className="sales-product-input"
        value={query}
        onChange={(event) => {
          onQueryChange(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder="Search product by name or SKU"
        autoComplete="off"
        aria-expanded={isOpen}
        aria-autocomplete="list"
        role="combobox"
        disabled={disabled}
      />
      {isOpen && !disabled && (
        <div className="sales-product-menu">
          {filteredProducts.length > 0 ? (
            filteredProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                className="sales-product-option"
                onMouseDown={(event) => {
                  event.preventDefault();
                  onProductSelect(product);
                  setIsOpen(false);
                }}
              >
                <span className="sales-product-option-name">{product.name}</span>
                <span className="sales-product-option-meta">
                  {product.sku ? `SKU ${product.sku}` : product.unit || "Product"}
                </span>
              </button>
            ))
          ) : (
            <div className="sales-product-empty">No matching products found.</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SalesPage() {
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [barcodeQuery, setBarcodeQuery] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [form, setForm] = useState(initialForm);
  const { user, scopedQuery, selectedShopId } = useAuth();

  const loadData = async () => {
    try {
      if (user?.role === "super_admin" && !selectedShopId) {
        setSales([]);
        setProducts([]);
        return;
      }

      const [productsResponse, salesResponse] = await Promise.all([
        api.get(`/products/${scopedQuery}`),
        api.get(`/sales/${scopedQuery}`),
      ]);

      setProducts(productsResponse.data);
      setSales(salesResponse.data);
      setError("");
    } catch (err) {
      setError("Could not load sales for the current shop.");
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedShopId, user?.role, scopedQuery]);

  const onBarcodeScan = async (e) => {
      e.preventDefault();
      const code = barcodeQuery.trim();
      if (!code) return;

      const product = products.find(p => p.barcode === code);
      if (product) {
          const existingIdx = form.items.findIndex(i => i.product_id === product.id);
          if (existingIdx > -1) {
              updateItem(existingIdx, { quantity: form.items[existingIdx].quantity + 1 });
          } else {
              const newItems = [...form.items];
              // Replace first empty item if it exists
              if (newItems.length === 1 && !newItems[0].product_id) {
                  newItems[0] = { product_id: product.id, product_search: formatProductOption(product), quantity: 1 };
              } else {
                  newItems.push({ product_id: product.id, product_search: formatProductOption(product), quantity: 1 });
              }
              setForm(prev => ({ ...prev, items: newItems }));
          }
          setBarcodeQuery("");
          setSuccess(`Added ${product.name}`);
          setTimeout(() => setSuccess(""), 2000);
      } else {
          setError(`Product with barcode ${code} not found.`);
          setTimeout(() => setError(""), 3000);
      }
  }

  const updateItem = (idx, updates) => {
    setForm((prev) => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], ...updates };
      return { ...prev, items };
    });
  };

  const handleProductQueryChange = (idx, query) => {
    const exactMatch = findExactProduct(products, query);

    updateItem(idx, {
      product_search: query,
      product_id: exactMatch ? exactMatch.id : "",
    });
  };

  const handleProductSelect = (idx, product) => {
    updateItem(idx, {
      product_search: formatProductOption(product),
      product_id: product.id,
    });
  };

  const isShopSelectionMissing = user?.role === "super_admin" && !selectedShopId;
  const isFormValid = form.items.length > 0 && form.items.every((item) => item.product_id);

  const submitSale = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (isShopSelectionMissing) {
      setError("Select a shop before recording a sale.");
      return;
    }

    const invalidItems = form.items.filter((item) => !item.product_id);
    if (invalidItems.length > 0) {
      setError("Please select a product for all items before submitting.");
      return;
    }

    if (form.items.length === 0) {
      setError("Please add at least one item to the sale.");
      return;
    }

    const payload = {
      payment_method: form.payment_method,
      items: form.items.map(({ product_id, quantity }) => ({
        product_id,
        quantity,
      })),
    };

    const queueSaleOffline = async () => {
      await saveSaleOffline({
        actorId: user?.id || user?.email || "default",
        url: `/sales/${scopedQuery}`,
        payload,
        summary: `${payload.items.length} item${payload.items.length === 1 ? "" : "s"}`,
      });

      setForm(initialForm);
      setSuccess("You are offline. Sale saved locally and will sync automatically once connected.");
      window.setTimeout(() => setSuccess(""), 4000);
    };

    if (!navigator.onLine) {
      await queueSaleOffline();
      return;
    }

    try {
      const response = await api.post(`/sales/${scopedQuery}`, payload);
      setForm(initialForm);
      setError("");
      setSuccess(`Sale recorded! Total: ${formatNumber(response.data.total_amount)}`);
      window.setTimeout(() => setSuccess(""), 3000);
      loadData();
    } catch (err) {
      if (isNetworkFailure(err)) {
        await queueSaleOffline();
        return;
      }

      setError(err?.response?.data?.detail || err?.response?.data?.items?.[0] || "Could not create sale.");
    }
  };

  const exportSales = async () => {
    setError("");
    setIsExporting(true);

    try {
      await downloadCsvExport("sales", scopedQuery, "sales.csv");
    } catch (err) {
      setError("Failed to export sales.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <section>
      <h1 className="page-title">Sales</h1>

      {/* Barcode Quick Scan */}
      <form onSubmit={onBarcodeScan} className="card" style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
          <input
            value={barcodeQuery}
            onChange={(e) => setBarcodeQuery(e.target.value)}
            placeholder="Scan Barcode / Enter code..."
            style={{ flex: 1 }}
            disabled={isShopSelectionMissing}
          />
          <button type="submit" className="btn btn-secondary" disabled={isShopSelectionMissing}>Quick Add</button>
      </form>

      <form className="card sales-entry-card" onSubmit={submitSale}>
        <select
          className="sales-entry-payment"
          value={form.payment_method}
          onChange={(event) => setForm((prev) => ({ ...prev, payment_method: event.target.value }))}
          disabled={isShopSelectionMissing}
        >
          <option value="cash">Cash</option>
          <option value="mpesa">Mpesa</option>
          <option value="credit">Credit</option>
        </select>

        {form.items.map((item, idx) => (
          <div className="sales-entry-row" key={idx}>
            <ProductSearchField
              products={products}
              query={item.product_search}
              onQueryChange={(query) => handleProductQueryChange(idx, query)}
              onProductSelect={(product) => handleProductSelect(idx, product)}
              disabled={isShopSelectionMissing}
            />
            <input
              type="number"
              min="1"
              className="sales-entry-quantity"
              value={item.quantity}
              onChange={(event) => updateItem(idx, { quantity: Number(event.target.value) })}
              required
              disabled={isShopSelectionMissing}
            />
          </div>
        ))}

        <div className="sales-entry-actions">
          <button type="submit" disabled={!isFormValid || isShopSelectionMissing}>
            Record Sale
          </button>
        </div>
      </form>
      {error && <div className="alert-bar">{error}</div>}
      {success && <div className="success-bar">{success}</div>}
      <div className="card" style={{ position: "relative" }}>
        <div style={{ position: "absolute", top: "8px", right: "16px" }}>
          <button
            type="button"
            className="btn btn-small"
            onClick={exportSales}
            disabled={isShopSelectionMissing || isExporting}
          >
            {isExporting ? "Exporting..." : "Export CSV"}
          </button>
        </div>
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
