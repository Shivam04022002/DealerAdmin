// middleware/authMiddleware.js
import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";

const protect = async (req, res, next) => {
  let token;

  try {
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (verifyErr) {
        console.warn("🔒 [auth] JWT verify failed:", verifyErr?.message || verifyErr);
        return res.status(401).json({ message: "Not authorized, token invalid" });
      }

      // token verified — get admin id from payload
      // decoded is the entire admin object from the token
      const adminId = decoded?.id || decoded?._id;

      if (adminId) {
        try {
          const adminDoc = await Admin.findById(adminId).select("-password").lean();
          if (adminDoc) {
            req.admin = adminDoc;
            console.log(" [auth] Attached admin from DB:", adminDoc._id?.toString?.(), adminDoc.email);
          } else {
            // DB lookup returned nothing — attach decoded payload as fallback
            req.admin = decoded;
            console.warn(" [auth] Admin ID from token not found in DB, attached token payload as req.admin:", adminId);
          }
        } catch (dbErr) {
          // DB error — fallback to decoded token so request can continue (but log)
          req.admin = decoded;
          console.error(" [auth] DB lookup failed, attached token payload as req.admin:", dbErr);
        }
      } else {
        // token valid but no id field present
        req.admin = decoded;
        console.warn(" [auth] Token decoded but contains no id field. Attached token payload to req.admin.");
      }

      // 🔹 ADD-ON (non-breaking): normalize role + add isSuperAdmin flag
      try {
        const currentRole =
          (req.admin?.role && String(req.admin.role).trim().toLowerCase()) ||
          (decoded?.role && String(decoded.role).trim().toLowerCase()) ||
          "admin";
        const normalizedRole = currentRole === "sadmin" ? "superadmin" : currentRole;

        // attach normalized role + flag without altering your existing logic
        req.admin.role = normalizedRole;
        req.admin.isSuperAdmin = normalizedRole === "superadmin";
      } catch (normErr) {
        console.warn(" [auth] Could not normalize role:", normErr?.message || normErr);
      }

      // Log workflows preview if present (don't print sensitive fields)
      if (req.admin?.workflows) {
        try {
          const preview = JSON.stringify(req.admin.workflows).slice(0, 300);
          console.log(" [auth] admin.workflows type:", typeof req.admin.workflows, "preview:", preview);
        } catch (e) {
          console.log(" [auth] admin.workflows present (could not stringify preview)");
        }
      } else {
        console.log(" [auth] admin.workflows absent on req.admin");
      }

      return next();
    } else {
      return res.status(401).json({ message: "Not authorized, no token" });
    }
  } catch (err) {
    console.error(" [auth] Unexpected error in auth middleware:", err);
    return res.status(500).json({ message: "Internal auth error" });
  }
};

export default protect;

// 🔹 NEW (non-breaking): named exports

// Alias so you can import { requireAuth } where needed without changing existing usage
export const requireAuth = protect;

// Gate for Super Admin only (use after protect/requireAuth)
export const requireSuperAdmin = (req, res, next) => {
  if (!req.admin) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  if (req.admin.role !== "superadmin") {
    return res.status(403).json({ message: "Super Admin required" });
  }
  return next();
};
