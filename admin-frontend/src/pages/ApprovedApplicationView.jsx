// src/pages/ApprovedApplicationView.jsx
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";


export default function ApprovedApplicationView() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);

  // Section refs for smooth scroll
  const applicantRef = useRef(null);
  const coApplicantRef = useRef(null);
  const vehicleRef = useRef(null);
  const financeRef = useRef(null);
  const dealerRef = useRef(null);
  const statusRef = useRef(null);
  const workflowRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await api.get(`/workflow/applications/approved/${id}`);
        if (mounted) setApp(data);
      } catch (err) {
        console.error(" Failed to fetch approved application:", err?.response?.data || err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  const goBack = () => navigate(-1);


  if (loading) {
    return (
      <div style={styles.pageWrapLoading}>
        <div style={styles.loader}>Loading…</div>
      </div>
    );
  }

  if (!app) {
    return (
      <div style={styles.pageWrapLoading}>
        <div style={styles.loader}>No data found</div>
      </div>
    );
  }
  
  const applicant =
    app?.applicant?.applicant || app?.applicant || {};
  const applicantName = applicant?.name || "—";

  const approvedAt = app?.approval?.approvedAt
    ? new Date(app.approval.approvedAt).toLocaleString()
    : app?.updatedAt
    ? new Date(app.updatedAt).toLocaleString()
    : "—";

  /* ---------- UI ---------- */
  return (
    <div style={styles.shell}>
      {/* LEFT: compact sticky summary */}
      <aside style={styles.sidebar}>
        <button onClick={goBack} style={styles.backBtn}>
          ← Back
        </button>

        <div style={styles.summaryCard}>
          <div style={styles.headerLine}>
            <span style={styles.pillApproved}>Approved</span>
            <span style={styles.formId}>#{app?.formId || app?._id}</span>
          </div>

          <div style={styles.kvRow}>
            <span style={styles.kLabel}>Applicant</span>
            <span style={styles.kValue}>{applicantName}</span>
          </div>
          <div style={styles.kvRow}>
            <span style={styles.kLabel}>Dealer</span>
            <span style={styles.kValue}>{app?.dealerDetails?.name || "—"}</span>
          </div>
          <div style={styles.kvRow}>
            <span style={styles.kLabel}>Branch</span>
            <span style={styles.kValue}>{app?.dealerDetails?.branch || "—"}</span>
          </div>
          <div style={styles.kvRow}>
            <span style={styles.kLabel}>District</span>
            <span style={styles.kValue}>{app?.dealerDetails?.district || "—"}</span>
          </div>
          <div style={styles.kvRow}>
            <span style={styles.kLabel}>Approved At</span>
            <span style={styles.kValue}>{approvedAt}</span>
          </div>
        </div>
      </aside>

      {/* RIGHT: content cards */}
      <main style={styles.content}>
        <Section title="Applicant" refProp={applicantRef}>
            <Grid three style={{ marginTop: 10, marginBottom: 20 }}>
            <ImageField label="Photo" src={applicant?.photo} />
          </Grid>
          <Grid two>
            <Field label="Name" value={applicant?.name} />
            <Field label="Father’s Name" value={applicant?.fatherName} />
            <Field label="DOB" value={applicant?.dateOfBirth?.substring(0, 10)} />
            <Field label="Aadhaar No" value={applicant?.aadharNo} />
            <Field label="PAN No" value={applicant?.panNo} />
            <Field label="Address" value={applicant?.address} />
          </Grid>
          
          
        </Section>

        <Section title="Co-Applicant" refProp={coApplicantRef}>
             <Grid three style={{ marginTop: 10, marginBottom: 20 }}>
            <ImageField label="Photo" src={app?.coApplicant?.photo} />
          </Grid>
          <Grid two>
            <Field label="Name" value={app?.coApplicant?.name} />
            <Field label="Father’s Name" value={app?.coApplicant?.fatherName} />
            <Field label="DOB" value={app?.coApplicant?.dateOfBirth?.substring(0, 10)} />
            <Field label="Aadhaar No" value={app?.coApplicant?.aadharNo} />
            <Field label="PAN No" value={app?.coApplicant?.panNo} />
            <Field label="Address" value={app?.coApplicant?.address} />
            <Field label="Pincode" value={app?.coApplicant?.pincode} />
            <Field label="Police Station" value={app?.coApplicant?.policeStation} />
            <Field label="Post Office" value={app?.coApplicant?.postOffice} />
            <Field label="Relation" value={app?.coApplicant?.relation} />
            <Field label="Document Type" value={app?.coApplicant?.documentType} />
          </Grid>
        </Section>

        <Section title="Vehicle Details" refProp={vehicleRef}>
          <Grid two>
            <Field label="Brand" value={app?.vehicleDetails?.brandName} />
            <Field label="Model" value={app?.vehicleDetails?.modelName} />
            <Field label="Price of Vehicle" value={app?.vehicleDetails?.priceOfVehicle} />
          </Grid>
        </Section>

        <Section title="Finance Details" refProp={financeRef}>
          <Grid two>
            <Field label="Finance Required" value={app?.vehicleDetails?.financeRequired} />
            <Field label="Tenure" value={app?.vehicleDetails?.tenure} />
          </Grid>
        </Section>

        <Section title="Dealer Details" refProp={dealerRef}>
          <Grid two>
            <Field label="Name" value={app?.dealerDetails?.name} />
            <Field label="Email" value={app?.dealerDetails?.email} />
            <Field label="Branch" value={app?.dealerDetails?.branch} />
            <Field label="District" value={app?.dealerDetails?.district} />
          </Grid>
        </Section>

        <Section title="Status" refProp={statusRef}>
          <div style={styles.statusLine}>
            <span style={styles.statusDot} />
            <span style={{ fontWeight: 700, color: "#14532d" }}>
              {app?.status || "approved"}
            </span>
          </div>
        </Section>

        <Section title="Workflow" refProp={workflowRef}>
          <Grid two>
            <Field label="Final Stage" value={app?.workflowStage || "disbursement"} />
            <Field label="Approved At" value={approvedAt} />
          </Grid>
        </Section>
      </main>
    </div>
  );
}

/* ====================== Small UI Bits ====================== */

function Section({ title, children, refProp }) {
  return (
    <section ref={refProp} style={styles.section}>
      <div style={styles.sectionHead}>
        <div style={styles.sectionBar} />
        <h3 style={styles.sectionTitle}>{title}</h3>
      </div>
      <div>{children}</div>
    </section>
  );
}

function Grid({ children, two, three, style }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: three ? "repeat(3, 1fr)" : two ? "repeat(2, 1fr)" : "1fr",
        gap: 16,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div style={styles.field}>
      <div style={styles.fieldLabel}>{label}</div>
      <div style={styles.fieldValue}>{value || "—"}</div>
    </div>
  );
}

