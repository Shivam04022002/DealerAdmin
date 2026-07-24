// src/components/FilesManagementTable.jsx
import React, {
  useMemo,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from "@tanstack/react-table";
import { exportApplicationsToExcel, exportAllToExcel } from "../utils/exportApplications";

/* ─── Brand colours (Surjit Finance) ─────────────────────────────────── */
const BRAND = {
  blue:   "#0B1F4D",
  orange: "#F59E0B",
  green:  "#16A34A",
  red:    "#EF4444",
  bg:     "#F8FAFC",
};

/* ─── Helper: accessors ───────────────────────────────────────────────── */
const getApplicantName = (app) =>
  app?.applicant?.applicant?.name || app?.applicant?.name || "—";
const getDealerName = (app) =>
  app?.dealerDetails?.name || app?.dealer?.name || "—";
const getDealerBranch = (app) =>
  app?.dealerDetails?.branch || app?.dealerDetails?.Branch || app?.dealer?.branch || "—";
const getDealerDistrict = (app) =>
  app?.dealerDetails?.district || app?.dealerDetails?.District || app?.dealer?.district || "—";
const getStage = (app) => app?.workflowStage || "—";
// Original dealer submission date. The record createdAt is re-stamped at approval,
// so read the submission timestamp preserved on the embedded applicant sub-document
// (canonical), then vehicle-details, then the record createdAt (pending/fixed records).
const getCreatedTs = (app) =>
  app?.applicant?.createdAt ||
  app?.applicant?.applicant?.createdAt ||
  app?.vehicleDetails?.createdAt ||
  app?.createdAt ||
  "";
const fmtDate = (v) => {
  if (!v) return "—";
  try { return new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return "—"; }
};

/* ─── Status badge ────────────────────────────────────────────────────── */
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
    }}>
      {c.label}
    </span>
  );
}

/* ─── Sort icon ───────────────────────────────────────────────────────── */
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

