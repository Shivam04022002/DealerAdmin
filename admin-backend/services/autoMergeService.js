// services/autoMergeService.js (updated autoMergeApplications)
import Application from "../models/Application.js";
import Applicant from "../models/Applicant.js";
import CoApplicant from "../models/CoApplicant.js";
import VehicleDetails from "../models/VehicleDetails.js";
import User from "../models/User.js";
import Admin from "../models/Admin.js";
import mongoose from "mongoose";

// NEW imports for finalization checks
import ApprovedApplication from "../models/ApprovedApplication.js";
import RejectedApplication from "../models/RejectedApplication.js";

/* ---------- helpers ---------- */
const DEFAULT_START_STAGE = "contact creation";
const toStage = (s) => String(s || "").trim().toLowerCase();

function asPlain(doc) {
  return doc?.toObject ? doc.toObject() : doc;
}

function sanitizeDealer(userDoc) {
  if (!userDoc) return null;
  const u = asPlain(userDoc);
  const snapshot = {
    _id: u._id || u.id || null,
    userId: u.userId ?? u.UserId ?? null,
    email:  u.email  ?? u.Email  ?? null,
    name:   u.name   ?? u.Name   ?? null,
    district: u.district ?? u.District ?? null,
    branch:   u.branch   ?? u.Branch   ?? null,
  };

  const hasInfo = Object.entries(snapshot).some(([k, v]) => k !== "_id" && v);
  return hasInfo ? snapshot : null;
}

const parseWorkflows = (wf) => {
  if (Array.isArray(wf)) return [...new Set(wf.map(toStage))];
  if (typeof wf === "string") {
    const parts = wf
      .replace(/\r/g, "")
      .split(/[\n,]+/)
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
      .filter(Boolean)
      .map(toStage);
    return [...new Set(parts)];
  }
  return [];
};

async function getFirstAdminWorkflowStage() {
  try {
    const admin = await Admin.findOne().lean();
    if (!admin) return DEFAULT_START_STAGE;
    const stages = parseWorkflows(admin.workflows || admin.workflow || admin.workflowStages || []);
    return stages[0] || DEFAULT_START_STAGE;
  } catch {
    return DEFAULT_START_STAGE;
  }
}

// Try resolving dealer from multiple places
async function resolveDealer({ vehicle, applicant, coApplicant }) {
  const tryFindUser = async (id) => {
    if (!id) return null;
    // try ObjectId
    try {
      if (mongoose.Types.ObjectId.isValid(String(id))) {
        const byId = await User.findById(id).lean();
        if (byId) return byId;
      }
    } catch {}
    // try userId / UserId / email
    return await User.findOne({
      $or: [{ userId: id }, { UserId: id }, { email: id }],
    }).lean();
  };

  return (
    (await tryFindUser(vehicle?.user)) ||
    (await tryFindUser(vehicle?.dealerId)) ||
    (await tryFindUser(vehicle?.dealerDetails?.UserId)) ||
    (await tryFindUser(applicant?.user)) ||
    (await tryFindUser(coApplicant?.user)) ||
    null
  );
}

function ensureDealerId(resolvedDealer, applicant) {
  if (resolvedDealer?._id) return resolvedDealer._id;
  const candidate = applicant?.user;
  if (candidate && mongoose.Types.ObjectId.isValid(String(candidate))) return candidate;
  return null;
}

/* ---------- merge ---------- */
export const autoMergeApplications = async () => {
  const vehicles = await VehicleDetails.find().lean();
  if (!vehicles.length) return;

  const initialStage = toStage(await getFirstAdminWorkflowStage());

  for (const vehicle of vehicles) {
    const formId =
      vehicle?.formId ||
      vehicle?.formID ||
      vehicle?.applicantFormId ||
      vehicle?.applicantFormID ||
      vehicle?.form?.formId ||
      vehicle?.form?.id ||
      null;

    if (!formId) continue;

    // already merged?
    const exists = await Application.findOne({ formId }).lean();
    if (exists) continue;

    // fetch related docs
    const applicant =
      (await Applicant.findOne({ formId }).lean()) ||
      (await Applicant.findOne({ applicantFormId: formId }).lean()) ||
      null;

    const coApplicant =
      (await CoApplicant.findOne({ formId }).lean()) ||
      (await CoApplicant.findOne({ coApplicantFormId: formId }).lean()) ||
      null;

    // if your old backend allowed missing coApplicant, keep behavior; otherwise keep this check
    if (!applicant || !vehicle) {
      // applicant is required; vehicle exists by iterating VehicleDetails
      continue;
    }

    // === NEW: finalization check (prevent re-creation if already approved/rejected) ===
    try {
      // Build OR checks: formId OR any source ids (applicant/coApplicant/vehicle)
      const orClauses = [{ formId }];

      if (applicant?._id) {
        orClauses.push(
          { "applicantSnapshot._id": String(applicant._id) },
          { applicantId: String(applicant._id) },
          { "applicant._id": String(applicant._id) }
        );
      }
      if (coApplicant?._id) {
        orClauses.push(
          { "coApplicantSnapshot._id": String(coApplicant._id) },
          { coApplicantId: String(coApplicant._id) },
          { "coApplicant._id": String(coApplicant._id) }
        );
      }
      if (vehicle?._id) {
        orClauses.push(
          { "vehicleSnapshot._id": String(vehicle._id) },
          { vehicleDetailsId: String(vehicle._id) },
          { "vehicleDetails._id": String(vehicle._id) }
        );
      }

      const query = { $or: orClauses };

      const [approved, rejected] = await Promise.all([
        ApprovedApplication.findOne(query).lean(),
        RejectedApplication.findOne(query).lean(),
      ]);

      if (approved) {
        console.log(` Skipping ${formId} — already approved (${approved._id})`);
        continue;
      }
      if (rejected) {
        console.log(` Skipping ${formId} — already rejected (${rejected._id})`);
        continue;
      }
    } catch (err) {
      console.error("Error checking finalized status for", formId, err?.message || err);
      // proceed — but safer to skip if check fails? we choose to continue and attempt create (optional)
    }

    const resolvedDealer = await resolveDealer({ vehicle, applicant, coApplicant });
    const dealerId = ensureDealerId(resolvedDealer, applicant);

    if (!dealerId) {
      // old backend may have allowed missing dealer; if you want to require dealer, uncomment next line
      // continue;
      // keep going (old behavior) — dealer optional
    }

    const dealerSnapshot =
      sanitizeDealer(resolvedDealer) || sanitizeDealer(vehicle?.dealerDetails || {});

    // build + save
    const mergedData = {
      formId,
      applicant,
      coApplicant,
      vehicleDetails: vehicle,
      dealer: dealerId,
      dealerDetails: dealerSnapshot,
      status: "pending",
      workflowStage: initialStage,
      history: [],
    };

    try {
      await Application.create(mergedData);
      console.log(` Merged ${formId} (dealer=${dealerId})`);
    } catch (err) {
      console.error(` Failed to merge ${formId}:`, err.message || err);
    }
  }
};
