// src/pages/RejectedApplicationView.jsx
import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../services/api";

export default function RejectedApplicationView() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [app, setApp] = useState(null);
    const [loading, setLoading] = useState(true);

    // section refs
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
                const { data } = await API.get(`/workflow/applications/rejected/${id}`, {
                    params: { _ts: Date.now() }, // avoid cached 304s while testing
                    headers: { "Cache-Control": "no-cache" },
                });
                if (mounted) setApp(data);
            } catch (err) {
                console.error("Failed to fetch rejected application", err?.response?.data || err.message);
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [id]);


    if (loading) {
        return (
            <div style={styles.centerWrap}>
                <div style={styles.loader}>Loading…</div>
            </div>
        );
    }
    if (!app) {
        return (
            <div style={styles.centerWrap}>
                <div style={styles.loader}>Not found</div>
            </div>
        );
    }

    const applicant = app?.applicant?.applicant || app?.applicant || {};
    const applicantName = applicant?.name || "—";
    const reason = app?.rejection?.reason || "—";
    const rejectedAt = app?.rejection?.rejectedAt
        ? new Date(app.rejection.rejectedAt).toLocaleString()
        : app?.updatedAt
            ? new Date(app.updatedAt).toLocaleString()
            : "—";

    return (
        <div style={styles.shell}>
            {/* Sidebar */}
            <aside style={styles.sidebar}>
                <button onClick={() => navigate(-1)} style={styles.backBtn}> Back</button>

                <div style={styles.summaryCard}>
                    <div style={styles.headerLine}>
                        <span style={styles.pillRejected}>Rejected</span>
                        <span style={styles.formId}>#{app?.formId || app?._id}</span>
                    </div>

                    <div style={styles.kvRow}><span style={styles.kLabel}>Applicant</span><span style={styles.kValue}>{applicantName}</span></div>
                    <div style={styles.kvRow}><span style={styles.kLabel}>Dealer</span><span style={styles.kValue}>{app?.dealerDetails?.name || "—"}</span></div>
                    <div style={styles.kvRow}><span style={styles.kLabel}>Branch</span><span style={styles.kValue}>{app?.dealerDetails?.branch || "—"}</span></div>
                    <div style={styles.kvRow}><span style={styles.kLabel}>District</span><span style={styles.kValue}>{app?.dealerDetails?.district || "—"}</span></div>
                    <div style={styles.kvRow}><span style={styles.kLabel}>Rejected At</span><span style={styles.kValue}>{rejectedAt}</span></div>
                </div>
            </aside>

            {/* Content */}
            <main style={styles.content}>
                {/* Rejection Reason Banner */}
                <div style={styles.reasonBanner}>
                    <div style={styles.reasonDot} />
                    <div>
                        <div style={styles.reasonTitle}>Rejection Reason</div>
                        <div style={styles.reasonText}>{reason}</div>
                    </div>
                </div>

                <Section title="Applicant" refProp={applicantRef} color="red">
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

                <Section title="Co-Applicant" refProp={coApplicantRef} color="red">
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

                <Section title="Vehicle Details" refProp={vehicleRef} color="red">
                    <Grid two>
                        <Field label="Brand" value={app?.vehicleDetails?.brandName} />
                        <Field label="Model" value={app?.vehicleDetails?.modelName} />
                        <Field label="Price of Vehicle" value={app?.vehicleDetails?.priceOfVehicle} />
                    </Grid>
                </Section>

                <Section title="Finance Details" refProp={financeRef} color="red">
                    <Grid two>
                        <Field label="Finance Required" value={app?.vehicleDetails?.financeRequired} />
                        <Field label="Tenure" value={app?.vehicleDetails?.tenure} />
                    </Grid>
                </Section>

                <Section title="Dealer Details" refProp={dealerRef} color="red">
                    <Grid two>
                        <Field label="Name" value={app?.dealerDetails?.name} />
                        <Field label="Email" value={app?.dealerDetails?.email} />
                        <Field label="Branch" value={app?.dealerDetails?.branch} />
                        <Field label="District" value={app?.dealerDetails?.district} />
                    </Grid>
                </Section>

                <Section title="Status" refProp={statusRef} color="red">
                    <div style={styles.statusLine}>
                        <span style={styles.statusDotRed} />
                        <span style={{ fontWeight: 700, color: "#7f1d1d" }}>
                            {app?.status || "rejected"}
                        </span>
                    </div>
                </Section>

                <Section title="Workflow" refProp={workflowRef} color="red">
                    <Grid two>
                        <Field label="Final Stage" value={app?.workflowStage || "rejected"} />
                        <Field label="Rejected At" value={rejectedAt} />
                    </Grid>
                </Section>
            </main>
        </div>
    );
}

