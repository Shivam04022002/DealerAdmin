// src/pages/PendingFiles.jsx
import React, { useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useApplications } from "../hooks/useApplications";
import TableSkeleton from "../components/TableSkeleton";
import { WORKFLOW_STAGES, stageLabel } from "../utils/workflowConfig";

/* ─── Memoized row — only re-renders when this row's data changes ─────────── */
const PendingRow = React.memo(function PendingRow({ app, onClick }) {
  const applicantName = app?.applicant?.applicant?.name || app?.applicant?.name || "—";
  const dealerName    = app?.dealerDetails?.name   || "—";
  const branch        = app?.dealerDetails?.branch || "—";
  const updatedAt     = app?.updatedAt ? new Date(app.updatedAt).toLocaleDateString() : "—";

  return (
    <tr style={{ cursor: "pointer" }} onClick={onClick}>
      <td className="text-primary fw-semibold">{app.formId || "—"}</td>
      <td>{applicantName}</td>
      <td>{dealerName}</td>
      <td>{branch}</td>
      <td>
        <span className="badge bg-warning text-dark">
          {app.workflowStage || "—"}
        </span>
      </td>
      <td className="text-muted small">{updatedAt}</td>
    </tr>
  );
});

/* ─── Memoized pagination ─────────────────────────────────────────────────── */
const Pagination = React.memo(function Pagination({ page, pages, total, setPage }) {
  const pageNumbers = useMemo(() => {
    const nums = [];
    const count = Math.min(pages, 7);
    for (let i = 0; i < count; i++) {
      const p = page <= 4 ? i + 1 : page - 3 + i;
      if (p >= 1 && p <= pages) nums.push(p);
    }
    return nums;
  }, [page, pages]);

  if (pages <= 1) return null;

  return (
    <div className="d-flex justify-content-between align-items-center mt-3">
      <small className="text-muted">Page {page} of {pages} · {total} total</small>
      <nav>
        <ul className="pagination pagination-sm mb-0">
          <li className={`page-item ${page <= 1 ? "disabled" : ""}`}>
            <button className="page-link" onClick={() => setPage((p) => p - 1)}>‹ Prev</button>
          </li>
          {pageNumbers.map((p) => (
            <li key={p} className={`page-item ${p === page ? "active" : ""}`}>
              <button className="page-link" onClick={() => setPage(p)}>{p}</button>
            </li>
          ))}
          <li className={`page-item ${page >= pages ? "disabled" : ""}`}>
            <button className="page-link" onClick={() => setPage((p) => p + 1)}>Next ›</button>
          </li>
        </ul>
      </nav>
    </div>
  );
});

export default function PendingFiles() {
  const navigate = useNavigate();
  const searchInputRef = useRef(null);

  const {
    items, total, pages, page,
    isLoading, isFetching, isError,
    refetch, setPage,
    handleSearchChange, handleBranchChange, handleStageChange,
  } = useApplications("pending", 50);

  // Stable per-row click handler factory — avoids inline arrow on every render
  const makeRowClick = useCallback(
    (id) => () => navigate(`/pending/${id}`),
    [navigate],
  );

  return (
    <div className="container py-3">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="mb-0">
          Pending Applications
          {total > 0 && (
            <span className="badge bg-secondary ms-2 fs-6">{total}</span>
          )}
          {/* Live indicator: pulsing dot during background auto-poll */}
          {isFetching && !isLoading && (
            <span
              title="Checking for new applications…"
              style={{
                display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                background: "#22c55e", marginLeft: 8, verticalAlign: "middle",
                animation: "pf-pulse 1.2s ease-in-out infinite",
              }}
            />
          )}
        </h2>
        <button className="btn btn-sm btn-outline-secondary" onClick={() => refetch()}>
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="row g-2 mb-3">
        <div className="col-12 col-md-5">
          <input
            ref={searchInputRef}
            type="search"
            className="form-control form-control-sm"
            placeholder="Search form ID, applicant, dealer…"
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
        <div className="col-6 col-md-3">
          <input
            type="text"
            className="form-control form-control-sm"
            placeholder="Filter by branch"
            onChange={(e) => handleBranchChange(e.target.value)}
          />
        </div>
        <div className="col-6 col-md-4">
          <select
            className="form-select form-select-sm"
            onChange={(e) => handleStageChange(e.target.value)}
          >
            <option value="">All Stages</option>
            {WORKFLOW_STAGES.map((s) => (
              <option key={s} value={s}>{stageLabel(s)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={10} cols={6} />
      ) : isError ? (
        <div className="alert alert-danger">
          Failed to load applications.{" "}
          <button className="btn btn-sm btn-link p-0" onClick={() => refetch()}>Retry</button>
        </div>
      ) : items.length === 0 ? (
        <p className="text-muted">No pending applications found.</p>
      ) : (
        <div
          className="table-responsive"
          style={{ opacity: isFetching ? 0.75 : 1, transition: "opacity 0.2s" }}
        >
          <table className="table table-striped table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Form ID</th>
                <th>Applicant</th>
                <th>Dealer</th>
                <th>Branch</th>
                <th>Stage</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {items.map((app) => (
                <PendingRow
                  key={app._id}
                  app={app}
                  onClick={makeRowClick(app._id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} pages={pages} total={total} setPage={setPage} />

      {/* Pulse animation for live indicator */}
      <style>{`
        @keyframes pf-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(1.5); }
        }
      `}</style>
    </div>
  );
}
