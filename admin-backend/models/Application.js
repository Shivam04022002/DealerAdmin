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

applicationSchema.index({ formId: 1 }, { unique: false, sparse: true });
applicationSchema.index({ status: 1 });
applicationSchema.index({ workflowStage: 1 });
applicationSchema.index({ status: 1, workflowStage: 1 });
applicationSchema.index({ createdAt: -1 });
applicationSchema.index({ "dealerDetails.branch": 1 });
applicationSchema.index({ "dealerDetails.district": 1 });
applicationSchema.index({ dealer: 1 });

export default mongoose.model("Application", applicationSchema, "applications");
