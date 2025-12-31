import mongoose from "mongoose";

const vehicleDetailsSchema = new mongoose.Schema({
  formId: String,
  brandName: String,
  modelName: String,
  priceOfVehicle: String,
  financeRequired: String,
  tenure: String,
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("VehicleDetails", vehicleDetailsSchema, "vehicledetails");
