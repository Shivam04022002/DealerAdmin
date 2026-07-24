// src/pages/Dashboard.jsx — Enterprise Data-Table UI
import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import API from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { WORKFLOW_STAGES, stageLabel, stageColor, toStage } from "../utils/workflowConfig";
import logo from "../assets/logo-surjit.png";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from "@tanstack/react-table";

/* ─── Brand ─────────────────────────────────────────────── */
const BRAND = { blue: "#0B1F4D", orange: "#F59E0B", green: "#16A34A", red: "#EF4444", bg: "#F8FAFC" };

/* ─── Accessors ─────────────────────────────────────────── */
const getApplicantName = (app) => app?.applicant?.applicant?.name || app?.applicant?.name || "—";
const getDealerName    = (app) => app?.dealerDetails?.name || app?.dealer?.name || "—";
const getDealerBranch  = (app) => app?.dealerDetails?.branch || app?.dealerDetails?.Branch || app?.dealer?.branch || "—";
const getDealerDistrict= (app) => app?.dealerDetails?.district || app?.dealerDetails?.District || app?.dealer?.district || "—";
const getStage         = (app) => app?.workflowStage || "—";
const fmtDate = (v) => {
  if (!v) return "—";
  try { return new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return "—"; }
};

/* ─── Status Badge ──────────────────────────────────────── */
function StatusBadge({ status }) {
  const cfg = {
    pending:  { bg: "#FFF7ED", color: "#92400E", border: "#FDE3BF", label: "Pending"  },
    approved: { bg: "#ECFDF5", color: "#065F46", border: "#D1FAE5", label: "Approved" },
    rejected: { bg: "#FFF1F2", color: "#7F1D1D", border: "#FECACA", label: "Rejected" },
  };
  const c = cfg[status?.toLowerCase()] || cfg.pending;
  return (
    <span style={{
      display: "inline-block", padding: "3px 10px", borderRadius: 999,
      fontSize: 11, fontWeight: 800, letterSpacing: "0.3px",
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
    }}>{c.label}</span>
  );
}

/* ─── Stage Badge ───────────────────────────────────────── */
function StageBadge({ stage }) {
  const c = stageColor(stage);
  return (
    <span style={{
      display: "inline-block", padding: "2px 9px", borderRadius: 6,
      fontSize: 11, fontWeight: 700, background: c.bg, color: c.color,
      border: `1px solid ${c.border}`, textTransform: "capitalize", whiteSpace: "nowrap",
    }}>{stageLabel(stage) || "—"}</span>
  );
}

/* ─── Sort Icon ─────────────────────────────────────────── */
function SortIcon({ dir }) {
  if (!dir) return (
    <svg width="10" height="12" viewBox="0 0 10 12" fill="none" style={{ opacity: 0.35 }}>
      <path d="M5 1L2 4H8L5 1Z" fill="currentColor"/>
      <path d="M5 11L2 8H8L5 11Z" fill="currentColor"/>
    </svg>
  );
  return dir === "asc"
    ? <svg width="10" height="12" viewBox="0 0 10 12" fill="none"><path d="M5 1L2 5H8L5 1Z" fill={BRAND.blue}/><path d="M5 11L2 8H8L5 11Z" fill="currentColor" opacity="0.2"/></svg>
    : <svg width="10" height="12" viewBox="0 0 10 12" fill="none"><path d="M5 1L2 4H8L5 1Z" fill="currentColor" opacity="0.2"/><path d="M5 11L2 7H8L5 11Z" fill={BRAND.blue}/></svg>;
}

