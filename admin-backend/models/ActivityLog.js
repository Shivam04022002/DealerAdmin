// models/ActivityLog.js
import mongoose from "mongoose";

const ActivityLogSchema = new mongoose.Schema(
  {
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: "Application", required: true },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    action: { type: String, required: true }, // UPDATE_STAGE | APPROVE | REJECT | EDIT_FIELDS
    fromStage: { type: String, default: null },
    toStage: { type: String, default: null },
    notes: { type: String, default: "" },
    meta: { type: Object, default: {} },
    at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

ActivityLogSchema.index({ applicationId: 1, at: -1 });
ActivityLogSchema.index({ adminId: 1, at: -1 });

export default mongoose.model("ActivityLog", ActivityLogSchema);
