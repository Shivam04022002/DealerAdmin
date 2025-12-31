// routes/workflowRoutes.js
import express from 'express';
import {
  getPendingApplications,
  updateWorkflowStage,
  rejectApplication,
  getRejectedApplications,
  getRejectedApplicationById,
  getApplicationById,
  getPendingApplicationById,
  approveApplication,
  getApprovedApplications,
  getApprovedApplicationById,
  fixDealerForApplications
} from '../controllers/workflowController.js';
import protect from '../middleware/authMiddleware.js';
import Application from "../models/Application.js";

const router = express.Router();

// primary endpoints
router.get('/pending', protect, getPendingApplications);
router.get('/pending/:id', protect, getPendingApplicationById);
router.get('/:id', protect, getApplicationById);

// canonical patch used by admin UI to advance non-final stages
router.patch('/workflow/update/:id', protect, updateWorkflowStage);

// deprecated/compat or alternate names (kept for backward compatibility)
router.patch('/update/:id', protect, updateWorkflowStage);
router.patch('/applications/:id', protect, updateWorkflowStage);
router.patch('/applications/update/:id', protect, updateWorkflowStage);

// approve / reject / lists
router.post('/approve/:id', protect, approveApplication);
router.post('/reject/:id', protect, rejectApplication);

router.get('/applications/approved', protect, getApprovedApplications);
router.get('/applications/rejected', protect, getRejectedApplications);
router.get('/applications/approved/:id', protect, getApprovedApplicationById);
router.get('/applications/rejected/:id', protect, getRejectedApplicationById);

// maintenance
router.post('/fix-dealers', protect, fixDealerForApplications);

// debug helper
router.get('/debug/pending-stages', protect, async (req, res) => {
  const docs = await Application.aggregate([
    { $match: { status: 'pending' } },
    { $group: { _id: { $toLower: "$workflowStage" }, count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  res.json(docs);
});

export default router;
