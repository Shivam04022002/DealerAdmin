// src/pages/ApprovedFiles.jsx
import React, { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useApplications } from "../hooks/useApplications";
import TableSkeleton from "../components/TableSkeleton";

/* ─── Memoized row ────────────────────────────────────────────────────────── */
const ApprovedRow = React.memo(function ApprovedRow({ app, onClick }) {
  const applicantName = app?.applicant?.applicant?.name || app?.applicant?.name || "—";
  const dealerName    = app?.dealerDetails?.name     || "—";
  const branch        = app?.dealerDetails?.branch   || "—";
  const district      = app?.dealerDetails?.district || "—";
  const approvedAt    = app?.updatedAt ? new Date(app.updatedAt).toLocaleDateString() : "—";
  return (
    <tr key={app._id}>
      <td className="text-primary fw-semibold">{app.formId || "—"}</td>
      <td>{applicantName}</td>
      <td>{dealerName}</td>
      <td>{branch}</td>
      <td>{district}</td>
      <td className="text-muted small">{approvedAt}</td>
      <td className="text-end">
        <button className="btn btn-sm btn-outline-primary" onClick={onClick}>View</button>
      </td>
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

const ApprovedFiles = () => {
  const navigate = useNavigate();

  const {
    items, total, pages, page,
    isLoading, isFetching, isError,
    refetch, setPage,
    handleSearchChange, handleBranchChange,
  } = useApplications("approved", 50);

  const makeRowClick = useCallback(
    (id) => () => navigate(`/approved/${id}`),
    [navigate],
  );

  return (
    <div className="container py-3">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="mb-0">
          Approved Applications
          {total > 0 && (
            <span className="badge bg-success ms-2 fs-6">{total}</span>
          )}
          {isFetching && !isLoading && (
            <span className="spinner-border spinner-border-sm text-secondary ms-2" />
          )}
        </h2>
        <button className="btn btn-sm btn-outline-secondary" onClick={() => refetch()}>
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="row g-2 mb-3">
        <div className="col-12 col-md-6">
          <input
            type="search"
            className="form-control form-control-sm"
            placeholder="Search form ID, applicant, dealer…"
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
        <div className="col-12 col-md-4">
          <input
            type="text"
            className="form-control form-control-sm"
            placeholder="Filter by branch"
            onChange={(e) => handleBranchChange(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton rows={10} cols={7} />
      ) : isError ? (
        <div className="alert alert-danger">Failed to load applications. <button className="btn btn-sm btn-link p-0" onClick={() => refetch()}>Retry</button></div>
      ) : items.length === 0 ? (
        <p className="text-muted">No approved applications found.</p>
      ) : (
        <div className="table-responsive" style={{ opacity: isFetching ? 0.75 : 1, transition: "opacity 0.2s" }}>
          <table className="table table-striped table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Form ID</th>
                <th>Applicant</th>
                <th>Dealer</th>
                <th>Branch</th>
                <th>District</th>
                <th>Approved At</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((app) => (
                <ApprovedRow key={app._id} app={app} onClick={makeRowClick(app._id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} pages={pages} total={total} setPage={setPage} />
    </div>
  );
};

export default ApprovedFiles;
