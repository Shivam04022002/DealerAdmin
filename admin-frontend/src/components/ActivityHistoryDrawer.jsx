// src/components/ActivityHistoryDrawer.jsx — Audit Log (Stage Updates + Internal Comments)
import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import api from "../services/api";

/* ─── Helpers ────────────────────────────────────────────── */
function fmtDateTime(raw) {
  if (!raw) return { date: "—", time: "" };
  const d = new Date(raw);
  if (isNaN(d)) return { date: "—", time: "" };
  return {
    date: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
  };
}

function dateKey(raw) {
  if (!raw) return "Unknown Date";
  const d = new Date(raw);
  if (isNaN(d)) return "Unknown Date";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const STAGE_META = { color: "#2563eb", bg: "#dbeafe", border: "#bfdbfe", icon: "⬆", label: "Stage Updated" };
const CMT_META   = { color: "#7c3aed", bg: "#ede9fe", border: "#ddd6fe", icon: "💬", label: "Comment"      };

/* ─── Main Component ─────────────────────────────────────── */
export default function ActivityHistoryDrawer({ app, onClose }) {
  const [entries,   setEntries]   = useState([]);
  const [stats,     setStats]     = useState({ stageUpdates: 0, comments: 0, lastUpdatedBy: null, lastUpdatedEmail: null, lastUpdatedAt: null });
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState("all"); // all | stage | comment
  const [visible,   setVisible]   = useState(false);

  /* comment box */
  const [comment,      setComment]      = useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [submitError,  setSubmitError]  = useState("");

  const scrollRef = useRef(null);

  /* animate-in */
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  /* Escape key */
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 280);
  }, [onClose]);

  /* Fetch history */
  const fetchHistory = useCallback(async () => {
    if (!app?._id) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/workflow/applications/${app._id}/history`);
      setEntries(Array.isArray(data.entries) ? data.entries : []);
      if (data.stats) setStats(data.stats);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [app?._id]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  /* Submit comment */
  const handleAddComment = async () => {
    const text = comment.trim();
    if (!text) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const { data } = await api.post(`/workflow/applications/${app._id}/comments`, { comment: text });
      setComment("");
      /* prepend new entry instantly */
      setEntries((prev) => [data.entry, ...prev]);
      setStats((s) => ({ ...s, comments: s.comments + 1, lastUpdatedBy: data.entry.updatedBy, lastUpdatedEmail: data.entry.updatedByEmail, lastUpdatedAt: data.entry.updatedAt }));
    } catch (err) {
      setSubmitError(err?.response?.data?.message || "Failed to save comment.");
    } finally {
      setSubmitting(false);
    }
  };

  /* Derived app info */
  const applicantName = app?.applicant?.applicant?.name || app?.applicant?.name || "—";
  const dealerName    = app?.dealerDetails?.name  || app?.dealer?.name  || "—";
  const branch        = app?.dealerDetails?.branch || app?.dealer?.branch || "—";
  const stage         = app?.workflowStage || "—";
  const formId        = app?.formId        || "—";

  /* Filtered entries */
  const filtered = useMemo(() => {
    if (filter === "stage")   return entries.filter((e) => e.actionType === "STAGE_CHANGED");
    if (filter === "comment") return entries.filter((e) => e.actionType === "COMMENT");
    return entries;
  }, [entries, filter]);

  /* Group by date */
  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach((e) => {
      const k = dateKey(e.updatedAt);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(e);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const { date: lastDate, time: lastTime } = fmtDateTime(stats.lastUpdatedAt);

  /* ─── Render ─── */
  return (
    <>
      <div style={{ ...S.backdrop, opacity: visible ? 1 : 0 }} onClick={handleClose} />
      <div style={{ ...S.drawer, transform: visible ? "translateX(0)" : "translateX(100%)" }} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={S.drawerHeader}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={S.headerIcon}>📋</div>
              <div>
                <div style={S.titleText}>Activity History</div>
                <div style={S.brandTag}>Surjit Finance · Internal Audit Log</div>
              </div>
            </div>
            <button style={S.closeBtn} onClick={handleClose}>✕</button>
          </div>

          {/* File info chips */}
          <div style={S.fileInfoStrip}>
            <InfoChip label="Form ID"   value={formId}        mono />
            <InfoChip label="Applicant" value={applicantName} />
            <InfoChip label="Stage"     value={stage}         highlight />
            <InfoChip label="Dealer"    value={dealerName}    />
            <InfoChip label="Branch"    value={branch}        />
          </div>

          {/* Stats — Stage Updates | Comments | Last Updated */}
          <div style={S.statsRow}>
            <StatCard label="Stage Updates" value={stats.stageUpdates} color="#2563eb" bg="rgba(219,234,254,0.9)" />
            <StatCard label="Comments"      value={stats.comments}     color="#7c3aed" bg="rgba(237,233,254,0.9)" />
            <div style={{ ...S.statCard, background: "rgba(255,255,255,0.12)", textAlign: "left" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Last Updated</div>
              {stats.lastUpdatedBy ? (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>{stats.lastUpdatedBy}</div>
                  {stats.lastUpdatedEmail && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.7)" }}>{stats.lastUpdatedEmail}</div>}
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{lastDate}{lastTime ? ` · ${lastTime}` : ""}</div>
                </>
              ) : (
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>—</div>
              )}
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div style={S.filterBar}>
          {[
            { id: "all",     label: `All  (${entries.length})` },
            { id: "stage",   label: `Stage Updates  (${stats.stageUpdates})` },
            { id: "comment", label: `Comments  (${stats.comments})` },
          ].map((f) => (
            <button key={f.id} style={{ ...S.filterPill, ...(filter === f.id ? S.filterPillActive : {}) }} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Timeline */}
        <div style={S.scrollArea} ref={scrollRef}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "24px 0", color: "#64748b" }}>
              <div style={S.spinner} />
              <span style={{ fontSize: 13 }}>Loading history…</span>
            </div>
          ) : grouped.length === 0 ? (
            <EmptyState />
          ) : (
            grouped.map(([dateLabel, dayEntries], gi) => (
              <div key={dateLabel} style={{ marginBottom: 8 }}>
                <div style={S.dateBadgeWrap}>
                  <div style={S.dateBadge}>{dateLabel}</div>
                  <div style={S.dateLine} />
                </div>
                <div style={{ paddingLeft: 4 }}>
                  {dayEntries.map((entry, ei) => {
                    const isStage   = entry.actionType === "STAGE_CHANGED";
                    const meta      = isStage ? STAGE_META : CMT_META;
                    const { date, time } = fmtDateTime(entry.updatedAt);
                    const isLast    = ei === dayEntries.length - 1 && gi === grouped.length - 1;

                    return (
                      <div key={ei} style={{ display: "flex", gap: 14, marginBottom: 0, animation: "cardIn 0.2s ease both" }}>
                        {/* Dot + line */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                          <div style={{ ...S.dot, background: meta.bg, border: `2px solid ${meta.border}`, color: meta.color }}>
                            <span style={{ fontSize: 12, lineHeight: 1 }}>{meta.icon}</span>
                          </div>
                          {!isLast && <div style={{ width: 2, flex: 1, minHeight: 16, margin: "2px 0", background: meta.border }} />}
                        </div>

                        {/* Card */}
                        <div style={{ ...S.card, borderLeftColor: meta.color, marginBottom: 14 }}>
                          {/* Title row */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                            <span style={{ ...S.typeBadge, background: meta.bg, color: meta.color, borderColor: meta.border }}>
                              {meta.label}
                            </span>
                            <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500, whiteSpace: "nowrap", marginLeft: 8 }}>{time || date}</span>
                          </div>

                          {/* Stage transition */}
                          {isStage && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                              <span style={S.stageFrom}>{entry.oldValue || "—"}</span>
                              <span style={{ fontSize: 16, color: "#94a3b8", fontWeight: 700 }}>→</span>
                              <span style={{ ...S.stageTo, color: meta.color }}>{entry.newValue || "—"}</span>
                            </div>
                          )}

                          {/* Comment text */}
                          {!isStage && entry.remarks && (
                            <div style={S.commentBox}>
                              <span style={{ fontSize: 11, color: "#7c3aed", marginRight: 6 }}>💬</span>
                              <span style={{ fontSize: 13, color: "#374151", lineHeight: 1.5, fontStyle: "italic" }}>"{entry.remarks}"</span>
                            </div>
                          )}

                          {/* Footer: admin name + email + date */}
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                            <span style={S.actorChip}>👤 {entry.updatedBy || "Admin"}</span>
                            {entry.updatedByEmail && (
                              <span style={S.emailChip}>{entry.updatedByEmail}</span>
                            )}
                            {entry.updatedByRole && (
                              <span style={S.roleChip}>{entry.updatedByRole}</span>
                            )}
                            <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: "auto" }}>{date}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
          <div style={{ height: 16 }} />
        </div>

        {/* Comment Box */}
        <div style={S.commentPanel}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <span>💬</span> Internal Comment
          </div>
          <textarea
            style={S.commentTextarea}
            placeholder="Write an internal note…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleAddComment(); }}
          />
          {submitError && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>{submitError}</div>}
          <button
            style={{ ...S.submitBtn, opacity: submitting || !comment.trim() ? 0.55 : 1 }}
            disabled={submitting || !comment.trim()}
            onClick={handleAddComment}
          >
            {submitting ? "Saving…" : "Add Comment"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes cardIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
        @keyframes spin   { to { transform:rotate(360deg); } }
      `}</style>
    </>
  );
}

