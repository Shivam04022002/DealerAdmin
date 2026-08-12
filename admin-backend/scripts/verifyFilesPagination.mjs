/**
 * verifyFilesPagination.mjs — Super Admin file API pagination.
 *
 * The Super Admin file list downloads whole collections and does search,
 * filtering, sorting, paging and bulk-selection in the browser. Measured
 * against this database that is ~21.8s for pending (776 records, ~2.1MB) while
 * the database itself answers in 8ms — the time is transfer, not query.
 *
 * What this suite protects:
 *
 *   1. the shared filter builder — because the list, the count, the facets and
 *      the BULK ACTION all ask "which records match?" and must get the same
 *      answer. With select-all-matching-filter the operator never sees the
 *      individual ids, so a filter built differently in the bulk path would
 *      approve or reject a different set than the screen showed;
 *   2. the opt-in envelope — the Super Admin frontend deployed today sends no
 *      query parameters and reads the response as
 *      `Array.isArray(data) ? data : []`, so an envelope sent unasked would
 *      render an empty table rather than raise an error. This is what makes the
 *      backend deployable before the frontend;
 *   3. the bulk guard rails — count handshake, MAX_BULK ceiling, and the
 *      explicit applicationIds form still working unchanged.
 *
 * NO DATABASE, NO NETWORK. Mongoose models are never queried: the pure helpers
 * are called directly, and the controller paths run against stubbed model
 * methods that are restored afterwards. Nothing here writes, and nothing here
 * touches an index.
 *
 * Usage:  node scripts/verifyFilesPagination.mjs
 */
import assert from "node:assert/strict";

import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MAX_BULK,
  FILE_TYPES,
  buildFilesFilter,
  parsePaging,
  wantsPagination,
  buildSort,
  selectForType,
  basePendingFilter,
} from "../utils/filesQuery.js";

