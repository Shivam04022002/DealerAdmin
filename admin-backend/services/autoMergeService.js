// services/autoMergeService.js
import Application from "../models/Application.js";
import Applicant from "../models/Applicant.js";
import CoApplicant from "../models/CoApplicant.js";
import VehicleDetails from "../models/VehicleDetails.js";
import User from "../models/User.js";
import Admin from "../models/Admin.js";
import mongoose from "mongoose";

import ApprovedApplication from "../models/ApprovedApplication.js";
import RejectedApplication from "../models/RejectedApplication.js";

import { toStage, normalizeWorkflows, WORKFLOW_STAGES } from "../utils/workflowConstants.js";

/* ---------- helpers ---------- */
const DEFAULT_START_STAGE = WORKFLOW_STAGES[0];

// Debug/timing logs — silenced in production to keep PM2 logs readable.
// NODE_ENV is read at call time, not module load: this module is imported
// before dotenv.config() runs in server.js.
const debugLog = (...args) => {
  if (process.env.NODE_ENV !== "production") console.log(...args);
};

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

const parseWorkflows = normalizeWorkflows;

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

/**
 * Optimized dealer resolution.
 *
 * OLD: up to 5 sequential awaits (waterfall).
 * NEW: collect all candidate IDs first, then fire one Promise.all batch.
 *      Falls back to a single $or query for non-ObjectId identifiers only
 *      when the batch yields nothing.
 *
 * Performance gain: reduces up to 10 sequential DB round-trips to 1–2 parallel queries.
 */
async function resolveDealer({ vehicle, applicant, coApplicant }) {
  // Collect all ObjectId candidates (deduplicated)
  const objectIdCandidates = [
    vehicle?.user,
    vehicle?.dealerId,
    applicant?.user,
    coApplicant?.user,
  ]
    .filter(Boolean)
    .filter((id) => mongoose.Types.ObjectId.isValid(String(id)))
    .map((id) => new mongoose.Types.ObjectId(String(id)));

  // Deduplicate by string representation
  const uniqueIds = [...new Map(objectIdCandidates.map((id) => [id.toString(), id])).values()];

  if (uniqueIds.length > 0) {
    // Single query: find any user whose _id is in the candidate set
    const found = await User.findOne({ _id: { $in: uniqueIds } }).lean();
    if (found) return found;
  }

  // Fallback: non-ObjectId identifiers (UserId string, email)
  const stringCandidates = [
    vehicle?.dealerDetails?.UserId,
    vehicle?.dealerDetails?.email,
  ].filter(Boolean);

  if (stringCandidates.length > 0) {
    const orClauses = stringCandidates.flatMap((val) => [
      { userId: val },
      { UserId: val },
      { email: val },
    ]);
    const found = await User.findOne({ $or: orClauses }).lean();
    if (found) return found;
  }

  return null;
}

function ensureDealerId(resolvedDealer, applicant) {
  if (resolvedDealer?._id) return resolvedDealer._id;
  const candidate = applicant?.user;
  if (candidate && mongoose.Types.ObjectId.isValid(String(candidate))) return candidate;
  return null;
}

/**
 * Build the finalization OR-query for approved/rejected checks.
 * Extracted so it can be reused without duplication.
 */
function buildFinalizationQuery(formId, applicant, coApplicant, vehicle) {
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
  return { $or: orClauses };
}

/* ============================================================
   mergeSingleApplication(formId)
   ============================================================
   Merges exactly ONE application identified by formId.

   Called by:
     - POST /api/workflow/merge/:formId  (immediate, from mobile backend)
     - autoMergeApplications()           (bulk recovery loop)

   Performance improvements over the old inline loop body:
     1. Parallel fetch: Applicant + CoApplicant + VehicleDetails + duplicate
        checks all fire as Promise.all — 4 queries instead of 6–8 serial.
     2. resolveDealer uses a single batched User query instead of waterfall.
     3. Structured timing logs at every stage for easy debugging.
   ============================================================ */
