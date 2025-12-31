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

export default mongoose.model(
  "ApprovedApplication",
  approvedApplicationSchema,
  "approvedApplications"
);
