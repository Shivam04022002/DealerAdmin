// src/pages/ApplicationView.jsx
import React, { useRef, useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import FilePreview from "../components/FilePreview";
import DashboardLayout from "../components/layout/DashboardLayout";
import ActivityHistoryDrawer from "../components/ActivityHistoryDrawer";
import {
  WORKFLOW_STAGES,
  toStage,
  stageLabel,
  isFinalStage,
  getNextStage,
} from "../utils/workflowConfig";

export default function ApplicationView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { admin } = useAuth() || {};

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

  const pendingUpdatesRef = useRef(new Set());
  const [updating, setUpdating] = useState(false);
  const [approving, setApproving] = useState(false);

  const [adminWorkflow, setAdminWorkflow] = useState([]);
  const [loadingWorkflow, setLoadingWorkflow] = useState(false);
  const [stageChanging, setStageChanging] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // ================== Update / Approve ==================
  const handleUpdate = async () => {
    if (!app?._id) return;
    if (pendingUpdatesRef.current.has(app._id)) {
      console.log("Update already in progress for", app._id);
      return;
    }
    pendingUpdatesRef.current.add(app._id);
    setUpdating(true);

    try {
      const currentStage = toStage(app.workflowStage || "");
      const nextStage = getNextStage(currentStage);
      const currentIsFinal = isFinalStage(currentStage);

      if (currentIsFinal) {
        try {
          await api.post(`/workflow/approve/${app._id}`, { note: "Approved via UI" });
        } catch (approveErr) {
          const msg = approveErr?.response?.data?.message || approveErr?.message || "Approve failed";
          alert("Approve failed: " + msg);
          return;
        }
      } else {
        try {
          await api.patch(`/workflow/update/${app._id}`, {
            nextWorkflowStage: nextStage,
            expectedCurrentStage: currentStage,
          });
        } catch (err) {
          const status = err?.response?.status;
          if (status === 409) {
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
            alert("Update endpoint not found on server.");
            return;
          }
          const msg = err?.response?.data?.message || err?.message || "Update failed";
          alert("Update failed: " + msg);
          return;
        }
      }

      try {
        const { data: refreshed } = await api.get(`/workflow/${app._id}`);
        setApp(refreshed);
      } catch (reFetchErr) {
        if (reFetchErr?.response?.status === 404) {
          alert("Application approved and moved to Approved collection.");
          navigate("/approved");
          return;
        }
      }

      if (!currentIsFinal) {
        alert(`Moved to stage: ${nextStage}`);
      } else {
        navigate("/approved");
      }
    } finally {
      pendingUpdatesRef.current.delete(app._id);
      setUpdating(false);
    }
  };

  const changeStage = async (targetStage) => {
    if (!app?._id) return;
    if (stageChanging) return;
    setStageChanging(true);
    try {
      const currentStage = toStage(app.workflowStage || "");
      if (toStage(targetStage) === currentStage) {
        setStageChanging(false);
        return;
      }

      try {
        await api.patch(`/workflow/update/${app._id}`, {
          nextWorkflowStage: targetStage,
          expectedCurrentStage: currentStage,
        });
      } catch (err) {
        const status = err?.response?.status;
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
        if (status === 409) {
          alert("Current stage mismatch. Reloading latest application...");
          try {
            const { data: refreshed } = await api.get(`/workflow/${app._id}`);
            setApp(refreshed);
          } catch (reErr) { /* ignore */ }
          return;
        }
        const msg = err?.response?.data?.message || err?.message || "Stage change failed";
        alert("Stage change failed: " + msg);
        return;
      }

      try {
        const { data: refreshed } = await api.get(`/workflow/${app._id}`);
        setApp(refreshed);
      } catch (reFetchErr) {
        if (reFetchErr?.response?.status === 404) {
          alert("Application approved and moved to Approved collection.");
          navigate("/approved");
          return;
        }
      }
      alert(`Stage changed to ${targetStage}`);
    } finally {
      setStageChanging(false);
    }
  };

  // Approve button handler
  const handleApprove = async () => {
    if (!app?._id) return;
    if (pendingUpdatesRef.current.has(app._id)) return;
    pendingUpdatesRef.current.add(app._id);
    setApproving(true);
    try {
      const res = await api.post(`/workflow/approve/${app._id}`, {
        note: "Approved via admin UI",
        approvedByName: "Admin",
      });
      alert(res.data?.message || "Application approved successfully");
      if (admin?.role === "superadmin") {
        navigate("/superadmin-dashboard", { state: { focus: "files", filesTab: "pending" } });
      } else {
        navigate("/dashboard", { state: { focus: "pending" } });
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Approve failed";
      alert("Approve failed: " + msg);
    } finally {
      pendingUpdatesRef.current.delete(app._id);
      setApproving(false);
    }
  };

  // Reject
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
      if (admin?.role === "superadmin") {
        navigate("/superadmin-dashboard", { state: { focus: "files", filesTab: "pending" } });
      } else {
        navigate("/dashboard", { state: { focus: "pending" } });
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err.message || "Reject failed";
      alert(msg);
    }
  };

  // Fetch application
  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/workflow/${id}`);
        setApp(data);
      } catch (err) {
        console.error("Application fetch error:", err?.response?.status, err?.response?.data || err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Admin's allowed stages come from auth context; fall back to full list
  useEffect(() => {
    const raw = admin?.workflows;
    if (raw && (Array.isArray(raw) ? raw.length > 0 : String(raw).trim())) {
      const parsed = Array.isArray(raw)
        ? raw.flat().map(toStage).filter(Boolean)
        : String(raw).replace(/[\[\]"']/g, "").split(/[\n,]+/).map(toStage).filter(Boolean);
      setAdminWorkflow([...new Set(parsed)]);
    } else {
      setAdminWorkflow(WORKFLOW_STAGES);
    }
  }, [admin]);

  // Helpers
  const applicantData = app?.applicant?.applicant || app?.applicant || null;
  const applicantPhoto = applicantData?.photo || "";
  const applicantName = applicantData?.name || "Applicant";

  const scrollTo = (ref, section) => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(section);
    }
  };

  // Track visible section via IntersectionObserver
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
      <DashboardLayout>
        <div style={S.centerWrap}>
          <div style={S.loader}>Loading…</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div style={{ display: "flex", height: "100%", gap: "16px", width: "100%", overflow: "hidden" }}>

        {/* ═══════════ LEFT SIDEBAR ═══════════ */}
        <div style={S.sidebar}>
          <button onClick={() => navigate(-1)} style={S.backBtn}>
            ← Back
          </button>

          {/* Applicant */}
          <h2
            style={{
              ...S.sidebarTitle,
              color: activeSection === "Applicant" ? "#2563eb" : "#374151",
              cursor: "pointer",
            }}
            onClick={() => scrollTo(applicantRef, "Applicant")}
          >
            Applicant
          </h2>

          <div style={S.photoWrap}>
            <div style={S.photoBox}>
              {applicantPhoto ? (
                <FilePreview src={applicantPhoto} alt="Applicant" style={S.photoImg} />
              ) : (
                <div style={S.photoPlaceholder}>No Photo</div>
              )}
            </div>
            <div style={S.photoName}>{applicantName}</div>
          </div>

          <hr style={S.divider} />

          {/* Co-Applicant */}
          <h2
            style={{
              ...S.sidebarTitle,
              textAlign: "center",
              color: activeSection === "Co-Applicant" ? "#2563eb" : "#374151",
              cursor: "pointer",
            }}
            onClick={() => scrollTo(coApplicantRef, "Co-Applicant")}
          >
            Co-Applicant
          </h2>

          <div style={S.photoWrap}>
            <div style={S.photoBox}>
              {app?.coApplicant?.photo ? (
                <FilePreview src={app.coApplicant.photo} alt="Co-Applicant" style={S.photoImg} />
              ) : (
                <div style={S.photoPlaceholder}>No Photo</div>
              )}
            </div>
            <div style={S.photoName}>{app?.coApplicant?.name || "Co-Applicant"}</div>
          </div>

          <hr style={S.divider} />

          {/* Other navigation */}
          <h2 style={{ ...S.sidebarTitle, textAlign: "center", color: "#374151" }}>Other</h2>
          <ul style={S.navList}>
            {["Vehicle Details", "Finance Details", "Dealer Details", "Status", "Workflow"].map((item) => (
              <li
                key={item}
                style={{
                  ...S.navItem,
                  color: activeSection === item ? "#2563eb" : "#374151",
                  fontWeight: activeSection === item ? 700 : 500,
                }}
                onClick={() => {
                  const map = {
                    "Vehicle Details": vehicleRef,
                    "Finance Details": financeRef,
                    "Dealer Details": dealerRef,
                    Status: statusRef,
                    Workflow: workflowRef,
                  };
                  scrollTo(map[item], item);
                }}
              >
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* ═══════════ RIGHT / CONTENT COLUMN ═══════════ */}
        <div style={S.content}>

          {/* ──── Applicant Section ──── */}
          <div ref={applicantRef} style={S.section}>
            <h2 style={S.sectionHeading}>Applicant</h2>
            <div style={S.sectionDividerWrap}><hr style={S.sectionDivider} /><hr style={S.sectionDivider} /></div>

            <div style={S.twoCol}>
              {/* LEFT: Images */}
              <div style={S.colStack}>
                <div>
                  <div style={S.fieldLabel}><b>Profile</b></div>
                  <div style={S.imgThumbBox}>
                    {applicantData?.photo ? (
                      <FilePreview src={applicantData.photo} alt="Applicant" style={S.imgThumb} />
                    ) : (
                      <span style={S.noImgText}>No Image</span>
                    )}
                  </div>
                </div>

                <div>
                  <div style={S.fieldLabel}><b>Aadhaar Number</b></div>
                  <p style={S.fieldValue}>{applicantData?.aadharNo || "—"}</p>
                </div>

                <div>
                  <div style={S.fieldLabel}><b>Aadhaar Front</b></div>
                  {applicantData?.aadharFront ? (
                    <FilePreview src={applicantData.aadharFront} alt="Aadhaar Front" style={S.docImg} />
                  ) : (
                    <span style={S.noImgText}>No Image</span>
                  )}
                </div>

                <div>
                  <div style={S.fieldLabel}><b>PAN Image</b></div>
                  {applicantData?.panImage ? (
                    <FilePreview src={applicantData.panImage} alt="PAN" style={S.docImg} />
                  ) : (
                    <span style={S.noImgText}>No Image</span>
                  )}
                </div>
              </div>

              {/* RIGHT: Text details */}
              <div style={S.colStack}>
                <FieldPair label="Name" value={applicantData?.name} />
                <FieldPair label="Mobile Number" value={applicantData?.mobileNumber || applicantData?.mobile} />
                <FieldPair label="Email" value={applicantData?.email} />
                <FieldPair label="Gender" value={applicantData?.gender} />
                <FieldPair label="Father's Name" value={applicantData?.fatherName} />
                <FieldPair label="DOB / Age" value={`${applicantData?.dateOfBirth ? applicantData.dateOfBirth.substring(0, 10) : "—"} / ${applicantData?.age || "—"}`} />

                <div>
                  <div style={S.fieldLabel}><b>Aadhaar Back</b></div>
                  {applicantData?.aadharBack ? (
                    <FilePreview src={applicantData.aadharBack} alt="Aadhaar Back" style={S.docImg} />
                  ) : (
                    <span style={S.noImgText}>No Image</span>
                  )}
                </div>

                <FieldPair label="PAN No" value={applicantData?.panNo} />
                <FieldPair label="Address" value={applicantData?.address} />
              </div>
            </div>
          </div>

          {/* ──── Co-Applicant Section ──── */}
          <div ref={coApplicantRef} style={S.section}>
            <h2 style={S.sectionHeading}>Co-Applicant</h2>
            <div style={S.sectionDividerWrap}><hr style={S.sectionDivider} /><hr style={S.sectionDivider} /></div>

            <div style={S.twoCol}>
              {/* LEFT: Images */}
              <div style={S.colStack}>
                <div>
                  <div style={S.fieldLabel}><b>Profile</b></div>
                  <div style={S.imgThumbBox}>
                    {app?.coApplicant?.photo ? (
                      <FilePreview src={app.coApplicant.photo} alt="Co-Applicant" style={S.imgThumb} />
                    ) : (
                      <span style={S.noImgText}>No Image</span>
                    )}
                  </div>
                </div>

                <div>
                  <div style={S.fieldLabel}><b>Aadhaar No</b></div>
                  <p style={S.fieldValue}>{app?.coApplicant?.aadharNo || "—"}</p>
                </div>

                <div>
                  <div style={S.fieldLabel}><b>Aadhaar Front</b></div>
                  {app?.coApplicant?.aadharFront ? (
                    <FilePreview src={app.coApplicant.aadharFront} alt="Aadhaar Front" style={S.docImg} />
                  ) : (
                    <span style={S.noImgText}>No Image</span>
                  )}
                </div>

                <div>
                  <div style={S.fieldLabel}><b>Aadhaar Back</b></div>
                  {app?.coApplicant?.aadharBack ? (
                    <FilePreview src={app.coApplicant.aadharBack} alt="Aadhaar Back" style={S.docImg} />
                  ) : (
                    <span style={S.noImgText}>No Image</span>
                  )}
                </div>

                <div>
                  <div style={S.fieldLabel}><b>PAN Image</b></div>
                  {app?.coApplicant?.panImage ? (
                    <FilePreview src={app.coApplicant.panImage} alt="PAN" style={S.docImg} />
                  ) : (
                    <span style={S.noImgText}>No Image</span>
                  )}
                </div>

                <div>
                  <div style={S.fieldLabel}><b>Form 60</b></div>
                  {app?.coApplicant?.form60 ? (
                    <FilePreview src={app.coApplicant.form60} alt="Form 60" style={S.docImg} />
                  ) : (
                    <span style={S.noImgText}>No Image</span>
                  )}
                </div>
              </div>

              {/* RIGHT: Text details */}
              <div style={S.colStack}>
                <FieldPair label="Name" value={app?.coApplicant?.name} />
                <FieldPair label="Mobile Number" value={app?.coApplicant?.mobileNumber || app?.coApplicant?.mobile} />
                <FieldPair label="Email" value={app?.coApplicant?.email} />
                <FieldPair label="Gender" value={app?.coApplicant?.gender} />
                <FieldPair label="Father's Name" value={app?.coApplicant?.fatherName} />
                <FieldPair label="DOB / Age" value={`${app?.coApplicant?.dateOfBirth ? app.coApplicant.dateOfBirth.substring(0, 10) : "—"} / ${app?.coApplicant?.age || "—"}`} />
                <FieldPair label="PAN No" value={app?.coApplicant?.panNo} />
                <FieldPair label="Address" value={app?.coApplicant?.address} />
                <FieldPair label="Pincode" value={app?.coApplicant?.pincode} />
                <FieldPair label="Police Station" value={app?.coApplicant?.policeStation} />
                <FieldPair label="Post Office" value={app?.coApplicant?.postOffice} />
                <FieldPair label="Relation" value={app?.coApplicant?.relation} />
                <FieldPair label="Document Type" value={app?.coApplicant?.documentType} />
              </div>
            </div>
          </div>

          {/* ──── Vehicle Details ──── */}
          <div ref={vehicleRef} style={S.section}>
            <h2 style={S.sectionHeading}>Vehicle Details</h2>
            <div style={S.sectionDividerWrap}><hr style={S.sectionDivider} /><hr style={S.sectionDivider} /></div>

            <div style={S.twoCol}>
              <div style={S.colStack}>
                <FieldPair label="Brand Name" value={app?.vehicleDetails?.brandName} />
                <FieldPair label="Model Name" value={app?.vehicleDetails?.modelName} />
                <div>
                  <div style={S.fieldLabel}><b>Vehicle Image</b></div>
                  {(app?.vehicleDetails?.vehicleImage || app?.vehicleDetails?.vehiclePhoto) ? (
                    <FilePreview src={app.vehicleDetails.vehicleImage || app.vehicleDetails.vehiclePhoto} alt="Vehicle Image" style={S.docImg} />
                  ) : (
                    <span style={S.noImgText}>No Image</span>
                  )}
                </div>
              </div>
              <div style={S.colStack}>
                <FieldPair label="Price of Vehicle" value={app?.vehicleDetails?.priceOfVehicle} />
              </div>
            </div>
          </div>

          {/* ──── Finance Details ──── */}
          <div ref={financeRef} style={S.section}>
            <h2 style={S.sectionHeading}>Finance Details</h2>
            <div style={S.sectionDividerWrap}><hr style={S.sectionDivider} /><hr style={S.sectionDivider} /></div>

            <div style={S.twoCol}>
              <div style={S.colStack}>
                <FieldPair label="Finance Required" value={app?.vehicleDetails?.financeRequired} />
              </div>
              <div style={S.colStack}>
                <FieldPair label="Tenure" value={app?.vehicleDetails?.tenure} />
              </div>
            </div>
          </div>

          {/* ──── Dealer Details ──── */}
          <div ref={dealerRef} style={S.section}>
            <h2 style={S.sectionHeading}>Dealer Details</h2>
            <div style={S.sectionDividerWrap}><hr style={S.sectionDivider} /><hr style={S.sectionDivider} /></div>

            <div style={S.twoCol}>
              <div style={S.colStack}>
                <FieldPair label="Email" value={app?.dealerDetails?.email} />
                <FieldPair label="Branch" value={app?.dealerDetails?.branch} />
              </div>
              <div style={S.colStack}>
                <FieldPair label="Name" value={app?.dealerDetails?.name} />
                <FieldPair label="District" value={app?.dealerDetails?.district} />
              </div>
            </div>
          </div>

          {/* ──── Status ──── */}
          <div ref={statusRef} style={S.section}>
            <h2 style={S.sectionHeading}>Status</h2>
            <div style={S.sectionDividerWrap}><hr style={S.sectionDivider} /><hr style={S.sectionDivider} /></div>

            <div style={S.fieldLabel}><b>Current Status</b></div>
            <span style={{ fontWeight: 600 }}>{app?.status || "—"}</span>
          </div>

          {/* ──── Workflow ──── */}
          <div ref={workflowRef} style={{ ...S.section, borderBottom: "none" }}>
            <h2 style={S.sectionHeading}>Workflow</h2>
            <div style={S.sectionDividerWrap}><hr style={S.sectionDivider} /><hr style={S.sectionDivider} /></div>

            <div style={S.fieldLabel}><b>Current Stage</b></div>
            <p style={{ ...S.fieldValue, fontWeight: 700, textTransform: "capitalize" }}>
              {stageLabel(app?.workflowStage) || "—"}
            </p>
            {stageChanging && <p style={{ fontSize: 12, color: "#64748b" }}>Changing stage…</p>}
            <div style={{ marginTop: 8 }}>
              <label style={{ ...S.fieldLabel, marginBottom: 4 }}><b>Change Stage</b></label>
              <select
                style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }}
                value={toStage(app?.workflowStage || "")}
                disabled={stageChanging}
                onChange={(e) => changeStage(e.target.value)}
              >
                {WORKFLOW_STAGES.filter((s) => adminWorkflow.includes(s) || adminWorkflow.length === 0).map((s) => (
                  <option key={s} value={s}>{stageLabel(s)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ──── Floating Buttons ──── */}
          <div style={S.floatingBtns}>
            <button
              onClick={() => setShowHistory(true)}
              style={{
                ...S.actionBtn,
                background: "linear-gradient(135deg, #1e3a5f, #1d4ed8)",
                color: "#fff",
                boxShadow: "0 4px 18px rgba(29,78,216,0.35)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              📋 Activity History
            </button>
            {isFinalStage(app?.workflowStage) ? (
              <button
                onClick={handleApprove}
                disabled={approving}
                style={{
                  ...S.actionBtn,
                  backgroundColor: approving ? "#d1fae5" : "white",
                  color: approving ? "#065f46" : "black",
                  cursor: approving ? "not-allowed" : "pointer",
                }}
              >
                {approving ? "Approving…" : "Approve"}
              </button>
            ) : (
              <button
                onClick={handleUpdate}
                disabled={updating}
                style={{
                  ...S.actionBtn,
                  backgroundColor: updating ? "#d1fae5" : "white",
                  color: updating ? "#065f46" : "black",
                  cursor: updating ? "not-allowed" : "pointer",
                }}
              >
                {updating ? "Approving…" : "Approve"}
              </button>
            )}

            <button onClick={handleReject} style={S.actionBtn}>
              Reject
            </button>
          </div>

        </div>
      </div>
      {showHistory && (
        <ActivityHistoryDrawer
          app={app}
          onClose={() => setShowHistory(false)}
        />
      )}
    </DashboardLayout>
  );
}

/* ═══════════ Reusable FieldPair Component ═══════════ */
function FieldPair({ label, value }) {
  return (
    <div>
      <div style={S.fieldLabel}><b>{label}</b></div>
      <p style={S.fieldValue}>{value || "—"}</p>
    </div>
  );
}

/* ═══════════ Styles ═══════════ */
const S = {
  /* -- Left sidebar -- */
  backBtn: {
    border: "1px solid #e5e7eb",
    background: "#fff",
    borderRadius: 8,
    padding: "6px 12px",
    fontWeight: 600,
    marginBottom: 16,
    cursor: "pointer",
    width: "100%",
    textAlign: "left",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    color: "#374151",
    transition: "background 0.2s",
  },
  sidebar: {
    width: 200,
    minWidth: 200,
    height: "100%",
    overflowY: "auto",
    borderRadius: 16,
    background: "rgba(255,255,255,0.95)",
    backdropFilter: "blur(10px)",
    boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
    padding: 16,
    flexShrink: 0,
    border: "1px solid #e5e7eb",
  },
  sidebarTitle: {
    fontSize: "1.15rem",
    fontWeight: 700,
    margin: "0 0 12px 0",
    letterSpacing: "0.01em",
  },
  photoWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginBottom: 8,
  },
  photoBox: {
    width: 140,
    height: 140,
    borderRadius: 14,
    overflow: "hidden",
    border: "3px solid #fff",
    background: "linear-gradient(145deg, #f9fafb, #e5e7eb)",
    boxShadow: "0 6px 15px rgba(0,0,0,0.12), inset 0 2px 6px rgba(255,255,255,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.3s ease",
    cursor: "pointer",
  },
  photoImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  photoPlaceholder: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#e5e7eb",
    color: "#6b7280",
    fontSize: 14,
    fontWeight: 700,
  },
  photoName: {
    marginTop: 10,
    fontWeight: 700,
    textAlign: "center",
    fontSize: "1rem",
    color: "#222",
    width: "100%",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  divider: {
    border: "none",
    borderTop: "1px solid #d1d5db",
    margin: "14px 0",
  },
  navList: {
    margin: 0,
    padding: "0 0 0 18px",
    listStyle: "disc",
  },
  navItem: {
    cursor: "pointer",
    padding: "4px 0",
    fontSize: 14,
    transition: "color 0.15s",
  },

  /* -- Right content -- */
  content: {
    flex: 1,
    height: "100%",
    overflowY: "auto",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#fff",
    padding: 24,
    boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
  },

  /* -- Sections -- */
  section: {
    marginBottom: 40,
    paddingBottom: 20,
    borderBottom: "2px solid #e5e7eb",
  },
  sectionHeading: {
    fontSize: "1.6rem",
    fontWeight: 700,
    textAlign: "center",
    margin: "0 0 8px 0",
    color: "#111827",
  },
  sectionDividerWrap: {
    marginBottom: 16,
  },
  sectionDivider: {
    border: "none",
    borderTop: "1px solid #d1d5db",
    margin: "4px 0",
  },

  /* -- Two column layout -- */
  twoCol: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 24,
  },
  colStack: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },

  /* -- Fields -- */
  fieldLabel: {
    fontWeight: 600,
    fontSize: 14,
    color: "#111827",
    marginBottom: 2,
  },
  fieldValue: {
    margin: "2px 0 0 0",
    fontSize: 14,
    color: "#2563eb",
    fontWeight: 400,
  },

  /* -- Images -- */
  imgThumbBox: {
    width: 143,
    height: 144,
    borderRadius: 6,
    border: "1px solid #e5e7eb",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  imgThumb: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  docImg: {
    width: 150,
    height: 100,
    objectFit: "cover",
    borderRadius: 4,
  },
  noImgText: {
    color: "#6b7280",
    fontSize: 13,
  },

  /* -- Floating action buttons -- */
  floatingBtns: {
    position: "fixed",
    bottom: 20,
    right: 40,
    display: "flex",
    gap: 20,
    zIndex: 1000,
  },
  actionBtn: {
    fontWeight: 700,
    letterSpacing: "0.1em",
    border: "none",
    borderRadius: "1.1em",
    cursor: "pointer",
    padding: "1em 2.5em",
    backgroundColor: "white",
    color: "black",
    transition: "all 0.3s ease-in-out",
    boxShadow: "4px 4px 15px rgba(0,0,0,0.2)",
  },

  /* -- Loading / center -- */
  centerWrap: {
    minHeight: "70vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  loader: {
    padding: "10px 14px",
    background: "#fff",
    border: "1px solid #eee",
    borderRadius: 10,
    boxShadow: "0 6px 20px rgba(0,0,0,0.06)",
    fontWeight: 700,
  },
};