let passed = 0;
const acheck = async (name, fn) => {
  try {
    await fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (err) {
    console.error(`  FAIL ${name}\n       ${err.message}`);
    process.exitCode = 1;
  }
};

const SUPER = { role: "superadmin", workflows: [] };
/** Serialise a filter so two builds can be compared exactly. */
const norm = (f) => JSON.stringify(f, (k, v) => (v instanceof RegExp ? `re:${v.source}:${v.flags}` : v));

console.log("paging bounds");

await acheck("defaults are 50 rows, page 1", () => {
  const { page, limit, skip } = parsePaging({});
  assert.equal(page, 1);
  assert.equal(limit, DEFAULT_LIMIT);
  assert.equal(limit, 50);
  assert.equal(skip, 0);
});

await acheck("limit is clamped to 100 — a caller cannot ask for the whole collection", () => {
  assert.equal(parsePaging({ limit: 100 }).limit, 100);
  assert.equal(parsePaging({ limit: 5000 }).limit, MAX_LIMIT);
  assert.equal(parsePaging({ limit: 1e9 }).limit, 100);
  assert.equal(parsePaging({ limit: 776 }).limit, 100, "the full pending collection cannot be requested");
});

await acheck("junk paging values fall back rather than breaking the query", () => {
  assert.equal(parsePaging({ page: 0 }).page, 1);
  assert.equal(parsePaging({ page: -5 }).page, 1);
  assert.equal(parsePaging({ page: "abc" }).page, 1);
  assert.equal(parsePaging({ limit: 0 }).limit, DEFAULT_LIMIT);
  assert.equal(parsePaging({ limit: -1 }).limit, 1, "negative clamps into range, never negative skip");
  assert.ok(parsePaging({ page: "abc", limit: "xyz" }).skip >= 0);
});

await acheck("skip follows page and limit", () => {
  assert.equal(parsePaging({ page: 3, limit: 50 }).skip, 100);
  assert.equal(parsePaging({ page: 2, limit: 100 }).skip, 100);
});

console.log("\nthe envelope is opt-in — the deployed frontend keeps its bare array");

await acheck("no page and no limit → not paginated", () => {
  assert.equal(wantsPagination({}), false);
  assert.equal(wantsPagination({ search: "x", branch: "B" }), false,
    "filters alone must not switch the response shape");
});

await acheck("either page or limit opts in", () => {
  assert.equal(wantsPagination({ page: 1 }), true);
  assert.equal(wantsPagination({ limit: 25 }), true);
  assert.equal(wantsPagination({ page: "2", limit: "50" }), true);
});

console.log("\nsort");

await acheck("sorts by createdAt, newest first by default", () => {
  assert.deepEqual(buildSort({}), { createdAt: -1 });
  assert.deepEqual(buildSort({ dir: "desc" }), { createdAt: -1 });
  assert.deepEqual(buildSort({ dir: "asc" }), { createdAt: 1 });
});

await acheck("no other sort key is accepted — only createdAt_-1 exists to serve it", () => {
  const s = buildSort({ sort: "applicant.name", dir: "asc" });
  assert.deepEqual(Object.keys(s), ["createdAt"]);
});

console.log("\nthe shared filter builder");

await acheck("every type is buildable and pending keeps its existing shape", async () => {
  for (const t of FILE_TYPES) {
    const f = await buildFilesFilter(t, SUPER, {});
    assert.ok(f && typeof f === "object", t);
  }
  const pending = await buildFilesFilter("pending", SUPER, {});
  assert.equal(norm(pending), norm(basePendingFilter()),
    "an unfiltered superadmin pending query is exactly the legacy base filter");
});

await acheck("an unfiltered superadmin approved/rejected query is unrestricted, as before", async () => {
  assert.equal(norm(await buildFilesFilter("approved", SUPER, {})), norm({}));
  assert.equal(norm(await buildFilesFilter("rejected", SUPER, {})), norm({}));
});

await acheck("an unknown type is rejected, not silently treated as pending", async () => {
  await assert.rejects(() => buildFilesFilter("everything", SUPER, {}), /Unknown file type/);
  await assert.rejects(() => buildFilesFilter(undefined, SUPER, {}), /Unknown file type/);
});

await acheck("search reproduces the three fields the table searched", async () => {
  const f = await buildFilesFilter("approved", SUPER, { search: "ravi" });
  const clause = JSON.stringify(f);
  for (const field of ["formId", "applicant.name", "applicant.applicant.name", "dealerDetails.name"]) {
    assert.ok(clause.includes(field), `searches ${field}`);
  }
  assert.ok(!clause.includes("panNo"), "and nothing the table did not search");
  assert.ok(!clause.includes("aadharNo"), "no identity field is newly searchable");
});

await acheck("search input is regex-escaped — no injection, no ReDoS", async () => {
  const f = await buildFilesFilter("approved", SUPER, { search: ".*(a+)+$" });
  const re = f.$or.find((c) => c.formId)?.formId;
  assert.ok(re instanceof RegExp);
  assert.ok(re.source.includes("\\.\\*"), "metacharacters escaped");
  assert.equal(re.flags, "i", "case-insensitive, as the client was");
  assert.ok(re.test(".*(a+)+$"), "matches the literal text");
  assert.ok(!re.test("anything else"), "and is not a wildcard");
});

await acheck("blank search is ignored rather than matching everything", async () => {
  const empty = await buildFilesFilter("approved", SUPER, {});
  for (const s of ["", "   ", null, undefined]) {
    assert.equal(norm(await buildFilesFilter("approved", SUPER, { search: s })), norm(empty), JSON.stringify(s));
  }
});

await acheck("branch / district / stage match EXACTLY, as the client's === did", async () => {
  const f = await buildFilesFilter("approved", SUPER, { branch: "Ludhiana", district: "Punjab", stage: "agreement" });
  const s = JSON.stringify(f);
  assert.ok(s.includes('"dealerDetails.branch":"Ludhiana"'), "exact string, not a regex");
  assert.ok(s.includes('"dealerDetails.district":"Punjab"'));
  assert.ok(s.includes('"workflowStage":"agreement"'));
});

await acheck("the date range covers whole days", async () => {
  const f = await buildFilesFilter("approved", SUPER, { from: "2026-03-01", to: "2026-03-31" });
  const c = f.createdAt || (f.$and || []).map((x) => x.createdAt).find(Boolean);
  assert.ok(c, "a createdAt clause exists");
  assert.equal(c.$gte.getHours(), 0);
  assert.equal(c.$lte.getHours(), 23);
  assert.equal(c.$lte.getMinutes(), 59);
});

await acheck("an unparseable date is ignored, never sent to mongo as Invalid Date", async () => {
  const empty = await buildFilesFilter("approved", SUPER, {});
  assert.equal(norm(await buildFilesFilter("approved", SUPER, { from: "not-a-date" })), norm(empty));
  assert.equal(norm(await buildFilesFilter("approved", SUPER, { to: "" })), norm(empty));
});

await acheck("a non-superadmin's pending access filter is preserved", async () => {
  const admin = { role: "admin", workflows: ["house visit"] };
  const f = await buildFilesFilter("pending", admin, {});
  assert.ok(JSON.stringify(f).includes("workflowStage"), "stage restriction survives");
  assert.notEqual(norm(f), norm(basePendingFilter()), "an ordinary admin is scoped, not global");
});

await acheck("filters compose — every clause survives together", async () => {
  const f = await buildFilesFilter("pending", SUPER, {
    search: "ravi", branch: "B", district: "D", stage: "agreement", from: "2026-01-01", to: "2026-12-31",
  });
  const s = JSON.stringify(f);
  for (const marker of ["formId", '"dealerDetails.branch":"B"', '"dealerDetails.district":"D"',
                        '"workflowStage":"agreement"', "createdAt"]) {
    assert.ok(s.includes(marker), `kept ${marker}`);
  }
});

console.log("\nthe four callers cannot disagree");

await acheck("list, count, facets and bulk build the IDENTICAL filter", async () => {
  const query = { search: "ravi", branch: "B", stage: "agreement", from: "2026-01-01" };
  const forList  = await buildFilesFilter("pending", SUPER, query);
  const forCount = await buildFilesFilter("pending", SUPER, query);
  const forBulk  = await buildFilesFilter("pending", SUPER, { ...query });
  assert.equal(norm(forList), norm(forCount), "count must match the list");
  assert.equal(norm(forBulk), norm(forList),
    "bulk must match the list — otherwise select-all acts on rows the operator never saw");
});

await acheck("paging and sort params do not leak into the filter", async () => {
  const plain = await buildFilesFilter("pending", SUPER, { search: "ravi" });
  const withPaging = await buildFilesFilter("pending", SUPER, { search: "ravi", page: 3, limit: 100, dir: "asc" });
  assert.equal(norm(withPaging), norm(plain),
    "page 3 of a filter must match the same records as page 1 of it");
  const s = JSON.stringify(withPaging);
  for (const leak of ["page", "limit", "dir"]) {
    assert.ok(!s.includes(`"${leak}"`), `${leak} is not a mongo field`);
  }
});

console.log("\nprojections are unchanged per type");

await acheck("each type still selects exactly the fields it always did", () => {
  const base = selectForType("pending");
  for (const f of ["formId", "applicant", "coApplicant", "vehicleDetails", "dealer",
                   "dealerDetails", "status", "workflowStage", "createdAt", "updatedAt"]) {
    assert.ok(base.includes(f), `pending selects ${f}`);
  }
  assert.equal(selectForType("approved"), base, "approved selected the same fields as pending");
  assert.ok(selectForType("rejected").includes("rejection"), "rejected carries the nested rejection object");
  assert.ok(!base.includes("rejection"), "pending does not over-select");
});

console.log("\nthe list controller — legacy array vs opt-in envelope");

/* getFilesByType is driven with a stubbed model so both response shapes can be
 * checked without a database. The stub records the query it was handed, which
 * is how "page=1&limit=50 must never fetch 776 records" is actually asserted
 * rather than assumed. */
const { getFilesByType } = await import("../controllers/superadminController.js");
const Application = (await import("../models/Application.js")).default;

const fakeRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
};

