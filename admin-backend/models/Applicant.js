import mongoose from "mongoose";

const applicantSchema = new mongoose.Schema({
  formId: String,
  name: String,
  email: String,
  phone: String,
  address: String,
  pan: String,
  aadhaar: String,
  user: {                                  
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  createdAt: { type: Date, default: Date.now }
});

applicantSchema.index({ formId: 1 });
applicantSchema.index({ applicantFormId: 1 }, { sparse: true });

export default mongoose.model("Applicant", applicantSchema, "applicants");
