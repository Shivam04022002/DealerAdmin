/**
 * filesQuery.js — the ONE definition of "which files is this admin asking for?"
 *
 * The Super Admin file list loads whole collections and does everything in the
 * browser: search, filter, sort, paginate and resolve bulk selections. Measured
 * against this database that costs ~21.8s for pending, ~15.8s for approved and
 * ~8.5s for rejected. The database itself answers in 8ms — the time is spent
 * shipping ~2.1MB of rows over the wire. Moving those decisions to the server
 * means the same question — which records match? — is now asked from four
 * places:
 *
 *     the list        (which page of rows to render)
 *     the count       (how many rows in total)
 *     the facets      (which branch / district / stage options to offer)
 *     the bulk action (which records to approve or reject)
 *
 * They MUST agree. The bulk path is why this is a correctness concern and not a
 * tidiness one: with select-all-matching-filter the operator never sees the
 * individual ids, so a filter built even slightly differently there would
 * approve or reject a different set than the screen showed. One builder, used
 * by all four, is what makes that impossible.
 *
 * Read-only: nothing here writes, and nothing here creates an index. The sort
 * below relies on `createdAt_-1`, which already exists on all three
 * collections.
 */
import Application from "../models/Application.js";
import ApprovedApplication from "../models/ApprovedApplication.js";
import RejectedApplication from "../models/RejectedApplication.js";
import { getPendingAccessFilter, buildFinalizedFilter } from "./accessFilter.js";

/** Rows per page, and the ceiling a caller cannot exceed. */
export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 100;

/**
 * The most records one bulk action may touch.
 *
 * This is a safety limit, not a performance tuning knob. bulkApprove and
 * bulkReject process ids SEQUENTIALLY, awaiting the full approve/reject
 * pipeline for each one, so the request time grows linearly with the match
 * count. Handing "select all matching" an unbounded set would reproduce exactly
 * the timeout this work exists to remove — and worse than a slow list, because
 * a bulk request that dies halfway leaves some applications transitioned and
 * the rest not. Over this many, the operator is asked to narrow the filter.
 */
export const MAX_BULK = 200;

/** The three list types and the collection each one reads. */
export const FILE_TYPES = ["pending", "approved", "rejected"];

const MODELS = {
  pending: Application,
  approved: ApprovedApplication,
  rejected: RejectedApplication,
};

export const modelForType = (type) => MODELS[type] || null;

/**
 * Escape a user-supplied string so it can be embedded in a RegExp as a literal.
 * Prevents regex injection and ReDoS through the `search` parameter.
 */
