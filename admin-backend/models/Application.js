import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema({
  formId: String,
  applicant: Object,
  coApplicant: Object,
  vehicleDetails: Object,
  dealer: {   // 👈 reference instead of plain object
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  }, 
   dealerDetails: {
    _id: mongoose.Schema.Types.ObjectId,
    userId: String,
    email: String,
    name: String,
    district: String,
    branch: String,
  },
  status: { type: String, default: "pending" },
  workflowStage: { type: String, default: "contact creation" },
  history: [
    {
      updatedBy: String,
      updatedAt: Date,
      changes: String
    }
  ]
}, { timestamps: true });

export default mongoose.model("Application", applicationSchema, "applications");