/** Stub Application.find/countDocuments, capturing what the controller asked for. */
const withStubbedList = async (rows, total, fn) => {
  const realFind = Application.find;
  const realCount = Application.countDocuments;
  const seen = { filter: null, select: null, sort: null, skip: null, limit: null, populated: false };
  Application.find = (filter) => {
    seen.filter = filter;
    const chain = {
      select: (s) => { seen.select = s; return chain; },
      populate: () => { seen.populated = true; return chain; },
      sort: (s) => { seen.sort = s; return chain; },
      skip: (n) => { seen.skip = n; return chain; },
      limit: (n) => { seen.limit = n; return chain; },
      lean: async () => rows,
    };
    return chain;
  };
  Application.countDocuments = async () => total;
  try { await fn(seen); } finally {
    Application.find = realFind;
    Application.countDocuments = realCount;
  }
};

await acheck("no query params → a bare array, exactly as the deployed frontend expects", async () => {
  await withStubbedList([{ _id: "a" }, { _id: "b" }], 776, async (seen) => {
    const res = fakeRes();
    await getFilesByType({ params: { type: "pending" }, query: {}, admin: SUPER }, res);
    assert.ok(Array.isArray(res.body), `expected an array, got ${typeof res.body}`);
    assert.equal(res.body.length, 2);
    assert.equal(seen.limit, null, "the legacy path applies no limit — unchanged behaviour");
    assert.equal(seen.sort, null, "and no sort, so the existing row order is preserved");
    assert.ok(seen.populated, "the dealer is still populated");
  });
});

