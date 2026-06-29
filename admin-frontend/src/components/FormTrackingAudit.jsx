// src/components/FormTrackingAudit.jsx
import React, { useState, useRef, useCallback } from "react";
import API from "../services/api";
import * as XLSX from "xlsx";

// ── Brand tokens (matches Surjit Finance theme) ──────────────────────────────
const BRAND = {
  blue: "#0B1F4D",
  orange: "#F59E0B",
  green: "#16A34A",
  red: "#EF4444",
  bg: "#F8FAFC",
  border: "rgba(14,20,36,0.08)",
};

// ── Action type config ────────────────────────────────────────────────────────
const ACTION_META = {
  FORM_CREATED:            { label: "Form Created",             color: "#7C3AED", bg: "#EDE9FE", icon: "📋" },
  STAGE_CHANGED:           { label: "Stage Updated",            color: "#2563EB", bg: "#DBEAFE", icon: "🔄" },
  STATUS_CHANGED:          { label: "Status Changed",           color: "#0891B2", bg: "#CFFAFE", icon: "🏷️" },
  APPROVED:                { label: "Approval Action",          color: "#16A34A", bg: "#DCFCE7", icon: "✅" },
  REJECTED:                { label: "Rejection",                color: "#EF4444", bg: "#FEE2E2", icon: "❌" },
  REVOKED:                 { label: "Revocation",               color: "#D97706", bg: "#FEF3C7", icon: "↩️" },
  COMMENT_ADDED:           { label: "Comment Added",            color: "#6B7280", bg: "#F3F4F6", icon: "💬" },
  NOTE_ADDED:              { label: "Note Added",               color: "#6B7280", bg: "#F3F4F6", icon: "📝" },
  DOCUMENT_UPLOADED:       { label: "Document Uploaded",        color: "#059669", bg: "#D1FAE5", icon: "📎" },
  DOCUMENT_REMOVED:        { label: "Document Removed",         color: "#DC2626", bg: "#FEE2E2", icon: "🗑️" },
  VEHICLE_DETAILS_UPDATED: { label: "Vehicle Details Updated",  color: "#7C3AED", bg: "#EDE9FE", icon: "🚗" },
  CUSTOMER_DETAILS_UPDATED:{ label: "Customer Details Updated", color: "#0B1F4D", bg: "#DBEAFE", icon: "👤" },
  CO_APPLICANT_UPDATED:    { label: "Co-Applicant Updated",     color: "#0B1F4D", bg: "#DBEAFE", icon: "👥" },
  DEALER_ASSIGNED:         { label: "Dealer Assigned",          color: "#D97706", bg: "#FEF3C7", icon: "🏬" },
  BRANCH_CHANGED:          { label: "Branch Changed",           color: "#0891B2", bg: "#CFFAFE", icon: "🏢" },
  REJECTION_REASON_UPDATED:{ label: "Rejection Reason Updated", color: "#EF4444", bg: "#FEE2E2", icon: "📋" },
  EDIT_FIELDS:             { label: "Fields Edited",            color: "#6B7280", bg: "#F3F4F6", icon: "✏️" },
  OTHER:                   { label: "Other Action",             color: "#6B7280", bg: "#F3F4F6", icon: "⚡" },
};

const ACTION_FILTER_OPTIONS = [
  { value: "ALL",                    label: "All Actions" },
  { value: "STAGE_CHANGED",          label: "Stage Changes" },
  { value: "COMMENT_ADDED",          label: "Comments" },
  { value: "APPROVED",               label: "Approvals" },
  { value: "REJECTED",               label: "Rejections" },
  { value: "DOCUMENT_UPLOADED",      label: "Document Uploads" },
  { value: "DOCUMENT_REMOVED",       label: "Document Removals" },
  { value: "VEHICLE_DETAILS_UPDATED",label: "Vehicle Updates" },
  { value: "CUSTOMER_DETAILS_UPDATED","label": "Customer Updates" },
  { value: "EDIT_FIELDS",            label: "Field Edits" },
  { value: "REVOKED",                label: "Revocations" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (d) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
  } catch { return String(d); }
};

