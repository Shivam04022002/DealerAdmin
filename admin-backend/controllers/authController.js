// controllers/authController.js
import Admin from "../models/Admin.js";
import bcrypt from "bcryptjs";
import generateToken from "../utils/generateToken.js";

export const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const admin = await Admin.findOne({ email });
    if (!admin) {
      console.log(`[auth] Login failed: Admin not found for email: ${email}`);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (admin.isActive === false) {
      return res.status(403).json({ message: "Account is deactivated. Contact Super Admin." });
    }

    // Clean password hash (remove trailing commas or whitespace)
    const cleanPasswordHash = admin.password.trim().replace(/,$/, '');
    
    // Check if password is already hashed, if not, it's a plain text password (legacy)
    const isHashed = cleanPasswordHash.match(/^\$2[ayb]\$/);
    
    let ok = false;
    if (isHashed) {
      // Compare with bcrypt
      ok = await bcrypt.compare(password, cleanPasswordHash);
    } else {
      // Legacy plain text comparison (shouldn't happen, but handle it)
      console.warn(`[auth] WARNING: Admin ${email} has plain text password!`);
      ok = password === cleanPasswordHash;
      
      // If login succeeds with plain text, hash it for next time
      if (ok) {
        admin.password = await bcrypt.hash(password, 10);
        await admin.save({ validateModifiedOnly: true });
        console.log(`[auth] Hashed password for admin ${email}`);
      }
    }
    
    if (!ok) {
      console.log(`[auth] Login failed: Invalid password for email: ${email}`);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // normalize role (legacy 'sadmin' -> 'superadmin')
    const role = admin.role === "sadmin" ? "superadmin" : (admin.role || "admin");
    const isSuperAdmin = role === "superadmin";

    // persist normalization + last login
    admin.role = role;
    admin.lastLoginAt = new Date();
    await admin.save({ validateModifiedOnly: true });

    // sign token via your util
    const token = generateToken({
      id: admin._id.toString(),
      email: admin.email,
      name: admin.name,
      role,
      isSuperAdmin,
    });

    const uiRoute = isSuperAdmin ? "/superadmin-dashboard" : "/admin-dashboard";

    return res.json({
      message: "Login successful",
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role,
        isActive: admin.isActive,
      },
      isSuperAdmin,
      uiRoute,
    });
  } catch (err) {
    console.error("authController.login:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