/* ─── Application Summary Drawer ────────────────────────── */
function AppSummaryDrawer({ app, tab, onClose, onViewFull }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);
  const handleClose = () => { setVisible(false); setTimeout(onClose, 280); };
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const applicantName = getApplicantName(app);
  const dealerName    = getDealerName(app);
  const branch        = getDealerBranch(app);
  const district      = getDealerDistrict(app);
  const stage         = getStage(app);
  const formId        = app?.formId || "—";
  const createdAt     = fmtDate(app?.createdAt);
  const updatedAt     = fmtDate(app?.updatedAt);

  const rows = [
    { label: "Form ID",         value: formId,        mono: true },
    { label: "Applicant Name",  value: applicantName  },
    { label: "Dealer",          value: dealerName     },
    { label: "Branch",          value: branch         },
    { label: "District",        value: district       },
    { label: "Current Stage",   value: <StageBadge stage={stage} /> },
    { label: "Status",          value: <StatusBadge status={tab} /> },
    { label: "Submission Date", value: createdAt      },
    { label: "Last Updated",    value: updatedAt      },
  ];

  return (
    <>
      <div
        onClick={handleClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)",
          zIndex: 8000, transition: "opacity 0.28s", opacity: visible ? 1 : 0,
          backdropFilter: "blur(2px)",
        }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0,
          width: "min(480px, 96vw)", background: "#fff",
          zIndex: 8001, display: "flex", flexDirection: "column",
          boxShadow: "-6px 0 32px rgba(0,0,0,0.16)",
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s cubic-bezier(0.16,1,0.3,1)",
          borderRadius: "20px 0 0 20px", overflow: "hidden",
          fontFamily: "Inter,ui-sans-serif,system-ui,-apple-system,sans-serif",
        }}
      >
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg,#0B1F4D 0%,#1d4ed8 60%,#3b82f6 100%)",
          padding: "18px 20px 16px", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,0.18)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, border: "1px solid rgba(255,255,255,0.25)",
              }}>📄</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>Application Summary</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Surjit Finance
                </div>
              </div>
            </div>
            <button
              onClick={handleClose}
              style={{
                width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(255,255,255,0.25)",
                background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: 14,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >✕</button>
          </div>
          <div style={{
            background: "rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 14px",
            border: "1px solid rgba(255,255,255,0.2)",
          }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Form ID</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", fontFamily: "monospace" }}>{formId}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.8)", marginTop: 4 }}>{applicantName}</div>
          </div>
        </div>

        {/* Info rows */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
            Application Details
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {rows.map(({ label, value, mono }) => (
              <div key={label} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 12px", borderRadius: 8,
                borderBottom: "1px solid #F1F5F9",
              }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", flexShrink: 0, marginRight: 12 }}>{label}</span>
                <span style={{
                  fontSize: 13, fontWeight: 700, color: "#111827", textAlign: "right",
                  fontFamily: mono ? "monospace" : undefined,
                }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
              Quick Actions
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                onClick={() => onViewFull(app)}
                style={{
                  padding: "11px 16px", borderRadius: 10, fontWeight: 700, fontSize: 14,
                  background: BRAND.blue, color: "#fff", border: "none", cursor: "pointer",
                  transition: "opacity 0.15s", textAlign: "left",
                  display: "flex", alignItems: "center", gap: 8,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.88"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                View Full Application
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const Dashboard = () => {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [pendingApps, setPendingApps]   = useState([]);
  const [approvedApps, setApprovedApps] = useState([]);
  const [rejectedApps, setRejectedApps] = useState([]);
  const [pendingTotal,  setPendingTotal]  = useState(0);
  const [approvedTotal, setApprovedTotal] = useState(0);
  const [rejectedTotal, setRejectedTotal] = useState(0);
  const [pendingPages,  setPendingPages]  = useState(1);
  const [approvedPages, setApprovedPages] = useState(1);
  const [rejectedPages, setRejectedPages] = useState(1);
  // per-tab server page
  const [pendingPage,   setPendingPage]   = useState(1);
  const [approvedPage,  setApprovedPage]  = useState(1);
  const [rejectedPage,  setRejectedPage]  = useState(1);
  const [pageLimit, setPageLimit] = useState(50);
  const [tab, setTab] = useState("pending");
  /* per-tab loading flags so the spinner only shows for the active tab */
  const [loadingPending,  setLoadingPending]  = useState(false);
  const [loadingApproved, setLoadingApproved] = useState(false);
  const [loadingRejected, setLoadingRejected] = useState(false);

  /* ── filter state ── */
  const [globalSearch, setGlobalSearch]     = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [filterStage,    setFilterStage]    = useState("");
  const [filterBranch,   setFilterBranch]   = useState("");
  const [filterDistrict, setFilterDistrict] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo,   setFilterDateTo]   = useState("");

  /* ── selection ── */
  const [rowSelection, setRowSelection] = useState({});

  /* ── drawer ── */
  const [drawerApp, setDrawerApp] = useState(null);

  /* ── account menu ── */
  const [open, setOpen] = useState(false);
  const btnRef  = useRef(null);
  const menuRef = useRef(null);
  const gridRef = useRef(null);

  /* ── export state ── */
  const [exporting, setExporting] = useState(false);

  /* ── bulk confirm ── */
  const [bulkConfirm, setBulkConfirm] = useState(null);

  /* debounce search */
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(globalSearch), 250);
    return () => clearTimeout(t);
  }, [globalSearch]);

  /* reset selection on tab change */
  useEffect(() => { setRowSelection({}); }, [tab]);

  /* helpers: current tab page state */
  const currentPage  = tab === "pending" ? pendingPage  : tab === "approved" ? approvedPage  : rejectedPage;
  const currentPages = tab === "pending" ? pendingPages : tab === "approved" ? approvedPages : rejectedPages;
  const currentTotal = tab === "pending" ? pendingTotal : tab === "approved" ? approvedTotal : rejectedTotal;
  const setCurrentPage = tab === "pending" ? setPendingPage : tab === "approved" ? setApprovedPage : setRejectedPage;

  const goToPage = (p) => {
    const clamped = Math.max(1, Math.min(p, currentPages));
    setCurrentPage(clamped);
  };

  /* ── Auth headers ── */
  const authHeaders = useCallback(() => {
    const token = localStorage.getItem("adminToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  /* ── Fetch a single tab (or all three on first load) ── */
  const fetchTab = useCallback(async (which, page, limit) => {
    if (!admin) return;
    const headers = authHeaders();
    const params  = { page, limit };

    const setLoading = which === "pending" ? setLoadingPending : which === "approved" ? setLoadingApproved : setLoadingRejected;
    const setApps    = which === "pending" ? setPendingApps    : which === "approved" ? setApprovedApps    : setRejectedApps;
    const setTotal   = which === "pending" ? setPendingTotal   : which === "approved" ? setApprovedTotal   : setRejectedTotal;
    const setPages   = which === "pending" ? setPendingPages   : which === "approved" ? setApprovedPages   : setRejectedPages;
    const endpoint   = which === "pending"
      ? "/workflow/pending"
      : which === "approved"
      ? "/workflow/applications/approved"
      : "/workflow/applications/rejected";

    setLoading(true);
    try {
      const { data } = await API.get(endpoint, { headers, params });
      setApps(Array.isArray(data) ? data : data?.items || []);
      if (data?.total != null) setTotal(data.total);
      if (data?.pages != null) setPages(data.pages);
    } catch (err) {
      console.error(`Failed to load ${which}`, err?.response?.data || err?.message);
      setApps([]);
    } finally {
      setLoading(false);
    }
  }, [admin, authHeaders]);

  /* ── Fetch all three in parallel on mount ── */
  const fetchAll = useCallback(async (limit = pageLimit) => {
    if (!admin) return;
    const headers = authHeaders();
    const params  = { page: 1, limit };
    setLoadingPending(true);
    setLoadingApproved(true);
    setLoadingRejected(true);

    const [pRes, aRes, rRes] = await Promise.allSettled([
      API.get("/workflow/pending",               { headers, params }),
      API.get("/workflow/applications/approved", { headers, params }),
      API.get("/workflow/applications/rejected", { headers, params }),
    ]);

    if (pRes.status === "fulfilled") {
      const d = pRes.value.data;
      setPendingApps(Array.isArray(d) ? d : d?.items || []);
      if (d?.total != null) setPendingTotal(d.total);
      if (d?.pages != null) setPendingPages(d.pages);
    } else {
      console.error("Failed to load pending",  pRes.reason?.response?.data || pRes.reason?.message);
      setPendingApps([]);
    }
    setLoadingPending(false);

    if (aRes.status === "fulfilled") {
      const d = aRes.value.data;
      setApprovedApps(Array.isArray(d) ? d : d?.items || []);
      if (d?.total != null) setApprovedTotal(d.total);
      if (d?.pages != null) setApprovedPages(d.pages);
    } else {
      console.error("Failed to load approved", aRes.reason?.response?.data || aRes.reason?.message);
      setApprovedApps([]);
    }
    setLoadingApproved(false);

    if (rRes.status === "fulfilled") {
      const d = rRes.value.data;
      setRejectedApps(Array.isArray(d) ? d : d?.items || []);
      if (d?.total != null) setRejectedTotal(d.total);
      if (d?.pages != null) setRejectedPages(d.pages);
    } else {
      console.error("Failed to load rejected", rRes.reason?.response?.data || rRes.reason?.message);
      setRejectedApps([]);
    }
    setLoadingRejected(false);
  }, [admin, authHeaders]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!admin) { navigate("/"); return; }
    fetchAll();
  }, [admin, navigate, fetchAll]);

  /* re-fetch active tab when its page changes */
  useEffect(() => { if (admin) fetchTab("pending",  pendingPage,  pageLimit); }, [pendingPage]);  // eslint-disable-line
  useEffect(() => { if (admin) fetchTab("approved", approvedPage, pageLimit); }, [approvedPage]); // eslint-disable-line
  useEffect(() => { if (admin) fetchTab("rejected",  rejectedPage,  pageLimit); }, [rejectedPage]);  // eslint-disable-line

  /* re-fetch all tabs when limit changes, reset pages */
  useEffect(() => {
    setPendingPage(1); setApprovedPage(1); setRejectedPage(1);
    fetchAll(pageLimit);
  }, [pageLimit]); // eslint-disable-line

  useEffect(() => {
    const stateFocus = location?.state?.focus;
    if (stateFocus) setTab(stateFocus);
    const handler = (e) => { if (e?.detail?.focus) setTab(e.detail.focus); };
    window.addEventListener("dashboard-focus", handler);
    return () => window.removeEventListener("dashboard-focus", handler);
  }, [location?.state]);

  /* close account menu on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (open && btnRef.current && !btnRef.current.contains(e.target) && menuRef.current && !menuRef.current.contains(e.target))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleLogout = () => {
    try { if (typeof logout === "function") logout(); } catch {}
    try { localStorage.removeItem("adminToken"); localStorage.removeItem("adminInfo"); } catch {}
    navigate("/");
  };

  /* ── Navigate to full application ── */
  const handleViewFull = useCallback((app) => {
    if (tab === "pending")  navigate(`/application/${app._id}`);
    else if (tab === "approved") navigate(`/approved/${app._id}`);
    else navigate(`/rejected/${app._id}`);
  }, [tab, navigate]);

  /* ── Raw data for current tab ── */
  const rawData = useMemo(() =>
    tab === "pending" ? pendingApps : tab === "approved" ? approvedApps : rejectedApps,
  [tab, pendingApps, approvedApps, rejectedApps]);

  /* ── Derived filter options ── */
  const branchOptions   = useMemo(() => [...new Set(rawData.map(getDealerBranch).filter((v) => v !== "—"))].sort(), [rawData]);
  const districtOptions = useMemo(() => [...new Set(rawData.map(getDealerDistrict).filter((v) => v !== "—"))].sort(), [rawData]);
  const stageOptions    = WORKFLOW_STAGES;

  /* ── Filtered data ── */
  const filteredData = useMemo(() => {
    let d = rawData;
    if (searchDebounced) {
      const q = searchDebounced.toLowerCase();
      d = d.filter((a) =>
        (a?.formId || "").toLowerCase().includes(q) ||
        getApplicantName(a).toLowerCase().includes(q) ||
        getDealerName(a).toLowerCase().includes(q)
      );
    }
    if (filterBranch)   d = d.filter((a) => getDealerBranch(a)   === filterBranch);
    if (filterDistrict) d = d.filter((a) => getDealerDistrict(a) === filterDistrict);
    if (filterStage)    d = d.filter((a) => toStage(getStage(a))  === toStage(filterStage));
    if (filterDateFrom) {
      const from = new Date(filterDateFrom); from.setHours(0,0,0,0);
      d = d.filter((a) => a?.createdAt && new Date(a.createdAt) >= from);
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo); to.setHours(23,59,59,999);
      d = d.filter((a) => a?.createdAt && new Date(a.createdAt) <= to);
    }
    return d;
  }, [rawData, searchDebounced, filterBranch, filterDistrict, filterStage, filterDateFrom, filterDateTo]);

  const hasActiveFilters = globalSearch || filterBranch || filterDistrict || filterStage || filterDateFrom || filterDateTo;

  const clearFilters = () => {
    setGlobalSearch(""); setFilterBranch(""); setFilterDistrict("");
    setFilterStage(""); setFilterDateFrom(""); setFilterDateTo("");
  };

  /* ── Selected rows helper ──
     Keyed by application id (see getRowId below) and resolved against the full
     dataset, so selections survive search/filter: a hidden selected row stays
     counted, stays in bulk/export, and reappears selected when shown again. */
  const selectedRows = useMemo(() => {
    const byId = new Map((rawData || []).map((a) => [a._id || a.formId, a]));
    return Object.keys(rowSelection)
      .filter((k) => rowSelection[k])
      .map((k) => byId.get(k))
      .filter(Boolean);
  }, [rowSelection, rawData]);

  /* ── Excel export ── */
  const handleExport = useCallback(async () => {
    const rows = selectedRows.length > 0 ? selectedRows : filteredData;
    if (!rows.length) { alert("No data to export."); return; }
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const ws = XLSX.utils.json_to_sheet(rows.map((a) => ({
        "Form ID":       a?.formId || "—",
        "Customer Name": getApplicantName(a),
        "Dealer":        getDealerName(a),
        "Branch":        getDealerBranch(a),
        "District":      getDealerDistrict(a),
        "Stage":         getStage(a),
        "Status":        tab,
        "Created Date":  fmtDate(a?.createdAt),
        // rejected -> rejection.rejectedAt (updatedAt is unreliable for historical
        // rejected records); approved/pending -> updatedAt.
        "Last Updated":  fmtDate(tab === "rejected" ? (a?.rejection?.rejectedAt || a?.updatedAt) : a?.updatedAt),
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, tab.charAt(0).toUpperCase() + tab.slice(1));
      XLSX.writeFile(wb, `applications_${tab}_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (err) {
      alert("Export failed: " + err.message);
    } finally { setExporting(false); }
  }, [selectedRows, filteredData, tab]);

  /* ── Column definitions ── */
  const columns = useMemo(() => [
    {
      id: "select",
      header: ({ table }) => (
        <input type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
          style={{ width: 15, height: 15, accentColor: BRAND.blue, cursor: "pointer" }}
          title="Select all on this page"
        />
      ),
      cell: ({ row }) => (
        <input type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          style={{ width: 15, height: 15, accentColor: BRAND.blue, cursor: "pointer" }}
        />
      ),
      enableSorting: false, size: 42,
    },
    {
      accessorKey: "formId",
      header: "Form ID",
      cell: (info) => (
        <span style={{ fontWeight: 700, color: BRAND.blue, fontSize: 12, fontFamily: "monospace" }}>
          {info.getValue() || "—"}
        </span>
      ),
      size: 130,
    },
    {
      id: "applicantName", header: "Customer Name",
      accessorFn: getApplicantName, size: 160,
      cell: (info) => <span style={{ fontWeight: 600 }}>{info.getValue()}</span>,
    },
    { id: "dealerName",  header: "Dealer",    accessorFn: getDealerName,    size: 160 },
    { id: "branch",      header: "Branch",    accessorFn: getDealerBranch,  size: 120 },
    { id: "district",    header: "District",  accessorFn: getDealerDistrict,size: 120 },
    {
      id: "stage", header: "Stage", accessorFn: getStage, size: 170,
      cell: (info) => <StageBadge stage={info.getValue()} />,
    },
    {
      id: "status", header: "Status", enableSorting: false, size: 100,
      cell: () => <StatusBadge status={tab} />,
    },
    {
      id: "createdAt", header: "Created Date",
      accessorFn: (row) => row?.createdAt || "",
      sortingFn: "datetime", size: 120,
      cell: (info) => <span style={{ fontSize: 12, color: "#6B7280" }}>{fmtDate(info.getValue())}</span>,
    },
    {
      id: "updatedAt", header: "Last Updated",
      accessorFn: (row) => row?.updatedAt || "",
      sortingFn: "datetime", size: 120,
      cell: (info) => <span style={{ fontSize: 12, color: "#6B7280" }}>{fmtDate(info.getValue())}</span>,
    },
    {
      id: "actions", header: "Actions", enableSorting: false, size: 80,
      cell: ({ row }) => (
        <button
          onClick={() => setDrawerApp(row.original)}
          style={{
            padding: "5px 12px", borderRadius: 7, fontSize: 12, fontWeight: 700,
            background: "linear-gradient(180deg,rgba(37,99,235,0.09),rgba(37,99,235,0.04))",
            border: "1px solid rgba(37,99,235,0.2)", color: BRAND.blue, cursor: "pointer",
            whiteSpace: "nowrap", transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(37,99,235,0.12)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "linear-gradient(180deg,rgba(37,99,235,0.09),rgba(37,99,235,0.04))"; e.currentTarget.style.transform = "none"; }}
        >
          View
        </button>
      ),
    },
  ], [tab]);

  /* ── Table instance ── */
  const table = useReactTable({
    data: filteredData,
    columns,
    // Track selection by the application's stable id, not the row index —
    // otherwise a search/sort that reorders rows moves the checkbox onto a
    // different application.
    getRowId: (row) => row._id || row.formId,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
    enableRowSelection: true,
  });

  const pageRows      = table.getRowModel().rows;
  const totalCount    = pendingTotal + approvedTotal + rejectedTotal;
  const totalFiltered = currentTotal;
  const rowFrom       = filteredData.length === 0 ? 0 : (currentPage - 1) * pageLimit + 1;
  const rowTo         = Math.min(currentPage * pageLimit, currentTotal);

  /* derived loading for current tab */
  const loading = tab === "pending" ? loadingPending : tab === "approved" ? loadingApproved : loadingRejected;

  /* ═══════════════════════ RENDER ═══════════════════════ */
  return (
    <div style={{
      minHeight: "100vh", background: "linear-gradient(135deg,#eef2ff 0%,#f8fafc 40%,#ffffff 100%)",
      padding: 20, fontFamily: "Inter,ui-sans-serif,system-ui,-apple-system,sans-serif",
      boxSizing: "border-box",
    }}>
      <style>{`
        @keyframes dash-spin { to { transform: rotate(360deg); } }
        @keyframes dt-shimmer {
          0%   { background-position: -600px 0; }
          100% { background-position:  600px 0; }
        }
        .dt-skeleton {
          background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
          background-size: 600px 100%;
          animation: dt-shimmer 1.4s infinite linear;
          border-radius: 5px;
        }
        @keyframes dt-progress {
          0%   { width: 0%;   opacity: 1; }
          80%  { width: 90%;  opacity: 1; }
          100% { width: 100%; opacity: 0; }
        }
        .dt-progress-bar {
          position: absolute; top: 0; left: 0; height: 3px;
          background: linear-gradient(90deg, #0B1F4D, #3b82f6);
          animation: dt-progress 1.2s ease-out forwards;
          border-radius: 0 2px 2px 0;
        }
        .dt-th-sort { cursor: pointer; user-select: none; }
        .dt-th-sort:hover { background: rgba(11,31,77,0.04) !important; }
        .dt-row:hover td { background: rgba(241,245,249,0.8) !important; }
        .dt-row td { transition: background 0.1s; }
        .dt-input {
          border: 1.5px solid #E5E7EB; border-radius: 10px; padding: 8px 12px;
          font-size: 13px; font-weight: 500; background: #fff; outline: none;
          transition: border-color 0.15s, box-shadow 0.15s; color: #111827;
          font-family: inherit;
        }
        .dt-input:focus { border-color: #0B1F4D; box-shadow: 0 0 0 3px rgba(11,31,77,0.08); }
        .dt-select {
          border: 1.5px solid #E5E7EB; border-radius: 10px; padding: 7px 10px;
          font-size: 13px; font-weight: 500; background: #fff; outline: none;
          cursor: pointer; color: #374151; transition: border-color 0.15s; font-family: inherit;
        }
        .dt-select:focus { border-color: #0B1F4D; }
        .dt-btn {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 7px 14px; border-radius: 9px; font-size: 13px; font-weight: 700;
          cursor: pointer; border: 1.5px solid transparent;
          transition: opacity 0.15s, transform 0.15s; white-space: nowrap; font-family: inherit;
        }
        .dt-btn:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
        .dt-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .dt-btn-primary { background: #0B1F4D; color: #fff; border-color: #0B1F4D; }
        .dt-btn-ghost   { background: #fff; color: #374151; border-color: #E5E7EB; }
        .dt-btn-ghost:hover:not(:disabled) { background: #F8FAFC; }
        .dt-btn-green   { background: #ECFDF5; color: #065F46; border-color: #D1FAE5; }
        .dt-btn-red     { background: #FFF1F2; color: #7F1D1D; border-color: #FECACA; }
        .dt-btn-blue    { background: #EFF6FF; color: #1D4ED8; border-color: #BFDBFE; }
        .dt-tab {
          padding: 8px 18px; border-radius: 10px; font-weight: 700; font-size: 13px;
          border: 1.5px solid transparent; cursor: pointer; transition: all 0.15s;
          font-family: inherit;
        }
        .dt-tab.t-pending  { background: #FFFBEB; color: #92400E; border-color: #FDE68A; }
        .dt-tab.t-approved { background: #ECFDF5; color: #065F46; border-color: #D1FAE5; }
        .dt-tab.t-rejected { background: #FFF1F2; color: #7F1D1D; border-color: #FECACA; }
        .dt-tab.t-inactive { background: #F8FAFC; color: #6B7280; border-color: #E5E7EB; }
        .dt-tab.t-inactive:hover { background: #F1F5F9; color: #374151; }
        .dt-pgbtn {
          width: 30px; height: 30px; border-radius: 7px; border: 1.5px solid #E5E7EB;
          background: #fff; cursor: pointer; font-weight: 700; font-size: 12px;
          display: inline-flex; align-items: center; justify-content: center;
          transition: all 0.15s; color: #374151;
        }
        .dt-pgbtn:hover:not(:disabled) { background: #0B1F4D; color: #fff; border-color: #0B1F4D; }
        .dt-pgbtn:disabled { opacity: 0.4; cursor: not-allowed; }
        .dt-pgbtn.active   { background: #0B1F4D; color: #fff; border-color: #0B1F4D; }
      `}</style>

      {/* ══ Top Bar ══ */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "12px 18px", border: "1px solid #E5E7EB", borderRadius: 14,
        background: "#fff", boxShadow: "0 2px 10px rgba(11,31,77,0.06)", marginBottom: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <img src={logo} alt="Surjit Finance" style={{ height: 38 }} />
          <div style={{ height: 28, width: 1, background: "#E5E7EB" }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0B1F4D" }}>Applications</div>
            <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 500 }}>
              {totalCount.toLocaleString()} total applications
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* KPI badges */}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {[
              { label: "Pending",  val: pendingTotal,  bg: "#FFFBEB", color: "#92400E", border: "#FDE68A" },
              { label: "Approved", val: approvedTotal, bg: "#ECFDF5", color: "#065F46", border: "#D1FAE5" },
              { label: "Rejected", val: rejectedTotal, bg: "#FFF1F2", color: "#7F1D1D", border: "#FECACA" },
            ].map(({ label, val, bg, color, border }) => (
              <div key={label} style={{
                background: bg, border: `1px solid ${border}`, borderRadius: 8,
                padding: "4px 10px", textAlign: "center",
              }}>
                <div style={{ fontSize: 16, fontWeight: 900, color, lineHeight: 1 }}>{val}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color, opacity: 0.8 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Account */}
          <div style={{ position: "relative" }}>
            <button
              ref={btnRef}
              onClick={() => setOpen((v) => !v)}
              style={{
                border: "1px solid #E5E7EB", background: "#fff", padding: "8px 10px",
                borderRadius: 10, cursor: "pointer", display: "inline-flex",
                alignItems: "center", justifyContent: "center",
              }}
              title="Account"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 12a5 5 0 100-10 5 5 0 000 10zM21 22a9 9 0 10-18 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </button>
            {open && (
              <div ref={menuRef} style={{
                position: "absolute", right: 0, marginTop: 8, minWidth: 200,
                background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10,
                boxShadow: "0 10px 30px rgba(11,31,77,0.1)", padding: 12, zIndex: 9999,
              }}>
                <div style={{ fontWeight: 800, color: "#0B1F4D", marginBottom: 3 }}>{admin?.name || "Admin"}</div>
                {admin?.email && <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 10 }}>{admin.email}</div>}
                <button style={{
                  width: "100%", padding: "8px 10px", borderRadius: 8, border: "none",
                  background: "#EF4444", color: "#fff", fontWeight: 700, cursor: "pointer",
                }} onClick={handleLogout}>Logout</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══ Table Card ══ */}
      <div style={{
        background: "#fff", borderRadius: 16, border: "1px solid #E5E7EB",
        boxShadow: "0 2px 12px rgba(11,31,77,0.06)", overflow: "hidden",
        position: "relative",
      }}>
        {/* thin progress bar when refreshing existing data */}
        {loading && filteredData.length > 0 && (
          <div className="dt-progress-bar" key={`${tab}-${Date.now()}`} />
        )}

        {/* ── Toolbar ── */}
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #F1F5F9" }}>

          {/* Tabs + Export row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {[
                { key: "pending",  label: `Pending`,  count: pendingTotal  },
                { key: "approved", label: `Approved`, count: approvedTotal },
                { key: "rejected", label: `Rejected`, count: rejectedTotal },
              ].map(({ key, label, count }) => (
                <button
                  key={key}
                  className={`dt-tab ${tab === key ? `t-${key}` : "t-inactive"}`}
                  onClick={() => setTab(key)}
                >
                  {label}
                  <span style={{
                    marginLeft: 7, padding: "1px 7px", borderRadius: 999, fontSize: 11,
                    fontWeight: 800, background: "rgba(0,0,0,0.08)",
                  }}>{count}</span>
                </button>
              ))}
              <div style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 500, marginLeft: 4 }}>
                {totalCount.toLocaleString()} total
              </div>
            </div>

          </div>

          {/* Search */}
          <div style={{ marginBottom: 12, position: "relative" }}>
            <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", pointerEvents: "none" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </span>
            <input
              className="dt-input"
              style={{ width: "100%", paddingLeft: 34, boxSizing: "border-box" }}
              placeholder="Search by Form ID, Customer Name, Dealer Name…"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
            />
          </div>

          {/* Filters row */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select className="dt-select" value={filterStage} onChange={(e) => setFilterStage(e.target.value)}>
              <option value="">All Stages</option>
              {stageOptions.map((s) => <option key={s} value={toStage(s)}>{stageLabel(s)}</option>)}
            </select>
            <select className="dt-select" value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}>
              <option value="">All Branches</option>
              {branchOptions.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <select className="dt-select" value={filterDistrict} onChange={(e) => setFilterDistrict(e.target.value)}>
              <option value="">All Districts</option>
              {districtOptions.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="date" className="dt-input" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} title="From Date" style={{ width: 138 }} />
              <span style={{ fontSize: 12, color: "#9CA3AF" }}>—</span>
              <input type="date" className="dt-input" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} title="To Date" style={{ width: 138 }} />
            </div>
            {hasActiveFilters && (
              <button className="dt-btn dt-btn-ghost" onClick={clearFilters} style={{ padding: "7px 12px" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* ── Bulk action bar ── */}
        {selectedRows.length > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10, padding: "10px 18px",
            background: "#EFF6FF", borderBottom: "1px solid #BFDBFE",
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: BRAND.blue }}>
              {selectedRows.length} row{selectedRows.length !== 1 ? "s" : ""} selected
            </span>
            {tab === "pending" && (
              <>
                <button className="dt-btn dt-btn-green" onClick={() => setBulkConfirm("approve")}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  Approve Selected
                </button>
                <button className="dt-btn dt-btn-red" onClick={() => setBulkConfirm("reject")}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  Reject Selected
                </button>
              </>
            )}
            <button className="dt-btn dt-btn-blue" onClick={handleExport} disabled={exporting}>
              Export Selected
            </button>
            <button className="dt-btn dt-btn-ghost" style={{ marginLeft: "auto" }} onClick={() => setRowSelection({})}>
              Deselect All
            </button>
          </div>
        )}

        {/* ── Info bar: count + page size ── */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "8px 18px", background: "#FAFBFC", borderBottom: "1px solid #F1F5F9",
        }}>
          <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 500 }}>
            Showing{" "}
            <b style={{ color: "#111827" }}>{rowFrom}–{rowTo}</b>{" "}
            of <b style={{ color: "#111827" }}>{currentTotal.toLocaleString()}</b> records
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "#6B7280" }}>Rows per page:</span>
            <select
              className="dt-select"
              style={{ padding: "4px 8px", fontSize: 12 }}
              value={pageLimit}
              onChange={(e) => setPageLimit(Number(e.target.value))}
            >
              {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        {/* ── Table ── */}
        {loading && filteredData.length === 0 ? (
          /* First-load skeleton — 10 placeholder rows */
          <div style={{ padding: "0 0 8px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                <tr style={{ background: "#FAFBFC", borderBottom: "2px solid #E5E7EB" }}>
                  {[42,130,160,160,120,120,170,100,120,120,80].map((w, i) => (
                    <th key={i} style={{ padding: "10px 13px", width: w, borderRight: "1px solid #F1F5F9" }}>
                      <div className="dt-skeleton" style={{ height: 10, width: "60%" }} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 10 }).map((_, ri) => (
                  <tr key={ri}>
                    {[42,130,160,160,120,120,170,100,120,120,80].map((w, ci) => (
                      <td key={ci} style={{ padding: "13px 13px", borderBottom: "1px solid #F1F5F9", width: w }}>
                        <div className="dt-skeleton" style={{ height: 12, width: ci === 0 ? 16 : `${55 + (ci * 7) % 40}%` }} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }} ref={gridRef}>
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} style={{ background: "#FAFBFC", borderBottom: "2px solid #E5E7EB" }}>
                    {hg.headers.map((header) => {
                      const canSort = header.column.getCanSort();
                      const sortDir = header.column.getIsSorted();
                      return (
                        <th
                          key={header.id}
                          className={canSort ? "dt-th-sort" : ""}
                          onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                          style={{
                            padding: "10px 13px", textAlign: "left",
                            fontSize: 11, fontWeight: 800, color: "#374151",
                            textTransform: "uppercase", letterSpacing: "0.6px",
                            width: header.getSize(), whiteSpace: "nowrap",
                            background: sortDir ? "rgba(11,31,77,0.03)" : undefined,
                            borderRight: "1px solid #F1F5F9",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {canSort && <SortIcon dir={sortDir || null} />}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} style={{
                      textAlign: "center", padding: "60px 20px",
                      color: "#9CA3AF", fontWeight: 600, fontSize: 14,
                    }}>
                      {hasActiveFilters ? "No records match the current filters." : `No ${tab} applications found.`}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row) => (
                    <tr key={row.id} className="dt-row">
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          style={{
                            padding: "10px 13px", fontSize: 13, color: "#111827",
                            borderBottom: "1px solid #F1F5F9", borderRight: "1px solid #FAFAFA",
                            width: cell.column.getSize(),
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Server-side Pagination ── */}
        {!loading && currentPages > 1 && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 18px", borderTop: "1px solid #F1F5F9", flexWrap: "wrap", gap: 10,
          }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button className="dt-pgbtn" onClick={() => goToPage(1)} disabled={currentPage <= 1} title="First">«</button>
              <button className="dt-pgbtn" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}>‹</button>
              {(() => {
                const total = currentPages;
                const current = currentPage;
                const range = [];
                if (total <= 7) { for (let i = 1; i <= total; i++) range.push(i); }
                else {
                  range.push(1);
                  if (current > 3) range.push("...");
                  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) range.push(i);
                  if (current < total - 2) range.push("...");
                  range.push(total);
                }
                return range.map((p, i) => p === "..."
                  ? <span key={`d${i}`} style={{ padding: "0 4px", color: "#9CA3AF", fontSize: 13 }}>…</span>
                  : <button key={p} className={`dt-pgbtn${p === current ? " active" : ""}`} onClick={() => goToPage(p)}>{p}</button>
                );
              })()}
              <button className="dt-pgbtn" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= currentPages}>›</button>
              <button className="dt-pgbtn" onClick={() => goToPage(currentPages)} disabled={currentPage >= currentPages} title="Last">»</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "#6B7280" }}>Go to:</span>
              <select
                className="dt-select"
                style={{ padding: "4px 8px", fontSize: 12 }}
                value={currentPage}
                onChange={(e) => goToPage(Number(e.target.value))}
              >
                {Array.from({ length: currentPages }, (_, i) => (
                  <option key={i + 1} value={i + 1}>Page {i + 1}</option>
                ))}
              </select>
              <span style={{ fontSize: 12, color: "#6B7280" }}>of {currentPages}</span>
            </div>
          </div>
        )}
      </div>

      {/* ══ Summary Drawer ══ */}
      {drawerApp && (
        <AppSummaryDrawer
          app={drawerApp}
          tab={tab}
          onClose={() => setDrawerApp(null)}
          onViewFull={handleViewFull}
        />
      )}

      {/* ══ Bulk Confirm Modal ══ */}
      {bulkConfirm && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999 }}
          onClick={(e) => e.target === e.currentTarget && setBulkConfirm(null)}
        >
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, minWidth: 340, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: "#111827", marginBottom: 8 }}>
              Bulk {bulkConfirm === "approve" ? "Approve" : "Reject"}
            </div>
            <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 20 }}>
              Are you sure you want to <b style={{ color: bulkConfirm === "approve" ? BRAND.green : BRAND.red }}>{bulkConfirm}</b>{" "}
              {selectedRows.length} selected application{selectedRows.length !== 1 ? "s" : ""}?
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="dt-btn dt-btn-ghost" onClick={() => setBulkConfirm(null)}>Cancel</button>
              <button
                className={`dt-btn ${bulkConfirm === "approve" ? "dt-btn-green" : "dt-btn-red"}`}
                style={{ fontWeight: 800 }}
                onClick={() => {
                  alert(`Bulk ${bulkConfirm} for ${selectedRows.length} records — wire up to your API.`);
                  setBulkConfirm(null);
                  setRowSelection({});
                }}
              >
                Confirm {bulkConfirm === "approve" ? "Approve" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
