// controllers/workflowController.js
import Application from "../models/Application.js";
import ApprovedApplication from "../models/ApprovedApplication.js";
import RejectedApplication from "../models/RejectedApplication.js";
import ActivityLog from "../models/ActivityLog.js";
import ApplicationHistory from "../models/ApplicationHistory.js";
import User from "../models/User.js";
import { sendPushNotification } from "../utils/sendPushNotification.js";
import { createHistoryEntry } from "./formTrackingController.js";
import {
  WORKFLOW_STAGES,
  FINAL_STAGES,
  toStage,
  stageLabel,
  isFinalStage,
  isValidStage,
  getNextStage,
  normalizeWorkflows,
} from "../utils/workflowConstants.js";
import {
  getPendingAccessFilter,
  buildFinalizedFilter,
  getStatCounts,
} from "../utils/accessFilter.js";

/**
 * Augment a lean application document with normalized, flat fields for list
 * views and Excel export, without dropping any existing fields (non-breaking).
 *
 * branchName / dealerName / applicantName are derived from the denormalized
 * dealerDetails snapshot already stored on each record, so this adds no extra
 * queries — no N+1. createdAt is the server-generated creation timestamp.
 */
function toListItem(app) {
  const applicantName =
    app?.applicant?.applicant?.name || app?.applicant?.name || "";
  const dealerName = app?.dealerDetails?.name || "";
  const branchName =
    app?.dealerDetails?.branch || app?.dealerDetails?.Branch || "";

  return {
    ...app,
    applicationId: app?.formId || String(app?._id || ""),
    applicantName,
    dealerName,
    branchName,
    // createdAt / updatedAt already present on the lean doc via timestamps.
  };
}

// backfill dealer ObjectId from dealerDetails/applicant if missing
async function backfillDealerRef(app) {
  if (!app) return null;
  if (app.dealer) return app.dealer;

  const d = app.dealerDetails || {};
  if (d?._id) {
    app.dealer = d._id;
    return app.dealer;
  }

  const uid = d.userId || d.UserId;
  if (uid) {
    const u = await User.findOne({ $or: [{ userId: uid }, { UserId: uid }] }).lean();
    if (u?._id) {
      app.dealer = u._id;
      return app.dealer;
    }
  }

  if (d.email) {
    const u = await User.findOne({ email: d.email }).lean();
    if (u?._id) {
      app.dealer = u._id;
      return app.dealer;
    }
  }

  if (d.name && d.branch) {
    const q = { name: d.name, branch: d.branch };
    if (d.district) q.district = d.district;
    const u = await User.findOne(q).lean();
    if (u?._id) {
      app.dealer = u._id;
      return app.dealer;
    }
  }

  const cand = app.applicant?.user;
  if (cand) {
    const u = await User.findById(cand).lean();
    if (u?._id) {
      app.dealer = u._id;
      return app.dealer;
    }
  }

  return null;
}

/* ---------- controllers ---------- */

// Get single application by id (populate dealer) - searches pending, rejected, and approved collections
export const getApplicationById = async (req, res) => {
  try {
    // First try to find in pending Applications
    let app = await Application.findById(req.params.id)
      .populate("dealer", "email userId name district branch")
      .lean();

    // If not found in pending, try rejected collection
    if (!app) {
      app = await RejectedApplication.findById(req.params.id)
        .populate("dealer", "email userId name district branch")
        .lean();
    }

    // If still not found, try approved collection
    if (!app) {
      app = await ApprovedApplication.findById(req.params.id)
        .populate("dealer", "email userId name district branch")
        .lean();
    }

    if (!app) return res.status(404).json({ error: "Application not found" });
    return res.json(app);
  } catch (err) {
    console.error("getApplicationById error:", err);
    return res.status(500).json({ error: err.message });
  }
};

// Get single pending application by id (populate dealer)
export const getPendingApplicationById = async (req, res) => {
  try {
    const app = await Application.findById(req.params.id)
      .populate("dealer", "email userId name district branch")
      .lean();

    if (!app) return res.status(404).json({ error: "Application not found" });
    return res.json(app);
  } catch (err) {
    console.error("getPendingApplicationById error:", err);
    return res.status(500).json({ error: err.message });
  }
};

