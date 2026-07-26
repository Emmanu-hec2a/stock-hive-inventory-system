import { useEffect, useState } from "react";
import api from "../api/client";
import FeatureGate from "../components/FeatureGate";
import { useAuth } from "../state/AuthContext";

const initialForm = {
  name: "",
  email: "",
  phone: "",
  address: "",
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [spendReport, setSpendReport] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const { user } = useAuth();

  const loadData = async () => {
    try {
      const [suppliersRes, spendRes] = await Promise.all([
          api.get("/suppliers/"),
          api.get("/reports/supplier-spend/")
      ]);
      setSuppliers(suppliersRes.data);
      setSpendReport(spendRes.data);
      setError("");
    } catch (err) {
      setError("Could not load supplier data.");
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.role]);

  const onChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    try {
      await api.post("/suppliers/", form);
      setForm(initialForm);
      loadData();
    } catch (err) {
      setError("Failed to create supplier.");
    }
  };

  const toggleStatus = async (supplier) => {
      try {
          await api.patch(`/suppliers/${supplier.id}/`, { is_active: !supplier.is_active });
          loadData();
      } catch (err) {
          setError("Failed to update status.");
      }
  }

  return (
    <section>
      <h1 className="page-title">Suppliers</h1>

      <FeatureGate feature="suppliers">
          <form className="card form-grid" onSubmit={onSubmit}>
            <input name="name" value={form.name} onChange={onChange} placeholder="Supplier Name" required />
            <input name="email" type="email" value={form.email} onChange={onChange} placeholder="Email" />
            <input name="phone" value={form.phone} onChange={onChange} placeholder="Phone" />
            <textarea
                name="address"
                value={form.address}
                onChange={onChange}
                placeholder="Address"
                style={{ gridColumn: 'span 2', minHeight: '60px' }}
            />
            <button type="submit" style={{ gridColumn: 'span 2' }}>Add Supplier</button>
          </form>

          {error && <div className="alert-bar">⚠ {error}</div>}

          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => (
                  <tr key={supplier.id}>
                    <td>
                        <div style={{ fontWeight: 'bold' }}>{supplier.name}</div>
                        <div style={{ fontSize: '0.8rem', color: '#666' }}>{supplier.address}</div>
                    </td>
                    <td>
                        <div>{supplier.email}</div>
                        <div>{supplier.phone}</div>
                    </td>
                    <td>
                      <span className={`pill ${supplier.is_active ? "pill-green" : "pill-red"}`}>
                        {supplier.is_active ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                    <td>
                        <button className="btn btn-small" onClick={() => toggleStatus(supplier)}>
                            {supplier.is_active ? "Deactivate" : "Activate"}
                        </button>
                    </td>
                  </tr>
                ))}
                {suppliers.length === 0 && (
                    <tr>
                        <td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>
                            No suppliers found. Add one above.
                        </td>
                    </tr>
                )}
              </tbody>
            </table>
          </div>

          {spendReport.length > 0 && (
              <div className="card" style={{ marginTop: '24px' }}>
                  <h2 className="section-title">Supplier Spend Analysis (Pro)</h2>
                  <table>
                      <thead>
                          <tr>
                              <th>Supplier</th>
                              <th style={{ textAlign: 'right' }}>Total Procurement Spend</th>
                          </tr>
                      </thead>
                      <tbody>
                          {spendReport.map((item, idx) => (
                              <tr key={idx}>
                                  <td>{item.supplier__name || 'Unknown Supplier'}</td>
                                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                      KES {Number(item.total_spend).toLocaleString()}
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          )}
      </FeatureGate>
    </section>
  );
}
