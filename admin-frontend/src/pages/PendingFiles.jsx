// src/pages/PendingFiles.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api"; // axios helper with baseURL: http://192.168.29.106:5001/api

export default function PendingFiles() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    const fetchPending = async () => {
      try {
        const { data } = await API.get("/workflow/pending");
        console.log("📌 Pending applications:", data);
        if (mounted) setPending(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("❌ Error fetching pending files", err);
        if (mounted) setPending([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchPending();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold mb-4">Pending Applications</h1>
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Pending Applications</h1>
      {pending.length === 0 ? (
        <p>No pending applications found.</p>
      ) : (
        <table className="w-full border-collapse border">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2">Form ID</th>
              <th className="border p-2">Applicant Name</th>
              <th className="border p-2">Dealer Name</th>
              <th className="border p-2">Dealer Branch</th>
              <th className="border p-2">Last Updated By</th>
            </tr>
          </thead>
          <tbody>
            {pending.map((app) => {
              const applicantName =
                app?.applicant?.name ||
                app?.applicant?.applicant?.name ||
                "—";
              const dealerName =
                app?.dealerDetails?.name || app?.dealer?.name || "—";
              const dealerBranch =
                app?.dealerDetails?.branch || app?.dealer?.branch || "—";
              const lastUpdatedBy = app?.history?.length
                ? app.history[app.history.length - 1]?.updatedBy || "—"
                : "—";

              return (
                <tr
                  key={app._id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => navigate(`/pending/${app._id}`)} // ✅ go to ApplicationView
                >
                  <td className="border p-2">{app.formId || "—"}</td>
                  <td className="border p-2">{applicantName}</td>
                  <td className="border p-2">{dealerName}</td>
                  <td className="border p-2">{dealerBranch}</td>
                  <td className="border p-2">{lastUpdatedBy}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
