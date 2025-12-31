// scripts/backfillAdminWorkflows.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Admin from '../models/Admin.js';
dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const admins = await Admin.find();
  for (const a of admins) {
    if (typeof a.workflows === 'string' && a.workflows.trim()) {
      const arr = a.workflows.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
      a.workflows = arr;
      await a.save();
      console.log('Backfilled', a.email);
    } else if (!Array.isArray(a.workflows)) {
      a.workflows = [];
      await a.save();
      console.log('Normalized empty workflows for', a.email);
    }
  }
  await mongoose.disconnect();
}
main().catch(err => { console.error(err); process.exit(1); });
