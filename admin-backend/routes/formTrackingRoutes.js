// routes/formTrackingRoutes.js
import express from "express";
import { requireAuth, requireSuperAdmin } from "../middleware/authMiddleware.js";
import {
  searchFormHistory,
  getAdminsForFilter,
} from "../controllers/formTrackingController.js";

const router = express.Router();

router.use(requireAuth, requireSuperAdmin);

router.get("/search", searchFormHistory);
router.get("/admins", getAdminsForFilter);

export default router;
