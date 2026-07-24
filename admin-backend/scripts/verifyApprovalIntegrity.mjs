/**
 * verifyApprovalIntegrity.mjs
 *
 * READ-ONLY verification for the approval flow. Development / ops use only.
 * This script performs NO writes of any kind — it only reads and reports.
 *
 * Usage:
 *   node scripts/verifyApprovalIntegrity.mjs            # summary
 *   node scripts/verifyApprovalIntegrity.mjs --verbose  # + sample mismatches
 *   node scripts/verifyApprovalIntegrity.mjs --limit 50 # cap records scanned
 *
 * Invariants checked (post-`_id`-preservation approval flow):
 *   1. createdAt preserved      ApprovedApplication.createdAt < updatedAt
 *                               (createdAt = original submission, updatedAt = approval).
 *                               Legacy records (createdAt == updatedAt) are reported
 *                               separately as "needs migration".
 *   2. _id identity             ApprovedApplication._id appears as an APPROVE
 *                               ActivityLog.applicationId — proof the original
 *                               Application identity was carried onto the approved doc.
 *   3. Original submission ts    Embedded applicant.createdAt exists and agrees with
 *                               the vehicledetails.createdAt source (recovery sources).
 *   4. ActivityLog refs valid    Every ActivityLog.applicationId resolves to a doc in
 *                               applications / approvedApplications / rejectedApplications.
 *   5. ApplicationHistory refs   Same resolution check for ApplicationHistory.applicationId.
 *
 * Exit code is always 0 (report tool). Read the printed PASS/FAIL/INFO lines.
 */

import dotenv from "dotenv";
import mongoose from "mongoose";

import Application from "../models/Application.js";
import ApprovedApplication from "../models/ApprovedApplication.js";
import RejectedApplication from "../models/RejectedApplication.js";
import ActivityLog from "../models/ActivityLog.js";
import ApplicationHistory from "../models/ApplicationHistory.js";
import VehicleDetails from "../models/VehicleDetails.js";

dotenv.config();

const args = process.argv.slice(2);
const VERBOSE = args.includes("--verbose");
const LIMIT = (() => {
  const i = args.indexOf("--limit");
  return i >= 0 ? parseInt(args[i + 1], 10) || 0 : 0;
})();

const TOLERANCE_MS = 2000;
const AGREE_MS = 5000;

const ok = (b) => (b ? "PASS" : "FAIL");
const embeddedApplicantCreatedAt = (a) =>
  a?.applicant?.createdAt || a?.applicant?.applicant?.createdAt || null;

