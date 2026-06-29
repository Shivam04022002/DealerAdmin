// src/components/ActivityHistoryDrawer.jsx
import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import api from "../services/api";

/* ─── Constants ──────────────────────────────────────────── */
const FILTERS = [
  { id: "all",      label: "All Actions" },
  { id: "update",   label: "Updates"     },
  { id: "approve",  label: "Approvals"   },
  { id: "reject",   label: "Rejections"  },
  { id: "comment",  label: "Comments"    },
  { id: "document", label: "Documents"   },
];

const ACTION_META = {
  approve:  { color: "#16a34a", bg: "#dcfce7", border: "#bbf7d0", icon: "✓",  label: "Approved" },
  reject:   { color: "#dc2626", bg: "#fee2e2", border: "#fecaca", icon: "✕",  label: "Rejected" },
  update:   { color: "#2563eb", bg: "#dbeafe", border: "#bfdbfe", icon: "↑",  label: "Updated"  },
  comment:  { color: "#7c3aed", bg: "#ede9fe", border: "#ddd6fe", icon: "💬", label: "Comment"  },
  document: { color: "#ea580c", bg: "#ffedd5", border: "#fed7aa", icon: "📄", label: "Document" },
  default:  { color: "#475569", bg: "#f1f5f9", border: "#e2e8f0", icon: "•",  label: "Action"   },
};

/* Map ApplicationHistory.actionType enum → our classifier keys */
const ACTION_TYPE_MAP = {
  APPROVED:                  "approve",
  REJECTED:                  "reject",
  REVOKED:                   "reject",
  COMMENT_ADDED:             "comment",
  NOTE_ADDED:                "comment",
  DOCUMENT_UPLOADED:         "document",
  DOCUMENT_REMOVED:          "document",
  STAGE_CHANGED:             "update",
  STATUS_CHANGED:            "update",
  FORM_CREATED:              "update",
  VEHICLE_DETAILS_UPDATED:   "update",
  CUSTOMER_DETAILS_UPDATED:  "update",
  CO_APPLICANT_UPDATED:      "update",
  DEALER_ASSIGNED:           "update",
  BRANCH_CHANGED:            "update",
  REJECTION_REASON_UPDATED:  "update",
  EDIT_FIELDS:               "update",
  OTHER:                     "update",
};

function classifyAction(entry) {
  // Rich ApplicationHistory entry has `actionType`
  if (entry?.actionType && ACTION_TYPE_MAP[entry.actionType]) {
    return ACTION_TYPE_MAP[entry.actionType];
  }
  // Fallback: plain app.history entry — `changes` is a free string
  const changes = String(entry?.changes || entry?.action || "").toLowerCase();
  const remarks = String(entry?.remarks || entry?.notes  || "").toLowerCase();
  const newVal  = String(entry?.newValue || entry?.to    || "").toLowerCase();

  if (changes.includes("approv") || newVal === "disbursement" || newVal === "disbursed") return "approve";
  if (changes.includes("reject") || newVal === "rejected")  return "reject";
  if (changes.includes("comment")) return "comment";
  if (changes.includes("doc") || changes.includes("upload") || remarks.includes("upload")) return "document";
  return "update";
}

function formatDateTime(raw) {
  if (!raw) return { date: "—", time: "" };
  const d = new Date(raw);
  if (isNaN(d.getTime())) return { date: String(raw).slice(0, 10), time: "" };
  return {
    date: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
  };
}