export async function mergeSingleApplication(formId) {
  const t0 = Date.now();
  const tag = `[merge:${formId}]`;

  debugLog(`${tag} Merge started`);

  if (!formId) {
    console.warn(`${tag} Merge aborted — formId is empty`);
    return { success: false, reason: "formId is required" };
  }

  try {
    // ── Step 1: check already merged (fast indexed lookup) ──────────────
    const tCheck = Date.now();
    const exists = await Application.findOne({ formId }).select("_id").lean();
    debugLog(`${tag} Duplicate check: ${Date.now() - tCheck}ms`);

    if (exists) {
      debugLog(`${tag} Skipped — already merged (Application _id=${exists._id})`);
      return { success: false, reason: "already_merged", applicationId: exists._id };
    }

    // ── Step 2: parallel fetch of all source documents ──────────────────
    const tFetch = Date.now();
    const [
      applicantPrimary,
      applicantFallback,
      coApplicantPrimary,
      coApplicantFallback,
      vehicle,
    ] = await Promise.all([
      Applicant.findOne({ formId }).lean(),
      Applicant.findOne({ applicantFormId: formId }).lean(),
      CoApplicant.findOne({ formId }).lean(),
      CoApplicant.findOne({ coApplicantFormId: formId }).lean(),
      VehicleDetails.findOne({ formId }).lean(),
    ]);
    debugLog(`${tag} Source fetch (5 parallel queries): ${Date.now() - tFetch}ms`);

    const applicant   = applicantPrimary   || applicantFallback   || null;
    const coApplicant = coApplicantPrimary || coApplicantFallback || null;

    if (!applicant) {
      console.warn(`${tag} Merge aborted — Applicant not found for formId=${formId}`);
      return { success: false, reason: "applicant_not_found" };
    }
    if (!vehicle) {
      console.warn(`${tag} Merge aborted — VehicleDetails not found for formId=${formId}`);
      return { success: false, reason: "vehicle_not_found" };
    }

    // ── Step 3: finalization check + initialStage in parallel ───────────
    const tFinal = Date.now();
    const finalizationQuery = buildFinalizationQuery(formId, applicant, coApplicant, vehicle);

    const [approved, rejected, initialStageRaw] = await Promise.all([
      ApprovedApplication.findOne(finalizationQuery).select("_id").lean(),
      RejectedApplication.findOne(finalizationQuery).select("_id").lean(),
      getFirstAdminWorkflowStage(),
    ]);
    debugLog(`${tag} Finalization check + stage lookup (3 parallel queries): ${Date.now() - tFinal}ms`);

    if (approved) {
      debugLog(`${tag} Skipped — already approved (ApprovedApplication _id=${approved._id})`);
      return { success: false, reason: "already_approved", applicationId: approved._id };
    }
    if (rejected) {
      debugLog(`${tag} Skipped — already rejected (RejectedApplication _id=${rejected._id})`);
      return { success: false, reason: "already_rejected", applicationId: rejected._id };
    }

    const initialStage = toStage(initialStageRaw);

    // ── Step 4: resolve dealer (optimized: batched User query) ──────────
    const tDealer = Date.now();
    const resolvedDealer = await resolveDealer({ vehicle, applicant, coApplicant });
    const dealerId = ensureDealerId(resolvedDealer, applicant);
    debugLog(`${tag} Dealer resolution: ${Date.now() - tDealer}ms (dealer=${dealerId ?? "none"})`);

    if (!dealerId) {
      // keep old behavior — dealer optional
    }

    const dealerSnapshot =
      sanitizeDealer(resolvedDealer) || sanitizeDealer(vehicle?.dealerDetails || {});

    // ── Step 5: create Application document ─────────────────────────────
    const tCreate = Date.now();
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

    const created = await Application.create(mergedData);
    debugLog(`${tag} Application created: ${Date.now() - tCreate}ms (_id=${created._id})`);

    const totalMs = Date.now() - t0;
    debugLog(`${tag} Merge completed successfully in ${totalMs}ms`);
    return { success: true, applicationId: created._id, formId, durationMs: totalMs };

  } catch (err) {
    const totalMs = Date.now() - t0;
    console.error(`${tag} Merge FAILED after ${totalMs}ms:`, err.message || err);
    return { success: false, reason: "error", error: err.message || String(err) };
  }
}

/* ============================================================
   autoMergeApplications()
   ============================================================
   Bulk recovery merge — for startup, manual trigger, or
   maintenance. NOT the primary merge path.

   Performance improvements over old version:
     1. Only fetches vehicles with formIds NOT already in
        applications — avoids scanning already-merged records.
     2. Delegates all merge logic to mergeSingleApplication()
        — zero code duplication.
     3. Logs total duration and per-run summary.
   ============================================================ */
export const autoMergeApplications = async () => {
  const t0 = Date.now();
  debugLog("[autoMerge] Bulk recovery merge started");

  // ── Only retrieve vehicles whose formId is NOT already in applications ──
  // This avoids the old O(N) full scan + N×findOne duplicate checks.
  const tScan = Date.now();
  const mergedFormIds = await Application.distinct("formId");
  const mergedSet = new Set(mergedFormIds.filter(Boolean));

  const vehicles = await VehicleDetails.find(
    mergedFormIds.length > 0
      ? { formId: { $nin: mergedFormIds } }
      : {}
  )
    .select("formId formID applicantFormId applicantFormID form")
    .lean();

  debugLog(
    `[autoMerge] Scan: ${mergedSet.size} already merged, ${vehicles.length} candidates — ${Date.now() - tScan}ms`
  );

  if (!vehicles.length) {
    debugLog(`[autoMerge] Nothing to merge. Total: ${Date.now() - t0}ms`);
    return { merged: 0, skipped: 0, failed: 0 };
  }

  let merged = 0, skipped = 0, failed = 0;

  for (const vehicle of vehicles) {
    const formId =
      vehicle?.formId ||
      vehicle?.formID ||
      vehicle?.applicantFormId ||
      vehicle?.applicantFormID ||
      vehicle?.form?.formId ||
      vehicle?.form?.id ||
      null;

    if (!formId) { skipped++; continue; }

    const result = await mergeSingleApplication(formId);

    if (result.success)                          merged++;
    else if (result.reason === "error")          failed++;
    else                                         skipped++;
  }

  const totalMs = Date.now() - t0;
  const summary = `[autoMerge] Bulk recovery complete — merged=${merged} skipped=${skipped} failed=${failed} totalMs=${totalMs}`;

  // Real merge activity is worth surfacing in production; idle sweeps are not.
  if (merged > 0 || failed > 0) console.log(summary);
  else debugLog(summary);

  return { merged, skipped, failed, totalMs };
};
