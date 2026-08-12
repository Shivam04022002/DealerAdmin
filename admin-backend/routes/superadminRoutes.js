// routes/superadminRoutes.js
import express from "express";
import { requireAuth, requireSuperAdmin } from "../middleware/authMiddleware.js";
import {
  createAdmin,
  listAdmins,
  updateAdmin,
  deleteAdmin,
  toggleAdminActive,
  recentActivity,
  adminSummary,
  applicationStats,
  applicationHistory,
  getFilesByType,
  getFileFacets,
  getAdminActivity,
  revokeRejectedApplication,
  createDealer,
  bulkCreateDealers,
  listDealers,
  updateDealer,
  toggleDealerActive,
  deleteDealer,
  getDealerLoginActivity,
} from "../controllers/superadminController.js";

const router = express.Router();

router.use(requireAuth, requireSuperAdmin);

router.post("/admins", createAdmin);
router.get("/admins", listAdmins);
router.patch("/admins/toggle", toggleAdminActive); // Must come before /admins/:id to avoid route conflict
router.patch("/admins/:id", updateAdmin);
router.delete("/admins/:id", deleteAdmin);

router.get("/dashboard/recent", recentActivity);
router.get("/dashboard/summary", adminSummary);
router.get("/dashboard/stats", applicationStats);
router.get("/dashboard/application/:applicationId/history", applicationHistory);
router.get("/dashboard/admin/:adminId/activity", getAdminActivity);

router.get("/files/:type/facets", getFileFacets); // Must come before /files/:type or ":type" swallows "pending/facets"
router.get("/files/:type", getFilesByType);
router.post("/applications/revoke", revokeRejectedApplication);

// Dealer management routes
router.post("/dealers", createDealer);
router.post("/dealers/bulk", bulkCreateDealers);
router.get("/dealers/activity", getDealerLoginActivity); // Must come before /dealers/:id
router.get("/dealers", listDealers);
router.patch("/dealers/toggle", toggleDealerActive); // Must come before /dealers/:id
router.patch("/dealers/:id", updateDealer);
router.delete("/dealers/:id", deleteDealer);

export default router;
