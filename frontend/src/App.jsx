import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import BillingPage from "./pages/BillingPage";
import ProductsPage from "./pages/ProductsPage";
import SalesPage from "./pages/SalesPage";
import ShopsPage from "./pages/ShopsPage";
import StaffPage from "./pages/StaffPage";
import StockPage from "./pages/StockPage";
import SettingsPage from "./pages/SettingsPage";
import { useAuth } from "./state/AuthContext";

function App() {
  const { token } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route
          path="products"
          element={
            <RoleRoute allowedRoles={["super_admin", "shop_admin"]}>
              <ProductsPage />
            </RoleRoute>
          }
        />
        <Route
          path="stock"
          element={
            <RoleRoute allowedRoles={["super_admin", "shop_admin"]}>
              <StockPage />
            </RoleRoute>
          }
        />
        <Route path="sales" element={<SalesPage />} />
        <Route
          path="billing"
          element={
            <RoleRoute allowedRoles={["super_admin"]}>
              <BillingPage />
            </RoleRoute>
          }
        />
        <Route
          path="shops"
          element={
            <RoleRoute allowedRoles={["super_admin"]}>
              <ShopsPage />
            </RoleRoute>
          }
        />
        <Route
          path="staff"
          element={
            <RoleRoute allowedRoles={["super_admin", "shop_admin"]}>
              <StaffPage />
            </RoleRoute>
          }
        />
        <Route
          path="settings"
          element={
            <RoleRoute allowedRoles={["super_admin", "shop_admin"]}>
              <SettingsPage />
            </RoleRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to={token ? "/" : "/login"} replace />} />
    </Routes>
  );
}

export default App;