/* ---------- Reusable bits ---------- */

function Section({ title, children, refProp, color }) {
    return (
        <section ref={refProp} style={styles.section}>
            <div style={styles.sectionHead}>
                <div
                    style={{
                        ...styles.sectionBar,
                        background: color === "red" ? "#ef4444" : "#10b981",
                    }}
                />
                <h3
                    style={{
                        ...styles.sectionTitle,
                        color: color === "red" ? "#991b1b" : "#065f46",
                    }}
                >
                    {title}
                </h3>
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
                {src ? <img src={src} alt={label} style={styles.image} /> : <div style={styles.imagePlaceholder}>No Image</div>}
            </div>
        </div>
    );
}

/* ---------- Styles ---------- */

const styles = {
    shell: {
        display: "grid",
        gridTemplateColumns: "280px 1fr",
        gap: 18,
        height: "100vh",
        padding: 18,
        background:
            "radial-gradient(1200px 600px at -200px -150px, #fef2f2 40%, transparent 41%), linear-gradient(135deg, #fff1f2, #ffffff)",
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
        boxShadow: "0 10px 24px rgba(239,68,68,0.10)",
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
        background: "linear-gradient(180deg, #ffffff, #fff7f7)",
    },
    headerLine: { display: "flex", alignItems: "center", gap: 8, marginBottom: 10 },
    pillRejected: {
        background: "#ef4444",
        color: "#fff",
        padding: "3px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: ".06em",
    },
    formId: { marginLeft: "auto", fontWeight: 700, color: "#7f1d1d" },

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
        boxShadow: "0 10px 24px rgba(239,68,68,0.08)",
    },

    reasonBanner: {
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        marginBottom: 16,
        padding: 14,
        borderRadius: 12,
        border: "1px solid #fecaca",
        background: "#fff1f2",
    },
    reasonDot: {
        width: 10,
        height: 10,
        borderRadius: 999,
        background: "#ef4444",
        marginTop: 6,
    },
    reasonTitle: { fontSize: 13, fontWeight: 800, color: "#991b1b", textTransform: "uppercase", letterSpacing: ".06em" },
    reasonText: { fontSize: 14.5, fontWeight: 600, color: "#7f1d1d" },

    section: {
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        background: "linear-gradient(180deg, #ffffff, #fafafa)",
    },
    sectionHead: { display: "flex", alignItems: "center", marginBottom: 10 },
    sectionBar: { width: 6, height: 24, borderRadius: 6, background: "#ef4444", marginRight: 10 },
    sectionTitle: { fontSize: 18, fontWeight: 800 },

    field: { border: "1px solid #eef2f7", borderRadius: 8, padding: 10, background: "#fff" },
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
        background: "#fef2f2",
        border: "1px solid #fee2e2",
    },
    statusDotRed: { width: 8, height: 8, borderRadius: 999, background: "#ef4444", boxShadow: "0 0 0 3px rgba(239,68,68,.2)" },

    centerWrap: { minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center" },
    loader: {
        padding: "10px 14px",
        background: "#fff",
        border: "1px solid #eee",
        borderRadius: 10,
        boxShadow: "0 6px 20px rgba(0,0,0,0.06)",
        fontWeight: 700,
    },
};
