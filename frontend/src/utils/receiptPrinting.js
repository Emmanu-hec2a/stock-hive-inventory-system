import api from "../api/client";

/**
 * Fetch receipt data from server
 * @param {string} saleId - The sale ID
 * @returns {Promise<Object>} Receipt data
 */
export async function fetchReceiptData(saleId) {
  try {
    const response = await api.get(`/sales/${saleId}/receipt/`);
    return response.data;
  } catch (error) {
    console.error("Failed to fetch receipt data:", {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
    });
    
    // Extract error message for user display
    let errorMessage = "Could not load receipt data.";
    if (error.response?.data?.detail) {
      errorMessage = error.response.data.detail;
    } else if (typeof error.response?.data === 'string') {
      errorMessage = error.response.data;
    } else if (error.response?.status === 404) {
      errorMessage = "Sale not found. Please try again.";
    } else if (error.response?.status === 403) {
      errorMessage = "You don't have permission to view this receipt.";
    }
    
    throw new Error(errorMessage);
  }
}

/**
 * Trigger browser print for thermal printer
 * @param {HTMLElement} element - The element to print
 */
export function printReceipt(element) {
  const printWindow = window.open("", "", "width=800,height=600");
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Receipt</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: "Courier New", monospace;
            padding: 20px;
            background: white;
          }
          @media print {
            body { margin: 0; padding: 0; }
          }
        </style>
      </head>
      <body>
        ${element.innerHTML}
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  
  // Print after slight delay to ensure content is rendered
  setTimeout(() => {
    printWindow.print();
  }, 250);
}

/**
 * Check if thermal printer is available
 * @returns {boolean}
 */
export function hasThermalPrinterSupport() {
  return typeof navigator !== "undefined" && navigator.usb !== undefined;
}

/**
 * Get available USB printers
 * @returns {Promise<Array>} List of USB devices that could be printers
 */
export async function getUSBPrinters() {
  if (!hasThermalPrinterSupport()) {
    return [];
  }

  try {
    const devices = await navigator.usb.getDevices();
    // Filter for common thermal printer vendor IDs
    const thermalPrinterVendorIds = [
      0x04b8, // Epson
      0x0471, // Philips (used in some thermal printers)
      0x067b, // Prolific (common in thermal printers)
    ];

    return devices.filter((device) =>
      thermalPrinterVendorIds.includes(device.vendorId)
    );
  } catch (error) {
    console.error("Error getting USB printers:", error);
    return [];
  }
}

/**
 * Print to specific USB thermal printer
 * @param {USBDevice} device - The USB device
 * @param {string} escposContent - ESC/POS formatted content
 * @returns {Promise<void>}
 */
export async function printToUSBDevice(device, escposContent) {
  try {
    if (!device.opened) {
      await device.open();
    }

    // Determine the correct endpoint (usually endpoint 1)
    const interfaceNumber = 0;
    const endpointNumber = 1;

    const encoder = new TextEncoder();
    const data = encoder.encode(escposContent);

    await device.transferOut(endpointNumber, data);
    await device.close();

    return { success: true, message: "Receipt printed successfully" };
  } catch (error) {
    console.error("USB printer error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Request printer and print
 * @param {string} escposContent - ESC/POS formatted content
 * @returns {Promise<void>}
 */
export async function printToThermalPrinter(escposContent) {
  if (!hasThermalPrinterSupport()) {
    throw new Error("WebUSB not supported in this browser");
  }

  try {
    // Request access to a USB device
    const devices = await navigator.usb.requestDevice({
      filters: [
        { vendorId: 0x04b8 }, // Epson
        { vendorId: 0x0471 }, // Philips
        { vendorId: 0x067b }, // Prolific
      ],
    });

    return await printToUSBDevice(devices, escposContent);
  } catch (error) {
    if (error.name === "NotFoundError") {
      throw new Error("No printer selected");
    }
    throw error;
  }
}

/**
 * Convert receipt to PDF using html2pdf library
 * @param {HTMLElement} element - Receipt element
 * @param {string} filename - Output filename
 * @returns {Promise<void>}
 */
export async function downloadReceiptPDF(element, filename = "receipt.pdf") {
  if (!window.html2pdf) {
    throw new Error("PDF library not loaded. Please include html2pdf in your page.");
  }

  try {
    const opt = {
      margin: [5, 5, 5, 5],
      filename: filename,
      image: { type: "png", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: {
        unit: "mm",
        format: [80, 200], // 80mm thermal paper width, variable height
        orientation: "portrait",
      },
    };

    await window.html2pdf().set(opt).from(element).save();
  } catch (error) {
    console.error("PDF download error:", error);
    throw error;
  }
}

/**
 * Copy receipt to clipboard for mobile sharing
 * @param {Object} receipt - Receipt data
 * @returns {Promise<void>}
 */
export async function shareReceipt(receipt) {
  try {
    const text = formatReceiptAsText(receipt);

    if (navigator.share) {
      await navigator.share({
        title: `Receipt #${receipt.id}`,
        text: text,
      });
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(text);
      return { success: true, message: "Receipt copied to clipboard" };
    }
  } catch (error) {
    console.error("Share error:", error);
    throw error;
  }
}

/**
 * Format receipt as plain text
 * @param {Object} receipt - Receipt data
 * @returns {string}
 */
export function formatReceiptAsText(receipt) {
  let text = "";
  text += `${receipt.shop_name}\n`;
  text += `${receipt.shop_location}\n`;
  text += `${"=".repeat(40)}\n`;
  text += `Receipt #: ${receipt.id}\n`;
  text += `Date: ${new Date(receipt.date).toLocaleString()}\n`;
  text += `Seller: ${receipt.seller_name}\n`;
  text += `${"=".repeat(40)}\n\n`;

  text += `Items:\n`;
  receipt.items.forEach((item) => {
    text += `${item.product_name} (${item.sku})\n`;
    text += `  ${item.quantity}x @ KES ${Number(item.unit_price).toLocaleString()} = KES ${Number(
      item.subtotal
    ).toLocaleString()}\n`;
  });

  text += `\n${"=".repeat(40)}\n`;
  text += `Total Items: ${receipt.total_items}\n`;
  text += `Total Amount: KES ${Number(receipt.total_amount).toLocaleString()}\n`;
  text += `Payment Method: ${receipt.payment_method}\n`;
  text += `${"=".repeat(40)}\n`;
  text += `Thank you for your purchase!\n`;

  return text;
}