// Get all pending applications — paginated, searchable, summary fields only
export const getPendingApplications = async (req, res) => {
  const t0 = Date.now();
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 50);
    const skip   = (page - 1) * limit;
    const search = (req.query.search || "").trim();
    const stage  = (req.query.stage  || "").trim();
    const branch = (req.query.branch || "").trim();

    // Base filter — pending-like applications
    const basePending = {
      $or: [
        { status: { $in: ["pending", null] } },
        { workflowStage: { $exists: false } },
        { workflowStage: { $nin: ["disbursed", "rejected", "approved"] } },
      ],
    };

    // Admin permission restriction (superadmin sees all)
    const accessFilter = getPendingAccessFilter(req.admin);
    let filter =
      Object.keys(accessFilter).length === 0
        ? basePending
        : { $and: [basePending, accessFilter] };

    // Optional search: formId or applicant name
    if (search) {
      const re = new RegExp(search, "i");
      const searchClause = {
        $or: [
          { formId: re },
          { "applicant.name": re },
          { "applicant.applicant.name": re },
          { "dealerDetails.name": re },
          { "dealerDetails.branch": re },
        ],
      };
      filter = { $and: [filter, searchClause] };
    }

    // Optional stage filter
    if (stage) filter = { $and: [filter, { workflowStage: stage }] };

    // Optional branch filter
    if (branch) filter = { $and: [filter, { "dealerDetails.branch": new RegExp(branch, "i") }] };

    const [applications, total] = await Promise.all([
      Application.find(filter)
        .select("formId applicant dealerDetails status workflowStage createdAt updatedAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Application.countDocuments(filter),
    ]);

    if (process.env.NODE_ENV !== "production") {
      console.log(`[PERF] getPendingApplications: page=${page} limit=${limit} total=${total} returned=${applications.length} in ${Date.now() - t0}ms`);
    }
    return res.json({
      items: applications.map(toListItem),
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("getPendingApplications error:", err);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * PATCH /api/workflow/update/:id
 * Body: { nextWorkflowStage: "house visit", expectedCurrentStage: "contact creation" }
 */
export const updateWorkflowStage = async (req, res) => {
  try {
    const { id } = req.params;
    const { nextWorkflowStage, expectedCurrentStage } = req.body || {};

    if (!nextWorkflowStage) {
      return res.status(400).json({ message: "nextWorkflowStage is required" });
    }

    const next = toStage(nextWorkflowStage);

    const app = await Application.findById(id);
    if (!app) return res.status(404).json({ message: "Application not found" });

    const current = toStage(app.workflowStage || "");

    // Validate against canonical stage list
    if (!isValidStage(next)) {
      return res.status(400).json({
        message: `Unknown workflow stage '${nextWorkflowStage}'. Valid stages: ${WORKFLOW_STAGES.join(", ")}.`,
        validStages: WORKFLOW_STAGES,
      });
    }

    // Optimistic check: if expectedCurrentStage provided, ensure current matches
    if (expectedCurrentStage) {
      const expect = toStage(expectedCurrentStage);
      if (expect !== current) {
        return res.status(409).json({
          message: "Current stage mismatch",
          current: app.workflowStage,
        });
      }
    }

    // Validate requested stage against logged-in admin's allowed workflow
    const adminWorkflows = normalizeWorkflows(req.admin?.workflows || []);
    if (Array.isArray(adminWorkflows) && adminWorkflows.length > 0) {
      if (!adminWorkflows.includes(next)) {
        return res.status(400).json({
          message: `Stage '${stageLabel(next)}' is not allowed for your account.`,
          allowedStages: adminWorkflows,
        });
      }
    }

    // Prevent skipping forward more than 1 step
    const currentIdx = WORKFLOW_STAGES.indexOf(current);
    const nextIdx    = WORKFLOW_STAGES.indexOf(next);
    const allowedIdx = currentIdx === -1 ? 0 : currentIdx + 1;

    if (!isFinalStage(next) && nextIdx !== allowedIdx && currentIdx !== -1) {
      const allowedStage = WORKFLOW_STAGES[allowedIdx] ?? WORKFLOW_STAGES[WORKFLOW_STAGES.length - 1];
      return res.status(400).json({
        message: currentIdx === -1
          ? `Application has no valid current stage. You must start with '${stageLabel(allowedStage)}'.`
          : `Cannot skip stages. After '${stageLabel(current)}', only '${stageLabel(allowedStage)}' is allowed.`,
      });
    }

    // push history and update
    app.history = app.history || [];
    app.history.push({
      action: "workflow_advance",
      from: app.workflowStage || null,
      to: next,
      updatedBy: (req.admin && (req.admin.name || req.admin.email)) || "admin",
      updatedAt: new Date(),
    });

    app.workflowStage = next;
    app.updatedAt = new Date();

    // Non-final -> just save and return
    if (!isFinalStage(next)) {
      await backfillDealerRef(app);
      await app.save();

      // Log the stage update
      try {
        await ActivityLog.create({
          adminId: req.admin?._id || req.admin?.id,
          applicationId: app._id,
          action: "UPDATE_STAGE",
          fromStage: app.history[app.history.length - 1]?.from || null,
          toStage: nextWorkflowStage,
          notes: `Stage updated to ${nextWorkflowStage}`,
          at: new Date()
        });
      } catch (logErr) {
        console.error("Failed to log stage update:", logErr);
        // Don't block the request if logging fails
      }

      // Audit history entry
      await createHistoryEntry({
        applicationId: app._id,
        formId: app.formId,
        actionType: "STAGE_CHANGED",
        oldValue: current || null,
        newValue: nextWorkflowStage,
        remarks: `Stage advanced from ${current || "—"} to ${nextWorkflowStage}`,
        updatedBy: (req.admin && (req.admin.name || req.admin.email)) || "admin",
        updatedByEmail: req.admin?.email || "",
        updatedByRole: req.admin?.role || "admin",
        updatedByAdminId: req.admin?._id || req.admin?.id || null,
      });

      if (app.dealer) {
        await sendPushNotification(
          app.dealer,
          "Application Stage Updated",
          `Your application stage was updated to ${stageLabel(nextWorkflowStage)}.`,
          "updated",
          app.formId
        );
      }

      return res.json({ message: "Workflow stage updated", workflowStage: app.workflowStage, application: app });
    }

    // Final stage: ensure dealer exists then move to Approved collection
    await backfillDealerRef(app);
    if (!app.dealer) {
      return res.status(422).json({ error: "Dealer reference missing", details: "Cannot approve without dealer ObjectId" });
    }

    // Log the approval before moving (use original app ID)
    try {
      await ActivityLog.create({
        adminId: req.admin?._id || req.admin?.id,
        applicationId: app._id,
        action: "APPROVE",
        fromStage: app.workflowStage || null,
        toStage: "disbursement",
        notes: "Application approved and moved to Approved collection",
        at: new Date()
      });
    } catch (logErr) {
      console.error("Failed to log approval:", logErr);
      // Don't block the request if logging fails
    }

    // Audit history entry
    await createHistoryEntry({
      applicationId: app._id,
      formId: app.formId,
      actionType: "APPROVED",
      oldValue: app.workflowStage || null,
      newValue: "disbursement",
      remarks: "Application approved and moved to disbursement",
      updatedBy: (req.admin && (req.admin.name || req.admin.email)) || "admin",
      updatedByEmail: req.admin?.email || "",
      updatedByRole: req.admin?.role || "admin",
      updatedByAdminId: req.admin?._id || req.admin?.id || null,
    });

    const exists = await ApprovedApplication.findOne({ formId: app.formId }).lean();
    if (!exists) {
      await ApprovedApplication.create({
        formId: app.formId,
        applicant: app.applicant,
        coApplicant: app.coApplicant,
        vehicleDetails: app.vehicleDetails,
        dealer: app.dealer,
        dealerDetails: app.dealerDetails || undefined,
        status: "approved",
        workflowStage: next,
        history: app.history,
      });
    }

    await Application.findByIdAndDelete(id);

    if (app.dealer) {
      await sendPushNotification(
        app.dealer,
        "Application Approved",
        "Your application has been approved and moved to disbursement.",
        "approved",
        app.formId
      );
    }

    return res.json({ message: "Application approved and moved to Approved collection" });
  } catch (err) {
    console.error("updateWorkflowStage error:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
};

/* ============================================================
   approveApplicationCore(id, admin, note)
   ------------------------------------------------------------
   Single source of truth for approving ONE application. Used by
   both the single endpoint (approveApplication) and the bulk
   endpoint (bulkApproveApplications) so the business logic and
   validations are never duplicated.

   Returns a structured result:
     { success: true,  id, formId }
     { success: false, id, formId?, code, message }
   Throws only on unexpected errors (caller maps to 500).
   ============================================================ */
async function approveApplicationCore(id, admin, note) {
  const app = await Application.findById(id);
  if (!app) return { success: false, id, code: "not_found", message: "Application not found" };

  await backfillDealerRef(app);
  if (!app.dealer) {
    return { success: false, id, formId: app.formId, code: "dealer_missing", message: "Dealer reference missing" };
  }

  // Log the approval before moving (use original app ID)
  try {
    await ActivityLog.create({
      adminId: admin?._id || admin?.id,
      applicationId: app._id,
      action: "APPROVE",
      fromStage: app.workflowStage || null,
      toStage: "disbursement",
      notes: note || "Application approved via admin UI",
      at: new Date()
    });
  } catch (logErr) {
    console.error("Failed to log approval:", logErr);
    // Don't block on logging failure
  }

  // Audit history entry
  await createHistoryEntry({
    applicationId: app._id,
    formId: app.formId,
    actionType: "APPROVED",
    oldValue: app.workflowStage || null,
    newValue: "disbursement",
    remarks: note || "Application approved via admin UI",
    updatedBy: (admin && (admin.name || admin.email)) || "admin",
    updatedByRole: admin?.role || "admin",
    updatedByAdminId: admin?._id || admin?.id || null,
  });

  const exists = await ApprovedApplication.findOne({ formId: app.formId }).lean();
  if (!exists) {
    // Preserve the original submission date as createdAt while stamping the
    // approval time as updatedAt. When createdAt is set explicitly, Mongoose 8
    // mirrors it onto updatedAt and ignores an explicit updatedAt on a normal
    // save; save({ timestamps: false }) lets us set both deterministically.
    const approvedDoc = new ApprovedApplication({
      // Preserve the original identity (see reference-integrity note): reusing
      // Application._id keeps ActivityLog/ApplicationHistory joins valid. The
      // findOne({ formId }) guard above prevents re-approval.
      _id: app._id,
      formId: app.formId,
      applicant: app.applicant,
      coApplicant: app.coApplicant,
      vehicleDetails: app.vehicleDetails,
      dealer: app.dealer,
      dealerDetails: app.dealerDetails,
      status: "approved",
      workflowStage: "disbursement",
      createdAt: app.createdAt,   // original submission date
      updatedAt: new Date(),      // approval time
      history: [
        ...(app.history || []),
        {
          updatedBy: admin?.name || "system",
          updatedAt: new Date(),
          changes: "Application approved and moved to Approved collection",
        },
      ],
    });
    await approvedDoc.save({ timestamps: false });
  }

  await Application.findByIdAndDelete(id);

  // Notify the user natively
  if (app.dealer) {
    await sendPushNotification(
      app.dealer,
      "Application Approved",
      "Your application has been approved.",
      "approved",
      app.formId
    );
  }

  return { success: true, id, formId: app.formId };
}

// approve endpoint (POST /api/workflow/approve/:id) — thin wrapper over core
export const approveApplication = async (req, res) => {
  try {
    const r = await approveApplicationCore(req.params.id, req.admin, req.body?.note);
    if (r.success) return res.json({ message: "Application approved and moved" });
    if (r.code === "not_found") return res.status(404).json({ error: r.message });
    if (r.code === "dealer_missing")
      return res.status(422).json({ error: r.message, details: "Cannot approve without dealer ObjectId" });
    return res.status(400).json({ error: r.message });
  } catch (err) {
    console.error("approveApplication error:", err);
    return res.status(500).json({ error: err.message });
  }
};

/* ============================================================
   rejectApplicationCore(id, admin, reason, note)
   ------------------------------------------------------------
   Single source of truth for rejecting ONE application. Used by
   both the single endpoint and the bulk endpoint — no duplication.
   ============================================================ */
async function rejectApplicationCore(id, admin, reason, note) {
  const app = await Application.findById(id);
  if (!app) return { success: false, id, code: "not_found", message: "Application not found" };

  // Log the rejection before moving (use original app ID)
  try {
    await ActivityLog.create({
      adminId: admin?._id || admin?.id,
      applicationId: app._id,
      action: "REJECT",
      fromStage: app.workflowStage || null,
      toStage: "rejected",
      notes: note || reason || "Application rejected",
      at: new Date()
    });
  } catch (logErr) {
    console.error("Failed to log rejection:", logErr);
    // Don't block on logging failure
  }

  // Audit history entry
  await createHistoryEntry({
    applicationId: app._id,
    formId: app.formId,
    actionType: "REJECTED",
    oldValue: app.workflowStage || null,
    newValue: "rejected",
    remarks: note || reason || "Application rejected",
    updatedBy: (admin && (admin.name || admin.email)) || "admin",
    updatedByRole: admin?.role || "admin",
    updatedByAdminId: admin?._id || admin?.id || null,
  });

  const rejectedDoc = new RejectedApplication({
    ...app.toObject(),
    status: "rejected",
    // Preserve the original submission date as createdAt; stamp the rejection
    // time as updatedAt. save({ timestamps: false }) keeps both explicit values.
    createdAt: app.createdAt,
    updatedAt: new Date(),
    rejection: {
      rejectedBy: admin?.name || "system",
      reason,
      rejectedAt: new Date(),
    },
  });

  await rejectedDoc.save({ timestamps: false });
  await Application.findByIdAndDelete(id);

  await backfillDealerRef(app);
  if (app.dealer) {
    await sendPushNotification(
      app.dealer,
      "Application Rejected",
      note || reason || "Your application was rejected.",
      "rejected",
      app.formId
    );
  }

  return { success: true, id, formId: app.formId };
}

// Reject application (POST /api/workflow/reject/:id) — thin wrapper over core
export const rejectApplication = async (req, res) => {
  try {
    const r = await rejectApplicationCore(req.params.id, req.admin, req.body?.reason, req.body?.note);
    if (r.success) return res.json({ message: "Application moved to Rejected collection" });
    if (r.code === "not_found") return res.status(404).json({ message: r.message });
    return res.status(400).json({ error: r.message });
  } catch (err) {
    console.error("rejectApplication error:", err);
    return res.status(500).json({ error: err.message });
  }
};

/* ============================================================
   Bulk approve / reject
   POST /api/workflow/bulk-approve  { applicationIds: [...] }
   POST /api/workflow/bulk-reject   { applicationIds: [...], reason? }
   ------------------------------------------------------------
   Reuse the exact *Core functions above — same business logic and
   validations as the single endpoints. Each application is processed
   independently; a failure on one does not abort the rest, and all
   failures are returned (never silently ignored).
   ============================================================ */
export const bulkApproveApplications = async (req, res) => {
  const ids = Array.isArray(req.body?.applicationIds)
    ? req.body.applicationIds.filter(Boolean)
    : [];
  if (!ids.length) {
    return res.status(400).json({ error: "applicationIds must be a non-empty array" });
  }

  const approved = [];
  const failed = [];
  for (const id of ids) {
    try {
      const r = await approveApplicationCore(id, req.admin, req.body?.note);
      if (r.success) approved.push({ id, formId: r.formId });
      else failed.push({ id, formId: r.formId || null, reason: r.message });
    } catch (err) {
      console.error("bulkApprove item failed:", id, err.message);
      failed.push({ id, reason: err.message });
    }
  }

  return res.json({
    approvedCount: approved.length,
    failedCount: failed.length,
    approved,
    failed,
  });
};

export const bulkRejectApplications = async (req, res) => {
  const ids = Array.isArray(req.body?.applicationIds)
    ? req.body.applicationIds.filter(Boolean)
    : [];
  if (!ids.length) {
    return res.status(400).json({ error: "applicationIds must be a non-empty array" });
  }
  const reason = req.body?.reason || "Bulk rejected";

  const rejected = [];
  const failed = [];
  for (const id of ids) {
    try {
      const r = await rejectApplicationCore(id, req.admin, reason, req.body?.note);
      if (r.success) rejected.push({ id, formId: r.formId });
      else failed.push({ id, formId: r.formId || null, reason: r.message });
    } catch (err) {
      console.error("bulkReject item failed:", id, err.message);
      failed.push({ id, reason: err.message });
    }
  }

  return res.json({
    rejectedCount: rejected.length,
    failedCount: failed.length,
    rejected,
    failed,
  });
};

// List approved applications — paginated, searchable, permission-filtered
export const getApprovedApplications = async (req, res) => {
  const t0 = Date.now();
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 50);
    const skip   = (page - 1) * limit;
    const search = (req.query.search || "").trim();
    const branch = (req.query.branch || "").trim();

    let baseFilter = {};

    if (search) {
      const re = new RegExp(search, "i");
      baseFilter.$or = [
        { formId: re },
        { "applicant.name": re },
        { "applicant.applicant.name": re },
        { "dealerDetails.name": re },
        { "dealerDetails.branch": re },
      ];
    }

    if (branch) baseFilter["dealerDetails.branch"] = new RegExp(branch, "i");

    // Apply admin permission filter (superadmin sees all)
    const filter = await buildFinalizedFilter(req.admin, baseFilter);

    const [approvedApps, total] = await Promise.all([
      ApprovedApplication.find(filter)
        .select("formId applicant dealerDetails status workflowStage createdAt updatedAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ApprovedApplication.countDocuments(filter),
    ]);

    if (process.env.NODE_ENV !== "production") {
      console.log(`[PERF] getApprovedApplications: page=${page} limit=${limit} total=${total} returned=${approvedApps.length} in ${Date.now() - t0}ms`);
    }
    res.json({
      items: approvedApps.map(toListItem),
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("getApprovedApplications error:", err);
    res.status(500).json({ error: err.message });
  }
};

// Get approved application by id
export const getApprovedApplicationById = async (req, res) => {
  try {
    const app = await ApprovedApplication.findById(req.params.id)
      .populate("dealer", "name email branch district")
      .lean();

    if (!app) {
      return res.status(404).json({ error: "Approved application not found" });
    }

    return res.json(app);
  } catch (err) {
    console.error("getApprovedApplicationById error:", err);
    return res.status(500).json({ error: err.message });
  }
};

// List rejected applications — paginated, searchable, permission-filtered
export const getRejectedApplications = async (req, res) => {
  const t0 = Date.now();
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 50);
    const skip   = (page - 1) * limit;
    const search = (req.query.search || "").trim();
    const branch = (req.query.branch || "").trim();

    let baseFilter = {};

    if (search) {
      const re = new RegExp(search, "i");
      baseFilter.$or = [
        { formId: re },
        { "applicant.name": re },
        { "applicant.applicant.name": re },
        { "dealerDetails.name": re },
        { "dealerDetails.branch": re },
      ];
    }

    if (branch) baseFilter["dealerDetails.branch"] = new RegExp(branch, "i");

    // Apply admin permission filter (superadmin sees all)
    const filter = await buildFinalizedFilter(req.admin, baseFilter);

    const [items, total] = await Promise.all([
      RejectedApplication.find(filter)
        .select("formId applicant dealerDetails status workflowStage createdAt updatedAt rejection")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      RejectedApplication.countDocuments(filter),
    ]);

    if (process.env.NODE_ENV !== "production") {
      console.log(`[PERF] getRejectedApplications: page=${page} limit=${limit} total=${total} returned=${items.length} in ${Date.now() - t0}ms`);
    }
    res.json({
      items: items.map(toListItem),
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("getRejectedApplications error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/workflow/stats
 * Returns pending/approved/rejected/total counts for the logged-in admin,
 * respecting their permission filter. Used by the admin Dashboard.
 */
export const getWorkflowStats = async (req, res) => {
  try {
    const counts = await getStatCounts(
      req.admin,
      Application,
      ApprovedApplication,
      RejectedApplication
    );
    return res.json({ stats: counts });
  } catch (err) {
    console.error("getWorkflowStats error:", err);
    return res.status(500).json({ error: err.message });
  }
};

// Get rejected application by id
export const getRejectedApplicationById = async (req, res) => {
  try {
    const app = await RejectedApplication.findById(req.params.id)
      .populate("dealer", "email userId name district branch")
      .lean();
    if (!app) return res.status(404).json({ error: "Rejected application not found" });
    res.json(app);
  } catch (err) {
    console.error("getRejectedApplicationById error:", err);
    res.status(500).json({ error: err.message });
  }
};

// Maintenance helper (calls backfill etc.) - used by route /fix-dealers
export const fixDealerForApplications = async (_req, res) => {
  try {
    const apps = await Application.find({
      $or: [{ dealer: { $exists: false } }, { dealer: null }],
    });
    let updated = 0;

    for (const app of apps) {
      await backfillDealerRef(app);
      if (app.dealer) {
        if (!app.dealerDetails) {
          const u = await User.findById(app.dealer).lean();
          if (u) {
            app.dealerDetails = {
              _id: u._id,
              userId: u.userId ?? u.UserId,
              email: u.email,
              name: u.name,
              district: u.district,
              branch: u.branch,
            };
          }
        }
        await app.save();
        updated++;
      }
    }

    res.json({ message: `Updated ${updated} applications` });
  } catch (err) {
    console.error("fixDealerForApplications error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/workflow/normalize-stages
 * One-time backfill: normalize all workflowStage values in the Application
 * collection to their canonical lowercase keys.  Safe to run multiple times.
 */
export const normalizeAllWorkflowStages = async (_req, res) => {
  try {
    const apps = await Application.find(
      { workflowStage: { $exists: true } },
      { _id: 1, workflowStage: 1 }
    ).lean();

    let updated = 0;
    const bulk = Application.collection.initializeUnorderedBulkOp();

    for (const app of apps) {
      const canonical = toStage(app.workflowStage);
      if (canonical !== app.workflowStage) {
        bulk.find({ _id: app._id }).updateOne({ $set: { workflowStage: canonical } });
        updated++;
      }
    }

    if (updated > 0) await bulk.execute();

    res.json({ message: `Normalized ${updated} of ${apps.length} applications` });
  } catch (err) {
    console.error("normalizeAllWorkflowStages error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/workflow/applications/:id/history
 * Returns only STAGE_CHANGED and COMMENT entries, newest first.
 * Dealers are never served comments — only admin/superadmin tokens
 * reach this route (protect middleware + role check inside).
 */
export const getApplicationHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const entries = await ApplicationHistory.find({
      applicationId: id,
      actionType: { $in: ["STAGE_CHANGED", "COMMENT"] },
    })
      .sort({ updatedAt: -1 })
      .lean();

    const stageCount   = entries.filter((e) => e.actionType === "STAGE_CHANGED").length;
    const commentCount = entries.filter((e) => e.actionType === "COMMENT").length;
    const last         = entries[0] || null;

    return res.json({
      entries,
      stats: {
        stageUpdates: stageCount,
        comments:     commentCount,
        lastUpdatedBy:    last?.updatedBy    || null,
        lastUpdatedEmail: last?.updatedByEmail || null,
        lastUpdatedAt:    last?.updatedAt    || null,
      },
    });
  } catch (err) {
    console.error("getApplicationHistory error:", err);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/workflow/applications/:id/comments
 * Body: { comment: string }
 * Only admin / superadmin. Dealers never reach this route.
 */
export const addApplicationComment = async (req, res) => {
  try {
    const { id }      = req.params;
    const { comment } = req.body || {};

    if (!comment || !String(comment).trim()) {
      return res.status(400).json({ message: "comment is required" });
    }

    // Resolve formId — check all three collections
    let formId = null;
    const pending = await Application.findById(id).select("formId").lean();
    if (pending) { formId = pending.formId; }
    if (!formId) {
      const approved = await ApprovedApplication.findById(id).select("formId").lean();
      if (approved) formId = approved.formId;
    }
    if (!formId) {
      const rejected = await RejectedApplication.findById(id).select("formId").lean();
      if (rejected) formId = rejected.formId;
    }
    if (!formId) return res.status(404).json({ message: "Application not found" });

    const entry = await ApplicationHistory.create({
      applicationId: id,
      formId,
      actionType:      "COMMENT",
      remarks:         String(comment).trim(),
      updatedBy:       req.admin?.name || req.admin?.email || "admin",
      updatedByEmail:  req.admin?.email || "",
      updatedByRole:   req.admin?.role  || "admin",
      updatedByAdminId: req.admin?._id  || req.admin?.id || null,
      updatedAt:       new Date(),
    });

    return res.status(201).json({ entry });
  } catch (err) {
    console.error("addApplicationComment error:", err);
    return res.status(500).json({ error: err.message });
  }
};
