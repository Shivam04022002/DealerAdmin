// src/pages/RejectedFiles.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api"; // baseURL: http://192.168.29.106:5001/api

const RejectedFiles = () => {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const goTo = (id) => navigate(`/rejected/${id}`);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        // Clean backend returns { items, page, limit, total, pages }
        const { data } = await API.get("/workflow/applications/rejected", {
          params: { page: 1, limit: 50, _ts: Date.now() }, // cache-buster
          headers: { "Cache-Control": "no-cache" },
        });
        if (mounted) setApps(Array.isArray(data) ? data : (data?.items || []));
      } catch (err) {
        console.error("Error fetching rejected applications", err?.response?.data || err.message);
        if (mounted) setApps([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="container">
        <h2>Rejected Applications</h2>
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="mb-0">Rejected Applications</h2>
        <button className="btn btn-sm btn-outline-secondary" onClick={() => window.location.reload()}>
          Refresh
        </button>
      </div>

      {apps.length === 0 ? (
        <p>No rejected applications found.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-striped align-middle">
            <thead>
              <tr>
                <th>Form ID</th>
                <th>Applicant</th>
                <th>Dealer</th>
                <th>Branch</th>
                <th>District</th>
                <th>Reason</th>
                <th>Rejected At</th>
                <th className="text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => {
                const id = app?._id;
                const applicantName =
                  app?.applicant?.applicant?.name || app?.applicant?.name || "—";
                const dealerName =
                  app?.dealerDetails?.name || app?.dealer?.name || "—";
                const branch =
                  app?.dealerDetails?.branch || app?.dealer?.branch || "—";
                const district =
                  app?.dealerDetails?.district || app?.dealer?.district || "—";
                const reason = app?.rejection?.reason || "—";
                const rejectedAt = app?.rejection?.rejectedAt
                  ? new Date(app.rejection.rejectedAt).toLocaleString()
                  : (app?.updatedAt ? new Date(app.updatedAt).toLocaleString() : "—");

                return (
                  <tr
                    key={id}
                    onClick={() => goTo(id)}                 // row is clickable
                    style={{ cursor: "pointer" }}
                  >
                    <td className="text-primary text-decoration-underline">
                      {app?.formId || "—"}
                    </td>
                    <td>{applicantName}</td>
                    <td>{dealerName}</td>
                    <td>{branch}</td>
                    <td>{district}</td>
                    <td className="text-danger fw-semibold">{reason}</td>
                    <td>{rejectedAt}</td>
                    <td className="text-end">
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={(e) => {
                          e.stopPropagation(); // prevent row click firing as well
                          goTo(id);
                        }}
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default RejectedFiles;