function dateKey(raw) {
  if (!raw) return "Unknown Date";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "Unknown Date";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function getEntrySearchText(e) {
  return [
    e.actionType, e.action, e.changes,
    e.oldValue, e.newValue,
    e.remarks, e.notes,
    e.updatedBy, e.actor,
  ].join(" ").toLowerCase();
}

/* ─── Normalise a raw entry into a unified display shape ─── */
function normaliseEntry(e) {
  // Rich ApplicationHistory entry
  if (e.actionType) {
    return {
      type:      classifyAction(e),
      actionLabel: e.actionType.replace(/_/g, " "),
      from:      e.oldValue  != null ? String(e.oldValue) : "",
      to:        e.newValue  != null ? String(e.newValue) : "",
      notes:     e.remarks   || "",
      actor:     e.updatedBy || "Admin",
      role:      e.updatedByRole || "",
      timestamp: e.updatedAt || e.createdAt,
    };
  }
  // Plain app.history entry: { updatedBy, updatedAt, changes }
  return {
    type:      classifyAction(e),
    actionLabel: "",
    from:      "",
    to:        "",
    notes:     e.changes || "",
    actor:     e.updatedBy || "Admin",
    role:      "",
    timestamp: e.updatedAt || e.createdAt,
  };
}

/* ─── Main Component ─────────────────────────────────────── */
export default function ActivityHistoryDrawer({ app, onClose }) {
  const [filter, setFilter]         = useState("all");
  const [search, setSearch]         = useState("");
  const [visible, setVisible]       = useState(false);
  const [toolbarStuck, setToolbarStuck] = useState(false);

  // Rich history from ApplicationHistory collection (if accessible)
  const [richHistory, setRichHistory]   = useState(null); // null = not yet attempted
  const [richLoading, setRichLoading]   = useState(false);
  const [analytics, setAnalytics]       = useState(null);

  const scrollRef = useRef(null);
  const searchRef = useRef(null);

  /* animate-in */
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  /* sticky toolbar */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setToolbarStuck(el.scrollTop > 10);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  /* Escape key */
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  /* Fetch rich ApplicationHistory via form-tracking API */
  useEffect(() => {
    if (!app?.formId) return;
    setRichLoading(true);
    api.get(`/form-tracking/search?formId=${encodeURIComponent(app.formId)}&limit=500`)
      .then(({ data }) => {
        setRichHistory(Array.isArray(data.history) ? data.history : []);
        setAnalytics(data.analytics || null);
      })
      .catch(() => {
        // 403 for non-superadmins: fall back to app.history silently
        setRichHistory([]);
      })
      .finally(() => setRichLoading(false));
  }, [app?.formId]);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 280);
  }, [onClose]);

  /* ─── Resolve correct data ─────────────────────────────── */
  // Use rich history when available and non-empty, else fall back to app.history
  const rawEntries = useMemo(() => {
    const rich = richHistory;
    if (rich && rich.length > 0) {
      return [...rich].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    }
    // Fallback: plain history array from app object
    const plain = Array.isArray(app?.history) ? app.history : [];
    return [...plain].reverse();
  }, [richHistory, app?.history]);

  /* Stats — prefer API analytics, else compute from entries */
  const stats = useMemo(() => {
    if (analytics) {
      return {
        total:      analytics.totalUpdates      ?? rawEntries.length,
        approvals:  analytics.approvals         ?? 0,
        rejections: analytics.rejections        ?? 0,
      };
    }
    let approvals = 0, rejections = 0;
    rawEntries.forEach((e) => {
      const t = classifyAction(e);
      if (t === "approve") approvals++;
      if (t === "reject")  rejections++;
    });
    return { total: rawEntries.length, approvals, rejections };
  }, [analytics, rawEntries]);

  /* Filter + search */
  const filtered = useMemo(() => {
    let list = rawEntries;
    if (filter !== "all") {
      list = list.filter((e) => classifyAction(e) === filter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((e) => getEntrySearchText(e).includes(q));
    }
    return list;
  }, [rawEntries, filter, search]);

  /* Group by date */
  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach((e) => {
      const k = dateKey(e.updatedAt || e.at || e.createdAt);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(e);
    });
    return Array.from(map.entries());
  }, [filtered]);

  /* ─── Derived app info — mirrors ApplicationView's helpers ─ */
  // applicant lives at app.applicant.applicant.name (nested) OR app.applicant.name (flat)
  const applicantData = app?.applicant?.applicant || app?.applicant || {};
  const applicantName = applicantData?.name || "—";

  // dealer: populated ObjectId has name/branch; dealerDetails is the embedded copy
  const dealerName = app?.dealer?.name    || app?.dealerDetails?.name    || "—";
  const branch     = app?.dealer?.branch  || app?.dealerDetails?.branch  || "—";
  const stage      = app?.workflowStage   || "—";
  const status     = app?.status          || "—";
  const formId     = app?.formId          || "—";

  /* ─── Render ─────────────────────────────────────────────── */
  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          ...S.backdrop,
          opacity: visible ? 1 : 0,
        }}
        onClick={handleClose}
      />

      {/* Drawer */}
      <div
        style={{
          ...S.drawer,
          transform: visible ? "translateX(0)" : "translateX(100%)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────── */}
        <div style={S.drawerHeader}>
          <div style={S.headerTop}>
            <div style={S.headerTitle}>
              <span style={S.headerIcon}>📋</span>
              <div>
                <div style={S.titleText}>Activity History</div>
                <div style={S.brandTag}>Surjit Finance</div>
              </div>
            </div>
            <button style={S.closeBtn} onClick={handleClose} aria-label="Close">✕</button>
          </div>

          {/* File Info Strip */}
          <div style={S.fileInfoStrip}>
            <InfoChip icon="🆔" label="Form ID"    value={formId}      />
            <InfoChip icon="👤" label="Applicant"  value={applicantName} />
            <InfoChip icon="🔵" label="Stage"      value={stage}       highlight />
            <InfoChip icon="📌" label="Status"     value={status}      />
            <InfoChip icon="🏢" label="Dealer"     value={dealerName}  />
            <InfoChip icon="🏪" label="Branch"     value={branch}      />
          </div>

          {/* Stats Row */}
          <div style={S.statsRow}>
            <StatCard label="Total Updates"  value={stats.total}      color="#2563eb" bg="#dbeafe" />
            <StatCard label="Approvals"      value={stats.approvals}  color="#16a34a" bg="#dcfce7" />
            <StatCard label="Rejections"     value={stats.rejections} color="#dc2626" bg="#fee2e2" />
          </div>
        </div>

        {/* ── Sticky Toolbar ──────────────────────────────── */}
        <div style={{ ...S.toolbar, boxShadow: toolbarStuck ? "0 4px 12px rgba(0,0,0,0.08)" : "none" }}>
          {/* Search */}
          <div style={S.searchWrap}>
            <span style={S.searchIcon}>🔍</span>
            <input
              ref={searchRef}
              style={S.searchInput}
              placeholder="Search actions, notes, users…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button style={S.clearSearch} onClick={() => setSearch("")}>✕</button>
            )}
          </div>

          {/* Filter Pills */}
          <div style={S.filterRow}>
            {FILTERS.map((f) => (
              <button
                key={f.id}
                style={{
                  ...S.filterPill,
                  ...(filter === f.id ? S.filterPillActive : {}),
                }}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Result count */}
          <div style={S.resultCount}>
            {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
            {(filter !== "all" || search) && (
              <button
                style={S.clearFilters}
                onClick={() => { setFilter("all"); setSearch(""); }}
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* ── Timeline ─────────────────────────────────────── */}
        <div style={S.scrollArea} ref={scrollRef}>

          {/* Rich-history loading indicator */}
          {richLoading && (
            <div style={S.loadingBanner}>
              <div style={S.loadingSpinner} />
              <span style={{ fontSize: 13, color: "#64748b" }}>Loading detailed history…</span>
            </div>
          )}

          {!richLoading && grouped.length === 0 ? (
            <EmptyState hasFilters={filter !== "all" || !!search} />
          ) : (
            grouped.map(([dateLabel, entries], gi) => (
              <div key={dateLabel} style={S.dateGroup}>
                {/* Date badge */}
                <div style={S.dateBadgeWrap}>
                  <div style={S.dateBadge}>{dateLabel}</div>
                  <div style={S.dateLine} />
                </div>

                {/* Timeline entries */}
                <div style={S.timelineTrack}>
                  {entries.map((entry, ei) => {
                    const n      = normaliseEntry(entry);
                    const meta   = ACTION_META[n.type] || ACTION_META.default;
                    const { date, time } = formatDateTime(n.timestamp);
                    const isLast = ei === entries.length - 1 && gi === grouped.length - 1;

                    return (
                      <div key={ei} style={S.timelineRow}>
                        {/* Left: dot + connector line */}
                        <div style={S.dotCol}>
                          <div style={{ ...S.dot, background: meta.bg, border: `2px solid ${meta.border}`, color: meta.color }}>
                            <span style={{ fontSize: 11, fontWeight: 800, lineHeight: 1 }}>{meta.icon}</span>
                          </div>
                          {!isLast && <div style={{ ...S.connLine, background: meta.border }} />}
                        </div>

                        {/* Right: card */}
                        <div style={{ ...S.card, borderLeftColor: meta.color }}>
                          {/* Card header: type badge + timestamp */}
                          <div style={S.cardHeader}>
                            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                              <span style={{ ...S.typeBadge, background: meta.bg, color: meta.color, borderColor: meta.border }}>
                                {meta.label}
                              </span>
                              {n.actionLabel && (
                                <span style={S.actionSubLabel}>{n.actionLabel}</span>
                              )}
                            </div>
                            <span style={S.timeText}>{time || date}</span>
                          </div>

                          {/* Stage transition: from → to */}
                          {(n.from || n.to) && (
                            <div style={S.stageFlow}>
                              {n.from && <span style={S.stageFrom}>{n.from}</span>}
                              {n.from && n.to && <span style={S.stageArrow}>→</span>}
                              {n.to   && <span style={{ ...S.stageTo, color: meta.color }}>{n.to}</span>}
                            </div>
                          )}

                          {/* Notes / remarks */}
                          {n.notes && (
                            <div style={S.noteText}>{n.notes}</div>
                          )}

                          {/* Footer: updated-by + role */}
                          <div style={S.cardFooter}>
                            <span style={S.actorChip}>👤 {n.actor}</span>
                            {n.role && <span style={S.roleChip}>{n.role}</span>}
                            <span style={S.dateChip}>{date}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}

          <div style={{ height: 32 }} />
        </div>
      </div>

      <style>{`
        @keyframes drawerIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes fadeIn   { from { opacity: 0; }                 to { opacity: 1; } }
        @keyframes cardIn   { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin     { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}

/* ─── Sub-components ─────────────────────────────────────── */
function InfoChip({ icon, label, value, highlight }) {
  return (
    <div style={{ ...S.infoChip, ...(highlight ? S.infoChipHL : {}) }}>
      <span style={{ fontSize: 13 }}>{icon}</span>
      <div style={S.infoChipInner}>
        <div style={S.infoChipLabel}>{label}</div>
        <div style={{ ...S.infoChipValue, color: highlight ? "#1d4ed8" : "#1e293b" }}>
          {value || "—"}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, bg }) {
  return (
    <div style={{ ...S.statCard, background: bg }}>
      <div style={{ ...S.statValue, color }}>{value}</div>
      <div style={S.statLabel}>{label}</div>
    </div>
  );
}

function EmptyState({ hasFilters }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 24px", color: "#94a3b8" }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>📭</div>
      <div style={{ fontWeight: 700, fontSize: 16, color: "#64748b", marginBottom: 6 }}>
        {hasFilters ? "No matching entries" : "No activity yet"}
      </div>
      <div style={{ fontSize: 14 }}>
        {hasFilters ? "Try changing your filters or search query." : "Activity will appear here once the file is processed."}
      </div>
    </div>
  );
}

/* ─── Styles ─────────────────────────────────────────────── */
const S = {
  backdrop: {
    position: "fixed", inset: 0,
    background: "rgba(15,23,42,0.45)",
    zIndex: 8000,
    transition: "opacity 0.28s ease",
    backdropFilter: "blur(3px)",
  },
  drawer: {
    position: "fixed", top: 0, right: 0, bottom: 0,
    width: "min(580px, 96vw)",
    background: "#fff",
    zIndex: 8001,
    display: "flex", flexDirection: "column",
    boxShadow: "-6px 0 32px rgba(0,0,0,0.16)",
    transition: "transform 0.28s cubic-bezier(0.16,1,0.3,1)",
    borderRadius: "20px 0 0 20px",
    overflow: "hidden",
  },

  /* Header */
  drawerHeader: {
    background: "linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 60%, #3b82f6 100%)",
    padding: "18px 20px 14px",
    flexShrink: 0,
  },
  headerTop: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    marginBottom: 14,
  },
  headerTitle: { display: "flex", alignItems: "center", gap: 10 },
  headerIcon: {
    width: 40, height: 40, borderRadius: 10,
    background: "rgba(255,255,255,0.18)", display: "flex",
    alignItems: "center", justifyContent: "center",
    fontSize: 20, backdropFilter: "blur(8px)",
    border: "1px solid rgba(255,255,255,0.25)",
  },
  titleText: { fontSize: 17, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" },
  brandTag:  {
    fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.75)",
    letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 1,
  },
  closeBtn: {
    width: 34, height: 34, borderRadius: 8, border: "1px solid rgba(255,255,255,0.25)",
    background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: 15,
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    transition: "background 0.15s",
  },

  /* File info */
  fileInfoStrip: {
    display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
    gap: "6px", marginBottom: 12,
  },
  infoChip: {
    background: "rgba(255,255,255,0.1)", borderRadius: 8,
    padding: "6px 10px", display: "flex", gap: 6, alignItems: "flex-start",
    border: "1px solid rgba(255,255,255,0.15)",
  },
  infoChipHL: {
    background: "rgba(255,255,255,0.22)",
    border: "1px solid rgba(255,255,255,0.4)",
  },
  infoChipInner: { minWidth: 0 },
  infoChipLabel: {
    fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.6)",
    textTransform: "uppercase", letterSpacing: "0.06em",
  },
  infoChipValue: {
    fontSize: 12, fontWeight: 700, color: "#fff",
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
    maxWidth: 120, marginTop: 1, textTransform: "capitalize",
  },

  /* Stats */
  statsRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 },
  statCard: {
    borderRadius: 10, padding: "8px 12px", textAlign: "center",
  },
  statValue: { fontSize: 22, fontWeight: 800, lineHeight: 1 },
  statLabel: { fontSize: 11, fontWeight: 600, color: "#475569", marginTop: 3 },

  /* Toolbar */
  toolbar: {
    background: "#fff", padding: "12px 16px 0",
    borderBottom: "1px solid #e2e8f0", flexShrink: 0,
    transition: "box-shadow 0.2s", zIndex: 10, position: "relative",
  },
  searchWrap: {
    position: "relative", marginBottom: 10, display: "flex", alignItems: "center",
  },
  searchIcon: {
    position: "absolute", left: 12, fontSize: 14, pointerEvents: "none",
  },
  searchInput: {
    width: "100%", border: "1px solid #e2e8f0", borderRadius: 10,
    padding: "9px 36px 9px 34px", fontSize: 13.5, outline: "none",
    background: "#f8fafc", color: "#1e293b", boxSizing: "border-box",
    transition: "border-color 0.2s, box-shadow 0.2s",
  },
  clearSearch: {
    position: "absolute", right: 10, background: "none", border: "none",
    color: "#94a3b8", cursor: "pointer", fontSize: 13, padding: 2,
  },
  filterRow: {
    display: "flex", gap: 6, flexWrap: "wrap", paddingBottom: 10,
    overflowX: "auto",
  },
  filterPill: {
    padding: "5px 13px", borderRadius: 20, fontSize: 12, fontWeight: 600,
    border: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b",
    cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap",
  },
  filterPillActive: {
    background: "#1d4ed8", color: "#fff", borderColor: "#1d4ed8",
    boxShadow: "0 2px 8px rgba(29,78,216,0.25)",
  },
  resultCount: {
    fontSize: 12, color: "#94a3b8", paddingBottom: 8,
    display: "flex", alignItems: "center", gap: 8,
  },
  clearFilters: {
    background: "none", border: "none", color: "#1d4ed8",
    fontSize: 12, cursor: "pointer", fontWeight: 600, padding: 0,
  },

  /* Scroll area */
  scrollArea: {
    flex: 1, overflowY: "auto", padding: "16px 20px 0",
    scrollBehavior: "smooth",
  },

  /* Date group */
  dateGroup: { marginBottom: 8 },
  dateBadgeWrap: {
    display: "flex", alignItems: "center", gap: 10, marginBottom: 14,
  },
  dateBadge: {
    background: "#f1f5f9", border: "1px solid #e2e8f0",
    borderRadius: 20, padding: "3px 12px", fontSize: 11.5,
    fontWeight: 700, color: "#475569", whiteSpace: "nowrap",
    letterSpacing: "0.02em",
  },
  dateLine: { flex: 1, height: 1, background: "#e2e8f0" },

  /* Timeline row */
  timelineTrack: { paddingLeft: 4 },
  timelineRow: {
    display: "flex", gap: 14, marginBottom: 0,
    animation: "cardIn 0.2s ease both",
  },

  /* Dot + connector */
  dotCol: { display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 },
  dot: {
    width: 30, height: 30, borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0, zIndex: 1,
  },
  connLine: { width: 2, flex: 1, minHeight: 16, margin: "2px 0" },

  /* Card */
  card: {
    flex: 1, background: "#fff", border: "1px solid #e2e8f0",
    borderLeft: "3px solid #2563eb", borderRadius: "0 10px 10px 0",
    padding: "10px 14px", marginBottom: 14,
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    transition: "box-shadow 0.15s",
  },
  cardHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginBottom: 6,
  },
  typeBadge: {
    fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20,
    border: "1px solid transparent", letterSpacing: "0.03em",
  },
  timeText: { fontSize: 11, color: "#94a3b8", fontWeight: 500 },

  /* Stage flow */
  stageFlow: {
    display: "flex", alignItems: "center", gap: 6,
    marginBottom: 6, flexWrap: "wrap",
  },
  stageFrom: {
    fontSize: 12, color: "#64748b", background: "#f1f5f9",
    borderRadius: 6, padding: "2px 8px", textTransform: "capitalize",
  },
  stageArrow: { fontSize: 13, color: "#94a3b8", fontWeight: 700 },
  stageTo: {
    fontSize: 12, fontWeight: 700, background: "#f0fdf4",
    borderRadius: 6, padding: "2px 8px", textTransform: "capitalize",
  },

  /* Notes */
  noteText: {
    fontSize: 13, color: "#475569", lineHeight: 1.5,
    marginBottom: 6, borderTop: "1px dashed #e2e8f0", paddingTop: 6,
  },

  /* Footer */
  cardFooter: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" },
  actorChip: {
    fontSize: 11, color: "#64748b", background: "#f8fafc",
    border: "1px solid #e2e8f0", borderRadius: 20, padding: "2px 9px",
    fontWeight: 600,
  },
  roleChip: {
    fontSize: 10, color: "#7c3aed", background: "#ede9fe",
    border: "1px solid #ddd6fe", borderRadius: 20, padding: "2px 8px",
    fontWeight: 700, textTransform: "capitalize",
  },
  dateChip: {
    fontSize: 10, color: "#94a3b8", marginLeft: "auto",
  },

  /* Action sub-label (raw actionType string) */
  actionSubLabel: {
    fontSize: 10, color: "#64748b", background: "#f1f5f9",
    border: "1px solid #e2e8f0", borderRadius: 20, padding: "1px 7px",
    fontWeight: 600, letterSpacing: "0.02em",
  },

  /* Loading banner */
  loadingBanner: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "14px 16px", background: "#f8fafc",
    border: "1px solid #e2e8f0", borderRadius: 10, margin: "0 0 12px 0",
  },
  loadingSpinner: {
    width: 16, height: 16,
    border: "2px solid #e2e8f0", borderTop: "2px solid #1d4ed8",
    borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0,
  },
};
