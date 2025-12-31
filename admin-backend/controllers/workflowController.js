// controllers/workflowController.js
import Application from "../models/Application.js";
import ApprovedApplication from "../models/ApprovedApplication.js";
import RejectedApplication from "../models/RejectedApplication.js";
import ActivityLog from "../models/ActivityLog.js";
import { autoMergeApplications } from "../services/autoMergeService.js";
import User from "../models/User.js";

/* ---------- helpers ---------- */

// normalize to lowercase trimmed stage key
const toStage = (s) => String(s || "").trim().toLowerCase();

// robust normalization: accepts array or messy string blob and returns clean array
const normalizeWorkflows = (wf) => {
  if (!wf) return [];

  if (Array.isArray(wf)) {
    return wf.map(toStage).filter(Boolean);
  }

  return String(wf)
    .replace(/[\[\]"']/g, "") // remove [, ], " and '
    .split(/[\n,]+/) // split by newline(s) or comma(s)
    .map((s) => toStage(s))
    .filter(Boolean);
};

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

// Get single application by id (populate dealer)
export const getApplicationById = async (req, res) => {
  try {
    const app = await Application.findById(req.params.id)
      .populate("dealer", "email userId name district branch")
      .lean();

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

// Get all pending applications (auto-merge first), populate dealer
export const getPendingApplications = async (req, res) => {
  try {
    await autoMergeApplications();

    // defensive normalization of admin workflows
    const cleaned = normalizeWorkflows(req.admin?.workflows || []);

    // Build filter for pending-like applications
    let filter = {
      $or: [
        { status: { $in: ["pending", null] } },
        { workflowStage: { $exists: false } },
        { workflowStage: { $nin: ["disbursed", "rejected", "approved"] } },
      ],
    };

    // Apply admin workflow restriction only if admin has an explicit list
    if (cleaned.length > 0) {
      // Allow applications that are either:
      // 1. At workflow stages the admin has access to, OR
      // 2. Don't have a workflowStage yet (new applications)
      filter = {
        $and: [
          filter, // Keep the pending-like filter
          {
            $or: [
              { workflowStage: { $exists: false } }, // New applications without workflowStage
              { workflowStage: { $in: cleaned } },   // Applications at stages admin can access
            ]
          }
        ]
      };
    }

    const applications = await Application.find(filter)
      .select("formId applicant coApplicant vehicleDetails dealer dealerDetails status workflowStage history")
      .populate("dealer", "email userId name district branch")
      .lean();

    return res.json(applications);
  } catch (err) {
    console.error("getPendingApplications error:", err);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * PATCH /api/workflow/update/:id
 * Body: { nextWorkflowStage: "cibil", expectedCurrentStage: "contact creation" }
 */
export const updateWorkflowStage = async (req, res) => {
  try {
    const { id } = req.params;
    const { nextWorkflowStage, expectedCurrentStage } = req.body || {};

    if (!nextWorkflowStage) {
      return res.status(400).json({ message: "nextWorkflowStage is required" });
    }

    const next = toStage(nextWorkflowStage);
    const allowedFinalNames = ["disbursement", "disbursed"];

    const app = await Application.findById(id);
    if (!app) return res.status(404).json({ message: "Application not found" });

    const current = toStage(app.workflowStage || "");

    // optimistic check: if expectedCurrentStage provided, ensure current matches
    if (expectedCurrentStage) {
      const expect = toStage(expectedCurrentStage);
      if (expect !== current) {
        return res.status(409).json({
          message: "Current stage mismatch",
          current: app.workflowStage,
        });
      }
    }

    // Validate requested `nextWorkflowStage` against logged-in admin's workflow (if defined)
    const adminWorkflows = normalizeWorkflows(req.admin?.workflows || []);
    if (Array.isArray(adminWorkflows) && adminWorkflows.length > 0) {
      if (!adminWorkflows.includes(next)) {
        return res.status(400).json({
          message: `Stage '${nextWorkflowStage}' is not allowed for your account (admin workflow).`,
          allowedStages: adminWorkflows,
        });
      }
    }

    // Prevent skipping forward more than 1 step — best-effort using a global list.
    const GLOBAL = [
      "contact creation",
      "cibil",
      "housevisit",
      "document collection",
      "credit sanction",
      "agreement",
      "pre-disbursement documentation",
      "disbursement",
      "disbursed",
    ].map(toStage);

    const currentIdx = GLOBAL.indexOf(current);
    const nextIdx = GLOBAL.indexOf(next);

    if (nextIdx === -1) {
      return res.status(400).json({ message: `Unknown workflow stage '${nextWorkflowStage}'` });
    }

    const allowedIdx = currentIdx === -1 ? 0 : currentIdx + 1;
    if (nextIdx !== allowedIdx && !allowedFinalNames.includes(next) && currentIdx !== -1) {
      const allowedStage = GLOBAL[allowedIdx] || GLOBAL[GLOBAL.length - 1];
      return res.status(400).json({
        message:
          currentIdx === -1
            ? `Application has no valid current stage. You must start with '${allowedStage}'.`
            : `Cannot skip stages. After '${app.workflowStage}', only '${allowedStage}' is allowed.`,
      });
    }

    // push history and update
    app.history = app.history || [];
    app.history.push({
      action: "workflow_advance",
      from: app.workflowStage || null,
      to: nextWorkflowStage,
      updatedBy: (req.admin && (req.admin.name || req.admin.email)) || "admin",
      updatedAt: new Date(),
    });

    app.workflowStage = nextWorkflowStage;
    app.updatedAt = new Date();

    // Non-final -> just save and return
    if (!allowedFinalNames.includes(next)) {
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
      
      return res.json({ message: "Workflow stage updated", workflowStage: app.workflowStage, application: app });
    }

    // Final: ensure dealer exists then move to Approved collection (if not duplicate)
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

    return res.json({ message: "Application approved and moved to Approved collection" });
  } catch (err) {
    console.error("updateWorkflowStage error:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
};

// approve endpoint (POST /api/workflow/approve/:id)
export const approveApplication = async (req, res) => {
  const { id } = req.params;
  try {
    const app = await Application.findById(id);
    if (!app) return res.status(404).json({ error: "Application not found" });

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
        notes: req.body?.note || "Application approved via admin UI",
        at: new Date()
      });
    } catch (logErr) {
      console.error("Failed to log approval:", logErr);
      // Don't block the request if logging fails
    }

    const exists = await ApprovedApplication.findOne({ formId: app.formId }).lean();
    if (!exists) {
      await ApprovedApplication.create({
        formId: app.formId,
        applicant: app.applicant,
        coApplicant: app.coApplicant,
        vehicleDetails: app.vehicleDetails,
        dealer: app.dealer,
        dealerDetails: app.dealerDetails,
        status: "approved",
        workflowStage: "disbursement",
        history: [
          ...(app.history || []),
          {
            updatedBy: req.admin?.name || "system",
            updatedAt: new Date(),
            changes: "Application approved and moved to Approved collection",
          },
        ],
      });
    }

    await Application.findByIdAndDelete(id);
    return res.json({ message: "Application approved and moved" });
  } catch (err) {
    console.error("approveApplication error:", err);
    return res.status(500).json({ error: err.message });
  }
};

// Reject application (copy then delete original)
export const rejectApplication = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  try {
    const app = await Application.findById(id);
    if (!app) return res.status(404).json({ message: "Application not found" });

    // Log the rejection before moving (use original app ID)
    try {
      await ActivityLog.create({
        adminId: req.admin?._id || req.admin?.id,
        applicationId: app._id,
        action: "REJECT",
        fromStage: app.workflowStage || null,
        toStage: "rejected",
        notes: req.body?.note || reason || "Application rejected",
        at: new Date()
      });
    } catch (logErr) {
      console.error("Failed to log rejection:", logErr);
      // Don't block the request if logging fails
    }

    const rejectedDoc = new RejectedApplication({
      ...app.toObject(),
      status: "rejected",
      rejection: {
        rejectedBy: req.admin?.name || "system",
        reason,
        rejectedAt: new Date(),
      },
    });

    await rejectedDoc.save();
    await Application.findByIdAndDelete(id);

    return res.json({ message: "Application moved to Rejected collection" });
  } catch (err) {
    console.error("rejectApplication error:", err);
    return res.status(500).json({ error: err.message });
  }
};

// List approved applications
export const getApprovedApplications = async (_req, res) => {
  try {
    const approvedApps = await ApprovedApplication.find()
      .populate("dealer", "name email branch district")
      .lean();
    res.json(approvedApps);
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

// List rejected applications
export const getRejectedApplications = async (_req, res) => {
  try {
    const items = await RejectedApplication.find()
      .select("formId applicant coApplicant vehicleDetails dealer dealerDetails status workflowStage history createdAt updatedAt")
      .populate("dealer", "email userId name district branch")
      .lean();
    res.json(items);
  } catch (err) {
    console.error("getRejectedApplications error:", err);
    res.status(500).json({ error: err.message });
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
