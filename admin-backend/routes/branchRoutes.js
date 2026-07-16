// routes/branchRoutes.js
import express from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { listBranches, createBranch } from "../controllers/branchController.js";

const router = express.Router();

router.use(requireAuth);

router.get("/", listBranches);
router.post("/", createBranch);

export default router;
