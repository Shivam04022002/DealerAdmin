// models/Admin.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },

    // store admin workflows as an array of strings (ordered)
    workflows: {
      type: [String],
      default: [],
    },

    // NEW FIELDS
    isActive: {
      type: Boolean,
      default: true, // super admin can deactivate an admin; blocked at login
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null, // who created this admin (usually superadmin)
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    role: {
      type: String,
      enum: ["admin", "superadmin"],
      default: "admin",
      set: (v) => {
        // normalize role to lowercase & map legacy 'sadmin' -> 'superadmin'
        const val = String(v || "").trim().toLowerCase();
        return val === "sadmin" ? "superadmin" : val || "admin";
      },
    },
  },
  { timestamps: true }
);

// 🔐 Pre-save hook to hash password
adminSchema.pre("save", async function (next) {
  try {
    // Only hash password if it's been modified (and not already hashed)
    if (!this.isModified("password")) {
      return next();
    }

    // Check if password is already hashed (bcrypt hashes start with $2a$, $2b$, or $2y$)
    if (this.password && this.password.match(/^\$2[ayb]\$/)) {
      // Already hashed, skip
      return next();
    }

    // Hash the password
    if (this.password) {
      const saltRounds = 10;
      this.password = await bcrypt.hash(this.password, saltRounds);
    }

    next();
  } catch (e) {
    next(e);
  }
});

// 🧹 Pre-save hook to normalize workflows
adminSchema.pre("save", function (next) {
  try {
    // If no workflows defined, ensure it's an array
    if (!this.workflows) {
      this.workflows = [];
      return next();
    }

    // If workflows is stored as a string blob — clean and split
    if (typeof this.workflows === "string") {
      const cleaned = String(this.workflows)
        .replace(/[\[\]"']/g, "") // remove brackets and quotes
        .split(/[\n,]+/) // split on commas or newlines
        .map((s) => String(s || "").trim().toLowerCase())
        .filter(Boolean);
      this.workflows = cleaned;
    }

    // If workflows is already an array — normalize each entry
    else if (Array.isArray(this.workflows)) {
      this.workflows = this.workflows
        .map((s) => String(s || "").trim().toLowerCase())
        .filter(Boolean);
    }

    next();
  } catch (e) {
    next(e);
  }
});

const Admin = mongoose.model("Admin", adminSchema);
export default Admin;
