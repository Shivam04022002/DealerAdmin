// src/pages/Dashboard.jsx — Card UI (no tables), same data & routes
import React, { useEffect, useState, useRef } from "react";
import API from "../services/api"; // baseURL: http://192.168.29.106:5001/api
import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom"; // <- added useLocation
import logo from "../assets/logo-surjit.png";


const Dashboard = () => {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation(); // <-- read router state

  const [pendingApps, setPendingApps] = useState([]);
  const [approvedApps, setApprovedApps] = useState([]);
  const [rejectedApps, setRejectedApps] = useState([]);
  const [tab, setTab] = useState("pending");
  const [loading, setLoading] = useState(false);

  // UI: dropdown open state and ref for the account button
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  // Grid ref so we can scroll it into view
  const gridRef = useRef(null);

  // minimal inline styles used by the account button
  const styles = {
    userBtn: {
      border: "1px solid #e5e7eb",
      background: "#fff",
      padding: "8px 10px",
      borderRadius: 10,
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
    },
  };

  const getDealerField = (app, key) =>
    app?.dealerDetails?.[key] ||
    app?.dealer?.[key] ||
    app?.dealerDetails?.[key?.charAt(0).toUpperCase() + key.slice(1)] ||
    "—";

  // Stable fetch functions (useCallback so effects can depend on them without stale identity)
    const fetchPending = React.useCallback(async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("adminToken");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const { data } = await API.get("/workflow/pending", { headers });
        setPendingApps(Array.isArray(data) ? data : data?.items || []);
      } catch (err) {
        console.error("Failed to load pending apps", err?.response?.data || err.message);
        setPendingApps([]);
      } finally {
        setLoading(false);
      }
    }, []);
  
    const fetchApproved = React.useCallback(async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("adminToken");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const { data } = await API.get("/workflow/applications/approved", { headers });
        setApprovedApps(Array.isArray(data) ? data : data?.items || []);
      } catch (err) {
        console.error("Failed to load approved apps", err?.response?.data || err.message);
        setApprovedApps([]);
      } finally {
        setLoading(false);
      }
    }, []);
  
    const fetchRejected = React.useCallback(async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("adminToken");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const { data } = await API.get("/workflow/applications/rejected", { headers });
        setRejectedApps(Array.isArray(data) ? data : data?.items || []);
      } catch (err) {
        console.error("Failed to load rejected apps", err?.response?.data || err.message);
        setRejectedApps([]);
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    if (!admin) {
      navigate("/");
      return;
    }
    fetchPending();
  }, [admin, navigate, fetchPending]);

  useEffect(() => {
    if (tab === "approved") fetchApproved();
    if (tab === "rejected") fetchRejected();
  }, [tab, fetchApproved, fetchRejected]);

  // ===== Listen for dashboard-focus events and for location.state.focus =====
  useEffect(() => {
    // Handle navigation with state: navigate('/dashboard', { state: { focus: 'approved' } })
    const stateFocus = location?.state?.focus;
    if (stateFocus) {
      setTab(stateFocus);
      // small delay to let rendering happen
      setTimeout(() => {
        if (gridRef.current) gridRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
    }

    // Handle CustomEvent dispatched by Navbar for same-page behavior
    const handler = (e) => {
      const focus = e?.detail?.focus;
      if (!focus) return;
      setTab(focus);
      setTimeout(() => {
        if (gridRef.current) gridRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    };

    window.addEventListener("dashboard-focus", handler);
    return () => window.removeEventListener("dashboard-focus", handler);
  }, [location?.state]);

  // ----------------- Logout handler -----------------
  const handleLogout = () => {
    try {
      if (typeof logout === "function") logout();
    } catch (e) {
      console.warn("logout() threw:", e);
    }
    try {
      localStorage.removeItem("adminToken");
      localStorage.removeItem("adminInfo");
    } catch (err) {
      console.warn("Failed to clear admin tokens from localStorage:", err);
    }
    navigate("/");
  };

  const cards = tab === "pending" ? pendingApps : tab === "approved" ? approvedApps : rejectedApps;

  return (
    <div className="dash-wrap">
      {/* local styles */}
      <style>{`
        :root{
          --bg: linear-gradient(135deg,#eef2ff 0%, #f8fafc 40%, #ffffff 100%);
          --muted: #6b7280;
          --ink: #0f172a;
          --ring: 0 8px 24px rgba(15,23,42,.08);
          --green: #16a34a; --green-100:#ecfdf5; --green-200:#d1fae5;
          --red: #ef4444; --red-100:#fef2f2; --red-200:#fee2e2;
          --amber:#f59e0b; --amber-100:#fffbeb; --amber-200:#fef3c7;
          --blue:#2563eb; --blue-100:#eff6ff; --blue-200:#dbeafe;
        }
        .dash-wrap{
          min-height:100vh; padding:22px;
          background: var(--bg);
        }
        .dash-bar{
          display:flex; justify-content:space-between; align-items:center;
          padding:14px 18px; border:1px solid #eee; border-radius:14px; background:#fff; box-shadow:var(--ring); margin-bottom:16px;
        }
        .dash-title{ margin:0; color:var(--ink) }
        .seg{
          display:inline-flex; padding:4px; background:#f1f5f9; border-radius:999px; gap:6px;
        }
        .seg button{
          border:0; background:transparent; padding:8px 14px; border-radius:999px; font-weight:700; color:var(--muted);
        }
        .seg button.active{
          background:#fff; color:var(--ink); box-shadow:var(--ring);
        }
        .badge{
          display:inline-block; font-size:11px; font-weight:800; padding:2px 8px; border-radius:999px; margin-left:6px;
        }
        .b-pending{ background:var(--amber-100); color:#92400e; border:1px solid var(--amber-200); }
        .b-approved{ background:var(--green-100); color:#065f46; border:1px solid var(--green-200); }
        .b-rejected{ background:var(--red-100); color:#7f1d1d; border:1px solid var(--red-200); }

        .grid{
          display:grid; grid-template-columns: repeat(12,1fr); gap:14px;
        }
        @media (max-width: 992px){ .grid{ grid-template-columns: repeat(6,1fr);} }
        @media (max-width: 576px){ .grid{ grid-template-columns: repeat(2,1fr);} }

        .card{
          grid-column: span 4;
          background:#fff; border:1px solid #eee; border-radius:14px; box-shadow:var(--ring); padding:16px;
          display:flex; flex-direction:column; gap:10px; transition: transform .15s ease, box-shadow .15s ease;
        }
        .card:hover{ transform: translateY(-2px); box-shadow: 0 10px 28px rgba(0,0,0,.08); }
        .meta{ color:var(--muted); font-size:12.5px }
        .row2{ display:flex; gap:10px; flex-wrap:wrap; }
        .k{ color:var(--muted); font-weight:700; font-size:12px; }
        .v{ color:var(--ink); font-weight:700; font-size:13.5px }
        .actions{ display:flex; justify-content:flex-end; gap:10px; margin-top:6px; }
        .btn{
          border:1px solid #e5e7eb; background:#fff; color:var(--ink);
          padding:8px 12px; border-radius:10px; font-weight:700; cursor:pointer;
        }
        .btn-primary{ border-color:var(--blue-200); background:var(--blue-100); color:var(--blue); }
        .btn-outline{ background:#fff; }
        .tag{ font-size:11px; font-weight:800; padding:2px 8px; border-radius:999px; }
        .tag-pending{ background:var(--amber-100); color:#92400e; border:1px solid var(--amber-200); }
        .tag-approved{ background:var(--green-100); color:#065f46; border:1px solid var(--green-200); }
        .tag-rejected{ background:var(--red-100); color:#7f1d1d; border:1px solid var(--red-200); }
        .empty{
          padding:16px; border:1px dashed #e5e7eb; border-radius:12px; text-align:center; background:#fff;
          color:var(--muted); font-weight:700;
        }
      `}</style>

      {/* Top bar */}
      <div className="dash-bar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src={logo} alt="Logo" style={{ height: 40, marginBottom: 4 }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="seg">
            <button
              className={tab === "pending" ? "active" : ""}
              onClick={() => setTab("pending")}
              title="Pending"
            >
              Pending <span className="badge b-pending">{pendingApps.length}</span>
            </button>
            <button
              className={tab === "approved" ? "active" : ""}
              onClick={() => setTab("approved")}
              title="Approved"
            >
              Approved <span className="badge b-approved">{approvedApps.length}</span>
            </button>
            <button
              className={tab === "rejected" ? "active" : ""}
              onClick={() => setTab("rejected")}
              title="Rejected"
            >
              Rejected <span className="badge b-rejected">{rejectedApps.length}</span>
            </button>
          </div>

          {/* Account icon (if you still want it) */}
          <div style={{ position: "relative" }}>
            <button
              ref={btnRef}
              onClick={() => setOpen((v) => !v)}
              style={styles.userBtn}
              aria-haspopup="menu"
              aria-expanded={open ? "true" : "false"}
              title="Account"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 12a5 5 0 100-10 5 5 0 000 10zM21 22a9 9 0 10-18 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>

            {open && (
              <div ref={menuRef} style={{
                position: "absolute",
                right: 0,
                marginTop: 8,
                minWidth: 200,
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                boxShadow: "0 10px 30px rgba(2,6,23,0.08)",
                padding: 10,
                zIndex: 9999,
              }} role="menu" aria-label="Account menu">
                <div style={{ fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>{admin?.name || "Admin"}</div>
                {admin?.email && <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>{admin.email}</div>}
                <button style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "none",
                  background: "#ef4444",
                  color: "#fff",
                  fontWeight: 700,
                  cursor: "pointer",
                }} onClick={handleLogout}>Logout</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && <div className="empty" style={{ marginBottom: 12 }}>Loading…</div>}

      {/* Content grid */}
      {!loading && cards.length === 0 ? (
        <div className="empty">No {tab} applications</div>
      ) : (
        <div className="grid" ref={gridRef}>
          {cards.map((app) => {
            const isPending = tab === "pending";
            const isApproved = tab === "approved";
            const isRejected = tab === "rejected";

            const applicantName =
              app?.applicant?.applicant?.name || app?.applicant?.name || "—";

            const approvedAt = app?.approval?.approvedAt
              ? new Date(app.approval.approvedAt).toLocaleString()
              : app?.updatedAt
              ? new Date(app.updatedAt).toLocaleString()
              : "—";

            const rejectedAt = app?.rejection?.rejectedAt
              ? new Date(app.rejection.rejectedAt).toLocaleString()
              : app?.updatedAt
              ? new Date(app.updatedAt).toLocaleString()
              : "—";

            return (
              <div className="card" key={app._id}>
                {/* Header line */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 900, color: "#111827" }}>
                    {app?.formId || "—"}
                  </div>
                  {isPending && <span className="tag tag-pending">Pending</span>}
                  {isApproved && <span className="tag tag-approved">Approved</span>}
                  {isRejected && <span className="tag tag-rejected">Rejected</span>}
                </div>

                {/* Title */}
                <div style={{ fontSize: 16, fontWeight: 800 }}>{applicantName}</div>
                <div className="meta">
                  Stage: <b style={{ color: "#111" }}>
                    {app?.workflowStage || (isApproved ? "disbursement" : isRejected ? "rejected" : "—")}
                  </b>
                </div>

                {/* Dealer meta */}
                <div className="row2">
                  <div><span className="k">Dealer</span><div className="v">{getDealerField(app, "name")}</div></div>
                  <div><span className="k">Branch</span><div className="v">{getDealerField(app, "branch")}</div></div>
                  <div><span className="k">District</span><div className="v">{getDealerField(app, "district")}</div></div>
                </div>

                {/* Status meta */}
                {isApproved && (
                  <div className="meta" style={{ marginTop: 4 }}>
                    Approved At: <b style={{ color: "#065f46" }}>{approvedAt}</b>
                  </div>
                )}
                {isRejected && (
                  <>
                    <div className="meta" style={{ marginTop: 4 }}>
                      Rejected At: <b style={{ color: "#7f1d1d" }}>{rejectedAt}</b>
                    </div>
                    <div className="meta" style={{ marginTop: 2 }}>
                      Reason: <b style={{ color: "#b91c1c" }}>{app?.rejection?.reason || "—"}</b>
                    </div>
                  </>
                )}

                {/* Actions */}
                <div className="actions">
                  {isPending && (
                    <button
                      className="btn btn-primary"
                      onClick={() => navigate(`/application/${app._id}`)}
                    >
                      View
                    </button>
                  )}
                  {isApproved && (
                    <button
                      className="btn btn-primary"
                      onClick={() => navigate(`/approved/${app._id}`)}
                    >
                      View Details
                    </button>
                  )}
                  {isRejected && (
                    <button
                      className="btn btn-primary"
                      onClick={() => navigate(`/rejected/${app._id}`)}
                    >
                      View Details
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
