// scripts/dedupeApplications.js
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();
import Application from "../models/Application.js"; // adjust path

async function main(){
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected.");
  const dupes = await Application.aggregate([
    { $group: { _id: "$formId", count: { $sum: 1 }, ids: { $push: { _id: "$_id", createdAt: "$createdAt" } } } },
    { $match: { count: { $gt: 1 } } }
  ]);

  for (const d of dupes) {
    // keep the most recent (by createdAt), remove others
    const sorted = d.ids.sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));
    const keep = sorted[0]._id;
    const remove = sorted.slice(1).map(x => x._id);
    console.log(`Dedupe formId=${d._id}, keep=${keep}, remove=${remove.length} docs`);
    await Application.deleteMany({ _id: { $in: remove } });
  }

  console.log("Done.");
  await mongoose.disconnect();
}

main().catch(err=>{ console.error(err); process.exit(1); });
