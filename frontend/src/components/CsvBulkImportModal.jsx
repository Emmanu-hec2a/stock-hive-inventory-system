import { useState, useRef } from "react";
import { Upload, X, AlertCircle, CheckCircle, Loader2, Download } from "lucide-react";
import api from "../api/client";

export default function CsvBulkImportModal({ onClose, onSuccess }) {
  const [step, setStep] = useState("upload"); // upload, preview, confirm, success
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith((".csv", ".xlsx"))) {
        setError("Only CSV and XLSX files are supported");
        return;
      }
      setFile(selectedFile);
      setError("");
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a file");
      return;
    }

    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await api.post("/products/bulk-import/preview/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.data.can_proceed) {
        setPreview(response.data);
        setStep("preview");
      } else {
        setError(`Found ${response.data.error_rows} errors. Fix them and try again.`);
        setPreview(response.data);
        setStep("errors");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to upload file");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!preview?.preview) return;

    setLoading(true);
    setError("");

    try {
      const response = await api.post("/products/bulk-import/confirm/", {
        rows: preview.preview,
      });

      setStep("success");
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to import products");
      setStep("preview");
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const headers = ["name", "sku", "category", "selling_price", "buying_price", "initial_stock", "unit"];
    const csv = [headers.join(","), "Khaki Pants,KP-001,Clothing,2500,1500,10,pieces"].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "StockHive_Product_Template.csv";
    a.click();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: "600px" }}>
        <div className="modal-header">
          <h2 className="modal-title">Bulk Import Products</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {step === "upload" && (
            <form onSubmit={handleUpload}>
              <div
                style={{
                  border: "2px dashed var(--amber)",
                  borderRadius: "8px",
                  padding: "40px 20px",
                  textAlign: "center",
                  cursor: "pointer",
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={40} style={{ color: "var(--amber)", margin: "0 auto 16px" }} />
                <p style={{ marginBottom: "8px" }}>Drop CSV file here or click to browse</p>
                <p style={{ fontSize: "12px", color: "var(--muted)" }}>
                  Supported formats: CSV, XLSX
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={handleFileSelect}
                  style={{ display: "none" }}
                />
              </div>

              {file && (
                <div
                  style={{
                    marginTop: "16px",
                    padding: "12px",
                    backgroundColor: "var(--surface)",
                    borderRadius: "6px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>{file.name}</span>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    style={{ background: "none", border: "none", cursor: "pointer" }}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              <div style={{ marginTop: "20px", display: "flex", gap: "12px" }}>
                <button type="submit" disabled={!file || loading} className="btn btn-primary" style={{ flex: 1 }}>
                  {loading ? "Validating..." : "Validate & Preview"}
                </button>
                <button type="button" onClick={downloadTemplate} className="btn btn-ghost">
                  <Download size={16} /> Download Template
                </button>
              </div>

              {error && <div className="alert-bar" style={{ marginTop: "16px" }}>{error}</div>}
            </form>
          )}

          {step === "errors" && (
            <div>
              <div style={{ marginBottom: "20px" }}>
                <h3 style={{ color: "var(--crimson)", marginBottom: "12px" }}>
                  <AlertCircle size={20} style={{ display: "inline", marginRight: "8px" }} />
                  Found {preview.error_rows} Errors
                </h3>
                <div style={{ backgroundColor: "#1f1f1f", padding: "12px", borderRadius: "6px", maxHeight: "300px", overflowY: "auto" }}>
                  {preview.errors.map((err, idx) => (
                    <div key={idx} style={{ fontSize: "12px", marginBottom: "8px", color: "#fca5a5" }}>
                      {err}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: "12px" }}>
                <button onClick={() => setStep("upload")} className="btn btn-ghost" style={{ flex: 1 }}>
                  Back
                </button>
              </div>
            </div>
          )}

          {step === "preview" && (
            <div>
              <div style={{ marginBottom: "20px" }}>
                <h3 style={{ marginBottom: "12px" }}>Preview</h3>
                <div style={{ fontSize: "14px", marginBottom: "16px" }}>
                  <p>
                    <strong>Total Rows:</strong> {preview.total_rows}
                  </p>
                  <p style={{ color: "var(--emerald)" }}>
                    <strong>✓ Valid:</strong> {preview.valid_rows}
                  </p>
                </div>

                <div style={{ backgroundColor: "#1f1f1f", borderRadius: "6px", maxHeight: "300px", overflowX: "auto" }}>
                  <table style={{ width: "100%", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border)" }}>
                        <th style={{ padding: "8px", textAlign: "left" }}>Name</th>
                        <th style={{ padding: "8px", textAlign: "left" }}>SKU</th>
                        <th style={{ padding: "8px", textAlign: "left" }}>Price</th>
                        <th style={{ padding: "8px", textAlign: "left" }}>Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.preview.slice(0, 5).map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "8px" }}>{row.data.name}</td>
                          <td style={{ padding: "8px" }}>{row.data.sku}</td>
                          <td style={{ padding: "8px" }}>KES {row.data.selling_price}</td>
                          <td style={{ padding: "8px" }}>{row.data.initial_stock}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {preview.valid_rows > 5 && (
                  <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "8px" }}>
                    ... and {preview.valid_rows - 5} more
                  </p>
                )}
              </div>

              <div style={{ display: "flex", gap: "12px" }}>
                <button onClick={() => setStep("upload")} className="btn btn-ghost" style={{ flex: 1 }}>
                  Back
                </button>
                <button onClick={handleConfirmImport} disabled={loading} className="btn btn-primary" style={{ flex: 1 }}>
                  {loading ? "Importing..." : `Import ${preview.valid_rows} Products`}
                </button>
              </div>

              {error && <div className="alert-bar" style={{ marginTop: "16px" }}>{error}</div>}
            </div>
          )}

          {step === "success" && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <CheckCircle size={60} style={{ color: "var(--emerald)", margin: "0 auto 16px" }} />
              <h3>Import Successful!</h3>
              <p style={{ color: "var(--muted)", marginTop: "8px" }}>
                {preview?.valid_rows} products have been added to your inventory.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
