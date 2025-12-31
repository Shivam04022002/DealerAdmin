import VehicleDetails from '../models/VehicleDetails.js';
import User from '../models/User.js';

// @desc    Get all vehicle details with user info
// @route   GET /api/vehicles
// @access  Private (admin)
export const getVehicleDetailsWithUser = async (req, res) => {
  try {
    const vehicles = await VehicleDetails.find().populate('user', 'name email region branch');
    res.json(vehicles);
  } catch (err) {
    console.error('Failed to fetch vehicle details:', err);
    res.status(500).json({ error: 'Server error while fetching vehicle details' });
  }
};
