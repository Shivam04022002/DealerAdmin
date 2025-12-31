// src/components/Navbar.jsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import logo from "../assets/logo-surjit.png";

export default function Navbar() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const btnRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const onClick = (e) => {
      if (!menuRef.current || !btnRef.current) return;
      if (!menuRef.current.contains(e.target) && !btnRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleLogout = () => {
    setOpen(false);
    logout();
    navigate("/");
  };

  // Helper: trigger dashboard focus for specific block
  const goToDashboardFocus = (focusKey) => {
    window.dispatchEvent(new CustomEvent("dashboard-focus", { detail: { focus: focusKey } }));
    navigate("/dashboard", { state: { focus: focusKey } });
  };

  return (
    <header style={styles.wrap}>
      <div style={styles.left}>
        <Link
          to="/dashboard"
          style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none" }}
        >
          <img src={logo} alt="Surjit Finance" style={styles.logo} />
        </Link>
      </div>

      {/* Dashboard-like segmented nav */}
      <nav style={styles.nav}>
        <button onClick={() => navigate("/dashboard")} style={styles.linkBtn}>
          Pending
        </button>
        <button onClick={() => goToDashboardFocus("approved")} style={styles.linkBtn}>
          Approved
        </button>
        <button onClick={() => goToDashboardFocus("rejected")} style={styles.linkBtn}>
          Rejected
        </button>
      </nav>

      {/* User dropdown menu */}
      <div style={styles.right}>
        <button
          ref={btnRef}
          onClick={() => setOpen((v) => !v)}
          style={styles.userBtn}
          aria-haspopup="menu"
          aria-expanded={open ? "true" : "false"}
          title="Account"
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 12a5 5 0 100-10 5 5 0 000 10zM21 22a9 9 0 10-18 0"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {open && (
          <div ref={menuRef} style={styles.menu} role="menu">
            <div style={styles.menuHeader}>
              <div style={styles.userCircle}>
                {String(admin?.name || "U").charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={styles.name}>{admin?.name || "Admin"}</div>
                <div style={styles.email}>{admin?.email || ""}</div>
              </div>
            </div>
            <div style={styles.menuSep} />
            <button style={styles.menuItem} onClick={handleLogout} role="menuitem">
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

/* ---- Inline styles matching Dashboard ---- */
const styles = {
  wrap: {
    position: "sticky",
    top: 0,
    zIndex: 50,
    display: "grid",
    gridTemplateColumns: "auto 1fr auto",
    alignItems: "center",
    gap: 12,
    padding: "10px 16px",
    background: "#ffffff",
    borderBottom: "1px solid #eee",
    boxShadow: "0 4px 16px rgba(0,0,0,.04)",
  },
  left: { display: "flex", alignItems: "center", gap: 10 },
  logo: { height: 34, width: "auto", display: "block" },

  /* Segmented navigation look like dashboard */
  nav: {
    display: "inline-flex",
    gap: 8,
    justifyContent: "center",
    alignItems: "center",
    padding: 5,
    background: "#f1f5f9",
    borderRadius: 999,
  },
  linkBtn: {
    color: "#6b7280",
    textDecoration: "none",
    fontWeight: 700,
    padding: "8px 14px",
    borderRadius: 999,
    background: "transparent",
    border: "none",
    cursor: "pointer",
  },
  right: { position: "relative", display: "flex", alignItems: "center" },
  userBtn: {
    border: "1px solid #e5e7eb",
    background: "#f8fafc",
    color: "#0f172a",
    padding: "8px 10px",
    borderRadius: 10,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  menu: {
    position: "absolute",
    top: "110%",
    right: 0,
    width: 240,
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    boxShadow: "0 14px 36px rgba(0,0,0,.08)",
    padding: 10,
  },
  menuHeader: { display: "flex", alignItems: "center", gap: 10, padding: "6px 4px" },
  userCircle: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "#eef2ff",
    color: "#3730a3",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
  },
  name: { fontWeight: 800, color: "#0f172a", lineHeight: 1.1 },
  email: { fontSize: 12, color: "#64748b" },
  menuSep: { height: 1, background: "#f1f5f9", margin: "8px 0" },
  menuItem: {
    width: "100%",
    textAlign: "left",
    padding: "8px 10px",
    borderRadius: 8,
    border: 0,
    background: "#fff",
    fontWeight: 700,
    color: "#b91c1c",
    cursor: "pointer",
  },
};