/* ─── Sub-components ─────────────────────────────────────── */
function InfoChip({ label, value, highlight, mono }) {
  return (
    <div style={{ ...S.infoChip, ...(highlight ? S.infoChipHL : {}) }}>
      <div style={S.infoChipLabel}>{label}</div>
      <div style={{ ...S.infoChipValue, fontFamily: mono ? "monospace" : undefined, color: highlight ? "#93c5fd" : "#fff" }}>
        {value || "—"}
      </div>
    </div>
  );
}

function StatCard({ label, value, color, bg }) {
  return (
    <div style={{ ...S.statCard, background: bg }}>
      <div style={{ ...S.statValue, color }}>{value ?? 0}</div>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#475569", marginTop: 3 }}>{label}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ textAlign: "center", padding: "48px 24px", color: "#94a3b8" }}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>
      <div style={{ fontWeight: 700, fontSize: 15, color: "#64748b", marginBottom: 4 }}>No activity yet</div>
      <div style={{ fontSize: 13 }}>Stage changes and comments will appear here.</div>
    </div>
  );
}

/* ─── Styles ─────────────────────────────────────────────── */
const S = {
  backdrop: {
    position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)",
    zIndex: 8000, transition: "opacity 0.28s", backdropFilter: "blur(3px)",
  },
  drawer: {
    position: "fixed", top: 0, right: 0, bottom: 0, width: "min(560px, 96vw)",
    background: "#fff", zIndex: 8001, display: "flex", flexDirection: "column",
    boxShadow: "-6px 0 32px rgba(0,0,0,0.16)",
    transition: "transform 0.28s cubic-bezier(0.16,1,0.3,1)",
    borderRadius: "20px 0 0 20px", overflow: "hidden",
    fontFamily: "Inter,ui-sans-serif,system-ui,sans-serif",
  },
  drawerHeader: {
    background: "linear-gradient(135deg,#1e3a5f 0%,#1d4ed8 60%,#3b82f6 100%)",
    padding: "18px 20px 14px", flexShrink: 0,
  },
  headerIcon: {
    width: 40, height: 40, borderRadius: 10,
    background: "rgba(255,255,255,0.18)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 20, border: "1px solid rgba(255,255,255,0.25)",
  },
  titleText: { fontSize: 17, fontWeight: 800, color: "#fff" },
  brandTag:  { fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.65)", marginTop: 2 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 8, border: "1px solid rgba(255,255,255,0.25)",
    background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: 15,
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  },
  fileInfoStrip: {
    display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 12,
  },
  infoChip: {
    background: "rgba(255,255,255,0.1)", borderRadius: 8,
    padding: "5px 9px", border: "1px solid rgba(255,255,255,0.15)",
  },
  infoChipHL: { background: "rgba(255,255,255,0.22)", border: "1px solid rgba(255,255,255,0.4)" },
  infoChipLabel: { fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.05em" },
  infoChipValue: { fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1 },
  statsRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 },
  statCard: { borderRadius: 10, padding: "8px 12px", textAlign: "center" },
  statValue: { fontSize: 22, fontWeight: 800, lineHeight: 1 },

  /* Filter bar */
  filterBar: {
    display: "flex", gap: 6, padding: "10px 16px",
    borderBottom: "1px solid #e2e8f0", flexShrink: 0,
    overflowX: "auto",
  },
  filterPill: {
    padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
    border: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b",
    cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap",
  },
  filterPillActive: { background: "#1d4ed8", color: "#fff", borderColor: "#1d4ed8" },

  /* Scroll area */
  scrollArea: { flex: 1, overflowY: "auto", padding: "16px 20px 0" },

  /* Date badge */
  dateBadgeWrap: { display: "flex", alignItems: "center", gap: 10, marginBottom: 14 },
  dateBadge: {
    background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 20,
    padding: "3px 12px", fontSize: 11, fontWeight: 700, color: "#475569", whiteSpace: "nowrap",
  },
  dateLine: { flex: 1, height: 1, background: "#e2e8f0" },

  /* Dot */
  dot: {
    width: 30, height: 30, borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0, zIndex: 1,
  },

  /* Card */
  card: {
    flex: 1, background: "#fff", border: "1px solid #e2e8f0",
    borderLeft: "3px solid #2563eb", borderRadius: "0 10px 10px 0",
    padding: "10px 14px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  },
  typeBadge: {
    fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20,
    border: "1px solid transparent",
  },
  stageFrom: {
    fontSize: 12, color: "#64748b", background: "#f1f5f9",
    borderRadius: 6, padding: "3px 10px", textTransform: "capitalize", fontWeight: 600,
  },
  stageTo: {
    fontSize: 12, fontWeight: 700, background: "#eff6ff",
    borderRadius: 6, padding: "3px 10px", textTransform: "capitalize",
  },
  commentBox: {
    background: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: 8,
    padding: "8px 12px", marginBottom: 6, display: "flex", alignItems: "flex-start", gap: 4,
  },
  actorChip: {
    fontSize: 11, color: "#374151", background: "#f1f5f9",
    border: "1px solid #e2e8f0", borderRadius: 20, padding: "2px 9px", fontWeight: 600,
  },
  emailChip: {
    fontSize: 10, color: "#6b7280", background: "#f9fafb",
    border: "1px solid #e5e7eb", borderRadius: 20, padding: "2px 8px",
  },
  roleChip: {
    fontSize: 10, color: "#7c3aed", background: "#ede9fe",
    border: "1px solid #ddd6fe", borderRadius: 20, padding: "2px 8px",
    fontWeight: 700, textTransform: "capitalize",
  },

  /* Spinner */
  spinner: {
    width: 16, height: 16, border: "2px solid #e2e8f0",
    borderTop: "2px solid #1d4ed8", borderRadius: "50%",
    animation: "spin 0.7s linear infinite", flexShrink: 0,
  },

  /* Comment panel */
  commentPanel: {
    borderTop: "1px solid #e2e8f0", padding: "14px 20px", background: "#fafbfc", flexShrink: 0,
  },
  commentTextarea: {
    width: "100%", boxSizing: "border-box", border: "1.5px solid #e2e8f0",
    borderRadius: 10, padding: "10px 12px", fontSize: 13, fontFamily: "inherit",
    resize: "vertical", outline: "none", color: "#111827", background: "#fff",
    transition: "border-color 0.15s",
  },
  submitBtn: {
    marginTop: 8, padding: "8px 20px", borderRadius: 9, border: "none",
    background: "#1d4ed8", color: "#fff", fontWeight: 700, fontSize: 13,
    cursor: "pointer", transition: "opacity 0.15s",
  },
};
