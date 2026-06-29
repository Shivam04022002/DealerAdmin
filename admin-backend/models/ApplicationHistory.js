// models/ApplicationHistory.js
import mongoose from "mongoose";

const applicationHistorySchema = new mongoose.Schema(
  {
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    formId: {
      type: String,
      required: true,
      index: true,
    },
    actionType: {
      type: String,
      required: true,
      enum: [
        "FORM_CREATED",
        "STAGE_CHANGED",
        "STATUS_CHANGED",
        "APPROVED",
        "REJECTED",
        "REVOKED",
        "COMMENT",
        "COMMENT_ADDED",
        "NOTE_ADDED",
        "DOCUMENT_UPLOADED",
        "DOCUMENT_REMOVED",
        "VEHICLE_DETAILS_UPDATED",
        "CUSTOMER_DETAILS_UPDATED",
        "CO_APPLICANT_UPDATED",
        "DEALER_ASSIGNED",
        "BRANCH_CHANGED",
        "REJECTION_REASON_UPDATED",
        "EDIT_FIELDS",
        "OTHER",
      ],
    },
    oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
    newValue: { type: mongoose.Schema.Types.Mixed, default: null },
    remarks: { type: String, default: "" },
    updatedBy: { type: String, required: true },
    updatedByEmail: { type: String, default: "" },
    updatedByRole: { type: String, default: "admin" },
    updatedByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

applicationHistorySchema.index({ formId: 1, updatedAt: -1 });
applicationHistorySchema.index({ applicationId: 1, updatedAt: -1 });
applicationHistorySchema.index({ updatedByAdminId: 1 });
applicationHistorySchema.index({ actionType: 1 });

export default mongoose.model(
  "ApplicationHistory",
  applicationHistorySchema,
  "applicationHistories"
);
