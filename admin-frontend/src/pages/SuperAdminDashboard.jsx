// src/pages/SuperAdminDashboard.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import API from "../services/api"; // baseURL already set in your project
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo-surjit.png";
import * as XLSX from 'xlsx';
import FilesManagementTable from "../components/FilesManagementTable";
import { WORKFLOW_STAGES, stageLabel, toStage } from "../utils/workflowConfig";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, Customized,
} from "recharts";
import { exportApplicationsToExcel, exportAllToExcel } from "../utils/exportApplications";
import FormTrackingAudit from "../components/FormTrackingAudit";
import DealerManagementTable from "../components/DealerManagementTable";
// ─────────────────────────────────────────────
// Modern Stats Dashboard Component
// ─────────────────────────────────────────────
const BRAND = {
  blue: "#0B1F4D",
  orange: "#F59E0B",
  green: "#16A34A",
  red: "#EF4444",
  bg: "#F8FAFC",
};

const PIE_COLORS = [BRAND.orange, BRAND.green, BRAND.red];

// Built-in branch list. Branches created via "+ Add Branch" are loaded from the
// API and appended to these.
const DEFAULT_BRANCHES = [
  "Gonda", "Balrampur", "Ayodhya", "Etawah", "Mainpuri", "Gopiganj",
  "Machhali Shahar", "Gorakhpur", "Pilibhit", "Bareilly", "Kushinagar",
  "Jaipur", "Sultanpur", "Auraiya", "Pratapgarh", "Azamgarh", "Kanpur",
  "Agra/Mathura", "Lucknow (Hussainganj)", "Barabanki (Matiyari)", "Unnao",
  "Deoria", "Varanasi (Tarna)", "Indore", "Aligarh", "Sitapur",
  "Raebareilly", "Prayagraj", "Shahjahanpur", "Firozabad", "Lakhimpur",
];

// Sentinel value for the "+ Add Branch" option in the branch dropdown
const ADD_BRANCH_OPTION = "__add_branch__";

const iconClock = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);
const iconCheck = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);
const iconX = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);
const iconFile = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
  </svg>
);
const iconRefresh = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);
const iconDownload = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const CustomBarLabel = ({ x, y, width, value }) => {
  if (!value) return null;
  return (
    <text x={x + width / 2} y={y - 6} fill="#374151" fontSize={13} fontWeight={700} textAnchor="middle">
      {value}
    </text>
  );
};

const DonutCenterLabel = ({ formattedGraphicalItems, total }) => {
  const pie = formattedGraphicalItems?.[0];
  if (!pie) return null;
  const cx = pie.props.cx;
  const cy = pie.props.cy;
  return (
    <g>
      <text x={cx} y={cy - 8} textAnchor="middle" fill={BRAND.blue} fontSize={28} fontWeight={900}>{total}</text>
      <text x={cx} y={cy + 16} textAnchor="middle" fill="#6B7280" fontSize={12} fontWeight={600}>Total</text>
    </g>
  );
};

// ── Date utility helpers ────────────────────────────────────────────────────
const startOfDay = (d) => { const r = new Date(d); r.setHours(0,0,0,0); return r; };
const endOfDay   = (d) => { const r = new Date(d); r.setHours(23,59,59,999); return r; };
const todayStart = () => startOfDay(new Date());
const todayEnd   = () => endOfDay(new Date());

const QUICK_FILTERS = [
  { key: "today",      label: "Today" },
  { key: "yesterday",  label: "Yesterday" },
  { key: "last7",      label: "Last 7 Days" },
  { key: "last30",     label: "Last 30 Days" },
  { key: "thisMonth",  label: "This Month" },
  { key: "lastMonth",  label: "Last Month" },
  { key: "custom",     label: "Custom Range" },
  { key: "all",        label: "All Time" },
];

const getFilterRange = (key) => {
  const now = new Date();
  switch (key) {
    case "today":
      return { from: todayStart(), to: todayEnd() };
    case "yesterday": {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case "last7": {
      const d = new Date(now); d.setDate(d.getDate() - 6);
      return { from: startOfDay(d), to: todayEnd() };
    }
    case "last30": {
      const d = new Date(now); d.setDate(d.getDate() - 29);
      return { from: startOfDay(d), to: todayEnd() };
    }
    case "thisMonth": {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: startOfDay(d), to: todayEnd() };
    }
    case "lastMonth": {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last  = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: startOfDay(first), to: endOfDay(last) };
    }
    case "all":
    default:
      return { from: null, to: null };
  }
};

const fmtRangeLabel = (from, to) => {
  if (!from && !to) return "All Time";
  const opts = { day: "2-digit", month: "short", year: "numeric" };
  const f = from ? new Date(from).toLocaleDateString("en-IN", opts) : "—";
  const t = to   ? new Date(to).toLocaleDateString("en-IN", opts)   : "—";
  if (f === t) return f;
  return `${f} – ${t}`;
};

const applyDateFilter = (apps, from, to) => {
  if (!from && !to) return apps;
  return apps.filter((app) => {
    const d = app?.createdAt ? new Date(app.createdAt) : null;
    if (!d) return false;
    if (from && d < from) return false;
    if (to   && d > to)   return false;
    return true;
  });
};

