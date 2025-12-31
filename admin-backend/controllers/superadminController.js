// controllers/superadminController.js
import mongoose from "mongoose";
import Admin from "../models/Admin.js";
import User from "../models/User.js";
import ActivityLog from "../models/ActivityLog.js";
import Application from "../models/Application.js";
import ApprovedApplication from "../models/ApprovedApplication.js";
import RejectedApplication from "../models/RejectedApplication.js";

export const createAdmin = async (req, res) => {
  try {
    const { name, email, password, workflows = [], role = "admin" } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: "name, email, password are required" });

    if (!["admin", "superadmin"].includes(role))
      return res.status(400).json({ message: "Invalid role" });

    const exists = await Admin.findOne({ email });
    if (exists) return res.status(409).json({ message: "Email already in use" });

    const admin = await Admin.create({
      name, email, password, role, workflows,
      createdBy: req.admin?.id || null,
      isActive: true,
    });

    return res.status(201).json({
      message: "Admin created",
      admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role, isActive: admin.isActive }
    });
  } catch (err) {
    console.error("createAdmin:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const listAdmins = async (_req, res) => {
  try {
    const admins = await Admin.find({}, "name email role isActive lastLoginAt createdAt workflows")
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ admins });
  } catch (err) {
    console.error("listAdmins:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const toggleAdminActive = async (req, res) => {
  try {
    const { adminId, isActive } = req.body;
    
    // Validate adminId
    if (!adminId) {
      return res.status(400).json({ message: "adminId is required" });
    }
    
    // Validate isActive is a boolean
    if (typeof isActive !== "boolean") {
      return res.status(400).json({ message: "isActive must be a boolean" });
    }

    // Check if trying to change own status (compare both _id and id fields, convert to strings)
    const currentAdminId = String(req.admin?._id || req.admin?.id || "");
    const targetAdminId = String(adminId);
    
    if (currentAdminId === targetAdminId) {
      return res.status(400).json({ message: "You cannot change your own active status" });
    }

    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    admin.isActive = isActive;
    await admin.save();

    return res.json({ message: "Updated", admin: { id: admin._id, isActive: admin.isActive } });
  } catch (err) {
    console.error("toggleAdminActive:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ----- DASHBOARD -----
export const recentActivity = async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const logs = await ActivityLog.find({})
      .populate("adminId", "name email role")
      .populate("applicationId", "_id")
      .sort({ at: -1 })
      .limit(Number(limit));
    return res.json({ logs });
  } catch (err) {
    console.error("recentActivity:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const adminSummary = async (req, res) => {
  try {
    const { from, to } = req.query;
    const match = {};
    if (from || to) {
      match.at = {};
      if (from) match.at.$gte = new Date(from);
      if (to) match.at.$lte = new Date(to);
    }

    const summary = await ActivityLog.aggregate([
      { $match: match },
      { $group: {
          _id: "$adminId",
          totalActions: { $sum: 1 },
          updates: { $sum: { $cond: [{ $eq: ["$action", "UPDATE_STAGE"] }, 1, 0] } },
          approvals: { $sum: { $cond: [{ $eq: ["$action", "APPROVE"] }, 1, 0] } },
          rejections: { $sum: { $cond: [{ $eq: ["$action", "REJECT"] }, 1, 0] } },
          edits: { $sum: { $cond: [{ $eq: ["$action", "EDIT_FIELDS"] }, 1, 0] } },
          lastActionAt: { $max: "$at" }
        }
      },
      { $lookup: { from: "admins", localField: "_id", foreignField: "_id", as: "admin" } },
      { $unwind: "$admin" },
      { $project: {
          _id: 0,
          adminId: "$admin._id",
          name: "$admin.name",
          email: "$admin.email",
          role: "$admin.role",
          totalActions: 1, updates: 1, approvals: 1, rejections: 1, edits: 1, lastActionAt: 1
        }
      },
      { $sort: { totalActions: -1 } }
    ]);

    return res.json({ summary });
  } catch (err) {
    console.error("adminSummary:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const applicationHistory = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const history = await ActivityLog.find({ applicationId })
      .populate("adminId", "name email role")
      .sort({ at: 1 });
    const app = await Application.findById(applicationId).select("_id status stage updatedAt");
    return res.json({ application: app, history });
  } catch (err) {
    console.error("applicationHistory:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ----- NEW CONTROLLERS -----

export const updateAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, workflows, password } = req.body;

    if (!["admin", "superadmin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const admin = await Admin.findById(id);
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    // Prevent self-demotion
    if (req.admin?.id === id && role !== "superadmin") {
      return res.status(400).json({ message: "You cannot change your own role" });
    }

    admin.name = name;
    admin.email = email;
    admin.role = role;
    admin.workflows = workflows;
    
    // Update password only if provided
    if (password && password.trim() !== "") {
      admin.password = password; // Will be hashed by pre-save hook
    }
    
    await admin.save();

    return res.json({
      message: "Admin updated",
      admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role, workflows: admin.workflows }
    });
  } catch (err) {
    console.error("updateAdmin:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent self-deletion
    if (req.admin?.id === id) {
      return res.status(400).json({ message: "You cannot delete your own account" });
    }

    const admin = await Admin.findById(id);
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    await Admin.findByIdAndDelete(id);
    return res.json({ message: "Admin deleted" });
  } catch (err) {
    console.error("deleteAdmin:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const applicationStats = async (req, res) => {
  try {
    const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
      Application.countDocuments({ $or: [
        { status: { $in: ["pending", null] } },
        { workflowStage: { $exists: false } },
        { workflowStage: { $nin: ["disbursed", "rejected", "approved"] } }
      ]}),
      ApprovedApplication.countDocuments(),
      RejectedApplication.countDocuments()
    ]);

    const total = pendingCount + approvedCount + rejectedCount;

    return res.json({
      stats: {
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        total: total
      }
    });
  } catch (err) {
    console.error("applicationStats:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getFilesByType = async (req, res) => {
  try {
    const { type } = req.params;
    let applications = [];

    switch (type) {
      case "pending":
        applications = await Application.find({
          $or: [
            { status: { $in: ["pending", null] } },
            { workflowStage: { $exists: false } },
            { workflowStage: { $nin: ["disbursed", "rejected", "approved"] } }
          ]
        })
        .select("formId applicant coApplicant vehicleDetails dealer dealerDetails status workflowStage")
        .populate("dealer", "email userId name district branch")
        .lean();
        break;

      case "approved":
        applications = await ApprovedApplication.find()
          .select("formId applicant coApplicant vehicleDetails dealer dealerDetails status workflowStage approvedAt")
          .populate("dealer", "email userId name district branch")
          .lean();
        break;

      case "rejected":
        applications = await RejectedApplication.find()
          .select("formId applicant coApplicant vehicleDetails dealer dealerDetails status workflowStage rejectedAt reason")
          .populate("dealer", "email userId name district branch")
          .lean();
        break;

      default:
        return res.status(400).json({ message: "Invalid type. Use: pending, approved, or rejected" });
    }

    return res.json(applications);
  } catch (err) {
    console.error("getFilesByType:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getAdminActivity = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { from, to } = req.query;
    
    const match = { adminId: new mongoose.Types.ObjectId(adminId) };
    if (from || to) {
      match.at = {};
      if (from) match.at.$gte = new Date(from);
      if (to) match.at.$lte = new Date(to);
    }

    const logs = await ActivityLog.find(match)
      .populate("adminId", "name email role")
      .sort({ at: -1 })
      .lean();

    // Get unique application IDs
    const appIds = [...new Set(logs.map(log => String(log.applicationId)))];
    
    // Try to find applications in all collections
    const [pendingApps, approvedApps, rejectedApps] = await Promise.all([
      Application.find({ _id: { $in: appIds } }).lean(),
      ApprovedApplication.find({ _id: { $in: appIds } }).lean(),
      RejectedApplication.find({ _id: { $in: appIds } }).lean()
    ]);
    
    // Create a map of application data
    const appMap = new Map();
    [...pendingApps, ...approvedApps, ...rejectedApps].forEach(app => {
      appMap.set(String(app._id), app);
    });

    // Group logs by application to show file-level actions
    const filesMap = new Map();
    logs.forEach(log => {
      const appId = String(log.applicationId);
      const app = appMap.get(appId);
      
      if (!filesMap.has(appId)) {
        filesMap.set(appId, {
          applicationId: appId,
          formId: app?.formId || "—",
          applicant: app?.applicant?.applicant?.name || app?.applicant?.name || "—",
          workflowStage: app?.workflowStage || "—",
          status: app?.status || "—",
          actions: []
        });
      }
      filesMap.get(appId).actions.push({
        action: log.action,
        fromStage: log.fromStage,
        toStage: log.toStage,
        notes: log.notes,
        at: log.at,
        admin: {
          name: log.adminId?.name || "—",
          email: log.adminId?.email || "—"
        }
      });
    });

    const files = Array.from(filesMap.values());

    return res.json({ 
      admin: logs[0]?.adminId || null,
      totalActions: logs.length,
      files 
    });
  } catch (err) {
    console.error("getAdminActivity:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const createDealer = async (req, res) => {
  try {
    const { email, password, UserId, name, District, Branch, Contact } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // Check if email already exists
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const dealer = await User.create({
      email,
      password,
      UserId,
      name,
      District,
      Branch,
      Contact,
    });

    return res.status(201).json({
      message: "Dealer created successfully",
      dealer: {
        id: dealer._id,
        email: dealer.email,
        UserId: dealer.UserId,
        name: dealer.name,
        District: dealer.District,
        Branch: dealer.Branch,
        Contact: dealer.Contact,
      }
    });
  } catch (err) {
    console.error("createDealer:", err);
    if (err.code === 11000) {
      return res.status(409).json({ message: "Email already exists" });
    }
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const bulkCreateDealers = async (req, res) => {
  try {
    const { dealers } = req.body; // Array of dealer objects
    
    if (!Array.isArray(dealers) || dealers.length === 0) {
      return res.status(400).json({ message: "Dealers array is required and must not be empty" });
    }

    const results = {
      success: [],
      failed: [],
    };

    for (const dealerData of dealers) {
      try {
        const { email, password, UserId, name, District, Branch, Contact } = dealerData;
        
        if (!email || !password) {
          results.failed.push({
            email: email || "N/A",
            error: "Email and password are required"
          });
          continue;
        }

        // Check if email already exists
        const exists = await User.findOne({ email });
        if (exists) {
          results.failed.push({
            email,
            error: "Email already exists"
          });
          continue;
        }

        const dealer = await User.create({
          email,
          password,
          UserId,
          name,
          District,
          Branch,
          Contact,
        });

        results.success.push({
          id: dealer._id,
          email: dealer.email,
          UserId: dealer.UserId,
          name: dealer.name,
        });
      } catch (err) {
        results.failed.push({
          email: dealerData.email || "N/A",
          error: err.message || "Failed to create dealer"
        });
      }
    }

    return res.status(200).json({
      message: `Bulk creation completed: ${results.success.length} succeeded, ${results.failed.length} failed`,
      results
    });
  } catch (err) {
    console.error("bulkCreateDealers:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const listDealers = async (req, res) => {
  try {
    const dealers = await User.find({}, "email UserId name District Branch Contact isActive createdAt")
      .sort({ createdAt: -1 })
      .lean();
    
    return res.json({ dealers });
  } catch (err) {
    console.error("listDealers:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const updateDealer = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, UserId, name, District, Branch, Contact } = req.body;

    const dealer = await User.findById(id);
    if (!dealer) return res.status(404).json({ message: "Dealer not found" });

    // Check if email is being changed and if it already exists
    if (email && email !== dealer.email) {
      const exists = await User.findOne({ email });
      if (exists) {
        return res.status(409).json({ message: "Email already in use" });
      }
      dealer.email = email;
    }

    // Update other fields
    if (UserId !== undefined) dealer.UserId = UserId;
    if (name !== undefined) dealer.name = name;
    if (District !== undefined) dealer.District = District;
    if (Branch !== undefined) dealer.Branch = Branch;
    if (Contact !== undefined) dealer.Contact = Contact;
    
    // Update password only if provided
    if (password && password.trim() !== "") {
      dealer.password = password; // Will be hashed by pre-save hook
    }
    
    await dealer.save();

    return res.json({
      message: "Dealer updated successfully",
      dealer: {
        id: dealer._id,
        email: dealer.email,
        UserId: dealer.UserId,
        name: dealer.name,
        District: dealer.District,
        Branch: dealer.Branch,
        Contact: dealer.Contact,
        isActive: dealer.isActive,
      }
    });
  } catch (err) {
    console.error("updateDealer:", err);
    if (err.code === 11000) {
      return res.status(409).json({ message: "Email already exists" });
    }
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const toggleDealerActive = async (req, res) => {
  try {
    const { dealerId, isActive } = req.body;
    
    if (!dealerId) {
      return res.status(400).json({ message: "dealerId is required" });
    }
    
    if (typeof isActive !== "boolean") {
      return res.status(400).json({ message: "isActive must be a boolean" });
    }

    const dealer = await User.findById(dealerId);
    if (!dealer) {
      return res.status(404).json({ message: "Dealer not found" });
    }

    dealer.isActive = isActive;
    await dealer.save();

    return res.json({ 
      message: "Dealer status updated successfully",
      dealer: { id: dealer._id, email: dealer.email, isActive: dealer.isActive } 
    });
  } catch (err) {
    console.error("toggleDealerActive:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const deleteDealer = async (req, res) => {
  try {
    const { id } = req.params;

    const dealer = await User.findById(id);
    if (!dealer) return res.status(404).json({ message: "Dealer not found" });

    await User.findByIdAndDelete(id);
    return res.json({ message: "Dealer deleted successfully" });
  } catch (err) {
    console.error("deleteDealer:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const revokeRejectedApplication = async (req, res) => {
  try {
    const { applicationId } = req.body;

    // Find the rejected application
    const rejectedApp = await RejectedApplication.findById(applicationId);
    if (!rejectedApp) {
      return res.status(404).json({ message: "Rejected application not found" });
    }

    // Ensure we have a dealer reference because Application schema requires it
    let dealerId =
      rejectedApp.dealer ||
      rejectedApp.dealerDetails?._id ||
      null;

    // Cast string ids to ObjectId so Application validation doesn't fail
    if (dealerId && typeof dealerId === "string") {
      try {
        dealerId = new mongoose.Types.ObjectId(dealerId);
      } catch (e) {
        return res.status(422).json({
          message: "Dealer reference invalid on rejected application",
          details: "Cannot move back to pending with malformed dealer id",
        });
      }
    }

    if (!dealerId) {
      return res.status(422).json({
        message: "Dealer reference missing on rejected application",
        details: "Cannot move back to pending without dealer ObjectId"
      });
    }

    // Create a new pending application from the rejected data
    const { _id, createdAt, updatedAt, ...rest } = rejectedApp.toObject();
    const pendingApp = new Application({
      ...rest,
      dealer: dealerId,
      status: "pending",
      workflowStage: "contact creation", // reset to the starting workflow stage
      history: [
        ...(rejectedApp.history || []),
        {
          updatedBy: req.admin?.name || req.admin?.email || "superadmin",
          updatedAt: new Date(),
          changes: "Rejection revoked -> moved back to pending",
        },
      ],
      createdAt: undefined,
      updatedAt: undefined,
    });

    await pendingApp.save();

    // Remove from rejected collection
    await RejectedApplication.findByIdAndDelete(applicationId);

    // Log the activity
    try {
      await ActivityLog.create({
        adminId: req.admin?._id || req.admin?.id,
        applicationId: pendingApp._id,
        action: "REVOKE_REJECTION",
        fromStage: "rejected",
        toStage: "pending",
        notes: "Application revoked from rejected status back to pending"
      });
    } catch (logErr) {
      console.error("revokeRejectedApplication: failed to log activity", logErr);
      // Do not block success if logging fails
    }

    return res.json({
      message: "Application revoked and moved back to pending",
      application: pendingApp
    });
  } catch (err) {
    console.error("revokeRejectedApplication:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
