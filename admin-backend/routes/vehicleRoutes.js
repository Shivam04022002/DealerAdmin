// routes/vehicleRoutes.js
import express from 'express';
import { getVehicleDetailsWithUser } from '../controllers/vehicleController.js';
import protect from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, getVehicleDetailsWithUser);

export default router;