async function main() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set. This script reads from the configured database.");
    process.exit(0);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected (read-only verification — no writes will be performed).\n");

  const approvedQuery = ApprovedApplication.find({})
    .select("formId createdAt updatedAt applicant")
    .lean();
  if (LIMIT) approvedQuery.limit(LIMIT);
  const approved = await approvedQuery;

  const formIds = approved.map((a) => a.formId).filter(Boolean);
  const vehDocs = await VehicleDetails.find({ formId: { $in: formIds } })
    .select("formId createdAt")
    .lean();
  const vehByForm = new Map(vehDocs.map((v) => [v.formId, v.createdAt]));

  // APPROVE-action application ids (for _id-identity check)
  const approveLogIds = new Set(
    (await ActivityLog.find({ action: "APPROVE" }).select("applicationId").lean()).map((l) =>
      String(l.applicationId)
    )
  );

  // ── Check 1 + 2 + 3 over approved records ────────────────────────────────
  let fixed = 0;
  let legacy = 0;
  let idIdentityOk = 0;
  let submissionTsPresent = 0;
  let sourcesAgree = 0;
  const sampleLegacy = [];
  const sampleNoIdentity = [];

  for (const a of approved) {
    const c = +new Date(a.createdAt);
    const u = +new Date(a.updatedAt);

    if (c < u - TOLERANCE_MS) fixed++;
    else {
      legacy++;
      if (sampleLegacy.length < 5)
        sampleLegacy.push({ formId: a.formId, createdAt: a.createdAt, updatedAt: a.updatedAt });
    }

    if (approveLogIds.has(String(a._id))) idIdentityOk++;
    else if (sampleNoIdentity.length < 5) sampleNoIdentity.push({ formId: a.formId, _id: String(a._id) });

    const emb = embeddedApplicantCreatedAt(a);
    const veh = vehByForm.get(a.formId);
    if (emb) submissionTsPresent++;
    if (emb && veh && Math.abs(+new Date(emb) - +new Date(veh)) < AGREE_MS) sourcesAgree++;
  }

  // ── Check 4: ActivityLog references resolve ──────────────────────────────
  const logRefs = [
    ...new Set(
      (await ActivityLog.find({}).select("applicationId").lean())
        .map((l) => l.applicationId)
        .filter(Boolean)
        .map(String)
    ),
  ];
  const resolvedLog = await resolveIds(logRefs);
  const logValid = resolvedLog.size;
  const logOrphan = logRefs.length - logValid;

  // ── Check 5: ApplicationHistory references resolve ───────────────────────
  const histRefs = [
    ...new Set(
      (await ApplicationHistory.find({}).select("applicationId").lean())
        .map((h) => h.applicationId)
        .filter(Boolean)
        .map(String)
    ),
  ];
  const resolvedHist = await resolveIds(histRefs);
  const histValid = resolvedHist.size;
  const histOrphan = histRefs.length - histValid;

  // ── Report ───────────────────────────────────────────────────────────────
  const line = "─".repeat(64);
  console.log(line);
  console.log("APPROVAL INTEGRITY VERIFICATION");
  console.log(line);
  console.log(`Approved records scanned            : ${approved.length}`);
  console.log("");
  console.log(`[1] createdAt preserved (createdAt<updatedAt) : ${fixed}`);
  console.log(`    legacy (createdAt==updatedAt, needs migration): ${legacy}`);
  console.log(`[2] _id identity (matches APPROVE log)        : ${idIdentityOk} / ${approved.length}  ${ok(idIdentityOk === approved.length)}`);
  console.log(`[3] embedded applicant.createdAt present      : ${submissionTsPresent} / ${approved.length}  ${ok(submissionTsPresent === approved.length)}`);
  console.log(`    embedded vs vehicledetails agree (<5s)    : ${sourcesAgree} / ${approved.length}`);
  console.log(`[4] ActivityLog refs resolve                  : ${logValid} valid, ${logOrphan} orphaned  ${ok(logOrphan === 0)}`);
  console.log(`[5] ApplicationHistory refs resolve           : ${histValid} valid, ${histOrphan} orphaned  ${ok(histOrphan === 0)}`);
  console.log(line);

  if (legacy > 0) {
    console.log(`\nNOTE: ${legacy} legacy approved record(s) still store the approval date as createdAt.`);
    console.log("      These predate the _id/createdAt fix and require the planned migration.");
  }

  if (VERBOSE) {
    if (sampleLegacy.length) {
      console.log("\nSample legacy records (createdAt == updatedAt):");
      sampleLegacy.forEach((s) => console.log("  ", JSON.stringify(s)));
    }
    if (sampleNoIdentity.length) {
      console.log("\nSample approved records with no matching APPROVE log (legacy new-_id):");
      sampleNoIdentity.forEach((s) => console.log("  ", JSON.stringify(s)));
    }
  }

  await mongoose.disconnect();
}

/** Return the set of ids (as strings) that resolve to a doc in any of the 3 collections. */
async function resolveIds(ids) {
  const objectIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
  const [p, a, r] = await Promise.all([
    Application.find({ _id: { $in: objectIds } }).select("_id").lean(),
    ApprovedApplication.find({ _id: { $in: objectIds } }).select("_id").lean(),
    RejectedApplication.find({ _id: { $in: objectIds } }).select("_id").lean(),
  ]);
  return new Set([...p, ...a, ...r].map((d) => String(d._id)));
}

main().catch((err) => {
  console.error("verifyApprovalIntegrity failed:", err.message || err);
  process.exit(0);
});