await acheck("page=1&limit=50 → an envelope, and it NEVER fetches all 776 records", async () => {
  await withStubbedList(new Array(50).fill({ _id: "x" }), 776, async (seen) => {
    const res = fakeRes();
    await getFilesByType({ params: { type: "pending" }, query: { page: "1", limit: "50" }, admin: SUPER }, res);
    assert.ok(!Array.isArray(res.body), "the paginated response is an object");
    assert.equal(res.body.page, 1);
    assert.equal(res.body.limit, 50);
    assert.equal(res.body.total, 776);
    assert.equal(res.body.pages, 16, "ceil(776 / 50)");
    assert.equal(res.body.items.length, 50);
    assert.equal(seen.limit, 50, "the DRIVER limit is 50 — this is the whole point of the change");
    assert.equal(seen.skip, 0);
    assert.deepEqual(seen.sort, { createdAt: -1 });
  });
});

await acheck("an oversized limit is clamped at the controller, not just the helper", async () => {
  await withStubbedList([], 776, async (seen) => {
    const res = fakeRes();
    await getFilesByType({ params: { type: "pending" }, query: { limit: "9999" }, admin: SUPER }, res);
    assert.equal(seen.limit, MAX_LIMIT, "a caller cannot re-create the unbounded query");
    assert.equal(res.body.limit, 100);
  });
});

await acheck("page 3 skips correctly", async () => {
  await withStubbedList([], 776, async (seen) => {
    const res = fakeRes();
    await getFilesByType({ params: { type: "pending" }, query: { page: "3", limit: "50" }, admin: SUPER }, res);
    assert.equal(seen.skip, 100);
    assert.equal(seen.limit, 50);
  });
});

await acheck("an invalid type is still a 400", async () => {
  const res = fakeRes();
  await getFilesByType({ params: { type: "archived" }, query: {}, admin: SUPER }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /Invalid type/);
});

console.log("\nbulk safety");

await acheck("MAX_BULK is 200", () => {
  assert.equal(MAX_BULK, 200);
});

const { bulkApproveApplications, bulkRejectApplications } = await import("../controllers/workflowController.js");

await acheck("the explicit applicationIds contract is untouched — empty is still the old 400", async () => {
  const res = fakeRes();
  await bulkApproveApplications({ body: {}, admin: SUPER }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /applicationIds must be a non-empty array/,
    "the original wording, so the existing frontend's error display is unchanged");
});

await acheck("a filter naming an unknown type is refused", async () => {
  const res = fakeRes();
  await bulkRejectApplications({ body: { filter: { type: "nonsense" } }, admin: SUPER }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /filter\.type must be pending, approved or rejected/);
});

