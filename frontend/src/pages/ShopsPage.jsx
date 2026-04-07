import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../state/AuthContext";

const defaults = { name: "", location: "", phone: "" };

export default function ShopsPage() {
  const { user, shops, refreshShops } = useAuth();
  const [form, setForm] = useState(defaults);
  const [error, setError] = useState("");

  useEffect(() => {
    refreshShops().catch(() => {});
  }, []);

  const createShop = async (event) => {
    event.preventDefault();
    try {
      await api.post("/shops/", form);
      setForm(defaults);
      setError("");
      await refreshShops();
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not create shop. Check your plan limit.");
    }
  };

  const deactivateShop = async (shopId) => {
    try {
      await api.delete(`/shops/${shopId}/`);
      await refreshShops();
    } catch (err) {
      setError("Could not deactivate shop.");
    }
  };

  if (user?.role !== "super_admin") {
    return (
      <section>
        <h1 className="page-title">Shops</h1>
        <div className="alert-bar">⚠ Only business owners can create or manage shops.</div>
      </section>
    );
  }

  return (
    <section>
      <h1 className="page-title">Shops</h1>
      <form className="card form-grid" onSubmit={createShop}>
        <input
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Shop name"
          required
        />
        <input
          value={form.location}
          onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
          placeholder="Location"
          required
        />
        <input
          value={form.phone}
          onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
          placeholder="Phone"
        />
        <button type="submit">Add Shop</button>
      </form>
      {error && <div className="alert-bar">⚠ {error}</div>}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Location</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {shops.map((shop) => (
              <tr key={shop.id}>
                <td>{shop.name}</td>
                <td>{shop.location}</td>
                <td>{shop.phone || "-"}</td>
                <td>
                  <span className={`pill ${shop.is_active ? "pill-green" : "pill-red"}`}>
                    {shop.is_active ? "ACTIVE" : "INACTIVE"}
                  </span>
                </td>
                <td>
                  {shop.is_active ? (
                    <button className="danger-btn" type="button" onClick={() => deactivateShop(shop.id)}>
                      Deactivate
                    </button>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
