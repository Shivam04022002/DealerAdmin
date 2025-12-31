// src/pages/FormView.jsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import API from "../services/api"; // ⬅️ use your axios instance (baseURL: http://192.168.29.106:5001/api)

export default function FormView() {
  const { id } = useParams();
  const [doc, setDoc] = useState(null);
  const [source, setSource] = useState(""); // "workflow" | "approved" | "rejected"
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setErrMsg("");
      try {
        // 1) Try active workflow application
        const wf = await API.get(`/workflow/${id}`);
        if (mounted) {
          setDoc(wf.data);
          setSource("workflow");
          setLoading(false);
          return;
        }
      } catch (e1) {
        // ignore, try snapshots
      }

      try {
        // 2) Try approved snapshot
        const ap = await API.get(`/workflow/applications/approved/${id}`);
        if (mounted) {
          setDoc(ap.data);
          setSource("approved");
          setLoading(false);
          return;
        }
      } catch (e2) {
        // ignore, try rejected
      }

      try {
        // 3) Try rejected snapshot
        const rj = await API.get(`/workflow/applications/rejected/${id}`);
        if (mounted) {
          setDoc(rj.data);
          setSource("rejected");
          setLoading(false);
          return;
        }
      } catch (e3) {
        if (mounted) {
          setErrMsg(
            e3?.response?.data?.message ||
              "Application not found in workflow, approved, or rejected collections."
          );
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [id]);

  if (loading) return <p className="p-6">Loading…</p>;
  if (errMsg) return <p className="p-6 text-danger">Error: {errMsg}</p>;
  if (!doc) return <p className="p-6">No data.</p>;

  const title =
    source === "workflow"
      ? "Active Application"
      : source === "approved"
      ? "Approved Application"
      : source === "rejected"
      ? "Rejected Application"
      : "Application";

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-1">
        {title} — {doc.formId || doc._id}
      </h1>
      <div className="text-muted mb-3">
        Source: <b>{source || "unknown"}</b>
      </div>
      <pre className="bg-gray-100 p-4 rounded" style={{ whiteSpace: "pre-wrap" }}>
        {JSON.stringify(doc, null, 2)}
      </pre>
    </div>
  );
}
