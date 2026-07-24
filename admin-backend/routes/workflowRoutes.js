// routes/workflowRoutes.js
import express from 'express';
import {
  WORKFLOW_STAGES,
  STAGE_LABELS,
  STAGE_COLORS,
  FINAL_STAGES,
} from '../utils/workflowConstants.js';
import {
  getPendingApplications,
  updateWorkflowStage,
  rejectApplication,
  getRejectedApplications,
  getRejectedApplicationById,
  getApplicationById,
  getPendingApplicationById,
  approveApplication,
  bulkApproveApplications,
  bulkRejectApplications,
  getApprovedApplications,
  getApprovedApplicationById,
  fixDealerForApplications,
  getApplicationHistory,
  addApplicationComment,
  getWorkflowStats,
  normalizeAllWorkflowStages,
} from '../controllers/workflowController.js';
import protect from '../middleware/authMiddleware.js';
import Application from "../models/Application.js";
import { autoMergeApplications, mergeSingleApplication } from '../services/autoMergeService.js';

const router = express.Router();

// ── Shared stage config (public — used by mobile app + admin frontend) ────────
router.get('/stages', (_req, res) => {
  res.json({ stages: WORKFLOW_STAGES, labels: STAGE_LABELS, colors: STAGE_COLORS, finalStages: FINAL_STAGES });
});

// ── Permission-aware stats (used by admin Dashboard, not superadmin panel) ───
router.get('/stats', protect, getWorkflowStats);

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

// Bulk approve / reject — same core logic as the single endpoints
router.post('/bulk-approve', protect, bulkApproveApplications);
router.post('/bulk-reject', protect, bulkRejectApplications);

router.get('/applications/approved', protect, getApprovedApplications);
router.get('/applications/rejected', protect, getRejectedApplications);
router.get('/applications/approved/:id', protect, getApprovedApplicationById);
router.get('/applications/rejected/:id', protect, getRejectedApplicationById);

// audit history + internal comments (admin/superadmin only — no dealer access)
router.get('/applications/:id/history',  protect, getApplicationHistory);
router.post('/applications/:id/comments', protect, addApplicationComment);

// maintenance
router.post('/fix-dealers', protect, fixDealerForApplications);
router.post('/normalize-stages', protect, normalizeAllWorkflowStages);

// POST /api/workflow/merge/:formId
// Merge a single application by formId — called immediately after dealer submission.
// Returns synchronously so the caller knows the result.
router.post('/merge/:formId', async (req, res) => {
  const { formId } = req.params;
  if (!formId || !formId.trim()) {
    return res.status(400).json({ success: false, error: 'formId is required' });
  }
  try {
    const result = await mergeSingleApplication(formId.trim());
    if (result.success) {
      return res.status(201).json({ success: true, applicationId: result.applicationId, formId, durationMs: result.durationMs });
    }
    // Not an error — already merged / approved / rejected are valid skip reasons
    const alreadyDone = ['already_merged', 'already_approved', 'already_rejected'].includes(result.reason);
    return res.status(alreadyDone ? 200 : 422).json({ success: false, reason: result.reason, applicationId: result.applicationId ?? null });
  } catch (err) {
    console.error(`[route:merge/${formId}] Unexpected error:`, err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/workflow/merge
// Bulk recovery merge — manual trigger only (not the primary path).
// Runs in background; responds immediately.
router.post('/merge', protect, (req, res) => {
  res.json({ message: 'Bulk recovery merge triggered in background' });
  autoMergeApplications()
    .then((summary) => console.log('[autoMerge] Manual trigger complete', summary))
    .catch((err) => console.error('[autoMerge] Manual trigger failed:', err.message));
});

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