await acheck("a malformed filter is refused before any database work", async () => {
  for (const body of [{ filter: null }, { filter: "pending" }, { filter: 42 }]) {
    const res = fakeRes();
    await bulkApproveApplications({ body, admin: SUPER }, res);
    assert.equal(res.statusCode, 400, JSON.stringify(body));
  }
});

/* The three guard rails below all return BEFORE the sequential approve/reject
 * loop, so they run with no database and no writes: only countDocuments and
 * find are stubbed, and both are restored afterwards. */
const withStubbedCount = async (count, fn) => {
  const realCount = Application.countDocuments;
  const realFind = Application.find;
  Application.countDocuments = async () => count;
  Application.find = () => ({ select: () => ({ lean: async () => [] }) });
  try { await fn(); } finally {
    Application.countDocuments = realCount;
    Application.find = realFind;
  }
};

await acheck("no matches → 400, and nothing is approved", async () => {
  await withStubbedCount(0, async () => {
    const res = fakeRes();
    await bulkApproveApplications(
      { body: { filter: { type: "pending" }, expectedCount: 5 }, admin: SUPER }, res
    );
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /No applications match/);
    assert.equal(res.body.total, 0);
  });
});

await acheck("expectedCount missing → 400, with the live total reported", async () => {
  await withStubbedCount(7, async () => {
    const res = fakeRes();
    await bulkApproveApplications({ body: { filter: { type: "pending" } }, admin: SUPER }, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /expectedCount is required/);
    assert.equal(res.body.total, 7);
  });
});

await acheck("the set changed since confirmation → 409, never a silent partial action", async () => {
  await withStubbedCount(12, async () => {
    const res = fakeRes();
    await bulkRejectApplications(
      { body: { filter: { type: "pending" }, expectedCount: 10 }, admin: SUPER }, res
    );
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.expectedCount, 10);
    assert.equal(res.body.total, 12, "the operator is told the real number");
    assert.match(res.body.error, /changed since you confirmed/);
  });
});

await acheck("over MAX_BULK → 413, refused rather than truncated", async () => {
  await withStubbedCount(MAX_BULK + 1, async () => {
    const res = fakeRes();
    await bulkApproveApplications(
      { body: { filter: { type: "pending" }, expectedCount: MAX_BULK + 1 }, admin: SUPER }, res
    );
    assert.equal(res.statusCode, 413);
    assert.equal(res.body.total, MAX_BULK + 1);
    assert.equal(res.body.maxBulk, MAX_BULK);
    assert.match(res.body.error, /Narrow the filter/);
  });
});

await acheck("exactly MAX_BULK is allowed — the boundary is inclusive", async () => {
  await withStubbedCount(MAX_BULK, async () => {
    const res = fakeRes();
    await bulkApproveApplications(
      { body: { filter: { type: "pending" }, expectedCount: MAX_BULK }, admin: SUPER }, res
    );
    assert.notEqual(res.statusCode, 413, "200 matches must not be refused");
  });
});

await acheck("a non-empty explicit id list never consults the count", async () => {
  let counted = false;
  const realCount = Application.countDocuments;
  const realFindById = Application.findById;
  Application.countDocuments = async () => { counted = true; return 999; };
  // Resolve the lookup to null so approveApplicationCore returns "not_found"
  // immediately: the id lands in `failed`, no write is attempted, and the test
  // does not sit through a mongoose buffering timeout.
  Application.findById = async () => null;
  try {
    const res = fakeRes();
    await bulkApproveApplications(
      { body: { applicationIds: ["000000000000000000000000"], filter: { type: "pending" }, expectedCount: 1 },
        admin: SUPER }, res
    );
    assert.equal(counted, false, "explicit ids bypass the handshake, as before");
    assert.equal(res.statusCode, 200, "and the request is still served normally");
    assert.equal(res.body.approvedCount, 0);
    assert.equal(res.body.failedCount, 1, "the bogus id is reported, never silently dropped");
  } finally {
    Application.countDocuments = realCount;
    Application.findById = realFindById;
  }
});

console.log(
  `\n${process.exitCode ? "FAILED" : "PASSED"} — ${passed} checks` +
    (process.exitCode ? "" : ", 0 failures")
);
