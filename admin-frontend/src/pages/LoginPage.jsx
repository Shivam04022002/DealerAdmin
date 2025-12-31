import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api'; // axios instance with baseURL like http://192.168.29.106:5001/api
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth() || {};

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await API.post("/auth/login", { email, password });
      // DEBUG: show full response when debugging
      console.log("login response (full):", res);

      const body = res?.data;

      // Accept either:
      // 1) { token, admin: { ... } }
      // 2) { token, _id, email, ... }  (your current backend)
      // 3) or nested shapes (defensive)
      const token = body?.token || body?.data?.token;
      let admin =
        body?.admin ||
        (body?.admin && { _id: body.admin.id, email: body.admin.email, name: body.admin.name, role: body.admin.role }) ||
        (body && (body._id || body.email) ? { _id: body._id, email: body.email, name: body.name, role: body.role } : null) ||
        (body?.data && (body.data._id || body.data.email) ? { _id: body.data._id, email: body.data.email, name: body.data.name, role: body.data.role } : null);

      if (!token) {
        console.error("Login response missing token:", body);
        throw new Error("Login failed: token not returned by server");
      }

      // If admin object is still missing, create a minimal one from token payload if possible
      if (!admin) {
        // try to decode JWT (very small, safe decode without verification)
        try {
          const parts = token.split(".");
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
            admin = { _id: payload.id || payload._id || null, email: payload.email || null, name: payload.name || null, role: payload.role || null };
          }
        } catch (e) {
          // ignore decode errors
        }
      }

      // persist token
      localStorage.setItem("adminToken", token);

      // persist minimal admin info
      if (admin) localStorage.setItem("adminInfo", JSON.stringify(admin));
      else localStorage.removeItem("adminInfo");

      // update auth context (adapt depending on your login signature)
      // your context's login() may expect { token, admin } or just admin object — handle both
      if (typeof login === "function") {
        try {
          // prefer { token, admin } shape
          login({ token, admin });
        } catch (e) {
          // fallback: call with admin only
          try {
            login(admin || { token });
          } catch {}
        }
      }

      // navigate to appropriate dashboard based on role
      if (admin?.role === "superadmin") {
        navigate("/superadmin-dashboard");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      console.error("LOGIN ERROR:", err);
      const msg = err?.response?.data?.message || err?.message || "Login failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };
  const handleDownloadApk = () => {
  // Temporary placeholder URL (will replace later)
  const apkUrl = "#";

  if (apkUrl === "#") {
    alert("APK download link will be available soon!");
    return;
  }

  const link = document.createElement("a");
  link.href = apkUrl;
  link.download = "admin-app.apk";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};


  return (
   <div
  style={{
    display: "flex",
    minHeight: "100vh",
    padding: "40px",
    background: "linear-gradient(135deg, #f3f4f6, #e5e7eb)",
    boxSizing: "border-box",
    gap: "40px",
  }}
>
  {/* LEFT SIDE – ADMIN LOGIN */}
  <div
    style={{
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <div
      className="card shadow"
      style={{
        width: "100%",
        maxWidth: "420px",
        borderRadius: "16px",
        border: "none",
        overflow: "hidden",
      }}
    >
      <div
        className="card-body"
        style={{
          padding: "32px",
          backgroundColor: "#ffffff",
        }}
      >
        <h3
          className="text-center mb-4"
          style={{ fontWeight: "600", color: "#111827" }}
        >
          Admin Login
        </h3>

        {error && (
          <div className="alert alert-danger" style={{ fontSize: "14px" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group mb-3">
            <label style={{ fontSize: "14px", fontWeight: 500 }}>Email address</label>
            <input
              type="email"
              className="form-control"
              style={{
                borderRadius: "10px",
                padding: "10px 12px",
                fontSize: "14px",
              }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div className="form-group mb-3">
            <label style={{ fontSize: "14px", fontWeight: 500 }}>Password</label>
            <input
              type="password"
              className="form-control"
              style={{
                borderRadius: "10px",
                padding: "10px 12px",
                fontSize: "14px",
              }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary w-100"
            disabled={loading}
            style={{
              marginTop: "8px",
              padding: "10px 0",
              borderRadius: "999px",
              fontWeight: 600,
            }}
          >
            {loading ? "Logging in…" : "Login"}
          </button>
        </form>
      </div>
    </div>
  </div>

  {/* RIGHT SIDE – APK DOWNLOAD */}
  <div
    style={{
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <div
      style={{
        textAlign: "center",
        padding: "32px",
        borderRadius: "20px",
        background:
          "linear-gradient(135deg, #2563eb, #1d4ed8)",
        color: "#ffffff",
        boxShadow: "0 20px 40px rgba(37, 99, 235, 0.35)",
        maxWidth: "420px",
        width: "100%",
      }}
    >
      <h2 style={{ marginBottom: "12px", fontWeight: 600 }}>
        Download Dealer App
      </h2>
      <p style={{ fontSize: "14px", opacity: 0.9, marginBottom: "20px" }}>
        Here is the dealer application download link .
      </p>

      <button
        type="button"
        onClick={handleDownloadApk} // <- your download handler
        style={{
          border: "none",
          outline: "none",
          padding: "12px 24px",
          borderRadius: "999px",
          backgroundColor: "#ffffff",
          color: "#1d4ed8",
          fontWeight: 600,
          fontSize: "14px",
          cursor: "pointer",
          boxShadow: "0 10px 25px rgba(15, 23, 42, 0.25)",
        }}
      >
        Click to Download APK
      </button>
    </div>
  </div>
</div>


  );
};

export default LoginPage;
