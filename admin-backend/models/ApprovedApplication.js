import mongoose from "mongoose";

const approvedApplicationSchema = new mongoose.Schema(
  {
    formId: { type: String, required: true, unique: true },
    applicant: Object,
    coApplicant: Object,
    vehicleDetails: Object,
    dealer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    dealerDetails: Object, // snapshot (email, branch, district, name)
    status: { type: String, default: "approved" },
    workflowStage: { type: String, default: "disbursement" },
    history: [
      {
        updatedBy: String,
        updatedAt: Date,
        changes: String,
      },
    ],
  },
  { timestamps: true }
);

approvedApplicationSchema.index({ createdAt: -1 });
approvedApplicationSchema.index({ workflowStage: 1 });
approvedApplicationSchema.index({ "dealerDetails.branch": 1 });
approvedApplicationSchema.index({ "dealerDetails.district": 1 });
approvedApplicationSchema.index({ dealer: 1 });
approvedApplicationSchema.index({ "dealerDetails.branch": 1, createdAt: -1 });
approvedApplicationSchema.index({ "dealerDetails.name": 1 });

export default mongoose.model(
  "ApprovedApplication",
  approvedApplicationSchema,
  "approvedApplications"
);
