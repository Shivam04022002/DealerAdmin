// backend/scripts/fixAdminWorkflows.js
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import Admin from "../models/Admin.js"; // adjust if models folder differs

const MONGO =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.DB_URI ||
  "your-mongo-uri-here";

const toStage = (s) => String(s || "").trim().toLowerCase();

const normalizeStringBlob = (wfStr) =>
  String(wfStr)
    .replace(/[\[\]"']/g, "")
    .split(/[\n,]+/)
    .map(toStage)
    .filter(Boolean);

async function run() {
  if (!MONGO) {
    console.error(" MONGO_URI missing in .env file");
    process.exit(1);
  }

  await mongoose.connect(MONGO, {});
  console.log("✅ Connected to MongoDB");

  const admins = await Admin.find({}).lean();
  console.log(`Found ${admins.length} admins`);

  for (const admin of admins) {
    if (typeof admin.workflows === "string") {
      const cleaned = normalizeStringBlob(admin.workflows);
      console.log(" Fixing", admin.email, "=>", cleaned);
      await Admin.updateOne({ _id: admin._id }, { $set: { workflows: cleaned } });
    } else if (Array.isArray(admin.workflows)) {
      const normalized = admin.workflows.map(toStage).filter(Boolean);
      if (JSON.stringify(normalized) !== JSON.stringify(admin.workflows)) {
        console.log(" Normalizing", admin.email, "=>", normalized);
        await Admin.updateOne({ _id: admin._id }, { $set: { workflows: normalized } });
      }
    }
  }

  console.log("✅ All admins normalized!");
  await mongoose.disconnect();
  process.exit(0);
}

run();
