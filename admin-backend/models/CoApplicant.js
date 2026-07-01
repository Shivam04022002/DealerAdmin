import mongoose from "mongoose";

const coApplicantSchema = new mongoose.Schema({
  formId: String,
  name: String,
  email: String,
  phone: String,
  address: String,
  pan: String,
  aadhaar: String,
  createdAt: { type: Date, default: Date.now }
});

coApplicantSchema.index({ formId: 1 });
coApplicantSchema.index({ coApplicantFormId: 1 }, { sparse: true });

export default mongoose.model("CoApplicant", coApplicantSchema, "coapplicants");