const fmtDateShort = (d) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch { return String(d); }
};

const statusTag = (status) => {
  const map = {
    pending:  { bg: "#FEF3C7", color: "#D97706", label: "Pending" },
    approved: { bg: "#DCFCE7", color: "#16A34A", label: "Approved" },
    rejected: { bg: "#FEE2E2", color: "#EF4444", label: "Rejected" },
  };
  const s = map[String(status).toLowerCase()] || map.pending;
  return (
    <span style={{
      display: "inline-block", padding: "3px 10px", borderRadius: 20,
      fontSize: 12, fontWeight: 700, background: s.bg, color: s.color,
    }}>
      {s.label}
    </span>
  );
};

// ── Export helpers ────────────────────────────────────────────────────────────
const exportToExcel = (application, analytics, adminInvolvement, history) => {
  if (!application) return;
  const wb = XLSX.utils.book_new();

  // Sheet 1: Form Details
  const detailRows = [
    ["Form ID", application.formId],
    ["Customer Name", application.customerName],
    ["Dealer Name", application.dealerName],
    ["Branch", application.branch],
    ["District", application.district],
    ["Current Status", application.currentStatus],
    ["Current Stage", application.currentStage],
    ["Created Date", fmtDate(application.createdAt)],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detailRows), "Form Details");

  // Sheet 2: Activity Summary
  const summaryRows = [
    ["Metric", "Value"],
    ["Total Updates", analytics.totalUpdates],
    ["Unique Admins Involved", analytics.uniqueAdminsInvolved],
    ["Stage Changes", analytics.stageChanges],
    ["Comments Added", analytics.commentsAdded],
    ["Approvals", analytics.approvals],
    ["Rejections", analytics.rejections],
    ["Last Updated By", analytics.lastUpdatedBy],
    ["Last Updated At", fmtDate(analytics.lastUpdatedAt)],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), "Activity Summary");

  // Sheet 3: Admin Involvement
  const adminRows = [["Admin Name", "Total Updates"], ...adminInvolvement.map(a => [a.name, a.count])];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(adminRows), "Admin Involvement");

  // Sheet 4: Full Audit Trail
  const auditHeaders = ["#", "Action", "Old Value", "New Value", "Updated By", "Role", "Remarks", "Date & Time"];
  const auditRows = [
    auditHeaders,
    ...history.map((h, i) => [
      i + 1,
      ACTION_META[h.actionType]?.label || h.actionType,
      h.oldValue != null ? String(h.oldValue) : "—",
      h.newValue != null ? String(h.newValue) : "—",
      h.updatedBy || "—",
      h.updatedByRole || "—",
      h.remarks || "—",
      fmtDate(h.updatedAt),
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(auditRows), "Audit Trail");

  XLSX.writeFile(wb, `AuditTrail_${application.formId}_${Date.now()}.xlsx`);
};

const exportToPDF = (application, analytics, adminInvolvement, history) => {
  if (!application) return;

  const lines = [];
  lines.push("SURJIT HIRE PURCHASE - FORM AUDIT TRAIL");
  lines.push("=".repeat(60));
  lines.push("");
  lines.push("FORM DETAILS");
  lines.push("-".repeat(40));
  lines.push(`Form ID       : ${application.formId}`);
  lines.push(`Customer      : ${application.customerName}`);
  lines.push(`Dealer        : ${application.dealerName}`);
  lines.push(`Branch        : ${application.branch}`);
  lines.push(`District      : ${application.district}`);
  lines.push(`Status        : ${application.currentStatus}`);
  lines.push(`Stage         : ${application.currentStage}`);
  lines.push(`Created       : ${fmtDate(application.createdAt)}`);
  lines.push("");
  lines.push("ACTIVITY SUMMARY");
  lines.push("-".repeat(40));
  lines.push(`Total Updates         : ${analytics.totalUpdates}`);
  lines.push(`Unique Admins         : ${analytics.uniqueAdminsInvolved}`);
  lines.push(`Stage Changes         : ${analytics.stageChanges}`);
  lines.push(`Comments              : ${analytics.commentsAdded}`);
  lines.push(`Approvals             : ${analytics.approvals}`);
  lines.push(`Rejections            : ${analytics.rejections}`);
  lines.push(`Last Updated By       : ${analytics.lastUpdatedBy}`);
  lines.push(`Last Updated At       : ${fmtDate(analytics.lastUpdatedAt)}`);
  lines.push("");
  lines.push("ADMIN INVOLVEMENT");
  lines.push("-".repeat(40));
  adminInvolvement.forEach(a => lines.push(`${a.name.padEnd(30)} : ${a.count} updates`));
  lines.push("");
  lines.push("COMPLETE AUDIT TRAIL");
  lines.push("-".repeat(40));
  history.forEach((h, i) => {
    lines.push(`\n[${i + 1}] ${ACTION_META[h.actionType]?.label || h.actionType}`);
    lines.push(`    By       : ${h.updatedBy || "—"} (${h.updatedByRole || "—"})`);
    lines.push(`    Date     : ${fmtDate(h.updatedAt)}`);
    if (h.oldValue != null) lines.push(`    From     : ${h.oldValue}`);
    if (h.newValue != null) lines.push(`    To       : ${h.newValue}`);
    if (h.remarks) lines.push(`    Remarks  : ${h.remarks}`);
  });

  const content = lines.join("\n");
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `AuditTrail_${application.formId}_${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
};

// ── Main Component ────────────────────────────────────────────────────────────
const FormTrackingAudit = () => {
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [result, setResult] = useState(null); // { application, history, analytics, adminInvolvement, pagination }

  // Filters
  const [filterAction, setFilterAction] = useState("ALL");
  const [filterAdminName, setFilterAdminName] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const searchRef = useRef(null);

  const authHeaders = () => {
    const token = localStorage.getItem("adminToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const handleSearch = useCallback(async (e) => {
    if (e) e.preventDefault();
    const fid = searchInput.trim();
    if (!fid) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const params = new URLSearchParams({ formId: fid, limit: 500 });
      if (filterAction && filterAction !== "ALL") params.set("actionType", filterAction);
      if (filterFrom) params.set("from", filterFrom);
      if (filterTo) {
        const toDate = new Date(filterTo);
        toDate.setHours(23, 59, 59, 999);
        params.set("to", toDate.toISOString());
      }

      const { data } = await API.get(`/form-tracking/search?${params.toString()}`, {
        headers: authHeaders(),
      });
      setResult(data);
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || "Search failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [searchInput, filterAction, filterFrom, filterTo]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch(e);
  };

  const clearSearch = () => {
    setSearchInput("");
    setResult(null);
    setError("");
    setFilterAction("ALL");
    setFilterFrom("");
    setFilterTo("");
    setFilterAdminName("");
    if (searchRef.current) searchRef.current.focus();
  };

  // Client-side admin name filter on top of server results
  const filteredHistory = result
    ? (filterAdminName
        ? result.history.filter(h =>
            (h.updatedBy || "").toLowerCase().includes(filterAdminName.toLowerCase())
          )
        : result.history)
    : [];

  const { application, analytics, adminInvolvement } = result || {};

  return (
    <div style={{ marginBottom: 32 }}>
      {/* ── Section Header ──────────────────────────────────────────────── */}
      <div style={{
        background: `linear-gradient(135deg, ${BRAND.blue} 0%, #162d6e 100%)`,
        borderRadius: 14,
        padding: "20px 24px",
        marginBottom: 20,
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: "rgba(245,158,11,0.18)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22,
        }}>🔍</div>
        <div>
          <div style={{ color: "#fff", fontWeight: 900, fontSize: 18, letterSpacing: 0.3 }}>
            Form Tracking &amp; Audit History
          </div>
          <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, marginTop: 2 }}>
            Search any Form ID to view the complete lifecycle &amp; audit trail of that application
          </div>
        </div>
      </div>

      {/* ── Search Bar ──────────────────────────────────────────────────── */}
      <div style={{
        background: "#fff",
        borderRadius: 12,
        padding: "18px 20px",
        boxShadow: "0 2px 12px rgba(11,31,77,0.07)",
        border: `1px solid ${BRAND.border}`,
        marginBottom: 16,
      }}>
        <div style={{ fontWeight: 800, color: BRAND.blue, fontSize: 14, marginBottom: 12 }}>
          Search Form ID
        </div>
        <form onSubmit={handleSearch} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 260px", minWidth: 200 }}>
            <input
              ref={searchRef}
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. FORM-478205"
              style={{
                width: "100%",
                padding: "11px 16px",
                border: `1.5px solid ${BRAND.border}`,
                borderRadius: 9,
                fontSize: 15,
                fontWeight: 600,
                color: BRAND.blue,
                background: BRAND.bg,
                outline: "none",
                letterSpacing: 0.5,
              }}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !searchInput.trim()}
            style={{
              padding: "11px 26px",
              background: loading ? "#9CA3AF" : BRAND.blue,
              color: "#fff",
              border: "none",
              borderRadius: 9,
              fontWeight: 800,
              fontSize: 14,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "background 0.2s",
              whiteSpace: "nowrap",
            }}
          >
            {loading ? "Searching…" : "🔍 Search"}
          </button>
          {result && (
            <button
              type="button"
              onClick={clearSearch}
              style={{
                padding: "11px 18px",
                background: "transparent",
                color: "#6B7280",
                border: `1.5px solid ${BRAND.border}`,
                borderRadius: 9,
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              ✕ Clear
            </button>
          )}
        </form>

        {error && (
          <div style={{
            marginTop: 12, padding: "10px 14px",
            background: "#FEF2F2", borderRadius: 8,
            color: "#DC2626", fontWeight: 600, fontSize: 13,
            border: "1px solid #FECACA",
          }}>
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* ── Results ──────────────────────────────────────────────────────── */}
      {result && (
        <>
          {/* Application Details Card */}
          <div style={{
            background: "#fff",
            borderRadius: 12,
            padding: "20px 24px",
            boxShadow: "0 2px 12px rgba(11,31,77,0.07)",
            border: `1px solid ${BRAND.border}`,
            marginBottom: 16,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 900, color: BRAND.blue, letterSpacing: 1 }}>
                  {application.formId}
                </div>
                <div style={{ color: "#6B7280", fontSize: 13, marginTop: 2 }}>
                  Application Details
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {statusTag(application.currentStatus)}
                <span style={{
                  display: "inline-block", padding: "3px 10px", borderRadius: 20,
                  fontSize: 12, fontWeight: 700,
                  background: "#DBEAFE", color: "#1D4ED8",
                }}>
                  {application.collection?.toUpperCase()}
                </span>
              </div>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 14,
            }}>
              {[
                { label: "Customer", value: application.customerName, icon: "👤" },
                { label: "Dealer", value: application.dealerName, icon: "🏬" },
                { label: "Branch", value: application.branch, icon: "🏢" },
                { label: "District", value: application.district, icon: "📍" },
                { label: "Current Stage", value: application.currentStage, icon: "🔄" },
                { label: "Created Date", value: fmtDateShort(application.createdAt), icon: "📅" },
              ].map(({ label, value, icon }) => (
                <div key={label} style={{
                  background: BRAND.bg,
                  borderRadius: 8,
                  padding: "10px 14px",
                  border: `1px solid ${BRAND.border}`,
                }}>
                  <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    {icon} {label}
                  </div>
                  <div style={{ fontWeight: 700, color: "#111827", fontSize: 14 }}>
                    {value || "—"}
                  </div>
                </div>
              ))}
            </div>

            {application.rejectionReason && (
              <div style={{
                marginTop: 14, padding: "10px 14px",
                background: "#FEF2F2", borderRadius: 8,
                border: "1px solid #FECACA",
              }}>
                <span style={{ fontWeight: 700, color: "#DC2626", fontSize: 13 }}>Rejection Reason: </span>
                <span style={{ color: "#374151", fontSize: 13 }}>{application.rejectionReason}</span>
              </div>
            )}
          </div>

          {/* Analytics Summary */}
          <div style={{
            background: "#fff",
            borderRadius: 12,
            padding: "20px 24px",
            boxShadow: "0 2px 12px rgba(11,31,77,0.07)",
            border: `1px solid ${BRAND.border}`,
            marginBottom: 16,
          }}>
            <div style={{ fontWeight: 900, color: BRAND.blue, fontSize: 15, marginBottom: 14, borderBottom: `2px solid ${BRAND.border}`, paddingBottom: 10 }}>
              📊 Activity Summary
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: 12,
              marginBottom: 16,
            }}>
              {[
                { label: "Total Updates",    value: analytics.totalUpdates,          color: BRAND.blue,   icon: "📋" },
                { label: "Unique Admins",    value: analytics.uniqueAdminsInvolved,  color: "#7C3AED",    icon: "👥" },
                { label: "Stage Changes",    value: analytics.stageChanges,          color: "#2563EB",    icon: "🔄" },
                { label: "Comments",         value: analytics.commentsAdded,         color: "#6B7280",    icon: "💬" },
                { label: "Approvals",        value: analytics.approvals,             color: BRAND.green,  icon: "✅" },
                { label: "Rejections",       value: analytics.rejections,            color: BRAND.red,    icon: "❌" },
              ].map(({ label, value, color, icon }) => (
                <div key={label} style={{
                  background: BRAND.bg,
                  borderRadius: 10,
                  padding: "12px 14px",
                  border: `1px solid ${BRAND.border}`,
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color }}>{value}</div>
                  <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 13, color: "#374151" }}>
              <b>Last Updated By:</b>{" "}
              <span style={{ fontWeight: 700, color: BRAND.blue }}>{analytics.lastUpdatedBy}</span>
              {analytics.lastUpdatedAt && (
                <span style={{ color: "#9CA3AF", marginLeft: 8 }}>on {fmtDate(analytics.lastUpdatedAt)}</span>
              )}
            </div>
          </div>

          {/* Admin Involvement */}
          {adminInvolvement && adminInvolvement.length > 0 && (
            <div style={{
              background: "#fff",
              borderRadius: 12,
              padding: "20px 24px",
              boxShadow: "0 2px 12px rgba(11,31,77,0.07)",
              border: `1px solid ${BRAND.border}`,
              marginBottom: 16,
            }}>
              <div style={{ fontWeight: 900, color: BRAND.blue, fontSize: 15, marginBottom: 14, borderBottom: `2px solid ${BRAND.border}`, paddingBottom: 10 }}>
                👥 Admin Involvement
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: BRAND.bg }}>
                      <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 800, color: BRAND.blue, borderBottom: `2px solid ${BRAND.border}` }}>#</th>
                      <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 800, color: BRAND.blue, borderBottom: `2px solid ${BRAND.border}` }}>Admin Name</th>
                      <th style={{ textAlign: "center", padding: "10px 14px", fontWeight: 800, color: BRAND.blue, borderBottom: `2px solid ${BRAND.border}` }}>Total Updates</th>
                      <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 800, color: BRAND.blue, borderBottom: `2px solid ${BRAND.border}` }}>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminInvolvement.map((a, i) => {
                      const pct = analytics.totalUpdates > 0
                        ? Math.round((a.count / analytics.totalUpdates) * 100)
                        : 0;
                      return (
                        <tr key={a.name} style={{ borderBottom: `1px solid ${BRAND.border}` }}>
                          <td style={{ padding: "10px 14px", color: "#9CA3AF", fontWeight: 600 }}>{i + 1}</td>
                          <td style={{ padding: "10px 14px", fontWeight: 700, color: "#111827" }}>{a.name}</td>
                          <td style={{ padding: "10px 14px", textAlign: "center" }}>
                            <span style={{
                              display: "inline-block",
                              background: BRAND.blue,
                              color: "#fff",
                              borderRadius: 20,
                              padding: "2px 12px",
                              fontWeight: 800,
                              fontSize: 13,
                            }}>{a.count}</span>
                          </td>
                          <td style={{ padding: "10px 14px", minWidth: 140 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{
                                flex: 1, height: 8, background: "#E5E7EB", borderRadius: 4, overflow: "hidden",
                              }}>
                                <div style={{
                                  width: `${pct}%`, height: "100%",
                                  background: `linear-gradient(90deg, ${BRAND.blue}, ${BRAND.orange})`,
                                  borderRadius: 4, transition: "width 0.5s ease",
                                }} />
                              </div>
                              <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 600, whiteSpace: "nowrap" }}>{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Filters + Export */}
          <div style={{
            background: "#fff",
            borderRadius: 12,
            padding: "16px 20px",
            boxShadow: "0 2px 12px rgba(11,31,77,0.07)",
            border: `1px solid ${BRAND.border}`,
            marginBottom: 16,
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "flex-end",
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", marginBottom: 4, textTransform: "uppercase" }}>Action Type</div>
              <select
                value={filterAction}
                onChange={e => setFilterAction(e.target.value)}
                style={{
                  padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${BRAND.border}`,
                  fontSize: 13, fontWeight: 600, color: BRAND.blue, background: BRAND.bg,
                  cursor: "pointer",
                }}
              >
                {ACTION_FILTER_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", marginBottom: 4, textTransform: "uppercase" }}>Admin Name</div>
              <input
                type="text"
                value={filterAdminName}
                onChange={e => setFilterAdminName(e.target.value)}
                placeholder="Filter by admin…"
                style={{
                  padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${BRAND.border}`,
                  fontSize: 13, fontWeight: 600, color: BRAND.blue, background: BRAND.bg, width: 180,
                }}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", marginBottom: 4, textTransform: "uppercase" }}>From Date</div>
              <input
                type="date"
                value={filterFrom}
                onChange={e => setFilterFrom(e.target.value)}
                style={{
                  padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${BRAND.border}`,
                  fontSize: 13, fontWeight: 600, color: BRAND.blue, background: BRAND.bg,
                }}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", marginBottom: 4, textTransform: "uppercase" }}>To Date</div>
              <input
                type="date"
                value={filterTo}
                onChange={e => setFilterTo(e.target.value)}
                style={{
                  padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${BRAND.border}`,
                  fontSize: 13, fontWeight: 600, color: BRAND.blue, background: BRAND.bg,
                }}
              />
            </div>
            <button
              onClick={handleSearch}
              style={{
                padding: "9px 18px",
                background: BRAND.blue, color: "#fff",
                border: "none", borderRadius: 8,
                fontWeight: 700, fontSize: 13, cursor: "pointer",
              }}
            >
              Apply Filters
            </button>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={() => exportToExcel(application, analytics, adminInvolvement, filteredHistory)}
                style={{
                  padding: "9px 16px",
                  background: "#16A34A", color: "#fff",
                  border: "none", borderRadius: 8,
                  fontWeight: 700, fontSize: 13, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                📊 Export Excel
              </button>
              <button
                onClick={() => exportToPDF(application, analytics, adminInvolvement, filteredHistory)}
                style={{
                  padding: "9px 16px",
                  background: "#EF4444", color: "#fff",
                  border: "none", borderRadius: 8,
                  fontWeight: 700, fontSize: 13, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                📄 Export Text
              </button>
            </div>
          </div>

          {/* Timeline */}
          <div style={{
            background: "#fff",
            borderRadius: 12,
            padding: "20px 24px",
            boxShadow: "0 2px 12px rgba(11,31,77,0.07)",
            border: `1px solid ${BRAND.border}`,
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 20, borderBottom: `2px solid ${BRAND.border}`, paddingBottom: 14,
              flexWrap: "wrap", gap: 8,
            }}>
              <div style={{ fontWeight: 900, color: BRAND.blue, fontSize: 15 }}>
                📅 Form Timeline
              </div>
              <div style={{ fontSize: 13, color: "#6B7280", fontWeight: 600 }}>
                {filteredHistory.length} event{filteredHistory.length !== 1 ? "s" : ""} found
              </div>
            </div>

            {filteredHistory.length === 0 ? (
              <div style={{
                textAlign: "center", padding: "40px 20px",
                color: "#9CA3AF", fontSize: 15,
              }}>
                No history records found{filterAction !== "ALL" ? ` for "${ACTION_META[filterAction]?.label || filterAction}"` : ""}.
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                {/* Vertical line */}
                <div style={{
                  position: "absolute", left: 20, top: 0, bottom: 0,
                  width: 2,
                  background: `linear-gradient(180deg, ${BRAND.blue}30, ${BRAND.orange}30)`,
                  borderRadius: 2,
                }} />

                {filteredHistory.map((h, idx) => {
                  const meta = ACTION_META[h.actionType] || ACTION_META.OTHER;
                  return (
                    <div key={h._id || idx} style={{
                      display: "flex",
                      gap: 18,
                      marginBottom: idx < filteredHistory.length - 1 ? 24 : 0,
                      position: "relative",
                    }}>
                      {/* Dot */}
                      <div style={{
                        flexShrink: 0,
                        width: 42, height: 42,
                        borderRadius: "50%",
                        background: meta.bg,
                        border: `2.5px solid ${meta.color}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 18,
                        zIndex: 1,
                        boxShadow: `0 0 0 3px #fff`,
                      }}>
                        {meta.icon}
                      </div>

                      {/* Card */}
                      <div style={{
                        flex: 1,
                        background: BRAND.bg,
                        borderRadius: 10,
                        padding: "14px 18px",
                        border: `1px solid ${BRAND.border}`,
                        borderLeft: `3px solid ${meta.color}`,
                        transition: "box-shadow 0.2s",
                      }}>
                        <div style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: 8,
                          flexWrap: "wrap",
                          gap: 6,
                        }}>
                          <div>
                            <span style={{
                              display: "inline-block",
                              background: meta.bg,
                              color: meta.color,
                              padding: "2px 10px",
                              borderRadius: 20,
                              fontSize: 12,
                              fontWeight: 800,
                              border: `1px solid ${meta.color}30`,
                            }}>
                              {meta.label}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 600, whiteSpace: "nowrap" }}>
                            {fmtDate(h.updatedAt)}
                          </div>
                        </div>

                        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: h.remarks ? 8 : 0 }}>
                          <div style={{ fontSize: 13 }}>
                            <span style={{ color: "#9CA3AF", fontWeight: 600 }}>By: </span>
                            <span style={{ fontWeight: 700, color: "#111827" }}>{h.updatedBy || "—"}</span>
                            {h.updatedByRole && (
                              <span style={{
                                marginLeft: 6,
                                display: "inline-block",
                                background: "#F3F4F6",
                                color: "#6B7280",
                                padding: "1px 8px",
                                borderRadius: 10,
                                fontSize: 11,
                                fontWeight: 600,
                              }}>{h.updatedByRole}</span>
                            )}
                          </div>
                        </div>

                        {(h.oldValue != null || h.newValue != null) && (
                          <div style={{
                            display: "flex", alignItems: "center", gap: 8,
                            marginTop: 8, flexWrap: "wrap",
                          }}>
                            {h.oldValue != null && (
                              <span style={{
                                display: "inline-flex", alignItems: "center", gap: 4,
                                background: "#FEE2E2", color: "#DC2626",
                                padding: "3px 10px", borderRadius: 6,
                                fontSize: 12, fontWeight: 700,
                              }}>
                                ✕ {String(h.oldValue)}
                              </span>
                            )}
                            {h.oldValue != null && h.newValue != null && (
                              <span style={{ color: "#9CA3AF", fontSize: 16 }}>→</span>
                            )}
                            {h.newValue != null && (
                              <span style={{
                                display: "inline-flex", alignItems: "center", gap: 4,
                                background: "#DCFCE7", color: "#16A34A",
                                padding: "3px 10px", borderRadius: 6,
                                fontSize: 12, fontWeight: 700,
                              }}>
                                ✓ {String(h.newValue)}
                              </span>
                            )}
                          </div>
                        )}

                        {h.remarks && (
                          <div style={{
                            marginTop: 10,
                            padding: "8px 12px",
                            background: "#fff",
                            borderRadius: 7,
                            border: `1px solid ${BRAND.border}`,
                            fontSize: 13,
                            color: "#374151",
                            fontStyle: "italic",
                          }}>
                            💬 {h.remarks}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default FormTrackingAudit;
