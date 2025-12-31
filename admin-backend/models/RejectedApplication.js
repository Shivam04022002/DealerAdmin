import mongoose from "mongoose";

const RejectedSchema = new mongoose.Schema(
  {
    formId: String,
    applicant: Object,
    coApplicant: Object,
    vehicleDetails: Object,

    // ✅ Add these two:
    dealer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",    // allows populate()
    },
    dealerDetails: {
      _id: mongoose.Schema.Types.ObjectId,
      userId: String,
      email: String,
      name: String,
      district: String,
      branch: String,
    },

    status: { type: String, default: "rejected" },

    rejection: {
      rejectedBy: String,
      reason: String,
      rejectedAt: Date,
    },

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

export default mongoose.model("RejectedApplication", RejectedSchema, "rejectedApplications");
