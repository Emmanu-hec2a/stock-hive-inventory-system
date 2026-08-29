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
import { SkeletonTable } from "../components/SkeletonLoaders";

const initialForm = {
  payment_method: "cash",
  items: [{ product_id: "", product_search: "", quantity: 1, payment_method: "cash" }],
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
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState(initialForm);
  const [lastSaleId, setLastSaleId] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [loadingReceipt, setLoadingReceipt] = useState(false);
  const { user, scopedQuery, selectedShopId, subscription } = useAuth();

  const loadData = async () => {
    try {
      setIsLoading(true);
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
    } finally {
      setIsLoading(false);
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
                  newItems[0] = { product_id: product.id, product_search: formatProductOption(product), quantity: 1, payment_method: "cash" };
              } else {
                  newItems.push({ product_id: product.id, product_search: formatProductOption(product), quantity: 1, payment_method: "cash" });
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

  const addItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { product_id: "", product_search: "", quantity: 1, payment_method: "cash" }],
    }));
  };

  const removeItem = (idx) => {
    if (form.items.length === 1) {
      setError("You must have at least one item in the sale.");
      return;
    }
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  };

  const clearForm = () => {
    setForm(initialForm);
    setError("");
    setSuccess("");
  };

  const calculateTotal = () => {
    return form.items.reduce((sum, item) => {
      const product = products.find(p => p.id === item.product_id);
      if (product && item.quantity > 0) {
        return sum + (product.selling_price * item.quantity);
      }
      return sum;
    }, 0);
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
      items: form.items.map(({ product_id, quantity, payment_method }) => ({
        product_id,
        quantity,
        payment_method,
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
        {/* Header with Global Payment Method */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <label style={{ fontSize: "12px", color: "#888", textTransform: "uppercase" }}>Default Payment Method</label>
            <select
              className="sales-entry-payment"
              value={form.payment_method}
              onChange={(event) => setForm((prev) => ({ ...prev, payment_method: event.target.value }))}
              disabled={isShopSelectionMissing}
              style={{ marginTop: "4px" }}
            >
              <option value="cash">Cash</option>
              <option value="mpesa">M-Pesa</option>
              <option value="credit">Credit</option>
            </select>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "12px", color: "#888", textTransform: "uppercase", marginBottom: "8px" }}>Total Amount</div>
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#ffa500", fontFamily: "\"Syne\", sans-serif" }}>
              KES {calculateTotal().toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #333", paddingTop: "16px", marginBottom: "16px" }}>
          {/* Items List */}
          {form.items.map((item, idx) => {
            const product = products.find(p => p.id === item.product_id);
            const itemTotal = product ? product.selling_price * item.quantity : 0;
            
            return (
              <div key={idx} style={{ marginBottom: "16px", paddingBottom: "16px", borderBottom: "1px solid #222" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 100px auto", gap: "12px", alignItems: "start" }}>
                  {/* Product Search */}
                  <ProductSearchField
                    products={products}
                    query={item.product_search}
                    onQueryChange={(query) => handleProductQueryChange(idx, query)}
                    onProductSelect={(product) => handleProductSelect(idx, product)}
                    disabled={isShopSelectionMissing}
                  />
                  
                  {/* Quantity */}
                  <div>
                    <label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase" }}>Qty</label>
                    <input
                      type="number"
                      min="1"
                      className="sales-entry-quantity"
                      value={item.quantity}
                      onChange={(event) => updateItem(idx, { quantity: Math.max(1, Number(event.target.value)) })}
                      required
                      disabled={isShopSelectionMissing}
                      style={{ marginTop: "4px" }}
                    />
                  </div>

                  {/* Per-Item Payment Method */}
                  <div>
                    <label style={{ fontSize: "11px", color: "#888", textTransform: "uppercase" }}>Pay With</label>
                    <select
                      value={item.payment_method}
                      onChange={(event) => updateItem(idx, { payment_method: event.target.value })}
                      disabled={isShopSelectionMissing}
                      style={{
                        marginTop: "4px",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #555",
                        backgroundColor: "#1a1a1a",
                        color: "#fff",
                        fontSize: "12px",
                        width: "100%",
                      }}
                    >
                      <option value="cash">Cash</option>
                      <option value="mpesa">M-Pesa</option>
                      <option value="credit">Credit</option>
                    </select>
                  </div>

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    disabled={isShopSelectionMissing}
                    style={{
                      padding: "8px 12px",
                      background: "#ff4444",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: "600",
                      marginTop: "20px",
                    }}
                  >
                    Remove
                  </button>
                </div>

                {/* Item Subtotal */}
                {product && (
                  <div style={{ marginTop: "8px", fontSize: "12px", color: "#aaa" }}>
                    {item.quantity} × KES {Number(product.selling_price).toLocaleString()} = 
                    <span style={{ color: "#ffa500", fontWeight: "600", marginLeft: "8px" }}>
                      KES {itemTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="sales-entry-actions" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
          <button
            type="button"
            onClick={addItem}
            disabled={isShopSelectionMissing}
            className="btn btn-secondary"
            style={{ gridColumn: "1" }}
          >
            + Add Item
          </button>
          <button
            type="button"
            onClick={clearForm}
            disabled={isShopSelectionMissing}
            className="btn btn-secondary"
            style={{ gridColumn: "2" }}
          >
            Clear Form
          </button>
          <button
            type="submit"
            disabled={!isFormValid || isShopSelectionMissing}
            className="btn btn-primary"
            style={{ gridColumn: "3" }}
          >
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
        {isLoading ? (
          <SkeletonTable rows={6} columns={5} />
        ) : (
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
        )}
      </div>
    </section>
  );
}
