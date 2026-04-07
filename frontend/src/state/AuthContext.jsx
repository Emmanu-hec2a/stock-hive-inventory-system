import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem("access_token"));
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("auth_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [shops, setShops] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [selectedShopId, setSelectedShopId] = useState(
    localStorage.getItem("selected_shop_id") || "",
  );

  const isSuperAdmin = user?.role === "super_admin";

  const selectShop = (shopId) => {
    setSelectedShopId(shopId || "");
    if (shopId) {
      localStorage.setItem("selected_shop_id", shopId);
    } else {
      localStorage.removeItem("selected_shop_id");
    }
  };

  const fetchShops = async () => {
    if (!isSuperAdmin) {
      setShops([]);
      return;
    }
    const response = await api.get("/shops/");
    setShops(response.data);
    if (!selectedShopId && response.data.length > 0) {
      selectShop(response.data[0].id);
    }
  };

  const fetchSubscription = async () => {
    const response = await api.get("/billing/subscription/");
    setSubscription(response.data);
  };

  const login = async (email, password) => {
    const response = await api.post("/auth/login/", { email, password });
    const { access, refresh, user: userData } = response.data;
    localStorage.setItem("access_token", access);
    localStorage.setItem("refresh_token", refresh);
    localStorage.setItem("auth_user", JSON.stringify(userData));
    setToken(access);
    setUser(userData);
    if (userData.role !== "super_admin") {
      selectShop(userData.shop_id || "");
    }
    try {
      await fetchSubscription();
    } catch (error) {
      setSubscription(null);
    }
  };

  const logout = async () => {
    const refresh = localStorage.getItem("refresh_token");
    if (refresh) {
      try {
        await api.post("/auth/logout/", { refresh });
      } catch (error) {
        // Ignore logout endpoint failures and clear local session anyway.
      }
    }
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("auth_user");
    localStorage.removeItem("selected_shop_id");
    setToken(null);
    setUser(null);
    setShops([]);
    setSelectedShopId("");
    setSubscription(null);
  };

  useEffect(() => {
    if (!token || !user) return;
    if (user.role === "super_admin") {
      fetchShops().catch(() => setShops([]));
    } else {
      selectShop(user.shop_id || "");
    }
    fetchSubscription().catch(() => setSubscription(null));
  }, [token, user?.role]);

  const scopedQuery = isSuperAdmin && selectedShopId ? `?shop_id=${selectedShopId}` : "";

  const value = useMemo(
    () => ({
      token,
      user,
      login,
      logout,
      shops,
      refreshShops: fetchShops,
      selectedShopId,
      selectShop,
      scopedQuery,
      subscription,
      refreshSubscription: fetchSubscription,
      isAuthenticated: Boolean(token),
    }),
    [token, user, shops, selectedShopId, scopedQuery, subscription],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
