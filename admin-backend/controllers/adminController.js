// controllers/adminController.js
import Admin from '../models/Admin.js';
import bcrypt from 'bcryptjs';
import generateToken from '../utils/generateToken.js';

/* ---------- existing functions (registerAdmin, loginAdmin, getProfile) unchanged ---------- */

export const registerAdmin = async (req, res) => {
  const { name, email, password, workflows } = req.body;

  const existing = await Admin.findOne({ email });
  if (existing) return res.status(400).json({ message: 'Admin already exists' });

  const hashedPassword = await bcrypt.hash(password, 10);

  const admin = await Admin.create({
    name,
    email,
    password: hashedPassword,
    workflows,
  });

  res.status(201).json({
    _id: admin._id,
    name: admin.name,
    email: admin.email,
    token: generateToken(admin._id),
  });
};

export const loginAdmin = async (req, res) => {
  const { email, password } = req.body;

  const admin = await Admin.findOne({ email });
  if (!admin) return res.status(404).json({ message: 'Admin not found' });

  const isMatch = await bcrypt.compare(password, admin.password);
  if (!isMatch) return res.status(401).json({ message: 'Invalid password' });

  res.json({
    _id: admin._id,
    name: admin.name,
    email: admin.email,
    token: generateToken(admin._id),
  });
};

export const getProfile = async (req, res) => {
  const admin = req.admin;
  res.json(admin);
};

/* ---------- NEW: workflow endpoints ---------- */

/**
 * GET /api/admin/workflow
 * Returns the logged-in admin's workflow as an ordered array of strings (stage keys).
 */
export const getWorkflow = async (req, res) => {
  try {
    const admin = req.admin;
    if (!admin) return res.status(401).json({ message: 'Not authenticated' });

    // Return workflows as-is (array). If stored as string for older docs, normalize in caller.
    return res.json({ workflow: admin.workflows || [] });
  } catch (err) {
    console.error('getWorkflow error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * PUT /api/admin/workflow
 * Accepts body { workflow: Array<string> | string }.
 * If string, newline/CSV will be parsed into array.
 */
const normalizeIncomingWorkflow = (wf) => {
  if (!wf) return [];
  if (Array.isArray(wf)) return wf.map(s => String(s).trim()).filter(Boolean);
  if (typeof wf === 'string') {
    return wf
      .split(/[\n,]+/)
      .map(s => String(s).trim())
      .filter(Boolean);
  }
  return [];
};

export const updateWorkflow = async (req, res) => {
  try {
    const admin = req.admin;
    if (!admin) return res.status(401).json({ message: 'Not authenticated' });

    const { workflow } = req.body;
    const normalized = normalizeIncomingWorkflow(workflow);

    admin.workflows = normalized;
    await admin.save();

    return res.json({ workflow: admin.workflows });
  } catch (err) {
    console.error('updateWorkflow error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};