const escapeRegex = (s) => String(s ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Pending is a shape, not a status: a record counts as pending when it has not
 * reached a terminal stage. Copied verbatim from the behaviour getFilesByType
 * already had, so the list this returns is unchanged.
 */
export const basePendingFilter = () => ({
  $or: [
    { status: { $in: ["pending", null] } },
    { workflowStage: { $exists: false } },
    { workflowStage: { $nin: ["disbursed", "rejected", "approved"] } },
  ],
});

/** Combine clauses without nesting an $and inside an $and for no reason. */
const allOf = (clauses) => {
  const real = clauses.filter((c) => c && Object.keys(c).length > 0);
  if (real.length === 0) return {};
  if (real.length === 1) return real[0];
  return { $and: real };
};

/**
 * Search, mirroring what the table did in the browser.
 *
 * The client matched `q` case-insensitively as a SUBSTRING of exactly three
 * things: formId, the applicant's name and the dealer's name. This reproduces
 * that and deliberately nothing more — widening it here would quietly change
 * which rows an operator sees, and with select-all-matching-filter, which rows
 * a bulk action touches.
 *
 * Two honest limits:
 *  - `dealer.name` (the populated User) cannot be matched in this query;
 *    only the denormalised `dealerDetails.name` is searchable. Records that
 *    carry only the populated dealer will not match a dealer-name search.
 *  - a substring regex cannot use an index. `applicant.name` is unindexed on
 *    every collection, so search alone scans. Combining it with a branch,
 *    district or stage filter lets those indexes narrow the scan first.
 */
const searchClause = (search) => {
  const q = String(search ?? "").trim();
  if (!q) return null;
  const re = new RegExp(escapeRegex(q), "i");
  return {
    $or: [
      { formId: re },
      { "applicant.name": re },
      { "applicant.applicant.name": re },
      { "dealerDetails.name": re },
    ],
  };
};

/**
 * Date range over the record's own `createdAt`, covering whole local days.
 * An unparseable date is dropped rather than sent to Mongo as an Invalid Date.
 */
const dateClause = (from, to) => {
  const range = {};
  if (from) {
    const d = new Date(from);
    if (!Number.isNaN(d.getTime())) { d.setHours(0, 0, 0, 0); range.$gte = d; }
  }
  if (to) {
    const d = new Date(to);
    if (!Number.isNaN(d.getTime())) { d.setHours(23, 59, 59, 999); range.$lte = d; }
  }
  return Object.keys(range).length ? { createdAt: range } : null;
};

/**
 * buildFilesFilter(type, admin, query) — the shared definition.
 *
 * Branch, district and stage are matched EXACTLY, not by regex, because the
 * client compared them with === against values it had read out of the data
 * itself. An exact match reproduces that; a loose one would return rows the
 * old UI would not have shown.
 */
export async function buildFilesFilter(type, admin, query = {}) {
  if (!FILE_TYPES.includes(type)) throw new Error(`Unknown file type: ${type}`);

  const access =
    type === "pending"
      ? allOf([basePendingFilter(), getPendingAccessFilter(admin)])
      : await buildFinalizedFilter(admin);

  const { search, branch, district, stage, from, to } = query;

  return allOf([
    access,
    searchClause(search),
    branch ? { "dealerDetails.branch": branch } : null,
    district ? { "dealerDetails.district": district } : null,
    stage ? { workflowStage: stage } : null,
    dateClause(from, to),
  ]);
}

/** Page and limit, clamped. A caller cannot ask for more than MAX_LIMIT. */
export function parsePaging(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(query.limit, 10) || DEFAULT_LIMIT));
  return { page, limit, skip: (page - 1) * limit };
}

/**
 * Did the caller ask to be paginated?
 *
 * The Super Admin frontend deployed today calls `/superadmin/files/:type` with
 * no query parameters at all and reads the result as
 * `Array.isArray(data) ? data : []`, so handing it an envelope would not raise
 * an error — it would render an empty table and look like data loss. The
 * envelope therefore appears only when the caller opts in by sending page or
 * limit; without them the response stays the bare array it has always been.
 * That is what lets this backend deploy on its own, before the frontend.
 */
export const wantsPagination = (query = {}) =>
  query.page !== undefined || query.limit !== undefined;

/** Sort. Only createdAt is offered, because only createdAt is indexed for it. */
export const buildSort = (query = {}) => ({
  createdAt: String(query.dir || "desc").toLowerCase() === "asc" ? 1 : -1,
});

/**
 * Field lists, byte-for-byte what getFilesByType already returned per type.
 * `rejected` carries the nested `rejection` object; nothing else differs.
 */
const BASE_SELECT =
  "formId applicant coApplicant vehicleDetails dealer dealerDetails status workflowStage createdAt updatedAt";

export const selectForType = (type) =>
  type === "rejected" ? `${BASE_SELECT} rejection` : BASE_SELECT;

export const DEALER_POPULATE = { path: "dealer", select: "email userId name district branch" };

export default {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MAX_BULK,
  FILE_TYPES,
  modelForType,
  basePendingFilter,
  buildFilesFilter,
  parsePaging,
  wantsPagination,
  buildSort,
  selectForType,
  DEALER_POPULATE,
};
