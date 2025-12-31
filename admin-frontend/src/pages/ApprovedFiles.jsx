import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

const ApprovedFiles = () => {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = async () => {
    try {
      setLoading(true);
      // clean backend returns: { items, page, limit, total, pages }
      const { data } = await API.get("/workflow/applications/approved", {
        params: { page: 1, limit: 50, _ts: Date.now() }, // ⬅️ cache-buster
        headers: { "Cache-Control": "no-cache" },
      }); 
      setApps(Array.isArray(data) ? data : (data?.items || []));
    } catch (err) {
      console.error("Error fetching approved applications", err?.response?.data || err.message);
      setApps([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (mounted) await load();
    })();
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="container">
        <h2 className="d-flex justify-content-between align-items-center">
          <span>Approved Applications</span>
          <button className="btn btn-sm btn-outline-secondary" disabled>Loading…</button>
        </h2>
      </div>
    );
  }

  return (
    <div className="container">
      <h2 className="mb-4 d-flex justify-content-between align-items-center">
        <span>Approved Applications</span>
        <button className="btn btn-sm btn-outline-secondary" onClick={load}>
          Refresh
        </button>
      </h2>

      {apps.length === 0 ? (
        <p>No approved applications found.</p>
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
                <th>Approved At</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => {
                const applicantName =
                  app?.applicant?.applicant?.name || app?.applicant?.name || "—";
                const dealerName = app?.dealerDetails?.name || "—";
                const branch = app?.dealerDetails?.branch || "—";
                const district = app?.dealerDetails?.district || "—";
                const approvedAt = app?.approval?.approvedAt
                  ? new Date(app.approval.approvedAt).toLocaleString()
                  : app?.updatedAt
                  ? new Date(app.updatedAt).toLocaleString()
                  : "—";

                return (
                  <tr key={app._id} className="cursor-pointer">
                    <td>{app?.formId || "—"}</td>
                    <td>{applicantName}</td>
                    <td>{dealerName}</td>
                    <td>{branch}</td>
                    <td>{district}</td>
                    <td>{approvedAt}</td>
                    <td className="text-end">
                      <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => navigate(`/approved/${app._id}`)}
                      >
                        View Details
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

export default ApprovedFiles;
