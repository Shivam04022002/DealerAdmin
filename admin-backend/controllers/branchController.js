import Branch from "../models/Branch.js";

// Escape user input before using it inside a RegExp
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET /api/branches — list branches for the dealer form dropdown
export const listBranches = async (req, res) => {
  try {
    const branches = await Branch.find({}).sort({ name: 1 }).lean();
    return res.status(200).json({ branches });
  } catch (err) {
    console.error("listBranches:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// POST /api/branches — create a branch (name only)
export const createBranch = async (req, res) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";

    if (!name) {
      return res.status(400).json({ message: "Branch Name is required" });
    }

    // Case-insensitive duplicate check
    const exists = await Branch.findOne({
      name: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
    });
    if (exists) {
      return res.status(409).json({ message: "Branch already exists" });
    }

    const branch = await Branch.create({ name });

    return res.status(201).json({
      message: "Branch added successfully",
      branch: {
        _id: branch._id,
        name: branch.name,
      },
    });
  } catch (err) {
    console.error("createBranch:", err);
    if (err.code === 11000) {
      return res.status(409).json({ message: "Branch already exists" });
    }
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};
