// example: add to admin/admin-backend/controllers/mergeController.js (for testing)
import express from "express";
import { autoMergeApplications } from "../services/autoMergeService.js";
const router = express.Router();

router.get("/debug/merge-dry", async (req, res) => {
  try {
    const summary = await autoMergeApplications({ dryRun: true, requireCoApplicant: false });
    return res.json(summary);
  } catch (err) {
    console.error("debug merge-dry error:", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

export default router;
