// controllers/formTrackingController.js
import mongoose from "mongoose";
import ApplicationHistory from "../models/ApplicationHistory.js";
import Application from "../models/Application.js";
import ApprovedApplication from "../models/ApprovedApplication.js";
import RejectedApplication from "../models/RejectedApplication.js";
import Admin from "../models/Admin.js";

// ── Helper: resolve application across all collections ──────────────────────
async function findApplicationByFormId(formId) {
  const normalized = String(formId || "").trim();
  const [pending, approved, rejected] = await Promise.all([
    Application.findOne({ formId: { $regex: new RegExp(`^${normalized}$`, "i") } })
      .populate("dealer", "name email branch district userId")
      .lean(),
    ApprovedApplication.findOne({ formId: { $regex: new RegExp(`^${normalized}$`, "i") } })
      .populate("dealer", "name email branch district userId")
      .lean(),
    RejectedApplication.findOne({ formId: { $regex: new RegExp(`^${normalized}$`, "i") } })
      .populate("dealer", "name email branch district userId")
      .lean(),
  ]);
  if (pending) return { app: pending, collection: "pending" };
  if (approved) return { app: approved, collection: "approved" };
  if (rejected) return { app: rejected, collection: "rejected" };
  return null;
}

// ── GET /api/form-tracking/search?formId=FORM-XXXXX ─────────────────────────
export const searchFormHistory = async (req, res) => {
  try {
    const { formId, page = 1, limit = 100, actionType, adminId, from, to } = req.query;

    if (!formId || String(formId).trim().length < 2) {
      return res.status(400).json({ message: "formId is required" });
    }

    const fid = String(formId).trim();

    // 1. Find application details
    const result = await findApplicationByFormId(fid);
    if (!result) {
      return res.status(404).json({ message: `No application found with Form ID: ${fid}` });
    }
    const { app, collection } = result;

    // 2. Build history query
    const historyMatch = { formId: { $regex: new RegExp(`^${fid}$`, "i") } };
    if (actionType && actionType !== "ALL") historyMatch.actionType = actionType;
    if (adminId) historyMatch.updatedByAdminId = new mongoose.Types.ObjectId(adminId);
    if (from || to) {
      historyMatch.updatedAt = {};
      if (from) historyMatch.updatedAt.$gte = new Date(from);
      if (to) historyMatch.updatedAt.$lte = new Date(to);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [history, totalCount] = await Promise.all([
      ApplicationHistory.find(historyMatch)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      ApplicationHistory.countDocuments(historyMatch),
    ]);

    // 3. Analytics
    const allHistory = await ApplicationHistory.find({
      formId: { $regex: new RegExp(`^${fid}$`, "i") },
    }).lean();

    const uniqueAdmins = new Set(allHistory.map((h) => h.updatedBy).filter(Boolean));
    const stageChanges = allHistory.filter((h) => h.actionType === "STAGE_CHANGED").length;
    const comments = allHistory.filter((h) => h.actionType === "COMMENT_ADDED").length;
    const approvals = allHistory.filter((h) => h.actionType === "APPROVED").length;
    const rejections = allHistory.filter((h) => h.actionType === "REJECTED").length;
    const lastEntry = allHistory.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];

    // 4. Admin involvement breakdown
    const adminCountMap = {};
    allHistory.forEach((h) => {
      const key = h.updatedBy || "Unknown";
      adminCountMap[key] = (adminCountMap[key] || 0) + 1;
    });
    const adminInvolvement = Object.entries(adminCountMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // 5. Build response
    const applicant = app.applicant?.applicant || app.applicant || {};
    const dealer = app.dealer || {};
    const dealerDetails = app.dealerDetails || {};

    return res.json({
      application: {
        formId: app.formId,
        applicationId: String(app._id),
        customerName:
          applicant?.name ||
          applicant?.applicantName ||
          app.applicant?.name ||
          "—",
        dealerName:
          dealer?.name ||
          dealerDetails?.name ||
          "—",
        branch:
          dealer?.branch ||
          dealerDetails?.branch ||
          app.dealerDetails?.Branch ||
          "—",
        district:
          dealer?.district ||
          dealerDetails?.district ||
          app.dealerDetails?.District ||
          "—",
        currentStatus: app.status || "pending",
        currentStage: app.workflowStage || "—",
        createdAt: app.createdAt,
        collection,
        rejectionReason: app.rejection?.reason || null,
      },
      history,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / Number(limit)),
      },
      analytics: {
        totalUpdates: allHistory.length,
        uniqueAdminsInvolved: uniqueAdmins.size,
        stageChanges,
        commentsAdded: comments,
        approvals,
        rejections,
        lastUpdatedBy: lastEntry?.updatedBy || "—",
        lastUpdatedAt: lastEntry?.updatedAt || null,
      },
      adminInvolvement,
    });
  } catch (err) {
    console.error("searchFormHistory error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ── POST /api/form-tracking/log ──────────────────────────────────────────────
// Internal helper also exported for use in other controllers
export const createHistoryEntry = async ({
  applicationId,
  formId,
  actionType,
  oldValue = null,
  newValue = null,
  remarks = "",
  updatedBy,
  updatedByRole = "admin",
  updatedByAdminId = null,
  updatedAt = new Date(),
}) => {
  try {
    await ApplicationHistory.create({
      applicationId,
      formId,
      actionType,
      oldValue,
      newValue,
      remarks,
      updatedBy,
      updatedByRole,
      updatedByAdminId,
      updatedAt,
    });
  } catch (err) {
    console.error("createHistoryEntry failed (non-blocking):", err.message);
  }
};

// ── GET /api/form-tracking/admins ────────────────────────────────────────────
export const getAdminsForFilter = async (req, res) => {
  try {
    const admins = await Admin.find({}, "name email role").sort({ name: 1 }).lean();
    return res.json({ admins });
  } catch (err) {
    console.error("getAdminsForFilter error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
