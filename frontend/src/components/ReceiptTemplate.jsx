import { useEffect, useRef } from "react";
import { Printer, Download, X } from "lucide-react";
import "../Receipt.css";

export default function ReceiptTemplate({ receipt, onClose, onPrint }) {
  const receiptRef = useRef(null);

  const handlePrint = () => {
    if (onPrint) {
      onPrint(receiptRef);
    } else {
      // Default browser print
      const printWindow = window.open("", "", "width=800,height=600");
      printWindow.document.write(receiptRef.current.innerHTML);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  const handleThermalPrint = () => {
    // ESC/POS thermal printer format
    const receipt_content = generateESCPOSReceipt(receipt);
    
    // Try to print to thermal printer if available
    if (navigator.usb) {
      // For USB thermal printers with WebUSB support
      console.log("WebUSB thermal printer detected");
      printToUSBPrinter(receipt_content);
    } else {
      // Fallback to system print dialog
      handlePrint();
    }
  };

  const handleDownloadPDF = () => {
    // Requires external library like html2pdf
    if (window.html2pdf) {
      const element = receiptRef.current;
      const opt = {
        margin: 5,
        filename: `receipt-${receipt.id}.pdf`,
        image: { type: "png", quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      };
      window.html2pdf().set(opt).from(element).save();
    } else {
      // Fallback: trigger print dialog
      handlePrint();
    }
  };

  return (
    <div className="receipt-modal-overlay" onClick={onClose}>
      <div className="receipt-modal" onClick={(e) => e.stopPropagation()}>
        <div className="receipt-modal-header">
          <h2>Receipt Preview</h2>
          <button className="receipt-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="receipt-modal-content">
          <div className="receipt-container" ref={receiptRef}>
            <div className="receipt">
              {/* Header */}
              <div className="receipt-header">
                <div className="receipt-shop-name">{receipt.shop_name}</div>
                <div className="receipt-shop-location">{receipt.shop_location}</div>
              </div>

              {/* Receipt Number & Date */}
              <div className="receipt-meta">
                <div className="receipt-row">
                  <span className="label">Receipt #:</span>
                  <span className="value">{receipt.id}</span>
                </div>
                <div className="receipt-row">
                  <span className="label">Date:</span>
                  <span className="value">
                    {new Date(receipt.date).toLocaleString()}
                  </span>
                </div>
                <div className="receipt-row">
                  <span className="label">Seller:</span>
                  <span className="value">{receipt.seller_name}</span>
                </div>
              </div>

              <div className="receipt-divider"></div>

              {/* Items */}
              <table className="receipt-items">
                <tbody>
                  {receipt.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="item-name">
                        <div>{item.product_name}</div>
                        <div className="item-sku">SKU: {item.sku}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <table className="receipt-details">
                <thead style={{ fontSize: "11px", borderBottom: "1px solid #444", marginBottom: "8px" }}>
                  <tr>
                    <th style={{ textAlign: "left", paddingBottom: "8px" }}>QTY</th>
                    <th style={{ textAlign: "right", paddingBottom: "8px" }}>PRICE</th>
                    <th style={{ textAlign: "right", paddingBottom: "8px" }}>SUBTOTAL</th>
                    <th style={{ textAlign: "center", paddingBottom: "8px" }}>PAYMENT</th>
                  </tr>
                </thead>
                <tbody>
                  {receipt.items.map((item, idx) => (
                    <tr key={idx} style={{ fontSize: "12px" }}>
                      <td className="detail-qty">{item.quantity}x</td>
                      <td className="detail-price">KES {Number(item.unit_price).toLocaleString()}</td>
                      <td className="detail-subtotal">KES {Number(item.subtotal).toLocaleString()}</td>
                      <td style={{ textAlign: "center", fontSize: "11px", textTransform: "capitalize", color: "#ffa500", fontWeight: "600" }}>
                        {item.payment_method || item.payment_method_display || "Cash"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="receipt-divider"></div>

              {/* Total with Discount */}
              <div className="receipt-total">
                <div className="receipt-row">
                  <span className="label">Total Items:</span>
                  <span className="value">{receipt.total_items}</span>
                </div>
                
                {/* Show subtotal if discount applied */}
                {receipt.discount_value && (
                  <>
                    <div className="receipt-row">
                      <span className="label">Subtotal:</span>
                      <span className="value">KES {(Number(receipt.total_amount) + Number(receipt.discount_value)).toLocaleString()}</span>
                    </div>
                    
                    <div className="receipt-row" style={{ color: "#4ade80", fontWeight: "600" }}>
                      <span className="label">Discount {receipt.discount_type === 'percent' ? `(${receipt.discount_value}%)` : ''}:</span>
                      <span className="value">-KES {Number(receipt.discount_value).toLocaleString()}</span>
                    </div>
                    
                    {receipt.discount_reason && (
                      <div className="receipt-row" style={{ fontSize: "11px", color: "#888" }}>
                        <span className="label">Reason:</span>
                        <span className="value">{receipt.discount_reason}</span>
                      </div>
                    )}
                  </>
                )}
                
                <div className="receipt-row total-amount">
                  <span className="label">Total Amount:</span>
                  <span className="value">KES {Number(receipt.total_amount).toLocaleString()}</span>
                </div>
                <div className="receipt-row">
                  <span className="label">Payment:</span>
                  <span className="value">{receipt.payment_method}</span>
                </div>
              </div>

              <div className="receipt-divider"></div>

              {/* Footer */}
              <div className="receipt-footer">
                <p>Thank you for your purchase!</p>
                <p className="receipt-timestamp">
                  {new Date(receipt.date).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="receipt-modal-actions">
          <button
            className="btn-print"
            onClick={handlePrint}
            title="Print Receipt"
          >
            <Printer size={16} />
            Print
          </button>
          <button
            className="btn-thermal"
            onClick={handleThermalPrint}
            title="Print to Thermal Printer"
          >
            <Printer size={16} />
            Thermal Print
          </button>
          <button
            className="btn-download"
            onClick={handleDownloadPDF}
            title="Download as PDF"
          >
            <Download size={16} />
            Save PDF
          </button>
          <button className="btn-close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Generate ESC/POS thermal printer format
function generateESCPOSReceipt(receipt) {
  let esc = "\x1B"; // ESC character
  let receipt_text = "";

  // Reset and set double-width for header
  receipt_text += esc + "@"; // Initialize
  receipt_text += esc + "!" + String.fromCharCode(32); // Normal mode

  // Center align
  receipt_text += esc + "a" + String.fromCharCode(1);

  // Shop name (bold)
  receipt_text += esc + "E" + String.fromCharCode(1); // Bold on
  receipt_text += receipt.shop_name + "\n";
  receipt_text += esc + "E" + String.fromCharCode(0); // Bold off

  // Location
  receipt_text += receipt.shop_location + "\n";
  receipt_text += "================================\n";

  // Receipt info
  receipt_text += esc + "a" + String.fromCharCode(0); // Left align
  receipt_text += "Receipt #: " + receipt.id + "\n";
  receipt_text += "Date: " + new Date(receipt.date).toLocaleString() + "\n";
  receipt_text += "Seller: " + receipt.seller_name + "\n";
  receipt_text += "================================\n";

  // Items header
  receipt_text += "Item                    Qty Price\n";
  receipt_text += "--------------------------------\n";

  // Items
  receipt.items.forEach((item) => {
    const item_line = `${item.product_name.substring(0, 16).padEnd(16)}${String(item.quantity).padStart(4)} ${Number(item.unit_price).toLocaleString().padStart(8)}\n`;
    receipt_text += item_line;
  });

  receipt_text += "================================\n";

  // Totals (right align)
  receipt_text += esc + "a" + String.fromCharCode(2); // Right align
  receipt_text += "Total Items: " + receipt.total_items + "\n";
  receipt_text += esc + "!" + String.fromCharCode(48); // Double-width
  receipt_text += "KES " + Number(receipt.total_amount).toLocaleString() + "\n";
  receipt_text += esc + "!" + String.fromCharCode(0); // Normal
  receipt_text += esc + "a" + String.fromCharCode(0); // Left align

  receipt_text += "Payment: " + receipt.payment_method + "\n";
  receipt_text += "================================\n";

  // Footer
  receipt_text += esc + "a" + String.fromCharCode(1); // Center
  receipt_text += "Thank you for your purchase!\n";
  receipt_text += "\n\n\n";

  // Cut paper
  receipt_text += esc + "m"; // Full cut

  return receipt_text;
}

// USB Thermal Printer support (requires WebUSB API)
async function printToUSBPrinter(escpos_content) {
  try {
    // Request access to USB device
    const device = await navigator.usb.requestDevice({
      filters: [{ vendorId: 0x04b8 }], // Epson vendor ID (example)
    });

    if (!device.opened) {
      await device.open();
    }

    // Send ESC/POS content
    const encoder = new TextEncoder();
    const data = encoder.encode(escpos_content);
    await device.transferOut(1, data);

    await device.close();
    console.log("Receipt printed to USB thermal printer");
  } catch (err) {
    console.error("USB printer error:", err);
    alert("Could not connect to thermal printer. Using browser print instead.");
  }
}
