// src/pages/ApplicationView.jsx
import React, { useRef, useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import Navbar from "../components/Navbar";

export default function ApplicationView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { admin } = useAuth() || {};

  // Full linear workflow (lowercase) - adjust if you have more steps
  const WORKFLOW = [
    "contact creation",
    "cibil",
    "housevisit",
    "document collection",
    "credit sanction",
    "agreement",
    "pre-disbursement documentation",
    "disbursement", // keep 'disbursement' as final label used in some backends
    "disbursed", // tolerate both spellings
  ].map((s) => String(s || "").toLowerCase());

  function getNextStage(current) {
    const idx = WORKFLOW.indexOf(String(current || "").toLowerCase());
    if (idx === -1) return WORKFLOW[0];
    // if already final, return final
    if (idx >= WORKFLOW.length - 1) return WORKFLOW[WORKFLOW.length - 1];
    return WORKFLOW[idx + 1];
  }

  // Refs for right-column sections
  const applicantRef = useRef(null);
  const coApplicantRef = useRef(null);
  const vehicleRef = useRef(null);
  const financeRef = useRef(null);
  const dealerRef = useRef(null);
  const statusRef = useRef(null);
  const workflowRef = useRef(null);

  const [activeSection, setActiveSection] = useState("Applicant");
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);

  // prevent duplicate updates per app id (persist across renders)
  const pendingUpdatesRef = useRef(new Set());
  const [updating, setUpdating] = useState(false);
  const [approving, setApproving] = useState(false);

  // >>> ADDED: admin workflow states
  const [adminWorkflow, setAdminWorkflow] = useState([]); // array of stage strings from backend
  const [loadingWorkflow, setLoadingWorkflow] = useState(false);
  const [stageChanging, setStageChanging] = useState(false); // for UI disable while changing stage
  // <<< END ADDED

  // ================== Update / Approve ==================
  // Single canonical update; uses expectedCurrentStage to avoid races.
  const handleUpdate = async () => {
    if (!app?._id) return;

    // guard: avoid multiple concurrent updates for same app
    if (pendingUpdatesRef.current.has(app._id)) {
      console.log("Update already in progress for", app._id);
      return;
    }
    pendingUpdatesRef.current.add(app._id);
    setUpdating(true);

    try {
      const currentStage = String(app.workflowStage || "").toLowerCase();
      const nextStage = getNextStage(currentStage);

      // treat these as final/approve names
      const FINAL_STAGES = ["disbursement", "disbursed"];


      const currentIsFinal = FINAL_STAGES.includes(currentStage);

      if (currentIsFinal) {
        // Current stage is already final -> call approve endpoint
        try {
          console.log(`[handleUpdate] current is final -> calling approve for ${app._id}`);
          const apro = await api.post(`/workflow/approve/${app._id}`, { note: "Approved via UI" });
          console.log("Approve endpoint response:", apro?.data);
        } catch (approveErr) {
          console.error("Approve endpoint failed:", approveErr?.response?.data || approveErr?.message);
          const msg = approveErr?.response?.data?.message || approveErr?.message || "Approve failed";
          alert("Approve failed: " + msg);
          return;
        }
      } else {
        // Normal non-final transition: PATCH to set nextStage (even if nextStage is final)
        try {
          console.log(`[handleUpdate] PATCH /workflow/update/${app._id}`, {
            nextWorkflowStage: nextStage,
            expectedCurrentStage: currentStage,
          });
          const res = await api.patch(`/workflow/update/${app._id}`, {
            nextWorkflowStage: nextStage,
            expectedCurrentStage: currentStage,
          });
          console.log("Non-final update response:", res?.data);
        } catch (err) {
          const status = err?.response?.status;
          if (status === 409) {
            console.warn("Stage mismatch (someone else updated it). Refetching latest application.");
            try {
              const { data: refreshed } = await api.get(`/workflow/${app._id}`);
              setApp(refreshed);
            } catch (reErr) {
              console.warn("Refetch after 409 failed:", reErr?.response || reErr);
            }
            alert("Application stage changed by another user; reloaded latest stage.");
            return;
          }

          if (status === 404) {
            console.error("PATCH endpoint not found (PATCH /workflow/update/:id).");
            alert("Update endpoint not found on server. See console for details.");
            return;
          }

          console.error("Update failed:", err?.response || err);
          const msg = err?.response?.data?.message || err?.message || "Update failed";
          alert("Update failed: " + msg);
          return;
        }
      }

      // REFRESH once after success (either non-final transition or approve)
      try {
        const { data: refreshed } = await api.get(`/workflow/${app._id}`);
        setApp(refreshed);
      } catch (reFetchErr) {
        // When final approve succeeds the pending doc is deleted on server -> GET returns 404.
        if (reFetchErr?.response?.status === 404) {

          console.log("Application moved to Approved (pending doc no longer exists). Navigating to approved list.");
          alert("Application approved and moved to Approved collection.");
          navigate("/approved");
          return;
        }
        console.warn("Could not re-fetch after update/approve:", reFetchErr?.response || reFetchErr);
      }

      // success feedback: if we just did a normal stage move, show next stage,
      // if we approved (currentIsFinal) we've already navigated/alerted above on re-fetch.
      if (!currentIsFinal) {
        alert(`Moved to stage: ${nextStage}`);
      } else {
        // If we approved and the document still exists, navigate to approved list
        navigate("/approved");
      }
    } finally {
      pendingUpdatesRef.current.delete(app._id);
      setUpdating(false);
    }
  };

  // >>> ADDED: changeStage function to set arbitrary stage from adminWorkflow
  const changeStage = async (targetStage) => {
    if (!app?._id) return;
    if (stageChanging) return;
    setStageChanging(true);
    try {
      const currentStage = String(app.workflowStage || "").toLowerCase();

      // If targetStage equals current, do nothing
      if (String(targetStage || "").toLowerCase() === currentStage) {
        setStageChanging(false);
        return;
      }

      // If targetStage is a final stage, the backend will handle moving to Approved as needed.
      console.log(`[changeStage] PATCH /workflow/update/${app._id}`, { nextWorkflowStage: targetStage, expectedCurrentStage: currentStage });

      try {
        await api.patch(`/workflow/update/${app._id}`, {
          nextWorkflowStage: targetStage,
          expectedCurrentStage: currentStage,
        });
      } catch (err) {
        const status = err?.response?.status;
        // 400: invalid stage for this admin (allowedStages returned)
        if (status === 400) {
          const allowed = err?.response?.data?.allowedStages;
          const msg = err?.response?.data?.message || "Invalid stage requested";
          if (Array.isArray(allowed) && allowed.length > 0) {
            alert(`${msg}. Allowed stages: ${allowed.join(", ")}`);
          } else {
            alert(msg);
          }
          return;
        }
        // 409: optimistic concurrency mismatch
        if (status === 409) {
          alert("Current stage mismatch. Reloading latest application...");
          try {
            const { data: refreshed } = await api.get(`/workflow/${app._id}`);
            setApp(refreshed);
          } catch (reErr) {
            console.warn("Refetch after 409 failed:", reErr?.response || reErr);
          }
          return;
        }

        // Other errors
        console.error("changeStage error:", err?.response || err);
        const msg = err?.response?.data?.message || err?.message || "Stage change failed";
        alert("Stage change failed: " + msg);
        return;
      }

      // On success, refresh the application (may be deleted if final)
      try {
        const { data: refreshed } = await api.get(`/workflow/${app._id}`);
        setApp(refreshed);
      } catch (reFetchErr) {
        if (reFetchErr?.response?.status === 404) {
          alert("Application approved and moved to Approved collection.");
          navigate("/approved");
          return;
        }
        console.warn("Could not re-fetch after changeStage:", reFetchErr?.response || reFetchErr);
      }

      alert(`Stage changed to ${targetStage}`);
    } finally {
      setStageChanging(false);
    }
  };
  // <<< END ADDED

  // Approve button handler
  const handleApprove = async () => {
    if (!app?._id) return;
    if (pendingUpdatesRef.current.has(app._id)) return;
    pendingUpdatesRef.current.add(app._id);
    setApproving(true);
    try {
      console.log(`[handleApprove] POST /workflow/approve/${app._id}`);
      const res = await api.post(`/workflow/approve/${app._id}`, {
        note: "Approved via admin UI",
        approvedByName: "Admin",
      });
      console.log("Approve response:", res?.data);
      alert(res.data?.message || "Application approved successfully");
      // Return to appropriate pending list based on role
      if (admin?.role === "superadmin") {
        navigate("/superadmin-dashboard", { state: { focus: "files", filesTab: "pending" } });
      } else {
        navigate("/dashboard", { state: { focus: "pending" } });
      }
    } catch (err) {
      console.error("Error approving application:", err?.response || err);
      const msg = err?.response?.data?.message || err?.message || "Approve failed";
      alert("Approve failed: " + msg);
    } finally {
      pendingUpdatesRef.current.delete(app._id);
      setApproving(false);
    }
  };

  // ================== Reject Application ==================
  const handleReject = async () => {
    if (!app?._id) return;

    const reason = prompt("Enter rejection reason:");
    if (!reason) return;

    try {
      await api.post(`/workflow/reject/${app._id}`, {
        reason,
        note: "Rejected by admin",
        rejectedByName: "Admin",
      });

      alert("Application rejected!");
      // Return to appropriate pending list based on role
      if (admin?.role === "superadmin") {
        navigate("/superadmin-dashboard", { state: { focus: "files", filesTab: "pending" } });
      } else {
        navigate("/dashboard", { state: { focus: "pending" } });
      }
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err.message ||
        "Reject failed";
      console.error("Reject error:", msg);
      alert(msg);
    }
  };

  // ================== Fetch application ==================
  // ================== Fetch application ==================
  // ================== Fetch application ==================
  useEffect(() => {
    if (!id) {
      console.log("⚠️ ApplicationView: no id param — skipping fetch.");
      return;
    }

    (async () => {
      console.log("🔍 [ApplicationView] Fetching application id:", id);
      setLoading(true);
      try {
        console.log("➡️ GET /workflow/" + id);
        const { data } = await api.get(`/workflow/${id}`);
        console.log("✅ Application fetched:", data);
        setApp(data);
      } catch (err) {
        console.error("❌ Application fetch error:", err?.response?.status, err?.response?.data || err.message);
      } finally {
        setLoading(false);
        console.log("⏹ ApplicationView: fetch finished.");
      }
    })();
  }, [id]);


  // >>> ADDED: fetch admin workflow for buttons
  // ================== Fetch admin workflow ==================
  useEffect(() => {
    (async () => {
      console.log(" [useEffect] Fetching admin workflow...");
      setLoadingWorkflow(true);
      try {
        console.log("➡️ API call: GET /admin/workflow");
        const { data } = await api.get("/admin/workflow");
        console.log("✅ [useEffect] Admin workflow fetched:", data);

        const workflowArr = Array.isArray(data?.workflow)
          ? data.workflow
          : (typeof data?.workflow === "string" ? data.workflow.split(/[,\\n]+/) : []);
        console.log("📋 Normalized workflow array:", workflowArr);

        setAdminWorkflow(workflowArr);
      } catch (err) {
        const status = err?.response?.status;
        const resData = err?.response?.data;
        console.error(" [useEffect] Failed to fetch admin workflow");
        console.log("Status:", status);
        console.log("Response data:", resData);
        console.log("Full error object:", err);
      } finally {
        setLoadingWorkflow(false);
        console.log("⏹️ [useEffect] Finished loading admin workflow.");
      }
    })();
  }, []);

  // <<< END ADDED

  // Helper to normalize applicant shape
  const applicantData = app?.applicant?.applicant || app?.applicant || null;
  const applicantPhoto = applicantData?.photo || "";
  const applicantName = applicantData?.name || "Applicant";

  const scrollTo = (ref, section) => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(section);
    }
  };

  // Track visible section
  useEffect(() => {
    const sections = [
      { ref: applicantRef, id: "Applicant" },
      { ref: coApplicantRef, id: "Co-Applicant" },
      { ref: vehicleRef, id: "Vehicle Details" },
      { ref: financeRef, id: "Finance Details" },
      { ref: dealerRef, id: "Dealer Details" },
      { ref: statusRef, id: "Status" },
      { ref: workflowRef, id: "Workflow" },
    ];

    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActiveSection(e.target.dataset.id)),
      { threshold: 0.5 }
    );

    sections.forEach((s) => {
      if (s.ref.current) {
        s.ref.current.dataset.id = s.id;
        observer.observe(s.ref.current);
      }
    });

    return () => {
      sections.forEach((s) => s.ref.current && observer.unobserve(s.ref.current));
    };
  }, []);

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center h-screen">Loading…</div>
      </>
    );
  }

  return (
    <>
      <Navbar />

      <div
        style={{
          display: "flex",
          height: "calc(100vh - 62px)",
          background: "linear-gradient(135deg, #b3e5fc, #e0f7fa)",
          padding: "18px",
          gap: "18px",
          overflow: "hidden",
          paddingTop: 12,
        }}
      >
        {/* LEFT / NAV COLUMN */}
        <div
          className="p-4"
          style={{
            width: "%",
            height: "100%",
            overflowY: "auto",
            borderRadius: "16px",
            background: "rgba(255,255,255,0.9)",
            backdropFilter: "blur(10px)",
            boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
          }}
        >
          {/* Applicant */}
          <h2
            className={`text-xl font-bold cursor-pointer mb-4 tracking-wide transition-colors sticky top-1 z-10 bg-white py-2
    ${activeSection === "Applicant" ? "text-blue-600" : "text-gray-700"}`}
            onClick={() => scrollTo(applicantRef, "Applicant")}
          >
            Applicant
          </h2>

          <div className="flex flex-col items-center mb-5">
            <div
              style={{
                width: "150px",
                height: "150px",
                borderRadius: "14px",
                overflow: "hidden",
                border: "3px solid #fff",
                background: "linear-gradient(145deg, #f9fafb, #e5e7eb)",
                boxShadow: "0 6px 15px rgba(0,0,0,0.15), inset 0 2px 6px rgba(255,255,255,0.4)",
                margin: "0 auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.3s ease",
                cursor: "pointer",
              }}
            >
              {applicantPhoto ? (
                <img src={applicantPhoto} alt="Applicant" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div
                  className="flex items-center justify-center bg-gray-200 text-gray-500"
                  style={{ width: "100%", height: "100%", fontSize: "14px", fontWeight: "bold" }}
                >
                  No Photo
                </div>
              )}
            </div>

            <div className="mt-3 font-semibold text-center w-full truncate" title={applicantName} style={{ fontSize: "1.05rem", color: "#222" }}>
              <b>{applicantName}</b>
            </div>
          </div>

          <hr className="my-4 border-gray-300" />

          {/* Co-Applicant */}
          <h2
            className={`text-xl font-bold cursor-pointer mb-4 tracking-wide transition-colors ${activeSection === "Co-Applicant" ? "text-blue-600" : "text-gray-700"
              }`}
            style={{ textAlign: "center" }}
            onClick={() => scrollTo(coApplicantRef, "Co-Applicant")}
          >
            Co-Applicant
          </h2>

          <div className="flex flex-col items-center mb-5">
            <div
              style={{
                width: "150px",
                height: "150px",
                borderRadius: "14px",
                overflow: "hidden",
                border: "3px solid #fff",
                background: "linear-gradient(145deg, #f9fafb, #e5e7eb)",
                boxShadow: "0 6px 15px rgba(0,0,0,0.15), inset 0 2px 6px rgba(255,255,255,0.4)",
                margin: "0 auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.3s ease",
                cursor: "pointer",
              }}
            >
              {app?.coApplicant?.photo ? (
                <img src={app.coApplicant.photo} alt="Co-Applicant" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div className="flex items-center justify-center bg-gray-200 text-gray-500" style={{ width: "100%", height: "100%", fontSize: "14px", fontWeight: "bold" }}>
                  No Photo
                </div>
              )}
            </div>

            <div className="mt-3 font-semibold text-center w-full truncate" title={app?.coApplicant?.name || "Co-Applicant"} style={{ fontSize: "1.05rem", color: "#222" }}>
              <b>{app?.coApplicant?.name || "Co-Applicant"}</b>
            </div>
          </div>

          <hr className="my-4 border-gray-300" />

          {/* Other navigation */}
          <h2 className="text-xl font-bold mb-3 text-center text-gray-700">Other</h2>
          <ul className="ml-4 space-y-2">
            {["Vehicle Details", "Finance Details", "Dealer Details", "Status", "Workflow"].map((item) => (
              <li
                key={item}
                className={`cursor-pointer font-medium transition-colors ${activeSection === item ? "text-blue-600" : "text-gray-700 hover:text-blue-500"}`}
                onClick={() => {
                  const map = {
                    "Vehicle Details": vehicleRef,
                    "Finance Details": financeRef,
                    "Dealer Details": dealerRef,
                    "Status": statusRef,
                    "Workflow": workflowRef,
                  };
                  scrollTo(map[item], item);
                }}
              >
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* RIGHT / CONTENT COLUMN */}
        <div className="bg-white p-6 shadow-lg" style={{ flex: 1, height: "100%", overflowY: "auto", borderRadius: "12px", paddingLeft: "120px" }}>
          {/* Applicant Section */}
          <div ref={applicantRef} className="mb-12 pb-6" style={{ borderBottom: "2px solid #e5e7eb" }}>
            <h2 className="text-3xl font-bold mb-6 text-blue-600" style={{ textAlign: "center", marginRight: "180px" }}>
              Applicant
            </h2>

            <hr className="my-1 border-gray-300" />
            <hr className="my-1 border-gray-300" />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
              {/* LEFT COLUMN */}
              <div className="space-y-4">
                <div>
                  <label className="font-semibold">
                    <b>Profile</b>
                  </label>
                  <div className="rounded-md border overflow-hidden flex items-center justify-center" style={{ width: "143px", height: "144px" }}>
                    {app?.applicant?.applicant?.photo ? (
                      <img src={app.applicant.applicant.photo} alt="Applicant" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <span className="text-gray-500">No Image</span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="font-semibold">
                    <b>Aadhaar Number</b>
                  </label>
                  <p>{app?.applicant?.applicant?.aadharNo || "—"}</p>
                </div>

                <div>
                  <label className="font-semibold">
                    <b>Aadhaar Front</b>
                  </label>
                  <br />
                  {app?.applicant?.applicant?.aadharFront ? (
                    <img src={app.applicant.applicant.aadharFront} alt="Aadhaar Front" style={{ width: "150px", height: "100px", objectFit: "cover" }} />
                  ) : (
                    <span className="text-gray-500">No Image</span>
                  )}
                </div>

                <div>
                  <label className="font-semibold">
                    <b>PAN Image</b>
                  </label>
                  <br />
                  {app?.applicant?.applicant?.panImage ? (
                    <img src={app.applicant.applicant.panImage} alt="PAN" style={{ width: "150px", height: "100px", objectFit: "cover" }} />
                  ) : (
                    <span className="text-gray-500">No Image</span>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN */}
              <div className="space-y-4">
                <div>
                  <label className="font-semibold">
                    <b>Name</b>
                  </label>
                  <p>{app?.applicant?.applicant?.name || "—"}</p>
                </div>

                <div>
                  <label className="font-semibold">
                    <b>Father’s Name</b>
                  </label>
                  <p>{app?.applicant?.applicant?.fatherName || "—"}</p>
                </div>

                <div>
                  <label className="font-semibold">
                    <b>DOB</b> / <b>Age</b>
                  </label>
                  <p>{app?.applicant?.applicant?.dateOfBirth ? app.applicant.applicant.dateOfBirth.substring(0, 10) : "—"} / {app?.applicant?.applicant?.age || "—"}</p>
                </div>

                <div>
                  <label className="font-semibold">
                    <b>Aadhaar Back</b>
                  </label>
                  <br />
                  {app?.applicant?.applicant?.aadharBack ? (
                    <img src={app.applicant.applicant.aadharBack} alt="Aadhaar Back" style={{ width: "150px", height: "100px", objectFit: "cover" }} />
                  ) : (
                    <span className="text-gray-500">No Image</span>
                  )}
                </div>

                <div>
                  <label className="font-semibold">
                    <b>PAN No</b>
                  </label>
                  <p>{app?.applicant?.applicant?.panNo || "—"}</p>
                </div>

                <div>
                  <label className="font-semibold">
                    <b>Address</b>
                  </label>
                  <p>{app?.applicant?.applicant?.address || "—"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Co-Applicant Section */}
          <div ref={coApplicantRef} className="mb-12 border-b pb-4">
            <h2 className="text-2xl font-bold mb-4" style={{ textAlign: "center", marginRight: "180px" }}>
              Co-Applicant
            </h2>

            <hr className="my-1 border-gray-300" />
            <hr className="my-1 border-gray-300" />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              {/* LEFT COLUMN */}
              <div className="space-y-4">
                <div>
                  <label className="font-semibold">
                    <b>Profile</b>
                  </label>
                  <div className="rounded-md border overflow-hidden flex items-center justify-center" style={{ width: "150px", height: "150px" }}>
                    {app?.coApplicant?.photo ? (
                      <img src={app.coApplicant.photo} alt="Co-Applicant" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <span className="text-gray-500">No Image</span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="font-semibold">
                    <b>Aadhaar No</b>
                  </label>
                  <p>{app?.coApplicant?.aadharNo || "—"}</p>
                </div>

                <div>
                  <label className="font-semibold">
                    <b>Aadhaar Front</b>
                  </label>
                  <br />
                  {app?.coApplicant?.aadharFront ? (
                    <img src={app.coApplicant.aadharFront} alt="Aadhaar Front" style={{ width: "150px", height: "100px", objectFit: "cover" }} />
                  ) : (
                    <span className="text-gray-500">No Image</span>
                  )}
                </div>

                <div>
                  <label className="font-semibold">
                    <b>Aadhaar Back</b>
                  </label>
                  <br />
                  {app?.coApplicant?.aadharBack ? (
                    <img src={app.coApplicant.aadharBack} alt="Aadhaar Back" style={{ width: "150px", height: "100px", objectFit: "cover" }} />
                  ) : (
                    <span className="text-gray-500">No Image</span>
                  )}
                </div>

                <div>
                  <label className="font-semibold">
                    <b>PAN Image</b>
                  </label>
                  <br />
                  {app?.coApplicant?.panImage ? (
                    <img src={app.coApplicant.panImage} alt="PAN" style={{ width: "150px", height: "100px", objectFit: "cover" }} />
                  ) : (
                    <span className="text-gray-500">No Image</span>
                  )}
                </div>

                <div>
                  <label className="font-semibold">
                    <b>Form 60</b>
                  </label>
                  <br />
                  {app?.coApplicant?.form60 ? (
                    <img src={app.coApplicant.form60} alt="Form 60" style={{ width: "150px", height: "100px", objectFit: "cover" }} />
                  ) : (
                    <span className="text-gray-500">No Image</span>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN */}
              <div className="space-y-4">
                <div>
                  <label className="font-semibold">
                    <b>Name</b>
                  </label>
                  <p>{app?.coApplicant?.name || "—"}</p>
                </div>

                <div>
                  <label className="font-semibold">
                    <b>Father’s Name</b>
                  </label>
                  <p>{app?.coApplicant?.fatherName || "—"}</p>
                </div>

                <div>
                  <label className="font-semibold">
                    <b>DOB</b> / <b>Age</b>
                  </label>
                  <p>{app?.coApplicant?.dateOfBirth ? app.coApplicant.dateOfBirth.substring(0, 10) : "—"} / {app?.coApplicant?.age || "—"}</p>
                </div>

                <div>
                  <label className="font-semibold">
                    <b>PAN No</b>
                  </label>
                  <p>{app?.coApplicant?.panNo || "—"}</p>
                </div>

                <div>
                  <label className="font-semibold">
                    <b>Address</b>
                  </label>
                  <p>{app?.coApplicant?.address || "—"}</p>
                </div>

                <div>
                  <label className="font-semibold">
                    <b>Pincode</b>
                  </label>
                  <p>{app?.coApplicant?.pincode || "—"}</p>
                </div>

                <div>
                  <label className="font-semibold">
                    <b>Police Station</b>
                  </label>
                  <p>{app?.coApplicant?.policeStation || "—"}</p>
                </div>

                <div>
                  <label className="font-semibold">
                    <b>Post Office</b>
                  </label>
                  <p>{app?.coApplicant?.postOffice || "—"}</p>
                </div>

                <div>
                  <label className="font-semibold">
                    <b>Relation</b>
                  </label>
                  <p>{app?.coApplicant?.relation || "N/A"}</p>
                </div>

                <div>
                  <label className="font-semibold">
                    <b>Document Type</b>
                  </label>
                  <p>{app?.coApplicant?.documentType || "—"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Vehicle Details */}
          <div ref={vehicleRef} className="mb-12 border-b pb-4">
            <h2 className="text-2xl font-bold mb-4" style={{ textAlign: "center", marginRight: "180px" }}>
              Vehicle Details
            </h2>

            <hr className="my-1 border-gray-300" />
            <hr className="my-1 border-gray-300" />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div className="space-y-4">
                <div>
                  <label className="font-semibold">
                    <b>Brand Name</b>
                  </label>
                  <p>{app?.vehicleDetails?.brandName || "—"}</p>
                </div>
                <div>
                  <label className="font-semibold">
                    <b>Model Name</b>
                  </label>
                  <p>{app?.vehicleDetails?.modelName || "—"}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="font-semibold">
                    <b>Price of Vehicle</b>
                  </label>
                  <p>{app?.vehicleDetails?.priceOfVehicle || "—"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Finance Details */}
          <div ref={financeRef} className="mb-12 border-b pb-4">
            <h2 className="text-2xl font-bold mb-4" style={{ textAlign: "center", marginRight: "180px" }}>
              Finance Details
            </h2>

            <hr className="my-1 border-gray-300" />
            <hr className="my-1 border-gray-300" />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div className="space-y-4">
                <div>
                  <label className="font-semibold">
                    <b>Finance Required</b>
                  </label>
                  <p>{app?.vehicleDetails?.financeRequired || "—"}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="font-semibold">
                    <b>Tenure</b>
                  </label>
                  <p>{app?.vehicleDetails?.tenure || "—"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Dealer Details */}
          <div ref={dealerRef} className="mb-12 border-b pb-4">
            <h2 className="text-2xl font-bold mb-4" style={{ textAlign: "center", marginRight: "180px" }}>
              Dealer Details
            </h2>

            <hr className="my-1 border-gray-300" />
            <hr className="my-1 border-gray-300" />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div className="space-y-4">
                <div>
                  <label className="font-semibold">
                    <b>Email</b>
                  </label>
                  <p>{app?.dealerDetails?.email || "—"}</p>
                </div>
                <div>
                  <label className="font-semibold">
                    <b>Branch</b>
                  </label>
                  <p>{app?.dealerDetails?.branch || "—"}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="font-semibold">
                    <b>Name</b>
                  </label>
                  <p>{app?.dealerDetails?.name || "—"}</p>
                </div>
                <div>
                  <label className="font-semibold">
                    <b>District</b>
                  </label>
                  <p>{app?.dealerDetails?.district || "—"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Status */}
          <div ref={statusRef} className="mb-12 border-b pb-4">
            <h2 className="text-2xl font-bold mb-2" style={{ textAlign: "center", marginRight: "180px" }}>
              Status
            </h2>

            <hr className="my-1 border-gray-300" />
            <hr className="my-1 border-gray-300" />

            <label>
              <b>Current Status</b>
            </label>
            <br />
            <span className="font-semibold">{app?.status || "—"}</span>
          </div>
          {/* Workflow */}
          <div ref={workflowRef} className="mb-12">
            <h2 className="text-2xl font-bold mb-2" style={{ textAlign: "center", marginRight: "180px" }}>
              Workflow
            </h2>
            <hr className="my-1 border-gray-300" />
            <hr className="my-1 border-gray-300" />

            <label>
              <b>Current Stage</b>
            </label>
            <p>{app?.workflowStage || "—"}</p>

          <div style={{ marginTop: 40 }}>
            <label >
              <b></b>
            </label>
          </div>

            {/* >>> ADDED: Render admin workflow buttons (clean + dedupe + unique keys) */}
            {/* <div style={{ marginTop: 12 }}>
              <label><b>Admin Workflow Actions</b></label>
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {loadingWorkflow ? (
                  <div>Loading workflow…</div>
                ) : adminWorkflow && adminWorkflow.length > 0 ? (
                  (() => {
                    // Clean + dedupe the adminWorkflow array before rendering
                    const cleaned = [];
                    const seen = new Set();
                    for (const raw of adminWorkflow) {
                      if (raw == null) continue;
                      // normalize string: trim, remove surrounding quotes if any
                      const label = String(raw).trim().replace(/^["']+|["']+$/g, "").trim();
                      if (!label) continue;               // skip empties
                      if (label === '"') continue;        // skip stray quote items
                      if (seen.has(label)) continue;      // dedupe preserving order
                      seen.add(label);
                      cleaned.push(label);
                    }

                    if (cleaned.length === 0) {
                      return <div style={{ color: "#666" }}>No valid admin-specific workflow stages.</div>;
                    }

                    return cleaned.map((stageLabel, i) => {
                      const isCurrent = stageLabel.toLowerCase() === String(app?.workflowStage || "").toLowerCase();
                      return (
                        <button
                          key={`${stageLabel}-${i}`}                // unique key
                          onClick={() => changeStage(stageLabel)}
                          disabled={isCurrent || stageChanging || updating || approving}
                          title={isCurrent ? "Already current stage" : `Move to ${stageLabel}`}
                          style={{
                            padding: "8px 12px",
                            borderRadius: 8,
                            border: "1px solid #ddd",
                            background: isCurrent ? "#f0fdf4" : "white",
                            cursor: isCurrent || stageChanging ? "not-allowed" : "pointer",
                            boxShadow: "0 4px 10px rgba(0,0,0,0.06)",
                          }}
                        >
                          {isCurrent ? `● ${stageLabel}` : stageChanging ? "Working…" : stageLabel}
                        </button>
                      );
                    });
                  })()
                ) : (
                  <div style={{ color: "#666" }}>No admin-specific workflow defined — default Update/Approve buttons apply.</div>
                )}
              </div>
            </div> */}
            {/* <<< END ADDED */}

          </div>

          {/* Floating Buttons */}
          <div style={{ position: "fixed", bottom: "20px", right: "40px", display: "flex", gap: "20px", zIndex: 1000 }}>
            {/* Show Approve button ONLY when workflowStage === "disbursed" (case-insensitive) */}
            {["disbursed"].includes(String(app?.workflowStage || "").toLowerCase()) ? (
              <button
                onClick={handleApprove}
                disabled={approving}
                style={{
                  fontWeight: "bold",
                  letterSpacing: "0.1em",
                  border: "none",
                  borderRadius: "1.1em",
                  cursor: approving ? "not-allowed" : "pointer",
                  padding: "1em 2.5em",
                  backgroundColor: approving ? "#d1fae5" : "white",
                  color: approving ? "#065f46" : "black",
                  transition: "all 0.3s ease-in-out",
                  boxShadow: "4px 4px 15px rgba(0,0,0,0.2)",
                }}
                onMouseDown={(e) => {
                  if (!approving) e.currentTarget.style.transform = "scale(0.95)";
                }}
                onMouseUp={(e) => {
                  if (!approving) e.currentTarget.style.transform = "scale(1)";
                }}
              >
                {approving ? "Approving…" : "Approve"}
              </button>
            ) : (
              <button
                onClick={handleUpdate}
                disabled={updating}
                style={{
                  fontWeight: "bold",
                  letterSpacing: "0.1em",
                  border: "none",
                  borderRadius: "1.1em",
                  cursor: updating ? "not-allowed" : "pointer",
                  padding: "1em 2.5em",
                  backgroundColor: updating ? "#d1fae5" : "white",
                  color: updating ? "#065f46" : "black",
                  transition: "all 0.3s ease-in-out",
                  boxShadow: "4px 4px 15px rgba(0,0,0,0.2)",
                }}
                onMouseDown={(e) => {
                  if (!updating) e.currentTarget.style.transform = "scale(0.95)";
                }}
                onMouseUp={(e) => {
                  if (!updating) e.currentTarget.style.transform = "scale(1)";
                }}
              >
                {updating ? "Approving…" : "Approve"}
              </button>
            )}

            <button
              onClick={handleReject}
              style={{
                fontWeight: "bold",
                letterSpacing: "0.1em",
                border: "none",
                borderRadius: "1.1em",
                cursor: "pointer",
                padding: "1em 2.5em",
                backgroundColor: "white",
                color: "black",
                transition: "all 0.3s ease-in-out",
                boxShadow: "4px 4px 15px rgba(0,0,0,0.2)",
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = "scale(0.95)";
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              Reject
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