function ImageField({ label, src }) {
  return (
    <div>
      <div style={styles.fieldLabel}>{label}</div>
      <div style={styles.imageBox}>
        {src ? (
          <img src={src} alt={label} style={styles.image} />
        ) : (
          <div style={styles.imagePlaceholder}>No Image</div>
        )}
      </div>
    </div>
  );
}

/* ====================== Styles ====================== */

const styles = {
  shell: {
    display: "grid",
    gridTemplateColumns: "280px 1fr",
    gap: 18,
    height: "100vh",
    padding: 18,
    background:
      "radial-gradient(1200px 600px at -200px -150px, #ecfdf5 40%, transparent 41%), linear-gradient(135deg, #f0fdf4, #ffffff)",
  },
  sidebar: {
    position: "sticky",
    top: 18,
    alignSelf: "start",
    height: "calc(100vh - 36px)",
    overflowY: "auto",
    padding: 16,
    borderRadius: 14,
    background: "#ffffff",
    boxShadow: "0 10px 24px rgba(16,185,129,0.10)",
    border: "1px solid #e5e7eb",
  },
  backBtn: {
    border: "1px solid #e5e7eb",
    background: "#fff",
    borderRadius: 10,
    padding: "8px 12px",
    fontWeight: 600,
    marginBottom: 10,
    cursor: "pointer",
  },
  summaryCard: {
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    padding: 14,
    background: "linear-gradient(180deg, #ffffff, #f8fffb)",
  },
  headerLine: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  pillApproved: {
    background: "#16a34a",
    color: "#fff",
    padding: "3px 8px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: ".06em",
  },
  formId: { marginLeft: "auto", fontWeight: 700, color: "#064e3b" },
  kvRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "6px 0",
    borderBottom: "1px dashed #e5e7eb",
    fontSize: 14,
  },
  kLabel: { color: "#6b7280" },
  kValue: { color: "#111827", fontWeight: 600 },

  content: {
    background: "#ffffff",
    borderRadius: 14,
    padding: 18,
    overflowY: "auto",
    border: "1px solid #e5e7eb",
    boxShadow: "0 10px 24px rgba(16,185,129,0.08)",
  },
  section: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    background: "linear-gradient(180deg, #ffffff, #fafafa)",
  },
  sectionHead: { display: "flex", alignItems: "center", marginBottom: 10 },
  sectionBar: {
    width: 6,
    height: 24,
    borderRadius: 6,
    background: "#10b981",
    marginRight: 10,
  },
  sectionTitle: { fontSize: 18, fontWeight: 800, color: "#065f46" },

  field: {
    border: "1px solid #eef2f7",
    borderRadius: 8,
    padding: 10,
    background: "#fff",
  },
  fieldLabel: { fontSize: 12, color: "#6b7280", fontWeight: 700, marginBottom: 4 },
  fieldValue: { fontSize: 14.5, fontWeight: 600, color: "#0f172a" },

  imageBox: {
    height: 120,
    borderRadius: 10,
    border: "1px dashed #cbd5e1",
    background: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  image: { width: "100%", height: "100%", objectFit: "cover" },
  imagePlaceholder: { color: "#94a3b8", fontSize: 13 },

  statusLine: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    background: "#ecfdf5",
    border: "1px solid #d1fae5",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "#10b981",
    boxShadow: "0 0 0 3px rgba(16,185,129,0.20)",
  },

  pageWrapLoading: {
    minHeight: "70vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
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