/* ─── Main Component ──────────────────────────────────────────────────── */
export default function FilesManagementTable({
  allFiles,
  loadingFiles,
  filesTab,
  setFilesTab,
  fetchAllFiles,
  stats,
  onViewDetails,
  onRevoke,
  busy,
  fetchAllFilesAll,          // callback to get {pending, approved, rejected} for export-all
}) {
  /* ── local filter state ── */
  const [globalSearch, setGlobalSearch]     = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [filterStatus,  setFilterStatus]    = useState("all");
  const [filterBranch,  setFilterBranch]    = useState("");
  const [filterDistrict, setFilterDistrict] = useState("");
  const [filterStage,   setFilterStage]     = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo,   setFilterDateTo]   = useState("");

  /* ── selection ── */
  const [rowSelection, setRowSelection] = useState({});

  /* ── export ── */
  const [exporting, setExporting] = useState({
    pending: false, approved: false, rejected: false, all: false, selected: false,
  });

  /* ── bulk action confirm ── */
  const [bulkConfirm, setBulkConfirm] = useState(null); // "approve" | "reject" | null

  /* debounce search */
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(globalSearch), 250);
    return () => clearTimeout(t);
  }, [globalSearch]);

  /* reset selection on tab change */
  useEffect(() => { setRowSelection({}); }, [filesTab]);

  /* ── derive unique filter options from current data ── */
  const branchOptions = useMemo(() =>
    [...new Set(allFiles.map((a) => getDealerBranch(a)).filter((v) => v !== "—"))].sort(),
  [allFiles]);

  const districtOptions = useMemo(() =>
    [...new Set(allFiles.map((a) => getDealerDistrict(a)).filter((v) => v !== "—"))].sort(),
  [allFiles]);

  const stageOptions = useMemo(() =>
    [...new Set(allFiles.map((a) => getStage(a)).filter((v) => v !== "—"))].sort(),
  [allFiles]);

  /* ── filtered data ── */
  const filteredData = useMemo(() => {
    let data = allFiles;

    if (searchDebounced) {
      const q = searchDebounced.toLowerCase();
      data = data.filter((a) =>
        (a?.formId || "").toLowerCase().includes(q) ||
        getApplicantName(a).toLowerCase().includes(q) ||
        getDealerName(a).toLowerCase().includes(q)
      );
    }
    if (filterBranch)   data = data.filter((a) => getDealerBranch(a)   === filterBranch);
    if (filterDistrict) data = data.filter((a) => getDealerDistrict(a) === filterDistrict);
    if (filterStage)    data = data.filter((a) => getStage(a)           === filterStage);
    if (filterDateFrom) {
      const from = new Date(filterDateFrom); from.setHours(0,0,0,0);
      data = data.filter((a) => a?.createdAt && new Date(a.createdAt) >= from);
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo); to.setHours(23,59,59,999);
      data = data.filter((a) => a?.createdAt && new Date(a.createdAt) <= to);
    }

    return data;
  }, [allFiles, searchDebounced, filterBranch, filterDistrict, filterStage, filterDateFrom, filterDateTo]);

  /* ── summary counts (for KPI cards) ── */
  const totalCount    = (stats?.pending || 0) + (stats?.approved || 0) + (stats?.rejected || 0);
  const pendingCount  = stats?.pending  || 0;
  const approvedCount = stats?.approved || 0;
  const rejectedCount = stats?.rejected || 0;

  /* ── selected rows helper ──
     Selection is keyed by application id (see getRowId below), so we resolve
     against the full dataset — not the filtered/paged view. A selected row that
     is currently filtered out therefore stays counted and stays part of bulk
     actions, and reappears selected when it becomes visible again. */
  const selectedRows = useMemo(() => {
    const byId = new Map((allFiles || []).map((a) => [a._id || a.formId, a]));
    return Object.keys(rowSelection)
      .filter((k) => rowSelection[k])
      .map((k) => byId.get(k))
      .filter(Boolean);
  }, [rowSelection, allFiles]);

  /* ── column definitions ── */
  const columns = useMemo(() => [
    {
      id: "select",
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
          style={{ width: 15, height: 15, accentColor: BRAND.blue, cursor: "pointer" }}
          title="Select all on this page"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          style={{ width: 15, height: 15, accentColor: BRAND.blue, cursor: "pointer" }}
        />
      ),
      enableSorting: false,
      size: 42,
    },
    {
      accessorKey: "formId",
      header: "App ID",
      cell: (info) => (
        <span style={{ fontWeight: 700, color: BRAND.blue, fontSize: 12 }}>
          {info.getValue() || "—"}
        </span>
      ),
      size: 120,
    },
    {
      id: "applicantName",
      header: "Customer Name",
      accessorFn: getApplicantName,
      size: 160,
      cell: (info) => <span style={{ fontWeight: 600 }}>{info.getValue()}</span>,
    },
    {
      id: "dealerName",
      header: "Dealer Name",
      accessorFn: getDealerName,
      size: 150,
    },
    {
      id: "branch",
      header: "Branch",
      accessorFn: getDealerBranch,
      size: 120,
    },
    {
      id: "district",
      header: "District",
      accessorFn: getDealerDistrict,
      size: 120,
    },
    {
      id: "stage",
      header: "Stage",
      accessorFn: getStage,
      size: 160,
      cell: (info) => (
        <span style={{
          display: "inline-block", padding: "2px 8px", borderRadius: 6,
          fontSize: 11, fontWeight: 700, background: "#EFF6FF", color: BRAND.blue,
          border: "1px solid #BFDBFE", textTransform: "capitalize",
        }}>
          {info.getValue()}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (row) => filesTab,
      enableSorting: false,
      size: 100,
      cell: (info) => <StatusBadge status={filesTab} />,
    },
    {
      id: "createdAt",
      header: "Created",
      accessorFn: (row) => getCreatedTs(row),
      sortingFn: "datetime",
      size: 110,
      cell: (info) => (
        <span style={{ fontSize: 12, color: "#6B7280" }}>{fmtDate(info.getValue())}</span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      size: filesTab === "rejected" ? 170 : 110,
      cell: ({ row }) => {
        const app = row.original;
        return (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button
              onClick={() => onViewDetails(app)}
              style={{
                padding: "5px 11px", borderRadius: 7, fontSize: 12, fontWeight: 700,
                background: "linear-gradient(180deg,rgba(37,99,235,0.09),rgba(37,99,235,0.04))",
                border: "1px solid rgba(37,99,235,0.2)", color: BRAND.blue, cursor: "pointer",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(37,99,235,0.12)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "linear-gradient(180deg,rgba(37,99,235,0.09),rgba(37,99,235,0.04))"; e.currentTarget.style.transform = "none"; }}
            >
              View Details
            </button>
            {filesTab === "rejected" && (
              <button
                onClick={() => onRevoke(app._id)}
                disabled={busy}
                style={{
                  padding: "5px 11px", borderRadius: 7, fontSize: 12, fontWeight: 700,
                  background: "transparent", border: "1px solid rgba(14,20,36,0.1)",
                  color: "#374151", cursor: busy ? "not-allowed" : "pointer",
                  transition: "all 0.15s ease", whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => { if (!busy) { e.currentTarget.style.background = "#F1F5F9"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.transform = "none"; }}
              >
                Revoke
              </button>
            )}
          </div>
        );
      },
    },
  ], [filesTab, onViewDetails, onRevoke, busy]);

  /* ── table instance ── */
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

  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = table.getPageCount();
  const totalFiltered = filteredData.length;

  /* ── Rows for current page ── */
  const pageRows = table.getRowModel().rows;
  const tableBodyRef = useRef(null);

  /* ── export handlers ── */
  const handleExport = useCallback(async (type) => {
    setExporting((p) => ({ ...p, [type]: true }));
    try {
      if (type === "selected") {
        if (!selectedRows.length) { alert("No rows selected."); return; }
        exportApplicationsToExcel(selectedRows, filesTab);
      } else if (type === "all") {
        if (!fetchAllFilesAll) { alert("Export all not available."); return; }
        const { pending, approved, rejected } = await fetchAllFilesAll();
        exportAllToExcel(pending, approved, rejected);
      } else {
        if (!fetchAllFilesAll) { alert("Export not available."); return; }
        const allData = await fetchAllFilesAll();
        exportApplicationsToExcel(allData[type] || [], type);
      }
    } catch (err) {
      alert("Export failed: " + err.message);
    } finally {
      setExporting((p) => ({ ...p, [type]: false }));
    }
  }, [selectedRows, filesTab, fetchAllFilesAll]);

  /* ── bulk actions ── */
  const handleBulkAction = useCallback((action) => {
    if (!selectedRows.length) { alert("Please select at least one row."); return; }
    setBulkConfirm(action);
  }, [selectedRows]);

  const clearFilters = () => {
    setGlobalSearch(""); setFilterBranch(""); setFilterDistrict("");
    setFilterStage(""); setFilterDateFrom(""); setFilterDateTo("");
  };
  const hasActiveFilters = globalSearch || filterBranch || filterDistrict || filterStage || filterDateFrom || filterDateTo;

  /* ── Page options for selector ── */
  const pageOptions = Array.from({ length: pageCount }, (_, i) => i);

  /* ══════════════════ RENDER ══════════════════ */
  return (
    <div style={{ fontFamily: "Inter,ui-sans-serif,system-ui,-apple-system,sans-serif" }}>
      <style>{`
        .fmt-th-sort { cursor: pointer; user-select: none; }
        .fmt-th-sort:hover { background: rgba(11,31,77,0.04) !important; }
        .fmt-row:hover td { background: rgba(241,245,249,0.7) !important; }
        .fmt-row td { transition: background 0.12s; }
        .fmt-input {
          border: 1.5px solid #E5E7EB; border-radius: 10px; padding: 8px 12px;
          font-size: 13px; font-weight: 500; background: #fff; outline: none;
          transition: border-color 0.15s, box-shadow 0.15s; color: #111827;
        }
        .fmt-input:focus { border-color: ${BRAND.blue}; box-shadow: 0 0 0 3px rgba(11,31,77,0.08); }
        .fmt-select {
          border: 1.5px solid #E5E7EB; border-radius: 10px; padding: 7px 10px;
          font-size: 13px; font-weight: 500; background: #fff; outline: none;
          cursor: pointer; color: #374151; transition: border-color 0.15s;
        }
        .fmt-select:focus { border-color: ${BRAND.blue}; }
        .fmt-btn {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 7px 14px; border-radius: 9px; font-size: 13px; font-weight: 700;
          cursor: pointer; border: 1.5px solid transparent;
          transition: opacity 0.15s, transform 0.15s, box-shadow 0.15s;
          white-space: nowrap;
        }
        .fmt-btn:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
        .fmt-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .fmt-btn-primary { background: ${BRAND.blue}; color: #fff; border-color: ${BRAND.blue}; }
        .fmt-btn-ghost { background: #fff; color: #374151; border-color: #E5E7EB; }
        .fmt-btn-ghost:hover:not(:disabled) { background: #F8FAFC; }
        .fmt-btn-danger { background: #FFF1F2; color: #7F1D1D; border-color: #FECACA; }
        .fmt-btn-success { background: #ECFDF5; color: #065F46; border-color: #D1FAE5; }
        .fmt-btn-amber { background: #FFFBEB; color: #92400E; border-color: #FDE68A; }
        .fmt-btn-blue { background: #EFF6FF; color: #1D4ED8; border-color: #BFDBFE; }
        .fmt-pagination-btn {
          width: 32px; height: 32px; border-radius: 8px; border: 1.5px solid #E5E7EB;
          background: #fff; cursor: pointer; font-weight: 700; font-size: 12px;
          display: inline-flex; align-items: center; justify-content: center;
          transition: all 0.15s; color: #374151;
        }
        .fmt-pagination-btn:hover:not(:disabled) { background: ${BRAND.blue}; color: #fff; border-color: ${BRAND.blue}; }
        .fmt-pagination-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .fmt-pagination-btn.active { background: ${BRAND.blue}; color: #fff; border-color: ${BRAND.blue}; }
        .fmt-tab-btn {
          padding: 8px 18px; border-radius: 10px; font-weight: 700; font-size: 13px;
          border: 1.5px solid transparent; cursor: pointer; transition: all 0.15s;
        }
        .fmt-tab-btn.active-pending  { background: #FFFBEB; color: #92400E; border-color: #FDE68A; }
        .fmt-tab-btn.active-approved { background: #ECFDF5; color: #065F46; border-color: #D1FAE5; }
        .fmt-tab-btn.active-rejected { background: #FFF1F2; color: #7F1D1D; border-color: #FECACA; }
        .fmt-tab-btn.inactive        { background: #F8FAFC; color: #6B7280; border-color: #E5E7EB; }
        .fmt-tab-btn.inactive:hover  { background: #F1F5F9; color: #374151; }
      `}</style>

      {/* ═══ KPI SUMMARY CARDS ═══ */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20,
      }}>
        {[
          { label: "Total Applications", value: totalCount,    accent: BRAND.blue,   bg: "#EFF6FF", border: "#BFDBFE" },
          { label: "Pending",            value: pendingCount,  accent: BRAND.orange, bg: "#FFFBEB", border: "#FEF3C7" },
          { label: "Approved",           value: approvedCount, accent: BRAND.green,  bg: "#F0FDF4", border: "#DCFCE7" },
          { label: "Rejected",           value: rejectedCount, accent: BRAND.red,    bg: "#FFF1F2", border: "#FFE4E6" },
        ].map((kpi) => (
          <div key={kpi.label} style={{
            background: "#fff", borderRadius: 14, border: `1px solid ${kpi.border}`,
            boxShadow: "0 2px 10px rgba(11,31,77,0.06)", padding: "16px 20px",
          }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: kpi.accent, lineHeight: 1 }}>
              {kpi.value.toLocaleString()}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", marginTop: 4 }}>
              {kpi.label}
            </div>
            <div style={{ height: 3, borderRadius: 99, background: kpi.accent, marginTop: 10, opacity: 0.5 }} />
          </div>
        ))}
      </div>

      {/* ═══ TABLE CARD ═══ */}
      <div style={{
        background: "#fff", borderRadius: 16, border: "1px solid #E5E7EB",
        boxShadow: "0 2px 12px rgba(11,31,77,0.06)", overflow: "hidden",
      }}>

        {/* ── Top toolbar ── */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #F1F5F9" }}>

          {/* Status tabs + export buttons row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
            {/* Tab pills */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { key: "pending",  label: `Pending (${stats?.pending || 0})` },
                { key: "approved", label: `Approved (${stats?.approved || 0})` },
                { key: "rejected", label: `Rejected (${stats?.rejected || 0})` },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  className={`fmt-tab-btn ${filesTab === key ? `active-${key}` : "inactive"}`}
                  onClick={() => { setFilesTab(key); fetchAllFiles(key); }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Export buttons */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="fmt-btn fmt-btn-amber" onClick={() => handleExport("pending")} disabled={exporting.pending}>
                {exportIcon}{exporting.pending ? "Exporting…" : "Export Pending"}
              </button>
              <button className="fmt-btn fmt-btn-success" onClick={() => handleExport("approved")} disabled={exporting.approved}>
                {exportIcon}{exporting.approved ? "Exporting…" : "Export Approved"}
              </button>
              <button className="fmt-btn fmt-btn-danger" onClick={() => handleExport("rejected")} disabled={exporting.rejected}>
                {exportIcon}{exporting.rejected ? "Exporting…" : "Export Rejected"}
              </button>
              <button className="fmt-btn fmt-btn-blue" onClick={() => handleExport("all")} disabled={exporting.all}>
                {exportIcon}{exporting.all ? "Exporting…" : "Export All"}
              </button>
            </div>
          </div>

          {/* Global search */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }}>
                {searchIcon}
              </span>
              <input
                className="fmt-input"
                style={{ width: "100%", paddingLeft: 34, boxSizing: "border-box" }}
                placeholder="Search by Application ID, Customer Name, Dealer Name…"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Filters row */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select className="fmt-select" value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}>
              <option value="">All Branches</option>
              {branchOptions.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <select className="fmt-select" value={filterDistrict} onChange={(e) => setFilterDistrict(e.target.value)}>
              <option value="">All Districts</option>
              {districtOptions.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select className="fmt-select" value={filterStage} onChange={(e) => setFilterStage(e.target.value)}>
              <option value="">All Stages</option>
              {stageOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="date" className="fmt-input" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} title="Date From" style={{ width: 140 }} />
              <span style={{ fontSize: 12, color: "#9CA3AF" }}>—</span>
              <input type="date" className="fmt-input" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} title="Date To" style={{ width: 140 }} />
            </div>
            {hasActiveFilters && (
              <button className="fmt-btn fmt-btn-ghost" onClick={clearFilters} style={{ padding: "7px 12px" }}>
                {clearIcon} Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* ── Bulk action bar (visible when rows selected) ── */}
        {selectedRows.length > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10, padding: "10px 20px",
            background: "#EFF6FF", borderBottom: "1px solid #BFDBFE",
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: BRAND.blue }}>
              {selectedRows.length} row{selectedRows.length !== 1 ? "s" : ""} selected
            </span>
            <button className="fmt-btn fmt-btn-success" onClick={() => handleBulkAction("approve")}>
              {checkIcon} Approve Selected
            </button>
            <button className="fmt-btn fmt-btn-danger" onClick={() => handleBulkAction("reject")}>
              {xIcon} Reject Selected
            </button>
            <button
              className="fmt-btn fmt-btn-blue"
              onClick={() => handleExport("selected")}
              disabled={exporting.selected}
            >
              {exportIcon} {exporting.selected ? "Exporting…" : "Export Selected"}
            </button>
            <button
              className="fmt-btn fmt-btn-ghost"
              style={{ marginLeft: "auto" }}
              onClick={() => setRowSelection({})}
            >
              Deselect All
            </button>
          </div>
        )}

        {/* ── Info row: count + pageSize selector ── */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "8px 20px", background: "#FAFBFC", borderBottom: "1px solid #F1F5F9",
        }}>
          <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 500 }}>
            Showing{" "}
            <b style={{ color: "#111827" }}>
              {pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, totalFiltered)}
            </b>{" "}
            of <b style={{ color: "#111827" }}>{totalFiltered.toLocaleString()}</b> records
            {hasActiveFilters && ` (filtered from ${allFiles.length.toLocaleString()})`}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "#6B7280" }}>Rows per page:</span>
            <select
              className="fmt-select"
              style={{ padding: "4px 8px", fontSize: 12 }}
              value={pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
            >
              {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        {/* ── TABLE ── */}
        {loadingFiles ? (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            height: 200, color: "#9CA3AF", fontWeight: 600, gap: 10,
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: "50%",
              border: `2px solid ${BRAND.blue}`, borderTopColor: "transparent",
              animation: "spin 0.7s linear infinite",
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            Loading applications…
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              {/* Sticky header */}
              <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} style={{ background: "#FAFBFC", borderBottom: "2px solid #E5E7EB" }}>
                    {hg.headers.map((header) => {
                      const canSort = header.column.getCanSort();
                      const sortDir = header.column.getIsSorted();
                      return (
                        <th
                          key={header.id}
                          className={canSort ? "fmt-th-sort" : ""}
                          onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                          style={{
                            padding: "11px 14px", textAlign: "left",
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

              {/* Body */}
              <tbody ref={tableBodyRef}>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} style={{
                      textAlign: "center", padding: "60px 20px",
                      color: "#9CA3AF", fontWeight: 600, fontSize: 14,
                    }}>
                      {hasActiveFilters
                        ? "No records match the current filters."
                        : `No ${filesTab} applications found.`}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row) => (
                    <tr key={row.id} className="fmt-row">
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          style={{
                            padding: "11px 14px",
                            fontSize: 13, color: "#111827",
                            borderBottom: "1px solid #F1F5F9",
                            borderRight: "1px solid #FAFAFA",
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

        {/* ── Pagination ── */}
        {!loadingFiles && pageCount > 1 && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 20px", borderTop: "1px solid #F1F5F9", flexWrap: "wrap", gap: 10,
          }}>
            {/* Prev / Next */}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                className="fmt-pagination-btn"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
                title="First page"
              >
                «
              </button>
              <button
                className="fmt-pagination-btn"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                ‹
              </button>

              {/* Page number pills */}
              {(() => {
                const current = pageIndex;
                const total = pageCount;
                const range = [];
                if (total <= 7) {
                  for (let i = 0; i < total; i++) range.push(i);
                } else {
                  range.push(0);
                  if (current > 2) range.push("...");
                  for (let i = Math.max(1, current - 1); i <= Math.min(total - 2, current + 1); i++) range.push(i);
                  if (current < total - 3) range.push("...");
                  range.push(total - 1);
                }
                return range.map((p, i) =>
                  p === "..." ? (
                    <span key={`dots-${i}`} style={{ padding: "0 4px", color: "#9CA3AF", fontSize: 13 }}>…</span>
                  ) : (
                    <button
                      key={p}
                      className={`fmt-pagination-btn${p === current ? " active" : ""}`}
                      onClick={() => table.setPageIndex(p)}
                    >
                      {p + 1}
                    </button>
                  )
                );
              })()}

              <button
                className="fmt-pagination-btn"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                ›
              </button>
              <button
                className="fmt-pagination-btn"
                onClick={() => table.setPageIndex(pageCount - 1)}
                disabled={!table.getCanNextPage()}
                title="Last page"
              >
                »
              </button>
            </div>

            {/* Page selector */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "#6B7280" }}>Go to page:</span>
              <select
                className="fmt-select"
                style={{ padding: "4px 8px", fontSize: 12 }}
                value={pageIndex}
                onChange={(e) => table.setPageIndex(Number(e.target.value))}
              >
                {pageOptions.map((p) => (
                  <option key={p} value={p}>Page {p + 1}</option>
                ))}
              </select>
              <span style={{ fontSize: 12, color: "#6B7280" }}>
                of {pageCount}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ═══ Bulk Confirm Modal ═══ */}
      {bulkConfirm && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999,
          }}
          onClick={(e) => e.target === e.currentTarget && setBulkConfirm(null)}
        >
          <div style={{
            background: "#fff", borderRadius: 16, padding: 28, minWidth: 340,
            boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: "#111827", marginBottom: 8 }}>
              Bulk {bulkConfirm === "approve" ? "Approve" : "Reject"}
            </div>
            <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 20 }}>
              Are you sure you want to <b style={{ color: bulkConfirm === "approve" ? BRAND.green : BRAND.red }}>
                {bulkConfirm}
              </b> {selectedRows.length} selected application{selectedRows.length !== 1 ? "s" : ""}?
              This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="fmt-btn fmt-btn-ghost" onClick={() => setBulkConfirm(null)}>Cancel</button>
              <button
                className={`fmt-btn ${bulkConfirm === "approve" ? "fmt-btn-success" : "fmt-btn-danger"}`}
                onClick={() => {
                  alert(`Bulk ${bulkConfirm} for ${selectedRows.length} records — integrate with your API.`);
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
}

/* ─── SVG icons ────────────────────────────────────────────────────────── */
const exportIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);
const searchIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const clearIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const checkIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);
const xIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
  </svg>
);
