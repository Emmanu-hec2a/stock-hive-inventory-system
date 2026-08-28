import { useEffect, useRef, useState } from "react";
import api from "../api/client";

export function useBarcodeLookup(barcode, onProductFound) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [found, setFound] = useState(false);
  const debounceTimer = useRef(null);

  useEffect(() => {
    if (!barcode || barcode.length < 3) {
      setError("");
      setFound(false);
      return;
    }

    // Clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Debounce lookup (300ms)
    debounceTimer.current = setTimeout(async () => {
      setLoading(true);
      setError("");

      try {
        const response = await api.get(`/products/lookup/barcode/?barcode=${encodeURIComponent(barcode)}`);
        
        if (response.data.found) {
          setFound(true);
          setError("");
          // Call callback with product data
          if (onProductFound) {
            onProductFound(response.data.product);
          }
        } else {
          setFound(false);
          setError("Barcode not found. Enter product details manually.");
        }
      } catch (err) {
        if (err.response?.status === 403) {
          setError("Feature not available for your plan. Upgrade to Pro.");
        } else if (err.response?.status === 404) {
          setFound(false);
          setError("Barcode not found in system.");
        } else {
          setError(err.response?.data?.error || "Error looking up barcode.");
        }
        setFound(false);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [barcode, onProductFound]);

  return { loading, error, found };
}
