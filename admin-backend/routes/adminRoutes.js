// routes/adminRoutes.js
import express from 'express';
import { registerAdmin, loginAdmin, getProfile, getWorkflow, updateWorkflow } from '../controllers/adminController.js';
import protect from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', registerAdmin);
router.post('/login', loginAdmin);
router.get('/profile', protect, getProfile);

// NEW routes:
router.get('/workflow', protect, getWorkflow);
router.put('/workflow', protect, updateWorkflow);

export default router;
