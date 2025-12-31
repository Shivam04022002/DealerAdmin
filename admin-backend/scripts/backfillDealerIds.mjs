// scripts/backfillDealerIds.mjs
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import Application from "../models/Application.js";
import User from "../models/User.js";

const MONGO = process.env.MONGO_URI || process.env.MONGO || null;

if (!MONGO) {
  console.error("ERROR: no Mongo URI found. Set MONGO_URI in your environment or .env file.");
  process.exit(1);
}

// show masked host for debug (don't print credentials)
const masked = MONGO.replace(/\/\/(.*?)@/, "//***:***@");
console.log("Connecting to Mongo:", masked);

async function main() {
  try {
    await mongoose.connect(MONGO); // modern mongoose uses recommended defaults
  } catch (err) {
    console.error("Mongoose connection error:", err.message);
    process.exit(1);
  }

  try {
    const apps = await Application.find({ dealer: { $exists: true } }).lean();
    console.log("Applications with dealer field:", apps.length);

    let updated = 0;
    for (const app of apps) {
      const rawDealer = app.dealer;
      if (!rawDealer) continue;

      // try find by _id first
      let foundUser = null;
      try {
        foundUser = await User.findById(rawDealer).lean();
      } catch (e) {
        // ignore invalid id format (we'll try other lookups)
      }
      if (foundUser) continue; // already correct ObjectId

      // try mapping by userId / email
      const user = await User.findOne({
        $or: [
          { userId: rawDealer },
          { UserId: rawDealer },
          { email: rawDealer },
        ],
      }).lean();

      if (user) {
        await Application.updateOne({ _id: app._id }, { $set: { dealer: user._id } });
        console.log(`Updated app ${app.formId}: dealer -> ${user._id}`);
        updated++;
      } else {
        console.log(`No mapping for app ${app.formId}, dealer='${rawDealer}'`);
      }
    }

    console.log("Backfill finished. total updated:", updated);
  } catch (err) {
    console.error("ERROR during backfill:", err);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
