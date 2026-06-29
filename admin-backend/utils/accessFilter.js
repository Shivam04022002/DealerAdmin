/**
 * accessFilter.js — Shared permission filter for all application queries.
 *
 * Permission model:
 *   - SuperAdmin     → sees ALL records in every collection, no filter.
 *   - Regular Admin  → Pending filtered by their assigned workflowStages.
 *                      Approved and Rejected are NOT filtered — all admins
 *                      see all finalized records regardless of who handled them.
 */

import { normalizeWorkflows, STAGE_ALIASES } from "./workflowConstants.js";

/**
 * Returns true when the caller is a super-admin (sees all records).
 */
export const isSuperAdmin = (admin) =>
  admin?.role === "superadmin" || admin?.role === "sadmin";

/**
 * Escape a string for use inside a RegExp literal.
 */
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * For a canonical stage key, build a regex that matches it AND all its known
 * aliases, case-insensitively.  This catches every DB variant written before
 * workflowStage normalization was enforced.
 *
 * e.g. "house visit" → /^(house visit|housevisit|house-visit|pd visit)$/i
 */
const stageRegex = (canonical) => {
  const terms = new Set([canonical]);
  for (const [alias, target] of Object.entries(STAGE_ALIASES)) {
    if (target === canonical) terms.add(alias);
  }
  const pattern = [...terms].map(escapeRegex).join("|");
  return new RegExp(`^(${pattern})$`, "i");
};

/**
 * Returns the MongoDB query fragment that limits PENDING queries to the
 * workflowStages the admin is authorised to handle.
 *
 * SuperAdmin              → {} (no restriction)
 * Admin with stages       → { $or: [ workflowStage missing | matches any assigned stage (case-insensitive + aliases) ] }
 * Admin with no workflows → {} (no restriction — sees all pending)
 */
export const getPendingAccessFilter = (admin) => {
  if (isSuperAdmin(admin)) return {};

  const stages = normalizeWorkflows(admin?.workflows || []);
  if (!stages.length) return {};

  // Build one regex clause per assigned stage (handles casing + legacy aliases)
  const stageClauses = stages.map((s) => ({ workflowStage: { $regex: stageRegex(s) } }));

  return {
    $or: [
      { workflowStage: { $exists: false } },
      ...stageClauses,
    ],
  };
};

/**
 * Returns the filter for Approved / Rejected collections.
 * Per business rules, ALL admins see ALL finalized records — no restriction.
 * Only the baseFilter (search, branch, etc.) is applied.
 */
export const buildFinalizedFilter = async (_admin, baseFilter = {}) => {
  return baseFilter;
};

/**
 * Returns { pending, approved, rejected, total } counts for the given admin.
 * - pending  : filtered by admin's workflowStages
 * - approved : unfiltered (all admins see all)
 * - rejected : unfiltered (all admins see all)
 */
export const getStatCounts = async (
  admin,
  Application,
  ApprovedApplication,
  RejectedApplication
) => {
  const basePending = {
    $or: [
      { status: { $in: ["pending", null] } },
      { workflowStage: { $exists: false } },
      { workflowStage: { $nin: ["disbursed", "rejected", "approved"] } },
    ],
  };

  const pendingAccessFilter = getPendingAccessFilter(admin);
  const pendingFilter =
    Object.keys(pendingAccessFilter).length === 0
      ? basePending
      : { $and: [basePending, pendingAccessFilter] };

  const [pending, approved, rejected] = await Promise.all([
    Application.countDocuments(pendingFilter),
    ApprovedApplication.countDocuments({}),
    RejectedApplication.countDocuments({}),
  ]);

  return { pending, approved, rejected, total: pending + approved + rejected };
};