// ── StatsDashboard ──────────────────────────────────────────────────────────
const StatsDashboard = ({ fetchStats, fetchAllFiles, setTab, setFilesTab }) => {
  // Raw full data fetched once
  const [rawData, setRawData] = React.useState({ pending: [], approved: [], rejected: [], loaded: false });
  const [loadingData, setLoadingData] = React.useState(false);

  // Active quick-filter key
  const [filterKey, setFilterKey] = React.useState("all");
  // Custom date inputs (string yyyy-mm-dd)
  const [customFrom, setCustomFrom] = React.useState("");
  const [customTo,   setCustomTo]   = React.useState("");
  // Resolved range dates (Date objects or null)
  const [rangeFrom, setRangeFrom] = React.useState(null);
  const [rangeTo,   setRangeTo]   = React.useState(null);

  const [exporting, setExporting] = React.useState({ pending: false, approved: false, rejected: false, all: false });

  // ── Fetch all data once ──────────────────────────────────────────────────
  const fetchAllData = React.useCallback(async () => {
    setLoadingData(true);
    try {
      const token = localStorage.getItem("adminToken");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const [p, a, r] = await Promise.all([
        API.get("/superadmin/files/pending",  { headers }),
        API.get("/superadmin/files/approved", { headers }),
        API.get("/superadmin/files/rejected", { headers }),
      ]);
      setRawData({
        pending:  Array.isArray(p.data) ? p.data : [],
        approved: Array.isArray(a.data) ? a.data : [],
        rejected: Array.isArray(r.data) ? r.data : [],
        loaded: true,
      });
    } catch (err) {
      console.error("Failed to load stats data", err?.response?.data || err.message);
      setRawData({ pending: [], approved: [], rejected: [], loaded: true });
    } finally {
      setLoadingData(false);
    }
  }, []);

  React.useEffect(() => { fetchAllData(); }, [fetchAllData]);

  // ── Apply quick filter ───────────────────────────────────────────────────
  const applyQuickFilter = (key) => {
    setFilterKey(key);
    if (key !== "custom") {
      const { from, to } = getFilterRange(key);
      setRangeFrom(from);
      setRangeTo(to);
    }
  };

  // ── Apply custom range ───────────────────────────────────────────────────
  const applyCustomRange = () => {
    if (!customFrom && !customTo) return;
    setRangeFrom(customFrom ? startOfDay(new Date(customFrom)) : null);
    setRangeTo(customTo   ? endOfDay(new Date(customTo))   : null);
  };

  // ── Filtered data ────────────────────────────────────────────────────────
  const filteredPending  = React.useMemo(() => applyDateFilter(rawData.pending,  rangeFrom, rangeTo), [rawData.pending,  rangeFrom, rangeTo]);
  const filteredApproved = React.useMemo(() => applyDateFilter(rawData.approved, rangeFrom, rangeTo), [rawData.approved, rangeFrom, rangeTo]);
  const filteredRejected = React.useMemo(() => applyDateFilter(rawData.rejected, rangeFrom, rangeTo), [rawData.rejected, rangeFrom, rangeTo]);

  const pending  = filteredPending.length;
  const approved = filteredApproved.length;
  const rejected = filteredRejected.length;
  const total    = pending + approved + rejected;

  const barData = [
    { name: "Pending",  value: pending,  fill: BRAND.orange },
    { name: "Approved", value: approved, fill: BRAND.green  },
    { name: "Rejected", value: rejected, fill: BRAND.red    },
  ];
  const pieData = barData.filter((d) => d.value > 0);

  const rangeLabel = fmtRangeLabel(rangeFrom, rangeTo);

  // ── Export handlers ──────────────────────────────────────────────────────
  const handleExport = (status) => {
    setExporting((prev) => ({ ...prev, [status]: true }));
    try {
      const map = { pending: filteredPending, approved: filteredApproved, rejected: filteredRejected };
      exportApplicationsToExcel(map[status], status, rangeFrom, rangeTo);
    } catch (err) {
      alert("Export failed: " + err.message);
    } finally {
      setExporting((prev) => ({ ...prev, [status]: false }));
    }
  };

  const handleExportAll = () => {
    setExporting((prev) => ({ ...prev, all: true }));
    try {
      exportAllToExcel(filteredPending, filteredApproved, filteredRejected, rangeFrom, rangeTo);
    } catch (err) {
      alert("Export failed: " + err.message);
    } finally {
      setExporting((prev) => ({ ...prev, all: false }));
    }
  };

  const kpiCards = [
    { label: "Pending Applications",  value: pending,  icon: iconClock, accent: BRAND.orange, bg: "#FFFBEB", border: "#FEF3C7", onClick: () => { setTab("files"); setFilesTab("pending");  fetchAllFiles("pending");  } },
    { label: "Approved Applications", value: approved, icon: iconCheck, accent: BRAND.green,  bg: "#F0FDF4", border: "#DCFCE7", onClick: () => { setTab("files"); setFilesTab("approved"); fetchAllFiles("approved"); } },
    { label: "Rejected Applications", value: rejected, icon: iconX,     accent: BRAND.red,    bg: "#FFF1F2", border: "#FFE4E6", onClick: () => { setTab("files"); setFilesTab("rejected"); fetchAllFiles("rejected"); } },
    { label: "Total Applications",    value: total,    icon: iconFile,  accent: BRAND.blue,   bg: "#EFF6FF", border: "#DBEAFE", onClick: null },
  ];

  return (
    <div style={{ fontFamily: "inherit" }}>
      <style>{`
        .stats-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 20px;
        }
        @media (max-width: 1100px) { .stats-kpi-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 600px)  { .stats-kpi-grid { grid-template-columns: 1fr; } }

        .stats-charts-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 20px;
        }
        @media (max-width: 900px) { .stats-charts-grid { grid-template-columns: 1fr; } }

        .stats-kpi-card {
          background: #fff; border-radius: 16px; border: 1px solid #E5E7EB;
          box-shadow: 0 2px 12px rgba(11,31,77,0.07); padding: 20px 22px;
          cursor: pointer; transition: transform 0.18s ease, box-shadow 0.18s ease;
          display: flex; flex-direction: column; gap: 10px;
          position: relative; overflow: hidden;
        }
        .stats-kpi-card:hover { transform: translateY(-3px); box-shadow: 0 8px 28px rgba(11,31,77,0.13); }
        .stats-kpi-card.no-click { cursor: default; }
        .stats-kpi-card.no-click:hover { transform: none; box-shadow: 0 2px 12px rgba(11,31,77,0.07); }

        .stats-chart-card {
          background: #fff; border-radius: 16px; border: 1px solid #E5E7EB;
          box-shadow: 0 2px 12px rgba(11,31,77,0.07); padding: 22px 24px;
        }
        .stats-chart-title { font-size: 15px; font-weight: 800; color: #0B1F4D; margin-bottom: 2px; letter-spacing: -0.2px; }
        .stats-chart-subtitle { font-size: 12px; color: #9CA3AF; font-weight: 500; margin-bottom: 16px; }

        .stats-header-row {
          display: flex; justify-content: space-between; align-items: flex-start;
          margin-bottom: 16px; flex-wrap: wrap; gap: 12px;
        }
        .stats-export-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .stats-export-btn {
          display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px;
          border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer;
          border: 1.5px solid transparent;
          transition: opacity 0.15s ease, transform 0.15s ease; white-space: nowrap;
        }
        .stats-export-btn:hover { opacity: 0.88; transform: translateY(-1px); }
        .stats-export-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }
        .stats-refresh-btn {
          display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px;
          border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer;
          background: #fff; border: 1.5px solid #E5E7EB; color: #0B1F4D;
          transition: background 0.15s ease, transform 0.15s ease;
        }
        .stats-refresh-btn:hover { background: #F1F5F9; transform: translateY(-1px); }

        /* Filter bar */
        .stats-filter-card {
          background: #fff; border-radius: 16px; border: 1px solid #E5E7EB;
          box-shadow: 0 2px 12px rgba(11,31,77,0.07); padding: 18px 22px; margin-bottom: 18px;
        }
        .stats-filter-label {
          font-size: 11px; font-weight: 700; color: #9CA3AF; text-transform: uppercase;
          letter-spacing: 0.8px; margin-bottom: 10px;
        }
        .stats-pills { display: flex; flex-wrap: wrap; gap: 8px; }
        .stats-pill {
          padding: 6px 14px; border-radius: 999px; font-size: 13px; font-weight: 600;
          cursor: pointer; border: 1.5px solid #E5E7EB; background: #F8FAFC; color: #374151;
          transition: all 0.15s ease; white-space: nowrap;
        }
        .stats-pill:hover { border-color: #0B1F4D; color: #0B1F4D; background: #EFF6FF; }
        .stats-pill.active {
          background: #0B1F4D; color: #fff; border-color: #0B1F4D;
          box-shadow: 0 2px 8px rgba(11,31,77,0.25);
        }
        .stats-custom-row {
          display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 14px;
          padding-top: 14px; border-top: 1px solid #F1F5F9;
        }
        .stats-date-input {
          padding: 8px 12px; border-radius: 10px; border: 1.5px solid #E5E7EB;
          font-size: 13px; font-weight: 500; color: #374151; background: #F8FAFC;
          outline: none; transition: border-color 0.15s;
        }
        .stats-date-input:focus { border-color: #0B1F4D; background: #fff; }
        .stats-apply-btn {
          padding: 8px 18px; border-radius: 10px; background: #0B1F4D; color: #fff;
          font-size: 13px; font-weight: 700; border: none; cursor: pointer;
          transition: opacity 0.15s, transform 0.15s;
        }
        .stats-apply-btn:hover { opacity: 0.88; transform: translateY(-1px); }
        .stats-range-badge {
          display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px;
          background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 999px;
          font-size: 12px; font-weight: 600; color: #1D4ED8; margin-top: 10px;
        }

        .kpi-icon-wrap { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 12px; }
        .kpi-count { font-size: 36px; font-weight: 900; line-height: 1; letter-spacing: -1px; }
        .kpi-label { font-size: 13px; font-weight: 600; color: #6B7280; }
        .kpi-accent-bar { position: absolute; bottom: 0; left: 0; right: 0; height: 3px; border-radius: 0 0 16px 16px; }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="stats-header-row">
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: BRAND.blue, letterSpacing: "-0.5px" }}>
            Application Statistics
          </div>
          <div style={{ fontSize: 13, color: "#6B7280", marginTop: 3, fontWeight: 500 }}>
            Real-time overview of application status
          </div>
        </div>
        <div className="stats-export-row">
          <button className="stats-refresh-btn" onClick={fetchAllData} title="Refresh">
            {iconRefresh} Refresh
          </button>
          <button className="stats-export-btn" style={{ background: "#FFFBEB", borderColor: "#FDE68A", color: "#92400E" }}
            onClick={() => handleExport("pending")} disabled={exporting.pending}>
            {iconDownload} {exporting.pending ? "Exporting…" : "Export Pending"}
          </button>
          <button className="stats-export-btn" style={{ background: "#F0FDF4", borderColor: "#BBF7D0", color: "#14532D" }}
            onClick={() => handleExport("approved")} disabled={exporting.approved}>
            {iconDownload} {exporting.approved ? "Exporting…" : "Export Approved"}
          </button>
          <button className="stats-export-btn" style={{ background: "#FFF1F2", borderColor: "#FECDD3", color: "#7F1D1D" }}
            onClick={() => handleExport("rejected")} disabled={exporting.rejected}>
            {iconDownload} {exporting.rejected ? "Exporting…" : "Export Rejected"}
          </button>
          <button className="stats-export-btn" style={{ background: "#EFF6FF", borderColor: "#BFDBFE", color: "#1D4ED8" }}
            onClick={handleExportAll} disabled={exporting.all}>
            {iconDownload} {exporting.all ? "Exporting…" : "Export All"}
          </button>
        </div>
      </div>

      {/* ── Date Filter Bar ─────────────────────────────────────────────────── */}
      <div className="stats-filter-card">
        <div className="stats-filter-label">Date Filter</div>
        <div className="stats-pills">
          {QUICK_FILTERS.map((f) => (
            <button
              key={f.key}
              className={`stats-pill${filterKey === f.key ? " active" : ""}`}
              onClick={() => applyQuickFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filterKey === "custom" && (
          <div className="stats-custom-row">
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>From</label>
            <input type="date" className="stats-date-input" value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)} />
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>To</label>
            <input type="date" className="stats-date-input" value={customTo}
              onChange={(e) => setCustomTo(e.target.value)} />
            <button className="stats-apply-btn" onClick={applyCustomRange}>Apply</button>
          </div>
        )}

        <div style={{ marginTop: 10 }}>
          <span className="stats-range-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Showing data for: <strong>{rangeLabel}</strong>
          </span>
        </div>
      </div>

      {/* ── Loading ─────────────────────────────────────────────────────────── */}
      {loadingData ? (
        <div style={{ textAlign: "center", padding: "60px 20px", background: "#fff", borderRadius: 16, border: "1px solid #E5E7EB", color: "#6B7280", fontWeight: 600 }}>
          Loading statistics…
        </div>
      ) : (
        <>
          {/* ── KPI Cards ──────────────────────────────────────────────────── */}
          <div className="stats-kpi-grid">
            {kpiCards.map((card) => (
              <div key={card.label}
                className={`stats-kpi-card${card.onClick ? "" : " no-click"}`}
                style={{ borderColor: card.border }}
                onClick={card.onClick || undefined}
                title={card.onClick ? "Click to view details" : undefined}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div className="kpi-icon-wrap" style={{ background: card.bg, color: card.accent }}>{card.icon}</div>
                  {card.onClick && <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginTop: 4 }}>View →</span>}
                </div>
                <div className="kpi-count" style={{ color: card.accent }}>{card.value.toLocaleString()}</div>
                <div className="kpi-label">{card.label}</div>
                <div className="kpi-accent-bar" style={{ background: card.accent }} />
              </div>
            ))}
          </div>

          {/* ── Charts ────────────────────────────────────────────────────── */}
          <div className="stats-charts-grid">
            {/* Bar Chart */}
            <div className="stats-chart-card">
              <div className="stats-chart-title">Application Status Overview</div>
              <div className="stats-chart-subtitle">Based on selected date range</div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={barData} margin={{ top: 20, right: 10, left: -10, bottom: 0 }} barSize={52}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 13, fontWeight: 600, fill: "#374151" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "rgba(11,31,77,0.04)" }}
                    contentStyle={{ borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, fontWeight: 600 }} />
                  <Bar dataKey="value" radius={[8,8,0,0]} label={<CustomBarLabel />}>
                    {barData.map((entry, i) => <Cell key={`cell-${i}`} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Donut Chart */}
            <div className="stats-chart-card">
              <div className="stats-chart-title">Application Distribution</div>
              <div className="stats-chart-subtitle">Filtered by selected date range</div>
              {total === 0 ? (
                <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", fontWeight: 600 }}>
                  No data for selected range
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={72} outerRadius={105} paddingAngle={3}
                      dataKey="value" label={({ percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {pieData.map((entry, i) => (
                        <Cell key={`pie-${i}`} fill={PIE_COLORS[["Pending","Approved","Rejected"].indexOf(entry.name)]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, fontWeight: 600 }}
                      formatter={(value, name) => [`${value} (${total ? ((value/total)*100).toFixed(1) : 0}%)`, name]} />
                    <Legend iconType="circle" iconSize={10}
                      formatter={(value) => <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{value}</span>} />
                    <Customized component={(props) => <DonutCenterLabel {...props} total={total} />} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
const SuperAdminDashboard = () => {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();

  // Tabs: admins management, dealers, recent activity, summary
  const [tab, setTab] = useState("admins");

  // Admins data
  const [admins, setAdmins] = useState([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  const availableWorkflows = WORKFLOW_STAGES;

  // Create admin form
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "admin",
    selectedWorkflows: [...WORKFLOW_STAGES],
  });

  // Edit admin state
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "admin",
    selectedWorkflows: [],
  });

  // Password visibility states
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  // Dealers data
  const [dealers, setDealers] = useState([]);
  const [loadingDealers, setLoadingDealers] = useState(false);
  
  // Create dealer form (single)
  const [dealerForm, setDealerForm] = useState({
    email: "",
    password: "",
    UserId: "",
    name: "",
    District: "",
    Branch: "",
    mobileNumber: "",
  });
  const [showDealerPassword, setShowDealerPassword] = useState(false);

  // Bulk create dealer form
  // const [bulkDealersText, setBulkDealersText] = useState("");
  const [bulkCreateMode, setBulkCreateMode] = useState("single"); // "single" or "bulk"
  const [bulkUploadMode, setBulkUploadMode] = useState("text"); // "text" or "excel"
  const [bulkDealersData, setBulkDealersData] = useState([]);
  const fileInputRef = useRef(null);
  const [nextUserId, setNextUserId] = useState(1000);

  // Edit dealer state
  const [editingDealer, setEditingDealer] = useState(null);
  const [editDealerForm, setEditDealerForm] = useState({
    email: "",
    password: "",
    UserId: "",
    name: "",
    District: "",
    Branch: "",
    mobileNumber: "",
  });

  // Branches added through the "+ Add Branch" popup (loaded from the API)
  const [dbBranches, setDbBranches] = useState([]);

  // Branch dropdown options — the built-in list plus any branch added via the API.
  // The built-in list stays first so the dropdown is unchanged even if the API is
  // unavailable or the branches collection is empty.
  const branchOptions = useMemo(() => {
    const seen = new Set(DEFAULT_BRANCHES.map((b) => b.toLowerCase()));
    const extra = dbBranches.filter((b) => b && !seen.has(b.toLowerCase()));
    return [...DEFAULT_BRANCHES, ...extra];
  }, [dbBranches]);

  // Add Branch popup state
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [branchError, setBranchError] = useState("");
  const [savingBranch, setSavingBranch] = useState(false);
  const savingBranchRef = useRef(false); // synchronous in-flight guard (blocks double-submit before re-render)
  const branchInputRef = useRef(null);
  const branchSelectRef = useRef(null); // dropdown to return focus to on close
  const branchModalRef = useRef(null);  // modal container for focus trapping

  // Lightweight in-app toast (no extra dependency, matches app theme)
  const [toast, setToast] = useState(null); // { type: "success" | "error", message }
  const toastTimerRef = useRef(null);
  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);
  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  // Search states
  const [filesSearch, setFilesSearch] = useState("");
  const [filesSearchDebounced, setFilesSearchDebounced] = useState("");
  // Debounce file search
  useEffect(() => {
    const t = setTimeout(() => setFilesSearchDebounced(filesSearch), 300);
    return () => clearTimeout(t);
  }, [filesSearch]);

  const [showEditDealerPassword, setShowEditDealerPassword] = useState(false);

  // Update edit form when editingAdmin changes
  useEffect(() => {
    if (editingAdmin) {
      // console.log("========== EDIT ADMIN DEBUG ==========");
      // console.log("Admin name:", editingAdmin.name);
      // console.log("Admin workflows (raw):", editingAdmin.workflows);
      // console.log("Admin workflows type:", typeof editingAdmin.workflows);
      // console.log("Admin workflows isArray:", Array.isArray(editingAdmin.workflows));
      // console.log("Admin workflows JSON:", JSON.stringify(editingAdmin.workflows));

      // Normalise workflows using the shared toStage helper (handles all legacy aliases)
      const raw = editingAdmin.workflows;
      let workflowArray = [];
      if (Array.isArray(raw)) {
        workflowArray = raw.flat();
      } else if (typeof raw === 'string') {
        try { workflowArray = JSON.parse(raw); } catch {
          workflowArray = raw.replace(/[\[\]"']/g, '').split(/[,\n]+/);
        }
        if (!Array.isArray(workflowArray)) workflowArray = [workflowArray];
      } else if (raw) {
        workflowArray = [raw].flat();
      }
      const workflows = [...new Set(
        workflowArray.map(w => toStage(w)).filter(w => WORKFLOW_STAGES.includes(w))
      )];

      setEditForm({
        name: editingAdmin.name || "",
        email: editingAdmin.email || "",
        password: "",
        role: editingAdmin.role || "admin",
        selectedWorkflows: workflows,
      });

      // console.log("useEffect: edit form updated with selectedWorkflows:", workflows);
    } else {
      // Reset form when not editing
      setEditForm({
        name: "",
        email: "",
        password: "",
        role: "admin",
        selectedWorkflows: [],
      });
    }
  }, [editingAdmin]);

  // Recent logs + summary
  const [recent, setRecent] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  const [summary, setSummary] = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Stats data
  const [stats, setStats] = useState({});
  const [loadingStats, setLoadingStats] = useState(false);

  // Files data
  const [allFiles, setAllFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [filesTab, setFilesTab] = useState("pending"); // pending, approved, rejected

  // Admin activity modal
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [adminActivity, setAdminActivity] = useState({ files: [], totalActions: 0, admin: null });
  const [loadingAdminActivity, setLoadingAdminActivity] = useState(false);

  // Dealer Activity data
  const [dealerActivity, setDealerActivity] = useState([]);
  const [dealerActivityStats, setDealerActivityStats] = useState({ total: 0, online: 0, offline: 0 });
  const [loadingDealerActivity, setLoadingDealerActivity] = useState(false);
  const [dealerActivitySearch, setDealerActivitySearch] = useState("");
  const [dealerActivitySearchDebounced, setDealerActivitySearchDebounced] = useState("");
  const [dealerActivityFilter, setDealerActivityFilter] = useState("all"); // all, online, offline

  // Debounce dealer activity search
  useEffect(() => {
    const t = setTimeout(() => setDealerActivitySearchDebounced(dealerActivitySearch), 300);
    return () => clearTimeout(t);
  }, [dealerActivitySearch]);

  const [busy, setBusy] = useState(false);

  const gridRef = useRef(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);

  // Get selected workflows for the current form
  const stageArray = useMemo(
    () => editingAdmin ? editForm.selectedWorkflows : form.selectedWorkflows,
    [form.selectedWorkflows, editForm.selectedWorkflows, editingAdmin]
  );

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

  const authHeaders = () => {
    const token = localStorage.getItem("adminToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
    // NOTE: your protect middleware reads Bearer token; this matches your Admin dashboard pattern
  };

  // ===== API Calls (keep identical patterns to your Admin Dashboard) =====
  const fetchAdmins = React.useCallback(async () => {
    try {
      setLoadingAdmins(true);
      const { data } = await API.get("/superadmin/admins", {
        headers: authHeaders(),
      });
      setAdmins(Array.isArray(data?.admins) ? data.admins : []);
    } catch (err) {
      console.error("Failed to load admins", err?.response?.data || err.message);
      setAdmins([]);
    } finally {
      setLoadingAdmins(false);
    }
  }, []);

  const fetchRecent = React.useCallback(async () => {
    try {
      setLoadingRecent(true);
      const { data } = await API.get("/superadmin/dashboard/recent?limit=25", {
        headers: authHeaders(),
      });
      setRecent(Array.isArray(data?.logs) ? data.logs : []);
    } catch (err) {
      console.error("Failed to load recent activity", err?.response?.data || err.message);
      setRecent([]);
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  const fetchSummary = React.useCallback(async () => {
    try {
      setLoadingSummary(true);
      const params = new URLSearchParams();
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      const qs = params.toString();
      const { data } = await API.get(`/superadmin/dashboard/summary${qs ? `?${qs}` : ""}`, {
        headers: authHeaders(),
      });
      setSummary(Array.isArray(data?.summary) ? data.summary : []);
    } catch (err) {
      console.error("Failed to load summary", err?.response?.data || err.message);
      setSummary([]);
    } finally {
      setLoadingSummary(false);
    }
  }, [dateFrom, dateTo]);

  const fetchStats = React.useCallback(async () => {
    try {
      setLoadingStats(true);
      const { data } = await API.get("/superadmin/dashboard/stats", {
        headers: authHeaders(),
      });
      setStats(data?.stats || {});
    } catch (err) {
      console.error("Failed to load stats", err?.response?.data || err.message);
      setStats({});
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const fetchAllFiles = React.useCallback(async (type = "pending") => {
    try {
      setLoadingFiles(true);
      const { data } = await API.get(`/superadmin/files/${type}`, {
        headers: authHeaders(),
      });
      setAllFiles(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(`Failed to load ${type} files`, err?.response?.data || err.message);
      setAllFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  // Fetch all three categories at once (for export-all / export-selected)
  const fetchAllFilesAll = useCallback(async () => {
    const headers = authHeaders();
    try {
      const [p, a, r] = await Promise.all([
        API.get("/superadmin/files/pending",  { headers }),
        API.get("/superadmin/files/approved", { headers }),
        API.get("/superadmin/files/rejected", { headers }),
      ]);
      return {
        pending:  Array.isArray(p.data) ? p.data : [],
        approved: Array.isArray(a.data) ? a.data : [],
        rejected: Array.isArray(r.data) ? r.data : [],
      };
    } catch (err) {
      console.error("fetchAllFilesAll failed", err?.response?.data || err.message);
      return { pending: [], approved: [], rejected: [] };
    }
  }, []);

  const fetchDealers = React.useCallback(async () => {
    try {
      setLoadingDealers(true);
      const { data } = await API.get("/superadmin/dealers", {
        headers: authHeaders(),
      });
      setDealers(Array.isArray(data?.dealers) ? data.dealers : []);
    } catch (err) {
      console.error("Failed to load dealers", err?.response?.data || err.message);
      setDealers([]);
    } finally {
      setLoadingDealers(false);
    }
  }, []);

  // Load branches created through "+ Add Branch". A failure here is non-fatal —
  // the dropdown falls back to DEFAULT_BRANCHES.
  const fetchBranches = React.useCallback(async () => {
    try {
      const { data } = await API.get("/branches", { headers: authHeaders() });
      const names = Array.isArray(data?.branches)
        ? data.branches.map((b) => b?.name).filter(Boolean)
        : [];
      setDbBranches(names);
      return names;
    } catch (err) {
      console.error("Failed to load branches", err?.response?.data || err.message);
      return [];
    }
  }, []);

  const fetchDealerActivity = React.useCallback(async (search = "", status = "all") => {
    try {
      setLoadingDealerActivity(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (status && status !== "all") params.set("status", status);
      const qs = params.toString();
      const { data } = await API.get(`/superadmin/dealers/activity${qs ? `?${qs}` : ""}`, {
        headers: authHeaders(),
      });
      setDealerActivity(Array.isArray(data?.dealers) ? data.dealers : []);
      setDealerActivityStats(data?.stats || { total: 0, online: 0, offline: 0 });
    } catch (err) {
      console.error("Failed to load dealer activity", err?.response?.data || err.message);
      setDealerActivity([]);
      setDealerActivityStats({ total: 0, online: 0, offline: 0 });
    } finally {
      setLoadingDealerActivity(false);
    }
  }, []);

  const fetchAdminActivity = React.useCallback(async (adminId) => {
    try {
      setLoadingAdminActivity(true);
      const params = new URLSearchParams();
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      const qs = params.toString();
      const { data } = await API.get(`/superadmin/dashboard/admin/${adminId}/activity${qs ? `?${qs}` : ""}`, {
        headers: authHeaders(),
      });
      setAdminActivity({
        files: Array.isArray(data?.files) ? data.files : [],
        totalActions: data?.totalActions || 0,
        admin: data?.admin || null
      });
    } catch (err) {
      console.error("Failed to load admin activity", err?.response?.data || err.message);
      setAdminActivity({ files: [], totalActions: 0, admin: null });
    } finally {
      setLoadingAdminActivity(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    // Gate: only superadmin should see this page. If not, bounce.
    if (!admin) {
      navigate("/");
      return;
    }
    if (admin?.role !== "superadmin") {
      navigate("/"); // or to /admin-dashboard if you prefer
      return;
    }
    // load initial tab
    fetchAdmins();
    fetchRecent();
    fetchSummary();
    fetchStats();
    fetchDealers();
  }, [admin, navigate, fetchAdmins, fetchRecent, fetchSummary, fetchStats, fetchDealers]);

  // Auto-fetch files when switching to Files tab or changing the files sub-tab
  useEffect(() => {
    if (tab === "files") {
      fetchAllFiles(filesTab);
    }
  }, [tab, filesTab, fetchAllFiles]);

  // Auto-fetch dealer activity when switching to Dealer Activity tab
  useEffect(() => {
    if (tab === "dealerActivity") {
      fetchDealerActivity(dealerActivitySearchDebounced, dealerActivityFilter);
    }
  }, [tab, dealerActivitySearchDebounced, dealerActivityFilter, fetchDealerActivity]);

  // Auto-refresh dealer activity every 30 seconds when on that tab
  useEffect(() => {
    if (tab !== "dealerActivity") return;
    const interval = setInterval(() => {
      fetchDealerActivity(dealerActivitySearchDebounced, dealerActivityFilter);
    }, 30000);
    return () => clearInterval(interval);
  }, [tab, dealerActivitySearchDebounced, dealerActivityFilter, fetchDealerActivity]);

  // Auto-fetch dealers when switching to Dealers tab
  useEffect(() => {
    if (tab === "dealers") {
      fetchDealers();
      fetchBranches();
    }
  }, [tab, fetchDealers, fetchBranches]);

  // Update edit dealer form when editingDealer changes
  useEffect(() => {
    if (editingDealer) {
      setEditDealerForm({
        email: editingDealer.email || "",
        password: "",
        UserId: editingDealer.UserId || "",
        name: editingDealer.name || "",
        District: editingDealer.District || "",
        Branch: editingDealer.Branch || "",
        mobileNumber: editingDealer.mobileNumber || editingDealer.Contact || "",
      });
      setShowEditDealerPassword(false);
    } else {
      setEditDealerForm({
        email: "",
        password: "",
        UserId: "",
        name: "",
        District: "",
        Branch: "",
        mobileNumber: "",
      });
    }
  }, [editingDealer]);

  // ===== Handlers =====
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
      console.warn("Failed to clear admin tokens:", err);
    }
    navigate("/");
  };

  const createAdmin = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await API.post(
        "/superadmin/admins",
        {
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          workflows: stageArray,
        },
        { headers: authHeaders() }
      );
      // reset name/email/password, keep workflows text as-is for faster multiple entries
      setForm((f) => ({ ...f, name: "", email: "", password: "" }));
      setShowCreatePassword(false);
      await fetchAdmins();
      setTab("admins");
      setTimeout(() => gridRef.current?.scrollIntoView({ behavior: "smooth" }), 120);
    } catch (err) {
      alert(err?.response?.data?.message || err.message || "Failed to create admin");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (id, isActive) => {
    if (!id) {
      alert("Admin ID is missing");
      return;
    }
    
    // Ensure isActive is a boolean
    const newActiveStatus = Boolean(isActive);
    
    setBusy(true);
    try {
      const response = await API.patch(
        "/superadmin/admins/toggle",
        { adminId: id, isActive: newActiveStatus },
        { headers: authHeaders() }
      );
      await fetchAdmins();
      alert(response?.data?.message || "Admin status updated successfully");
    } catch (err) {
      const errorMsg = err?.response?.data?.message || err?.message || "Failed to toggle";
      console.error("Toggle error:", err?.response?.data || err);
      alert(errorMsg);
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (applicationId) => {
    if (!confirm("Are you sure you want to revoke this rejection and move the application back to pending?")) {
      return;
    }

    setBusy(true);
    try {
      await API.post(
        "/superadmin/applications/revoke",
        { applicationId },
        { headers: authHeaders() }
      );
      // Refresh the current files tab
      fetchAllFiles(filesTab);
      fetchStats(); // Refresh stats too
      alert("Application revoked and moved back to pending");
    } catch (err) {
      alert(err?.response?.data?.message || err.message || "Failed to revoke");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteAdmin = async (adminId) => {
    if (!confirm("Are you sure you want to delete this admin? This action cannot be undone.")) {
      return;
    }

    setBusy(true);
    try {
      await API.delete(`/superadmin/admins/${adminId}`, {
        headers: authHeaders()
      });
      await fetchAdmins();
      alert("Admin deleted successfully");
    } catch (err) {
      alert(err?.response?.data?.message || err.message || "Failed to delete admin");
    } finally {
      setBusy(false);
    }
  };

  const handleEditAdmin = (admin) => {
    if (!admin) {
      console.error("handleEditAdmin called with undefined admin");
      return;
    }

    // console.log("handleEditAdmin called for:", admin.name);
    // console.log("Full admin object:", admin);
    // console.log("Admin workflows:", admin.workflows);
    // console.log("Admin workflows type:", typeof admin.workflows);
    // console.log("Admin workflows isArray:", Array.isArray(admin.workflows));

    // Just set the editing admin - useEffect will handle updating the form
    setEditingAdmin(admin);
  };

  const updateAdmin = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const updateData = {
        name: editForm.name,
        email: editForm.email,
        role: editForm.role,
        workflows: stageArray,
      };
      
      // Only include password if it's been provided
      if (editForm.password && editForm.password.trim() !== "") {
        updateData.password = editForm.password;
      }
      
      await API.patch(
        `/superadmin/admins/${editingAdmin._id}`,
        updateData,
        { headers: authHeaders() }
      );
      setEditingAdmin(null);
      setEditForm({ name: "", email: "", password: "", role: "admin", selectedWorkflows: [] });
      await fetchAdmins();
      alert("Admin updated successfully");
    } catch (err) {
      alert(err?.response?.data?.message || err.message || "Failed to update admin");
    } finally {
      setBusy(false);
    }
  };

  const cancelEdit = () => {
    setEditingAdmin(null);
    setEditForm({
      name: "",
      email: "",
      password: "",
      role: "admin",
      selectedWorkflows: [],
    });
    setShowEditPassword(false);
  };

  // Dealer creation handlers
  const createDealer = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await API.post(
        "/superadmin/dealers",
        dealerForm,
        { headers: authHeaders() }
      );
      setDealerForm({
        email: "",
        password: "",
        UserId: "",
        name: "",
        District: "",
        Branch: "",
        mobileNumber: "",
      });
      setShowDealerPassword(false);
      await fetchDealers();
      alert("Dealer created successfully");
    } catch (err) {
      alert(err?.response?.data?.message || err.message || "Failed to create dealer");
    } finally {
      setBusy(false);
    }
  };

  // ===== Add Branch popup handlers =====
  const openAddBranch = () => {
    setNewBranchName("");
    setBranchError("");
    setShowAddBranch(true);
  };

  const closeAddBranch = () => {
    setShowAddBranch(false);
    setNewBranchName("");
    setBranchError("");
    // Return keyboard focus to the Branch dropdown after the modal unmounts
    setTimeout(() => branchSelectRef.current?.focus(), 0);
  };

  // When the Add Branch popup opens: focus the input, enable Escape-to-close,
  // and trap keyboard focus inside the modal.
  useEffect(() => {
    if (!showAddBranch) return;
    // Focus the branch name input once the modal has mounted
    const focusTimer = setTimeout(() => branchInputRef.current?.focus(), 0);
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        closeAddBranch();
        return;
      }
      if (e.key === "Tab") {
        // Keep Tab focus cycling within the modal's enabled controls
        const focusable = branchModalRef.current?.querySelectorAll(
          "input, button, select, textarea, a[href]"
        );
        const list = focusable
          ? Array.from(focusable).filter((el) => !el.disabled && el.tabIndex !== -1)
          : [];
        if (list.length === 0) return;
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showAddBranch]);

  const submitNewBranch = async (e) => {
    e.preventDefault();
    // Guard against repeated clicks / Enter presses while a request is in flight.
    // The ref updates synchronously, closing the race window before the button
    // is re-rendered as disabled.
    if (savingBranchRef.current) return;

    // Normalize: trim ends and collapse internal whitespace to single spaces
    // e.g. "  Lucknow    Main   " -> "Lucknow Main"
    const name = newBranchName.trim().replace(/\s+/g, " ");

    if (!name) {
      setBranchError("Branch Name is required.");
      return;
    }
    if (branchOptions.some((b) => b.toLowerCase() === name.toLowerCase())) {
      setBranchError("Branch already exists.");
      return;
    }

    savingBranchRef.current = true;
    setSavingBranch(true);
    setBranchError("");
    try {
      const { data } = await API.post(
        "/branches",
        { name },
        { headers: authHeaders() }
      );
      const created = data?.branch?.name || name;
      await fetchBranches();
      setDealerForm((prev) => ({ ...prev, Branch: created }));
      closeAddBranch();
      showToast("Branch added successfully.", "success");
    } catch (err) {
      // Keep the popup open and the input intact so the user can retry.
      // Show the API error inline in the modal and via a toast.
      const msg =
        err?.response?.data?.message || err.message || "Failed to add branch";
      setBranchError(msg);
      showToast(msg, "error");
    } finally {
      savingBranchRef.current = false;
      setSavingBranch(false);
    }
  };

  // Generate UserId if not provided
  const generateUserId = () => {
    const id = `USER${String(nextUserId).padStart(6, '0')}`;
    setNextUserId(nextUserId + 1);
    return id;
  };

  // Handle Excel file upload
  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          alert("Excel file is empty");
          return;
        }

        // Process the data and generate IDs where needed
        const processedData = jsonData.map((row) => ({
          email: row.email || row.Email || "",
          password: row.password || row.Password || "",
          UserId: row.UserId || row.userid || row.Userid || generateUserId(),
          name: row.name || row.Name || "",
          District: row.District || row.district || "",
          Branch: row.Branch || row.branch || "",
          mobileNumber: row.mobileNumber || row.MobileNumber || row.Contact || row.contact || row.Phone || row.phone || "",
        }));

        setBulkDealersData(processedData);
        alert(`Successfully loaded ${processedData.length} records from Excel file`);
      } catch (err) {
        alert("Error reading Excel file: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = ""; // Reset file input
  };

  // Handle text input with ID generation
  // const generateIdsFromText = () => {
  //   if (!bulkDealersText.trim()) {
  //     alert("Please enter dealer data");
  //     return;
  //   }

  //   try {
  //     const lines = bulkDealersText.trim().split('\n').filter(line => line.trim());
  //     const dealers = lines.map((line, index) => {
  //       const parts = line.split(',').map(p => p.trim());
  //       if (parts.length < 2) {
  //         throw new Error(`Line ${index + 1}: Email and password are required`);
  //       }
        
  //       // Generate UserId if not provided (parts[2] is empty or missing)
  //       let userId = parts[2];
  //       if (!userId || userId === "") {
  //         userId = generateUserId();
  //       }
        
  //       return {
  //         email: parts[0],
  //         password: parts[1],
  //         UserId: userId,
  //         name: parts[3] || "",
  //         District: parts[4] || "",
  //         Branch: parts[5] || "",
  //         Contact: parts[6] || "",
  //       };
  //     });

  //     setBulkDealersData(dealers);
  //     alert(`Successfully generated IDs for ${dealers.length} records`);
  //   } catch (err) {
  //     alert(err.message);
  //   }
  // };

  const bulkCreateDealers = async (e) => {
    e.preventDefault();
    
    const dealers = bulkDealersData;
    
    if (dealers.length === 0) {
      alert("Please load dealer data first");
      return;
    }

    setBusy(true);
    try {
      // Validate required fields
      for (let i = 0; i < dealers.length; i++) {
        const d = dealers[i];
        if (!d.email || !d.password) {
          alert(`Record ${i + 1}: Email and password are required`);
          setBusy(false);
          return;
        }
      }

      const { data } = await API.post(
        "/superadmin/dealers/bulk",
        { dealers },
        { headers: authHeaders() }
      );
      
      // setBulkDealersText("");
      setBulkDealersData([]);
      setNextUserId(1000);
      await fetchDealers();
      
      const message = `Bulk creation completed!\n${data.results.success.length} succeeded\n${data.results.failed.length} failed`;
      if (data.results.failed.length > 0) {
        const failedDetails = data.results.failed.map(f => `- ${f.email}: ${f.error}`).join('\n');
        alert(message + '\n\nFailed:\n' + failedDetails);
      } else {
        alert(message);
      }
    } catch (err) {
      alert(err?.response?.data?.message || err.message || "Failed to create dealers");
    } finally {
      setBusy(false);
    }
  };

  const handleEditDealer = (dealer) => {
    if (!dealer) {
      console.error("handleEditDealer called with undefined dealer");
      return;
    }
    setEditingDealer(dealer);
  };

  const updateDealer = async (e) => {
    e.preventDefault();
    if (!editingDealer?._id) return;
    
    setBusy(true);
    try {
      const updateData = {
        email: editDealerForm.email,
        UserId: editDealerForm.UserId,
        name: editDealerForm.name,
        District: editDealerForm.District,
        Branch: editDealerForm.Branch,
        mobileNumber: editDealerForm.mobileNumber,
      };
      
      // Only include password if it's been provided
      if (editDealerForm.password && editDealerForm.password.trim() !== "") {
        updateData.password = editDealerForm.password;
      }
      
      await API.patch(
        `/superadmin/dealers/${editingDealer._id}`,
        updateData,
        { headers: authHeaders() }
      );
      setEditingDealer(null);
      setEditDealerForm({ email: "", password: "", UserId: "", name: "", District: "", Branch: "", mobileNumber: "" });
      setShowEditDealerPassword(false);
      await fetchDealers();
      alert("Dealer updated successfully");
    } catch (err) {
      alert(err?.response?.data?.message || err.message || "Failed to update dealer");
    } finally {
      setBusy(false);
    }
  };

  const cancelEditDealer = () => {
    setEditingDealer(null);
    setEditDealerForm({ email: "", password: "", UserId: "", name: "", District: "", Branch: "", mobileNumber: "" });
    setShowEditDealerPassword(false);
  };

  const toggleDealerActive = async (dealerId, isActive) => {
    if (!dealerId) {
      alert("Dealer ID is missing");
      return;
    }
    
    setBusy(true);
    try {
      await API.patch(
        "/superadmin/dealers/toggle",
        { dealerId, isActive: !isActive },
        { headers: authHeaders() }
      );
      await fetchDealers();
      alert("Dealer status updated successfully");
    } catch (err) {
      const errorMsg = err?.response?.data?.message || err?.message || "Failed to toggle";
      console.error("Toggle error:", err?.response?.data || err);
      alert(errorMsg);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteDealer = async (dealerId) => {
    if (!confirm("Are you sure you want to delete this dealer? This action cannot be undone.")) {
      return;
    }

    setBusy(true);
    try {
      await API.delete(`/superadmin/dealers/${dealerId}`, {
        headers: authHeaders()
      });
      await fetchDealers();
      alert("Dealer deleted successfully");
    } catch (err) {
      alert(err?.response?.data?.message || err.message || "Failed to delete dealer");
    } finally {
      setBusy(false);
    }
  };

  const handleBulkToggleDealers = async (ids, activate) => {
    if (!confirm(`${activate ? "Activate" : "Deactivate"} ${ids.length} dealer(s)?`)) return;
    setBusy(true);
    try {
      await Promise.all(
        ids.map(id => API.patch("/superadmin/dealers/toggle", { dealerId: id, isActive: activate }, { headers: authHeaders() }))
      );
      await fetchDealers();
      alert(`${ids.length} dealer(s) ${activate ? "activated" : "deactivated"} successfully`);
    } catch (err) {
      alert(err?.response?.data?.message || err.message || "Bulk toggle failed");
    } finally {
      setBusy(false);
    }
  };

  const handleBulkDeleteDealers = async (ids) => {
    if (!confirm(`Permanently delete ${ids.length} dealer(s)? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await Promise.all(
        ids.map(id => API.delete(`/superadmin/dealers/${id}`, { headers: authHeaders() }))
      );
      await fetchDealers();
      alert(`${ids.length} dealer(s) deleted successfully`);
    } catch (err) {
      alert(err?.response?.data?.message || err.message || "Bulk delete failed");
    } finally {
      setBusy(false);
    }
  };

  // Helper functions for workflow checkboxes
  const handleWorkflowChange = (workflow, isChecked, isEdit = false) => {
    const targetForm = isEdit ? editForm : form;
    const setTargetForm = isEdit ? setEditForm : setForm;
    const normalizedWorkflow = toStage(workflow);
    const updatedWorkflows = isChecked
      ? [...new Set([...targetForm.selectedWorkflows, normalizedWorkflow])]
      : targetForm.selectedWorkflows.filter(w => toStage(w) !== normalizedWorkflow);
    setTargetForm({ ...targetForm, selectedWorkflows: updatedWorkflows });
  };

  const isWorkflowSelected = (workflow, isEdit = false) => {
    const targetForm = isEdit ? editForm : form;
    const key = toStage(workflow);
    return (targetForm.selectedWorkflows || []).map(toStage).includes(key);
  };

  // ===== UI pieces (cards, same style system) =====
  const SuperAdminFileCard = ({ app, type }) => {
    const navigate = useNavigate();

    const handleViewDetails = () => {
      // Navigate to a detailed view - for now, let's use the existing ApplicationView
      navigate(`/application/${app._id}`);
    };

    return (
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 900, color: "#111827" }}>
            {app?.formId || "—"}
          </div>
          <span className={`tag ${
            type === "pending" ? "tag-pending" :
            type === "approved" ? "tag-approved" : "tag-rejected"
          }`}>
            {type === "pending" ? "Pending" :
             type === "approved" ? "Approved" : "Rejected"}
          </span>
        </div>

        <div style={{ fontSize: 16, fontWeight: 800 }}>
          {app?.applicant?.applicant?.name || app?.applicant?.name || "—"}
        </div>
        <div className="meta">
          Stage: <b style={{ color: "#111" }}>
            {app?.workflowStage || "—"}
          </b>
        </div>

        <div className="row2">
          <div><span className="k">Dealer</span><div className="v">{app?.dealerDetails?.name || "—"}</div></div>
          <div><span className="k">Branch</span><div className="v">{app?.dealerDetails?.branch || "—"}</div></div>
          <div><span className="k">District</span><div className="v">{app?.dealerDetails?.district || "—"}</div></div>
        </div>

        <div className="actions">
          <button
            className="btn btn-primary"
            onClick={handleViewDetails}
          >
            View Details
          </button>
          {type === "rejected" && (
            <button
              className="btn btn-outline"
              onClick={() => handleRevoke(app._id)}
              style={{ marginLeft: 8 }}
            >
              Revoke
            </button>
          )}
        </div>
      </div>
    );
  };

  const AdminCard = ({ a }) => (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 900, color: "#111827" }}>{a?.name || "—"}</div>
        <span className={`tag ${a?.isActive ? "tag-approved" : "tag-rejected"}`}>
          {a?.isActive ? "Active" : "Inactive"}
        </span>
      </div>
      <div className="meta">Email: <b style={{ color: "#111" }}>{a?.email || "—"}</b></div>
      <div className="meta">Role: <b style={{ color: "#111" }}>{a?.role || "—"}</b></div>
      <div className="meta">
        Last Login: <b style={{ color: "#111" }}>
          {a?.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString() : "—"}
        </b>
      </div>
      <div className="actions">
        <button
          className="btn btn-primary"
          onClick={() => toggleActive(a?._id, !a?.isActive)}
          disabled={busy}
        >
          {a?.isActive ? "Deactivate" : "Activate"}
        </button>
        <button
          className="btn btn-outline"
          onClick={() => {
            if (a && a._id) {
              handleEditAdmin(a);
            } else {
              console.error("Cannot edit admin: invalid admin object", a);
            }
          }}
          disabled={busy || !a || !a._id}
          style={{ marginLeft: 8 }}
        >
          Edit
        </button>
        <button
          className="btn"
          onClick={() => handleDeleteAdmin(a?._id)}
          disabled={busy}
          style={{ marginLeft: 8, backgroundColor: "#ef4444", color: "white", borderColor: "#ef4444" }}
        >
          Delete
        </button>
      </div>
    </div>
  );

  const LogCard = ({ r }) => (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 900, color: "#111827" }}>
          {r?.action || "—"}
        </div>
        <span className="tag tag-pending">
          {new Date(r?.at || r?.createdAt || Date.now()).toLocaleString()}
        </span>
      </div>

      <div className="meta">
        Admin: <b style={{ color: "#111" }}>
          {r?.adminId?.name} ({r?.adminId?.email})
        </b>
      </div>

      <div className="row2">
        <div><span className="k">From</span><div className="v">{r?.fromStage || "—"}</div></div>
        <div><span className="k">To</span><div className="v">{r?.toStage || "—"}</div></div>
        <div><span className="k">Application</span><div className="v">{r?.applicationId?._id || r?.applicationId || "—"}</div></div>
      </div>

      {!!r?.notes && (
        <div className="meta" style={{ marginTop: 4 }}>
          Notes: <b style={{ color: "#111" }}>{r.notes}</b>
        </div>
      )}
    </div>
  );

  const SummaryCard = ({ s, onClick }) => (
    <div 
      className="card" 
      onClick={onClick}
      style={{ cursor: "pointer" }}
    >
      <div style={{ fontWeight: 900, color: "#111827", marginBottom: 6 }}>
        {s?.name} <span className="meta">({s?.email})</span>
      </div>
      <div className="row2">
        <div><span className="k">Total</span><div className="v">{s?.totalActions ?? 0}</div></div>
        <div><span className="k">Updates</span><div className="v">{s?.updates ?? 0}</div></div>
        <div><span className="k">Approvals</span><div className="v">{s?.approvals ?? 0}</div></div>
        <div><span className="k">Rejections</span><div className="v">{s?.rejections ?? 0}</div></div>
      </div>
      <div className="meta" style={{ marginTop: 4 }}>
        Last: <b style={{ color: "#111" }}>
          {s?.lastActionAt ? new Date(s.lastActionAt).toLocaleString() : "—"}
        </b>
      </div>
    </div>
  );

  // Which collection to show in the grid for this tab
  const cards =
    tab === "admins" ? admins
    : tab === "recent" ? recent
    : summary;

  return (
    <div className="dash-wrap">
      {/* local styles match your Admin Dashboard */}
      <style>{`
:root{
  --bg-grad: linear-gradient(180deg,#f8fafc 0%, #ffffff 60%);
  --muted: #6b7280;
  --ink: #0f172a;
  --card-ring: 0 12px 32px rgba(15,23,42,.06);
  --glass: rgba(255,255,255,0.8);
  --blue: #2563eb;
  --green: #16a34a;
  --red: #ef4444;
  --amber: #f59e0b;

  --radius-lg: 14px;
  --radius-md: 10px;
  --pad-md: 16px;
  --shadow-soft: 0 8px 20px rgba(12,18,33,0.06);
  --transition: 180ms cubic-bezier(.2,.9,.3,1);
}

/* Page shell */
.dash-wrap{
  min-height: 100vh;
  padding: 24px;
  background: var(--bg-grad);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
  color: var(--ink);
  box-sizing: border-box;
}

/* Top bar */
.dash-bar{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:12px;
  padding:12px 18px;
  border-radius: var(--radius-lg);
  background: linear-gradient(180deg, rgba(255,255,255,0.8), rgba(250,250,250,0.9));
  border: 1px solid rgba(14,20,36,0.04);
  box-shadow: var(--card-ring);
  margin-bottom: 18px;
}

/* segmented controls */
.seg{ display:inline-flex; padding:6px; background: rgba(241,245,249,0.7); border-radius:999px; gap:6px; }
.seg button{
  border:0; background:transparent; padding:8px 14px; border-radius:999px; font-weight:700; color:var(--muted);
  cursor: pointer; transition: all var(--transition);
  letter-spacing: .2px;
}
.seg button.active{
  background: #fff;
  color: var(--ink);
  box-shadow: var(--shadow-soft);
  transform: translateY(-1px);
}

/* counts / badges */
.badge{ display:inline-block; font-size:11px; font-weight:800; padding:4px 8px; border-radius:999px; margin-left:8px; background: #eef2ff; color: var(--blue); }

/* responsive grid */
.grid{
  display:grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 16px;
}
@media (max-width: 992px){ .grid{ grid-template-columns: repeat(6,1fr); } }
@media (max-width: 576px){ .grid{ grid-template-columns: repeat(2,1fr); } }

/* cards */
.card{
  grid-column: span 4;
  background: linear-gradient(180deg, #fff, #fcfdff);
  border: 1px solid rgba(14,20,36,0.04);
  border-radius: var(--radius-lg);
  box-shadow: var(--card-ring);
  padding: var(--pad-md);
  display:flex;
  flex-direction:column;
  gap:10px;
  transition: transform var(--transition), box-shadow var(--transition), border-color var(--transition);
}
.card:hover{
  transform: translateY(-6px);
  box-shadow: 0 16px 40px rgba(15,23,42,0.08);
  border-color: rgba(14,20,36,0.06);
}

/* smaller card variant for inner stat cards */
.card.card-compact{ padding:12px; grid-column: span 3; }

/* meta text */
.meta{ color:var(--muted); font-size:13px; line-height:1.35; }
.row2{ display:flex; gap:12px; flex-wrap:wrap; align-items:center; }
.k{ color:var(--muted); font-weight:700; font-size:12px; }
.v{ color:var(--ink); font-weight:800; font-size:14px; }

/* action buttons */
.actions{ display:flex; justify-content:flex-end; gap:10px; margin-top:8px; }
.btn{
  border:1px solid rgba(14,20,36,0.06);
  background:#fff;
  color:var(--ink);
  padding:8px 12px;
  border-radius: var(--radius-md);
  font-weight:700;
  cursor:pointer;
  transition: all var(--transition);
}
.btn:disabled{ opacity:0.6; cursor:not-allowed; transform:none; }
.btn:hover:not(:disabled){ transform: translateY(-2px); box-shadow: var(--shadow-soft); }

/* primary / outline */
.btn-primary{
  border-color: rgba(37,99,235,0.12);
  background: linear-gradient(180deg, rgba(37,99,235,0.06), rgba(37,99,235,0.02));
  color: var(--blue);
}
.btn-outline{
  background: transparent;
  border-color: rgba(14,20,36,0.06);
}

/* small tags for states */
.tag{ font-size:11px; font-weight:800; padding:4px 8px; border-radius:999px; display:inline-block; }
.tag-pending{ background: #fff7ed; color:#92400e; border:1px solid #fde3bf; }
.tag-approved{ background:#ecfdf5; color:#065f46; border:1px solid #d1fae5; }
.tag-rejected{ background:#fff1f2; color:#7f1d1d; border:1px solid #fecaca; }

/* empty / loading placeholders */
.empty{
  padding:20px;
  border-radius:12px;
  border: 1px dashed rgba(14,20,36,0.06);
  text-align:center;
  background: rgba(255,255,255,0.7);
  color: var(--muted);
  font-weight:700;
}

/* forms */
.form{ display:grid; gap:12px; }
.input{
  border:1px solid rgba(14,20,36,0.06);
  border-radius:10px;
  padding:10px 12px;
  background: #fff;
  font-size:14px;
  outline: none;
  transition: box-shadow var(--transition), border-color var(--transition);
}
.input:focus{ box-shadow: 0 6px 20px rgba(37,99,235,0.06); border-color: rgba(37,99,235,0.25); }

/* label */
.label{ font-size:13px; color:var(--muted); font-weight:700; }

/* checkbox rows */
label > input[type="checkbox"]{
  width:16px; height:16px; accent-color: var(--blue);
}

/* small responsive tweaks */
@media (max-width: 880px){
  .card{ grid-column: span 6; }
  .card.card-compact{ grid-column: span 3; }
}
@media (max-width: 520px){
  .card{ grid-column: span 12; }
  .seg{ display:flex; gap:4px; overflow:auto; padding:4px 6px; }
  .seg button{ padding:6px 10px; font-size:13px; }
}

/* modal */
.modal-overlay{
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 24px;
}
.modal-content{
  background: #fff;
  border-radius: var(--radius-lg);
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  max-width: 900px;
  width: 100%;
  max-height: 90vh;
  padding: 24px;
  overflow-y: auto;
}

/* pulse animation for online dot */
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.2); }
}

/* table styling */
table th {
  position: sticky;
  top: 0;
  background: #fff;
  z-index: 1;
}
      `}</style>

      {/* Top bar */}
      <div className="dash-bar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src={logo} alt="Logo" style={{ height: 40, marginBottom: 4 }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="seg">
            <button className={tab === "admins" ? "active" : ""} onClick={() => setTab("admins")}>
              Admins <span className="badge b-approved">{admins.length}</span>
            </button>
            <button className={tab === "summary" ? "active" : ""} onClick={() => setTab("summary")}>
              Summary <span className="badge b-approved">{summary.length}</span>
            </button>
            <button className={tab === "stats" ? "active" : ""} onClick={() => setTab("stats")}>
              Stats
            </button>
            <button className={tab === "files" ? "active" : ""} onClick={() => setTab("files")}>
              Files
            </button>
            <button className={tab === "dealers" ? "active" : ""} onClick={() => setTab("dealers")}>
              Dealers <span className="badge b-approved">{dealers.length}</span>
            </button>
            <button className={tab === "dealerActivity" ? "active" : ""} onClick={() => setTab("dealerActivity")}>
              Activity
            </button>
          </div>

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
              <div
                ref={menuRef}
                style={{
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
                }}
                role="menu"
                aria-label="Account menu"
              >
                <div style={{ fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>
                  {admin?.name || "Super Admin"}
                </div>
                {admin?.email && (
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>{admin.email}</div>
                )}
                <button
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "none",
                    background: "#ef4444",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {tab === "admins" && (
        <>
          {/* Create Admin */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 900, color: "#111827" }}>Create Admin</div>
            <form className="form" onSubmit={createAdmin}>
              <input
                className="input"
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <input
                className="input"
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
              <div style={{ position: "relative" }}>
                <input
                  className="input"
                  type={showCreatePassword ? "text" : "password"}
                  placeholder="Password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  style={{ paddingRight: "40px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowCreatePassword(!showCreatePassword)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  title={showCreatePassword ? "Hide password" : "Show password"}
                >
                  {showCreatePassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              <select
                className="input"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="admin">Admin</option>
                <option value="superadmin">Super Admin</option>
              </select>

              <div>
                <div className="label">Workflow Access (check to grant access)</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px", marginTop: "8px" }}>
                  {availableWorkflows.map(workflow => (
                    <label key={workflow} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <input
                        type="checkbox"
                        checked={isWorkflowSelected(workflow)}
                        onChange={(e) => handleWorkflowChange(workflow, e.target.checked)}
                      />
                      <span style={{ fontSize: "14px" }}>{stageLabel(workflow)}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="actions">
                <button className="btn btn-primary" disabled={busy}>
                  {busy ? "Please wait…" : "Create"}
                </button>
              </div>
            </form>
          </div>

          {/* Edit Admin Form */}
          {editingAdmin && editingAdmin._id && (
            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 900, color: "#111827", marginBottom: 8 }}>
                Edit Admin: {editingAdmin.name || "—"}
              </div>
              <div style={{ fontSize: "14px", color: "#6b7280", marginBottom: 16 }}>
                <strong>Current Access:</strong> {Array.isArray(editingAdmin.workflows) && editingAdmin.workflows.length > 0 ? editingAdmin.workflows.join(", ") : "None"}
              </div>
              <form className="form" onSubmit={updateAdmin}>
                <input
                  className="input"
                  placeholder="Name"
                  value={editForm.name || ""}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                />
                <input
                  className="input"
                  type="email"
                  placeholder="Email"
                  value={editForm.email || ""}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  required
                />
                <div style={{ position: "relative" }}>
                  <input
                    className="input"
                    type={showEditPassword ? "text" : "password"}
                    placeholder="New Password (leave empty to keep current)"
                    value={editForm.password || ""}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    style={{ paddingRight: "40px" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    title={showEditPassword ? "Hide password" : "Show password"}
                  >
                    {showEditPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                <select
                  className="input"
                  value={editForm.role || "admin"}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                >
                  <option value="admin">Admin</option>
                  <option value="superadmin">Super Admin</option>
                </select>

                <div>
                  <div className="label">Workflow Access (check to grant access)</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px", marginTop: "8px" }}>
                    {availableWorkflows.map(workflow => {
                      const isChecked = isWorkflowSelected(workflow, true);

                      return (
                        <label key={workflow} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => handleWorkflowChange(workflow, e.target.checked, true)}
                          />
                          <span style={{
                            fontSize: "14px",
                            fontWeight: isChecked ? "bold" : "normal",
                            color: isChecked ? "#16a34a" : "#6b7280"
                          }}>
                            {stageLabel(workflow)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="actions">
                  <button className="btn btn-primary" disabled={busy}>
                    {busy ? "Updating…" : "Update"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={cancelEdit}
                    disabled={busy}
                    style={{ marginLeft: 8 }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Admins list */}
          {loadingAdmins ? (
            <div className="empty">Loading admins…</div>
          ) : admins.length === 0 ? (
            <div className="empty">No admins found</div>
          ) : (
            <div className="grid" ref={gridRef}>
              {admins.map((a) => (
                <AdminCard key={a._id} a={a} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Recent tab is commented out */}

      {tab === "summary" && (
        <>
          {/* Form Tracking & Audit History */}
          <FormTrackingAudit />

          {/* Filters */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 900, color: "#111827", marginBottom: 8 }}>
              Summary Filters
            </div>
            <div className="row2">
              <div>
                <div className="label">From</div>
                <input
                  type="date"
                  className="input"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div>
                <div className="label">To</div>
                <input
                  type="date"
                  className="input"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              <div className="actions" style={{ marginLeft: "auto" }}>
                <button className="btn btn-primary" onClick={fetchSummary} disabled={loadingSummary}>
                  {loadingSummary ? "Refreshing…" : "Refresh"}
                </button>
              </div>
            </div>
          </div>

          {/* Summary cards */}
          {loadingSummary ? (
            <div className="empty">Loading summary…</div>
          ) : summary.length === 0 ? (
            <div className="empty">No summary data</div>
          ) : (
            <div className="grid" ref={gridRef}>
              {summary.map((s) => (
                <SummaryCard 
                  key={String(s.adminId)} 
                  s={s}
                  onClick={() => {
                    setSelectedAdmin(s);
                    fetchAdminActivity(s.adminId);
                  }}
                />
              ))}
            </div>
          )}

          {/* Admin Activity Modal */}
          {selectedAdmin && (
            <div 
              className="modal-overlay"
              onClick={(e) => {
                if (e.target.classList.contains("modal-overlay")) {
                  setSelectedAdmin(null);
                  setAdminActivity({ files: [], totalActions: 0, admin: null });
                }
              }}
            >
              <div className="modal-content">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <div>
                    <h2 style={{ margin: 0, color: "#111827" }}>
                      {selectedAdmin.name} - Activity History
                    </h2>
                    <div className="meta" style={{ marginTop: 4 }}>
                      {selectedAdmin.email} • Total Actions: {adminActivity.totalActions}
                    </div>
                  </div>
                  <button
                    className="btn btn-outline"
                    onClick={() => {
                      setSelectedAdmin(null);
                      setAdminActivity({ files: [], totalActions: 0, admin: null });
                    }}
                    style={{ padding: "8px 16px" }}
                  >
                    ✕ Close
                  </button>
                </div>

                {loadingAdminActivity ? (
                  <div className="empty">Loading activity…</div>
                ) : adminActivity.files.length === 0 ? (
                  <div className="empty">No activity found for this admin</div>
                ) : (
                  <div style={{ maxHeight: "70vh", overflowY: "auto" }}>
                    {adminActivity.files.map((file, idx) => (
                      <div key={idx} className="card" style={{ marginBottom: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <div style={{ fontWeight: 900, color: "#111827" }}>
                            Form ID: {file.formId}
                          </div>
                          <span className={`tag ${
                            file.status === "approved" ? "tag-approved" :
                            file.status === "rejected" ? "tag-rejected" : "tag-pending"
                          }`}>
                            {file.status || "Pending"}
                          </span>
                        </div>
                        <div className="meta" style={{ marginBottom: 8 }}>
                          Applicant: <b style={{ color: "#111" }}>{file.applicant}</b>
                        </div>
                        <div className="meta" style={{ marginBottom: 12 }}>
                          Stage: <b style={{ color: "#111" }}>{file.workflowStage}</b>
                        </div>
                        <div style={{ borderTop: "1px solid rgba(14,20,36,0.06)", paddingTop: 12 }}>
                          <div className="label" style={{ marginBottom: 8 }}>Actions on this file:</div>
                          {file.actions.map((action, actionIdx) => (
                            <div 
                              key={actionIdx} 
                              style={{ 
                                padding: "8px 12px", 
                                marginBottom: 8, 
                                background: "rgba(241,245,249,0.5)",
                                borderRadius: 8,
                                borderLeft: `3px solid ${
                                  action.action === "APPROVE" ? "#16a34a" :
                                  action.action === "REJECT" ? "#ef4444" :
                                  action.action === "UPDATE_STAGE" ? "#2563eb" : "#6b7280"
                                }`
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                <span style={{ 
                                  fontWeight: 700, 
                                  color: action.action === "APPROVE" ? "#16a34a" :
                                         action.action === "REJECT" ? "#ef4444" :
                                         action.action === "UPDATE_STAGE" ? "#2563eb" : "#6b7280"
                                }}>
                                  {action.action === "APPROVE" ? " Approved" :
                                   action.action === "REJECT" ? " Rejected" :
                                   action.action === "UPDATE_STAGE" ? " Updated" :
                                   action.action === "EDIT_FIELDS" ? " Edited" : action.action}
                                </span>
                                <span className="meta" style={{ fontSize: 11 }}>
                                  {new Date(action.at).toLocaleString()}
                                </span>
                              </div>
                              {action.fromStage && action.toStage && (
                                <div className="meta" style={{ fontSize: 12 }}>
                                  {action.fromStage} → {action.toStage}
                                </div>
                              )}
                              {action.notes && (
                                <div className="meta" style={{ fontSize: 12, marginTop: 4 }}>
                                  Notes: {action.notes}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {tab === "stats" && (
        <StatsDashboard
          fetchAllFiles={fetchAllFiles}
          setTab={setTab}
          setFilesTab={setFilesTab}
        />
      )}

      {tab === "files" && (
        <FilesManagementTable
          allFiles={allFiles}
          loadingFiles={loadingFiles}
          filesTab={filesTab}
          setFilesTab={setFilesTab}
          fetchAllFiles={fetchAllFiles}
          stats={stats}
          onViewDetails={(app) => navigate(`/application/${app._id}`)}
          onRevoke={handleRevoke}
          busy={busy}
          fetchAllFilesAll={fetchAllFilesAll}
        />
      )}

      {tab === "dealers" && (
        <>
          {/* ── Create / Edit Dealer Forms (unchanged) ── */}
          {/* Mode Toggle */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", gap: "8px", marginBottom: 16 }}>
              <button
                className={`btn ${bulkCreateMode === "single" ? "btn-primary" : "btn-outline"}`}
                onClick={() => setBulkCreateMode("single")}
              >
                Single Create
              </button>
              <button
                className={`btn ${bulkCreateMode === "bulk" ? "btn-primary" : "btn-outline"}`}
                onClick={() => setBulkCreateMode("bulk")}
              >
                Bulk Create
              </button>
            </div>

            {/* Single Create Form */}
            {bulkCreateMode === "single" && (
              <form className="form" onSubmit={createDealer}>
                <div style={{ fontWeight: 900, color: "#111827", marginBottom: 8 }}>Create Dealer</div>
                <input
                  className="input"
                  type="email"
                  placeholder="Email *"
                  value={dealerForm.email}
                  onChange={(e) => setDealerForm({ ...dealerForm, email: e.target.value })}
                  required
                />
                <div style={{ position: "relative" }}>
                  <input
                    className="input"
                    type={showDealerPassword ? "text" : "password"}
                    placeholder="Password *"
                    value={dealerForm.password}
                    onChange={(e) => setDealerForm({ ...dealerForm, password: e.target.value })}
                    required
                    style={{ paddingRight: "40px" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowDealerPassword(!showDealerPassword)}
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    title={showDealerPassword ? "Hide password" : "Show password"}
                  >
                    {showDealerPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                <input
                  className="input"
                  placeholder="User ID"
                  value={dealerForm.UserId}
                  onChange={(e) => setDealerForm({ ...dealerForm, UserId: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="Name"
                  value={dealerForm.name}
                  onChange={(e) => setDealerForm({ ...dealerForm, name: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="District"
                  value={dealerForm.District}
                  onChange={(e) => setDealerForm({ ...dealerForm, District: e.target.value })}
                />
                <select
                  className="input"
                  ref={branchSelectRef}
                  value={dealerForm.Branch}
                  onChange={(e) => {
                    // "+ Add Branch" opens the popup instead of selecting a value
                    if (e.target.value === ADD_BRANCH_OPTION) {
                      openAddBranch();
                      return;
                    }
                    setDealerForm({ ...dealerForm, Branch: e.target.value });
                  }}
                >
                  <option value="">Select Branch</option>
                  {branchOptions.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                  <option value={ADD_BRANCH_OPTION}>+ Add Branch</option>
                </select>
                <input
                  className="input"
                  placeholder="Dealer Mobile Number"
                  value={dealerForm.mobileNumber}
                  onChange={(e) => setDealerForm({ ...dealerForm, mobileNumber: e.target.value })}
                />
                <div className="actions">
                  <button className="btn btn-primary" disabled={busy}>
                    {busy ? "Creating…" : "Create Dealer"}
                  </button>
                </div>
              </form>
            )}

            {/* Add Branch Modal */}
            {showAddBranch && (
              <div
                className="modal-overlay"
                onClick={(e) => {
                  if (e.target.classList.contains("modal-overlay")) closeAddBranch();
                }}
              >
                <div
                  className="modal-content"
                  style={{ maxWidth: 420 }}
                  ref={branchModalRef}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="add-branch-title"
                >
                  <h2 id="add-branch-title" style={{ margin: "0 0 16px", color: "#111827", fontSize: 20 }}>
                    Add New Branch
                  </h2>
                  <form onSubmit={submitNewBranch}>
                    <label
                      style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#374151", marginBottom: 6 }}
                    >
                      Branch Name <span style={{ color: "#EF4444" }}>*</span>
                    </label>
                    <input
                      className="input"
                      ref={branchInputRef}
                      aria-label="Branch Name"
                      value={newBranchName}
                      onChange={(e) => {
                        setNewBranchName(e.target.value);
                        if (branchError) setBranchError("");
                      }}
                      placeholder="Enter branch name"
                    />
                    {branchError && (
                      <div style={{ color: "#EF4444", fontSize: 13, marginTop: 8 }}>
                        {branchError}
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={closeAddBranch}
                        disabled={savingBranch}
                      >
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-primary" disabled={savingBranch}>
                        {savingBranch ? "Adding…" : "Add"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Toast notification */}
            {toast && (
              <div
                role="status"
                aria-live="polite"
                style={{
                  position: "fixed",
                  bottom: 24,
                  right: 24,
                  zIndex: 11000,
                  minWidth: 240,
                  maxWidth: 360,
                  padding: "12px 16px",
                  borderRadius: 10,
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
                  background: toast.type === "error" ? "#EF4444" : "#16A34A",
                }}
                onClick={() => setToast(null)}
              >
                {toast.message}
              </div>
            )}

            {/* Bulk Create Form */}
            {bulkCreateMode === "bulk" && (
              <div>
                <div className="card" style={{ marginBottom: 14 }}>
                  <div style={{ fontWeight: 900, color: "#111827", marginBottom: 12 }}>Bulk Create Dealers</div>
                  
                  {/* Upload Mode Tabs */}
                  <div style={{ display: "flex", gap: "10px", marginBottom: 16 }}>
                    {/* <button
                      type="button"
                      className={`btn ${bulkUploadMode === "text" ? "btn-primary" : "btn-outline"}`}
                      onClick={() => setBulkUploadMode("text")}
                    >
                      Text Input
                    </button> */}
                    <button
                      type="button"
                      className={`btn ${bulkUploadMode === "excel" ? "btn-primary" : "btn-outline"}`}
                      onClick={() => setBulkUploadMode("excel")}
                    >
                      Excel Upload
                    </button>
                  </div>

                  {/* Text Input Mode */}
                  {/* {bulkUploadMode === "text" && (
                    <div>
                      <div className="label" style={{ marginBottom: 8 }}>
                        Format: email,password,UserId,name,District,Branch,Contact (one per line)
                      </div>
                      <div className="label" style={{ fontSize: "12px", color: "#666", marginBottom: 12 }}>
                        💡 Leave UserId empty to auto-generate (e.g., USER001000, USER001001...)
                      </div>
                      <textarea
                        className="input"
                        placeholder={`dealer1@example.com,password123,,Dealer Name,District,Branch,1234567890\ndealer2@example.com,password456,,Another Dealer,Another Dist,Branch2,9876543210`}
                        value={bulkDealersText}
                        onChange={(e) => setBulkDealersText(e.target.value)}
                        rows={10}
                        style={{ fontFamily: "monospace", fontSize: "13px", marginBottom: 12 }}
                      />
                      <div style={{ display: "flex", gap: "10px" }}>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={generateIdsFromText}
                          disabled={!bulkDealersText.trim()}
                        >
                          Generate IDs & Preview
                        </button>
                      </div>
                    </div>
                  )} */}

                  {/* Excel Upload Mode */}
                  {bulkUploadMode === "excel" && (
                    <div>
                      <div className="label" style={{ marginBottom: 8 }}>
                        Upload Excel file with columns: email, password, name, District, Branch, Contact, UserId (optional)
                      </div>
                      <div className="label" style={{ fontSize: "12px", color: "#666", marginBottom: 12 }}>
                        📋 UserId will be auto-generated if not provided in the Excel file
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleExcelUpload}
                          accept=".xlsx,.xls,.csv"
                          style={{
                            padding: "10px",
                            border: "1px solid #ddd",
                            borderRadius: "4px",
                            cursor: "pointer",
                            display: "block",
                            width: "100%"
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Data Preview */}
                  {bulkDealersData.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontWeight: 700, color: "#111827", marginBottom: 8 }}>
                        Preview ({bulkDealersData.length} records):
                      </div>
                      <div style={{
                        maxHeight: "300px",
                        overflowY: "auto",
                        border: "1px solid #e5e7eb",
                        borderRadius: "4px",
                        marginBottom: 12
                      }}>
                        <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
                          <thead style={{ position: "sticky", top: 0, backgroundColor: "#f3f4f6" }}>
                            <tr>
                              <th style={{ padding: "8px", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>#</th>
                              <th style={{ padding: "8px", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Email</th>
                              <th style={{ padding: "8px", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>UserId</th>
                              <th style={{ padding: "8px", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Name</th>
                              <th style={{ padding: "8px", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>District</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bulkDealersData.map((dealer, idx) => (
                              <tr key={idx} style={{ borderBottom: "1px solid #f3f4f6" }}>
                                <td style={{ padding: "8px" }}>{idx + 1}</td>
                                <td style={{ padding: "8px" }}>{dealer.email}</td>
                                <td style={{ padding: "8px", fontWeight: 600 }}>{dealer.UserId}</td>
                                <td style={{ padding: "8px" }}>{dealer.name || "—"}</td>
                                <td style={{ padding: "8px" }}>{dealer.District || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div style={{ display: "flex", gap: "10px" }}>
                        <button
                          className="btn btn-primary"
                          onClick={bulkCreateDealers}
                          disabled={busy || bulkDealersData.length === 0}
                        >
                          {busy ? "Creating…" : `Create ${bulkDealersData.length} Dealers`}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => {
                            setBulkDealersData([]);
                            // setBulkDealersText("");
                            setNextUserId(1000);
                          }}
                          disabled={busy}
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  )}

                  {bulkDealersData.length === 0 && (
                    <div style={{ textAlign: "center", padding: "20px", color: "#999" }}>
                      {bulkUploadMode === "text" 
                        ? ""
                        : "Upload an Excel file to preview records"
                      }
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Edit Dealer Form */}
          {editingDealer && editingDealer._id && (
            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 900, color: "#111827", marginBottom: 8 }}>
                Edit Dealer: {editingDealer.name || editingDealer.email || "—"}
              </div>
              <form className="form" onSubmit={updateDealer}>
                <input
                  className="input"
                  type="email"
                  placeholder="Email *"
                  value={editDealerForm.email || ""}
                  onChange={(e) => setEditDealerForm({ ...editDealerForm, email: e.target.value })}
                  required
                />
                <div style={{ position: "relative" }}>
                  <input
                    className="input"
                    type={showEditDealerPassword ? "text" : "password"}
                    placeholder="New Password (leave empty to keep current)"
                    value={editDealerForm.password || ""}
                    onChange={(e) => setEditDealerForm({ ...editDealerForm, password: e.target.value })}
                    style={{ paddingRight: "40px" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditDealerPassword(!showEditDealerPassword)}
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    title={showEditDealerPassword ? "Hide password" : "Show password"}
                  >
                    {showEditDealerPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                <input
                  className="input"
                  placeholder="User ID"
                  value={editDealerForm.UserId || ""}
                  onChange={(e) => setEditDealerForm({ ...editDealerForm, UserId: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="Name"
                  value={editDealerForm.name || ""}
                  onChange={(e) => setEditDealerForm({ ...editDealerForm, name: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="District"
                  value={editDealerForm.District || ""}
                  onChange={(e) => setEditDealerForm({ ...editDealerForm, District: e.target.value })}
                />
                <select
                  className="input"
                  value={editDealerForm.Branch || ""}
                  onChange={(e) => setEditDealerForm({ ...editDealerForm, Branch: e.target.value })}
                >
                  <option value="">Select Branch</option>
                  {branchOptions.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
                <input
                  className="input"
                  placeholder="Dealer Mobile Number"
                  value={editDealerForm.mobileNumber || ""}
                  onChange={(e) => setEditDealerForm({ ...editDealerForm, mobileNumber: e.target.value })}
                />
                <div className="actions">
                  <button className="btn btn-primary" disabled={busy}>
                    {busy ? "Updating…" : "Update Dealer"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={cancelEditDealer}
                    disabled={busy}
                    style={{ marginLeft: 8 }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── Data Table ── */}
          <DealerManagementTable
            dealers={dealers}
            loading={loadingDealers}
            busy={busy}
            branchOptions={branchOptions}
            onEdit={handleEditDealer}
            onToggle={toggleDealerActive}
            onDelete={handleDeleteDealer}
            onBulkToggle={handleBulkToggleDealers}
            onBulkDelete={handleBulkDeleteDealers}
          />
        </>
      )}

      {tab === "dealerActivity" && (
        <>
          {/* Activity Stats Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: 18 }}>
            <div
              className="card"
              style={{ textAlign: "center", cursor: "pointer", border: dealerActivityFilter === "all" ? "2px solid #2563eb" : undefined }}
              onClick={() => setDealerActivityFilter("all")}
            >
              <div style={{ fontSize: "2rem", fontWeight: "bold", color: "#2563eb", marginBottom: 4 }}>
                {dealerActivityStats.total}
              </div>
              <div style={{ fontWeight: "600", color: "#111827" }}>Total Dealers</div>
            </div>
            <div
              className="card"
              style={{ textAlign: "center", cursor: "pointer", border: dealerActivityFilter === "online" ? "2px solid #16a34a" : undefined }}
              onClick={() => setDealerActivityFilter("online")}
            >
              <div style={{ fontSize: "2rem", fontWeight: "bold", color: "#16a34a", marginBottom: 4 }}>
                {dealerActivityStats.online}
              </div>
              <div style={{ fontWeight: "600", color: "#111827" }}>Online Now</div>
            </div>
            <div
              className="card"
              style={{ textAlign: "center", cursor: "pointer", border: dealerActivityFilter === "offline" ? "2px solid #6b7280" : undefined }}
              onClick={() => setDealerActivityFilter("offline")}
            >
              <div style={{ fontSize: "2rem", fontWeight: "bold", color: "#6b7280", marginBottom: 4 }}>
                {dealerActivityStats.offline}
              </div>
              <div style={{ fontWeight: "600", color: "#111827" }}>Offline</div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ fontWeight: 900, color: "#111827", flex: 1 }}>Dealer Login Activity</div>
              <button
                className="btn btn-outline"
                onClick={() => fetchDealerActivity(dealerActivitySearchDebounced, dealerActivityFilter)}
                disabled={loadingDealerActivity}
                style={{ fontSize: 13 }}
              >
                {loadingDealerActivity ? "Refreshing…" : "↻ Refresh"}
              </button>
            </div>
            <input
              className="input"
              type="text"
              placeholder="🔍 Search by Name, Email, User ID, Mobile, or Branch..."
              value={dealerActivitySearch}
              onChange={(e) => setDealerActivitySearch(e.target.value)}
              style={{ width: "100%", padding: "12px 16px", borderRadius: 12, fontSize: 14, fontWeight: 500 }}
            />
            <div className="meta" style={{ marginTop: 8, fontSize: 11 }}>
              Auto-refreshes every 30 seconds • Online = active in last 5 minutes
            </div>
          </div>

          {/* Activity Table */}
          {loadingDealerActivity ? (
            <div className="empty">Loading dealer activity…</div>
          ) : dealerActivity.length === 0 ? (
            <div className="empty">No dealers found</div>
          ) : (
            <div className="card" style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid rgba(14,20,36,0.08)" }}>
                    <th style={{ padding: "12px 14px", textAlign: "left", fontWeight: 800, color: "#111827", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>Status</th>
                    <th style={{ padding: "12px 14px", textAlign: "left", fontWeight: 800, color: "#111827", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>Dealer</th>
                    <th style={{ padding: "12px 14px", textAlign: "left", fontWeight: 800, color: "#111827", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>User ID</th>
                    <th style={{ padding: "12px 14px", textAlign: "left", fontWeight: 800, color: "#111827", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>Branch</th>
                    <th style={{ padding: "12px 14px", textAlign: "left", fontWeight: 800, color: "#111827", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>Mobile</th>
                    <th style={{ padding: "12px 14px", textAlign: "left", fontWeight: 800, color: "#111827", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>Last Login</th>
                    <th style={{ padding: "12px 14px", textAlign: "left", fontWeight: 800, color: "#111827", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>Last Active</th>
                    <th style={{ padding: "12px 14px", textAlign: "left", fontWeight: 800, color: "#111827", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>Account</th>
                  </tr>
                </thead>
                <tbody>
                  {dealerActivity.map((dealer) => {
                    const timeAgo = (date) => {
                      if (!date) return "Never";
                      const diff = Date.now() - new Date(date).getTime();
                      const mins = Math.floor(diff / 60000);
                      if (mins < 1) return "Just now";
                      if (mins < 60) return `${mins}m ago`;
                      const hrs = Math.floor(mins / 60);
                      if (hrs < 24) return `${hrs}h ago`;
                      const days = Math.floor(hrs / 24);
                      if (days < 7) return `${days}d ago`;
                      return new Date(date).toLocaleDateString();
                    };

                    return (
                      <tr
                        key={dealer._id}
                        style={{
                          borderBottom: "1px solid rgba(14,20,36,0.04)",
                          transition: "background var(--transition)",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(241,245,249,0.5)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        {/* Status dot */}
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: "50%",
                                background: dealer.isOnline ? "#16a34a" : "#d1d5db",
                                boxShadow: dealer.isOnline ? "0 0 8px rgba(22,163,74,0.5)" : "none",
                                animation: dealer.isOnline ? "pulse 2s ease-in-out infinite" : "none",
                              }}
                            />
                            <span style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: dealer.isOnline ? "#16a34a" : "#9ca3af",
                            }}>
                              {dealer.isOnline ? "Online" : "Offline"}
                            </span>
                          </div>
                        </td>

                        {/* Dealer Info */}
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ fontWeight: 700, color: "#111827" }}>{dealer.name || "—"}</div>
                          <div style={{ fontSize: 12, color: "#6b7280" }}>{dealer.email}</div>
                        </td>

                        {/* User ID */}
                        <td style={{ padding: "12px 14px" }}>
                          <span style={{ fontWeight: 700, color: "#2563eb", fontSize: 12 }}>
                            {dealer.UserId || "—"}
                          </span>
                        </td>

                        {/* Branch */}
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ fontWeight: 600 }}>{dealer.Branch || "—"}</div>
                          {dealer.District && (
                            <div style={{ fontSize: 11, color: "#6b7280" }}>{dealer.District}</div>
                          )}
                        </td>

                        {/* Mobile */}
                        <td style={{ padding: "12px 14px", fontSize: 13 }}>
                          {dealer.mobileNumber || "—"}
                        </td>

                        {/* Last Login */}
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>
                            {dealer.lastLoginAt ? timeAgo(dealer.lastLoginAt) : "Never"}
                          </div>
                          {dealer.lastLoginAt && (
                            <div style={{ fontSize: 11, color: "#6b7280" }}>
                              {new Date(dealer.lastLoginAt).toLocaleString()}
                            </div>
                          )}
                        </td>

                        {/* Last Active */}
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>
                            {dealer.lastActive ? timeAgo(dealer.lastActive) : "Never"}
                          </div>
                          {dealer.lastActive && (
                            <div style={{ fontSize: 11, color: "#6b7280" }}>
                              {new Date(dealer.lastActive).toLocaleString()}
                            </div>
                          )}
                        </td>

                        {/* Account Status */}
                        <td style={{ padding: "12px 14px" }}>
                          <span className={`tag ${dealer.isActive !== false ? "tag-approved" : "tag-rejected"}`}>
                            {dealer.isActive !== false ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
