// scripts/createSAdmin.js
// Usage:
//   node scripts/createSAdmin.js
//   node scripts/createSAdmin.js --email super@demo.com --password "Super@123" --name "Super Admin"
//   node scripts/createSAdmin.js --workflows "pending,review,approved,rejected,disbursement"
// Env overrides:
//   MONGO_URI, SEED_SADMIN_EMAIL, SEED_SADMIN_PASSWORD, SEED_SADMIN_NAME, SEED_SADMIN_WORKFLOWS

import "dotenv/config.js";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import Admin from "../models/Admin.js";

const args = process.argv.slice(2);
const getArg = (key, fallback = undefined) => {
  const idx = args.findIndex(a => a === `--${key}`);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return fallback;
};

// --- DB & inputs ---
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/admin";

const EMAIL =
  getArg("email") ||
  process.env.SEED_SADMIN_EMAIL ||
  "superadmin@example.com";

const PASSWORD =
  getArg("password") ||
  process.env.SEED_SADMIN_PASSWORD ||
  "Super@123";

const NAME =
  getArg("name") ||
  process.env.SEED_SADMIN_NAME ||
  "Super Admin";

// Workflows list (SAdmin should access ALL).
// If your code bypasses workflow checks for superadmin (recommended), this can be any set.
// We provide a sensible default list; override via --workflows or SEED_SADMIN_WORKFLOWS.
const WF_RAW =
  getArg("workflows") ||
  process.env.SEED_SADMIN_WORKFLOWS ||
  "pending,review,approved,rejected,disbursement";

const WORKFLOWS = String(WF_RAW)
  .split(/[\n,]+/)
  .map(s => String(s || "").trim().toLowerCase())
  .filter(Boolean);

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected:", MONGO_URI);

    let admin = await Admin.findOne({ email: EMAIL });
    const hashed = await bcrypt.hash(PASSWORD, 10);

    if (admin) {
      // Update existing to be a fully enabled Super Admin
      admin.name = NAME || admin.name;
      admin.password = hashed; // always reset to ensure you know the password
      admin.role = "superadmin";
      admin.isActive = true;
      admin.workflows = WORKFLOWS;
      await admin.save();
      console.log("🔁 Updated existing Super Admin:");
      console.log({ id: admin._id.toString(), email: admin.email, role: admin.role, isActive: admin.isActive, workflows: admin.workflows });
    } else {
      // Create new Super Admin
      admin = await Admin.create({
        name: NAME,
        email: EMAIL,
        password: hashed,
        role: "superadmin",
        isActive: true,
        workflows: WORKFLOWS,
      });
      console.log("🎉 Created Super Admin:");
      console.log({ id: admin._id.toString(), email: admin.email, role: admin.role, isActive: admin.isActive, workflows: admin.workflows });
    }

    console.log("\nNext:");
    console.log("- Login with the above SAdmin credentials at / (LoginPage).");
    console.log("- You should be redirected to /superadmin-dashboard via uiRoute.");
    console.log("- SAdmin can create admins, toggle active, and view activity.");
    process.exit(0);
  } catch (err) {
    console.error(" Seed error:", err);
    process.exit(1);
  }
})();
