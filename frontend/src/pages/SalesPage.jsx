import { useEffect, useRef, useState } from "react";
import api from "../api/client";
import { useAuth } from "../state/AuthContext";
import { downloadCsvExport } from "../utils/downloads";
import { formatNumber } from "../utils/formatters";
import { saveSaleOffline } from "../utils/offlineSales";
import { cacheProducts, getCachedProducts, isCacheStale } from "../utils/offlineProducts";
import FeatureGate from "../components/FeatureGate";
import ReceiptTemplate from "../components/ReceiptTemplate";
import { fetchReceiptData } from "../utils/receiptPrinting";

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

  const filteredProducts = products
    .filter((product) => product.current_stock > 0)
    .filter((product) => matchesProduct(product, query))
    .slice(0, 8);

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
  const [lastSaleId, setLastSaleId] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [loadingReceipt, setLoadingReceipt] = useState(false);
  const { user, scopedQuery, selectedShopId, subscription } = useAuth();

  const loadData = async () => {
    try {
      if (user?.role === "super_admin" && !selectedShopId) {
        setSales([]);
        setProducts([]);
        return;
      }

      // Try to load from API
      try {
        const [productsResponse, salesResponse] = await Promise.all([
          api.get(`/products/${scopedQuery}`),
          api.get(`/sales/${scopedQuery}`),
        ]);

        setProducts(productsResponse.data);
        setSales(salesResponse.data);
        setError("");

        // Cache products for offline use
        if (selectedShopId) {
          await cacheProducts(productsResponse.data, selectedShopId);
        }
      } catch (apiError) {
        // If online, show error and don't use cache
        if (navigator.onLine) {
          throw apiError;
        }

        // If offline, try to use cached data
        console.log("Offline: Loading from cache...");
        const cachedProducts = selectedShopId 
          ? await getCachedProducts(selectedShopId)
          : [];
        
        setProducts(cachedProducts);
        setSales([]); // Can't load sales while offline (read-only anyway)
        
        if (cachedProducts.length > 0) {
          setError("Offline mode: Using cached products. Sales will sync when online.");
        } else {
          setError("Offline mode: No cached products available. Please go online to load products.");
        }
      }
    } catch (err) {
      console.error("Failed to load sales/products:", {
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        message: err.message,
        url: err.config?.url,
      });
      
      let errorMsg = "Could not load sales for the current shop.";
      if (err.response?.status === 403) {
        errorMsg = "You don't have permission to view sales for this shop.";
      } else if (err.response?.status === 404) {
        errorMsg = "Shop not found. Please select a valid shop.";
      } else if (!navigator.onLine) {
        errorMsg = "No internet connection. Please check your network.";
      }
      setError(errorMsg);
      
      // Try to load cached products as fallback
      if (!navigator.onLine && selectedShopId) {
        try {
          const cachedProducts = await getCachedProducts(selectedShopId);
          if (cachedProducts.length > 0) {
            setProducts(cachedProducts);
            setError("Offline mode: Using cached products.");
          }
        } catch (cacheErr) {
          console.error("Failed to load cache:", cacheErr);
        }
      }
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedShopId, user?.role, scopedQuery]);

  const onBarcodeScan = async (e) => {
      e.preventDefault();
      const code = barcodeQuery.trim();
      if (!code) return;

      const product = products.find(p => p.barcode === code && p.current_stock > 0);
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
      setLastSaleId(response.data.id);
      setSuccess(`Sale recorded! Total: ${formatNumber(response.data.total_amount)}`);
      window.setTimeout(() => setSuccess(""), 3000);
      loadData();
    } catch (err) {
      if (isNetworkFailure(err)) {
        await queueSaleOffline();
        return;
      }

      // Extract detailed error message
      let errorMessage = "Could not create sale.";
      
      // Handle validation errors from backend
      const data = err?.response?.data;
      if (data) {
        // Non-field errors (stock validation, etc.)
        if (Array.isArray(data.non_field_errors) && data.non_field_errors.length > 0) {
          errorMessage = data.non_field_errors[0];
        }
        // Field errors
        else if (data.items && Array.isArray(data.items) && data.items.length > 0) {
          errorMessage = data.items[0];
        }
        // Detail field
        else if (data.detail) {
          errorMessage = data.detail;
        }
        // Generic error object
        else if (typeof data === 'string') {
          errorMessage = data;
        }
      }
      
      setError(errorMessage);
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

  const handlePrintReceipt = async () => {
    if (!lastSaleId) return;

    setLoadingReceipt(true);
    setError(""); // Clear any previous error
    
    try {
      const receiptData = await fetchReceiptData(lastSaleId);
      setReceipt(receiptData);
      setShowReceiptModal(true);
      // Clear success message when modal opens
      setLastSaleId(null);
      setSuccess("");
    } catch (err) {
      // Error message is already formatted in fetchReceiptData
      setError(err.message || "Could not load receipt data.");
      console.error("Receipt error:", err);
    } finally {
      setLoadingReceipt(false);
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

      {/* Receipt Print Button */}
      {lastSaleId && (
        <>
          <FeatureGate feature="receipt_printing">
            <div className="card" style={{ padding: "16px", backgroundColor: "#f0f9ff", borderColor: "#bfdbfe" }}>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <span style={{ flex: 1, color: "#0c4a6e" }}>✓ Last sale recorded successfully!</span>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handlePrintReceipt}
                  disabled={loadingReceipt}
                >
                  {loadingReceipt ? "Loading..." : "Print Receipt"}
                </button>
              </div>
            </div>
          </FeatureGate>
          <FeatureGate feature="receipt_printing" invert>
            <div className="card" style={{ padding: "16px", backgroundColor: "#fef3c7", borderColor: "#fcd34d", display: "flex", gap: "12px", alignItems: "center" }}>
              <span style={{ flex: 1, color: "#78350f" }}>Sale recorded! Receipt printing is available on Pro and Enterprise plans only.</span>
              <button type="button" className="btn btn-secondary" style={{ whiteSpace: "nowrap" }} onClick={() => window.location.href = "/billing"}>
                Upgrade Plan
              </button>
            </div>
          </FeatureGate>
        </>
      )}

      {/* Receipt Modal */}
      {showReceiptModal && receipt && (
        <ReceiptTemplate
          receipt={receipt}
          onClose={() => setShowReceiptModal(false)}
        />
      )}
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
              <th>Items</th>
              <th>Quantity</th>
              <th>Amount</th>
              <th>Payment</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={sale.id}>
                <td>
                  {sale.line_items && sale.line_items.length > 0
                    ? sale.line_items.map((item) => item.product_name || item.name).join(", ")
                    : "No items"}
                </td>
                <td>
                  {sale.line_items && sale.line_items.length > 0
                    ? sale.line_items.reduce((sum, item) => sum + item.quantity, 0)
                    : 0}
                </td>
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
