import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true,
  },
  UserId: {
    type: String,
    unique: true
  }, // userId pattern for dealer
  name: String,
  District: String,
  Branch: String,
  mobileNumber: { type: String, default: "" },
  profilePicture: { type: String, default: "" },
  lastLoginAt: { type: Date, default: null },
  lastSeenAt: { type: Date, default: null },
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);   
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model("User", userSchema, "users");
