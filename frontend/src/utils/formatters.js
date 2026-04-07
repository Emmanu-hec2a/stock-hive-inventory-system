/**
 * Format large numbers to K, M, B format
 * @param {number|string} value - The number to format
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted number
 */
export function formatNumber(value) {
  if (value === null || value === undefined || value === "") return "-";
  
  const num = Math.abs(Number(value));
  
  if (isNaN(num)) return "-";
  if (num === 0) return "0";
  
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2).replace(/\.?0+$/, "") + "M";
  } else if (num >= 1000) {
    return (num / 1000).toFixed(num >= 100000 ? 0 : 1).replace(/\.?0+$/, "") + "K";
  }
  
  return num.toFixed(2);
}

/**
 * Format currency with KES prefix
 * @param {number|string} value - The amount to format
 * @returns {string} Formatted currency (e.g., "KES 1.2K", "KES 2.89M")
 */
export function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "-";
  
  const num = Math.abs(Number(value));
  
  if (isNaN(num)) return "-";
  if (num === 0) return "KES 0";
  
  let formatted;
  if (num >= 1000000) {
    formatted = "KES " + (num / 1000000).toFixed(2).replace(/\.?0+$/, "") + "M";
  } else if (num >= 1000) {
    formatted = "KES " + (num / 1000).toFixed(num >= 100000 ? 0 : 1).replace(/\.?0+$/, "") + "K";
  } else {
    formatted = "KES " + num.toFixed(2);
  }
  
  return formatted;
}
