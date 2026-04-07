import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../state/AuthContext";

const initialStaff = {
  full_name: "",
  email: "",
  password: "",
  role: "cashier",
  shop: "",
};

export default function StaffPage() {
  const { user, shops, refreshShops } = useAuth();
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState(initialStaff);
  const [error, setError] = useState("");

  const loadStaff = async () => {
    const response = await api.get("/staff/");
    setStaff(response.data);
  };

  useEffect(() => {
    refreshShops().catch(() => {});
    loadStaff().catch(() => setError("Could not load staff list."));
  }, []);

  const createStaff = async (event) => {
    event.preventDefault();
    try {
      await api.post("/staff/", form);
      setForm(initialStaff);
      setError("");
      await loadStaff();
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not create staff account.");
    }
  };

  return (
    <section>
      <h1 className="page-title">Staff Assignment</h1>
      <form className="card form-grid" onSubmit={createStaff}>
        <input
          value={form.full_name}
          onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
          placeholder="Full name"
          required
        />
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          placeholder="Email"
          required
        />
        <input
          type="password"
          value={form.password}
          onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
          placeholder="Password"
          required
        />
        <select
          value={form.role}
          onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
        >
          <option value="cashier">Cashier</option>
          {user?.role === "super_admin" && <option value="shop_admin">Shop Admin</option>}
        </select>
        <select
          value={form.shop}
          onChange={(e) => setForm((prev) => ({ ...prev, shop: e.target.value }))}
          required={user?.role === "super_admin"}
          disabled={user?.role !== "super_admin"}
        >
          <option value="">Assign shop</option>
          {shops.map((shop) => (
            <option key={shop.id} value={shop.id}>
              {shop.name}
            </option>
          ))}
        </select>
        <button type="submit">Add Staff</button>
      </form>
      {error && <div className="alert-bar">⚠ {error}</div>}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Shop</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((member) => (
              <tr key={member.id}>
                <td>{member.full_name}</td>
                <td>{member.email}</td>
                <td>{member.role}</td>
                <td>{member.shop_name || "-"}</td>
                <td>
                  <span className={`pill ${member.is_active ? "pill-green" : "pill-red"}`}>
                    {member.is_active ? "ACTIVE" : "INACTIVE"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
