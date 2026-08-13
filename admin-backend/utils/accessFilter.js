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
 * Optional createdAt window for the stat counts, covering whole local days.
 *
 * Deliberately the same rules as the date filter in utils/filesQuery.js: the
 * dashboard tiles and the file list must agree about which records fall in a
 * range, or the tile would report a number the list cannot show. An
 * unparseable date is dropped rather than handed to Mongo as an Invalid Date,
 * which would match nothing and silently zero the counts.
 */
const statDateClause = (range) => {
  if (!range) return null;
  const out = {};
  if (range.from) {
    const d = new Date(range.from);
    if (!Number.isNaN(d.getTime())) { d.setHours(0, 0, 0, 0); out.$gte = d; }
  }
  if (range.to) {
    const d = new Date(range.to);
    if (!Number.isNaN(d.getTime())) { d.setHours(23, 59, 59, 999); out.$lte = d; }
  }
  return Object.keys(out).length ? { createdAt: out } : null;
};

/**
 * Returns { pending, approved, rejected, total } counts for the given admin.
 * - pending  : filtered by admin's workflowStages
 * - approved : unfiltered (all admins see all)
 * - rejected : unfiltered (all admins see all)
 *
 * `dateRange` is optional and defaults to null. Omitted, every query below is
 * exactly what it has always been, so the existing /workflow/stats caller is
 * unaffected. Supplied, the tiles can be scoped to a date range without the
 * dashboard downloading every record to filter client-side.
 */
export const getStatCounts = async (
  admin,
  Application,
  ApprovedApplication,
  RejectedApplication,
  dateRange = null
) => {
  const dateFilter = statDateClause(dateRange);
  const withDate = (f) => (dateFilter ? { $and: [f, dateFilter] } : f);

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
    Application.countDocuments(withDate(pendingFilter)),
    ApprovedApplication.countDocuments(dateFilter || {}),
    RejectedApplication.countDocuments(dateFilter || {}),
  ]);

  return { pending, approved, rejected, total: pending + approved + rejected };
};
