import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";

export default function RegisterPage() {
  const [form, setForm] = useState({
    email: "",
    full_name: "",
    password: "",
    password_confirm: "",
    business_name: "",
    shop_name: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onChange = (event) => {
    setForm((prev) => ({
      ...prev,
      [event.target.name]: event.target.value,
    }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    if (form.password !== form.password_confirm) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      await api.post("/auth/register/", form);
      setError("");
      navigate("/login", { state: { message: "Registration successful! Please log in." } });
    } catch (err) {
      const errors = err?.response?.data;
      if (typeof errors === "object") {
        const errorMessages = Object.entries(errors)
          .map(([key, value]) => `${key}: ${Array.isArray(value) ? value[0] : value}`)
          .join("; ");
        setError(errorMessages);
      } else {
        setError(errors?.detail || "Registration failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="card" onSubmit={onSubmit}>
        <h1 className="page-title">Create StočkHive Account</h1>

        <input
          type="email"
          name="email"
          value={form.email}
          placeholder="Email"
          onChange={onChange}
          required
        />

        <input
          type="text"
          name="full_name"
          value={form.full_name}
          placeholder="Full Name"
          onChange={onChange}
          required
        />

        <input
          type="password"
          name="password"
          value={form.password}
          placeholder="Password"
          onChange={onChange}
          required
        />

        <input
          type="password"
          name="password_confirm"
          value={form.password_confirm}
          placeholder="Confirm Password"
          onChange={onChange}
          required
        />

        <input
          type="text"
          name="business_name"
          value={form.business_name}
          placeholder="Business Name"
          onChange={onChange}
          required
        />

        <input
          type="text"
          name="shop_name"
          value={form.shop_name}
          placeholder="First Shop Name (optional)"
          onChange={onChange}
        />

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? "Creating account..." : "Register"}
        </button>

        <p style={{ textAlign: "center", marginTop: "1rem" }}>
          Already have an account?{" "}
          <a href="/login" style={{ color: "#007bff", textDecoration: "none" }}>
            Log in here
          </a>
        </p>
      </form>
    </div>
  );
}
