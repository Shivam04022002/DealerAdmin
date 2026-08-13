/**
 * verifySuperAdminFilesPaging.mjs
 *
 * The Super Admin dashboard used to download every pending, approved and
 * rejected application and then search, filter, sort, paginate and resolve bulk
 * selections in the browser. This suite guards the migration away from that.
 *
 * This package has no test runner and no DOM, so a React hook and a table
 * component cannot be mounted. What is verified instead:
 *
 *   - the pure query-parameter logic, EXTRACTED from the real hook source and
 *     evaluated, so the assertions cannot drift from the shipped code;
 *   - source-level invariants that would silently undo the migration if they
 *     regressed — client-side row models coming back, filtering returning to
 *     the browser, or an unbounded fetch reappearing;
 *   - that MAX_BULK here still equals MAX_BULK on the server. It is duplicated
 *     across the two packages by necessity, and a drift would let the UI offer
 *     a bulk action the server then refuses.
 *
 * NO NETWORK, NO BROWSER, NO DATABASE.
 *
 * Usage:  node scripts/verifySuperAdminFilesPaging.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8").replace(/\r\n/g, "\n");

const hookSrc = read("../src/hooks/useSuperAdminFiles.js");
const tableSrc = read("../src/components/FilesManagementTable.jsx");
const pageSrc = read("../src/pages/SuperAdminDashboard.jsx");
const serverSrc = read("../../admin-backend/utils/filesQuery.js");

/** Strip comments so a source assertion reads code, not prose about the code. */
const codeOf = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "").replace(/\/\/.*$/gm, "");

const hookCode = codeOf(hookSrc);
const tableCode = codeOf(tableSrc);
const pageCode = codeOf(pageSrc);

let passed = 0;
const check = (name, fn) => {
  try {
    fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (err) {
    console.error(`  FAIL ${name}\n       ${err.message}`);
    process.exitCode = 1;
  }
};

console.log("query parameters (evaluated from the real hook source)");

/** Pull filterParamsOf out of the shipped file and run it. */
const filterParamsOf = (() => {
  const a = hookSrc.indexOf("const filterParamsOf =");
  assert.notEqual(a, -1, "filterParamsOf not found in the hook");
  const b = hookSrc.indexOf("\n};", a);
  assert.notEqual(b, -1);
  return new Function(`${hookSrc.slice(a, b + 3)}\nreturn filterParamsOf;`)();
})();

check("only real filters are sent — blanks are omitted entirely", () => {
  assert.deepEqual(filterParamsOf({}), {});
  assert.deepEqual(filterParamsOf({ search: "", branch: "", district: "", stage: "", from: "", to: "" }), {});
  assert.deepEqual(
    filterParamsOf({ search: "ravi", branch: "B", district: "D", stage: "agreement", from: "2026-01-01", to: "2026-12-31" }),
    { search: "ravi", branch: "B", district: "D", stage: "agreement", from: "2026-01-01", to: "2026-12-31" }
  );
});

check("paging and sort never leak into the filter", () => {
  const p = filterParamsOf({ search: "x", page: 4, limit: 100, dir: "asc", sort: "createdAt" });
  assert.deepEqual(Object.keys(p), ["search"],
    "page 4 of a filter must describe the same records as page 1 of it");
});

check("an omitted filter is absent, not undefined", () => {
  const p = filterParamsOf({ search: "x" });
  assert.equal("branch" in p, false, "an undefined value would still serialise as a query param");
});

console.log("\nthe bulk limit is shared with the server");

check("MAX_BULK matches admin-backend/utils/filesQuery.js", () => {
  const here = Number(/export const MAX_BULK = (\d+)/.exec(hookSrc)?.[1]);
  const there = Number(/export const MAX_BULK = (\d+)/.exec(serverSrc)?.[1]);
  assert.equal(Number.isFinite(here), true, "no MAX_BULK in the hook");
  assert.equal(Number.isFinite(there), true, "no MAX_BULK on the server");
  assert.equal(here, there, `UI says ${here}, server says ${there} — the UI would offer what the server refuses`);
  assert.equal(here, 200, "the approved limit is 200");
});

check("page sizes stay within the server's ceiling of 100", () => {
  const sizes = JSON.parse(/export const PAGE_SIZES = (\[[^\]]*\])/.exec(hookSrc)[1]);
  const maxLimit = Number(/export const MAX_LIMIT = (\d+)/.exec(serverSrc)?.[1]);
  assert.ok(sizes.every((n) => n <= maxLimit), `a page size exceeds MAX_LIMIT ${maxLimit}`);
  const dflt = Number(/export const DEFAULT_PAGE_SIZE = (\d+)/.exec(hookSrc)[1]);
  assert.equal(dflt, 50);
  assert.ok(sizes.includes(dflt), "the default must be offered in the selector");
});

console.log("\nthe hook asks the server, one page at a time");

check("the list request always carries page and limit", () => {
  assert.match(hookCode, /params:\s*\{\s*\.\.\.filterParams,\s*page,\s*limit:\s*pageSize\b/,
    "without page/limit the server returns the legacy unbounded array");
});

check("the list request carries the sort direction", () => {
  assert.match(hookCode, /params:\s*\{[^}]*\bdir\b[^}]*\}/,
    "the header would otherwise move the arrow without reordering the data");
});

check("a filter change returns the operator to page 1", () => {
  const m = /setPage\(1\);\s*\}, \[([^\]]*)\]/.exec(hookCode);
  assert.ok(m, "the page-reset effect is missing");
  for (const dep of ["filterKey", "type", "pageSize", "dir"]) {
    assert.ok(m[1].includes(dep),
      `${dep} must reset the page — otherwise it leaves the operator on an out-of-range page`);
  }
});

check("out-of-order responses cannot repaint the table", () => {
  assert.match(hookCode, /requestRef/, "a request sequence guard exists");
  assert.match(hookCode, /if \(id !== requestRef\.current\) return/);
});

check("search is debounced in the hook, not per keystroke", () => {
  assert.match(hookCode, /setTimeout\(\(\) => setSearchQuery/);
});

check("facets are fetched over the filter but NOT the page", () => {
  assert.match(hookCode, /files\/\$\{type\}\/facets/);
  assert.match(hookCode, /\}, \[type, filterKey\]\)/,
    "depending on `page` would change the dropdown options as the operator pages");
});

/* The export loops live in the page, not the hook: the hook owns one page of
 * one type, while an export spans every page and (for "all") every type. */
check("the export path pages through at limit 100 and is capped", () => {
  assert.match(pageCode, /limit:\s*100/, "exports page through rather than asking for everything");
  assert.match(pageCode, /EXPORT_PAGE_CAP/, "a runaway loop is bounded");
  assert.match(pageCode, /const EXPORT_PAGE_CAP = \d+/, "the cap is a named constant");
});

check("reaching the export cap raises, and never returns a short file", () => {
  // Both loops must test the cap and then throw — a spreadsheet quietly missing
  // rows is worse than a failed download.
  const loops = pageCode.match(/while \(page <= pages && page <= EXPORT_PAGE_CAP\);[\s\S]{0,400}?\n  \}, \[/g) || [];
  assert.equal(loops.length, 2, `expected both export loops, found ${loops.length}`);
  for (const loop of loops) {
    assert.match(loop, /if \(page <= pages\)/, "the cap is detected");
    assert.match(loop, /throw new Error/, "and raised, not swallowed");
  }
});

check("a failed export is not answered with empty arrays", () => {
  const m = /const fetchAllFilesAll = useCallback\([\s\S]*?\n  \}, \[/.exec(pageCode);
  assert.ok(m, "fetchAllFilesAll not found");
  assert.ok(!/return \{ pending: \[\], approved: \[\], rejected: \[\] \}/.test(m[0]),
    "returning empty arrays would write an empty spreadsheet that looked successful");
  assert.match(m[0], /throw err/, "the error reaches handleExport instead");
});

check("the hook carries no unused export helper", () => {
  // fetchAllMatching had no caller; dead code that looks load-bearing is a
  // maintenance trap, and the real export path is asserted above.
  assert.ok(!hookCode.includes("fetchAllMatching"),
    "fetchAllMatching is dead code — the page owns the export loops");
});

console.log("\nsorting is the server's, and the UI does not pretend otherwise");

check("only createdAt is sortable — every other column is inert", () => {
  // With manualSorting on, a sortable header the server ignores shows an arrow
  // and reorders nothing. Each column block runs from its own declaration to
  // the start of the next one, so a JSX cell of any length is covered.
  const starts = [...tableCode.matchAll(/\n    \{\n      (?:accessorKey|id): "([A-Za-z]+)"/g)];
  assert.ok(starts.length >= 8, `expected the full column set, found ${starts.length}`);

  const blockFor = (name) => {
    const i = starts.findIndex((s) => s[1] === name);
    assert.notEqual(i, -1, `column ${name} not found`);
    const from = starts[i].index;
    const to = i + 1 < starts.length ? starts[i + 1].index : tableCode.length;
    return tableCode.slice(from, to);
  };

  for (const col of ["formId", "applicantName", "dealerName", "branch", "district", "stage"]) {
    assert.match(blockFor(col), /enableSorting: false/, `${col} must not look sortable`);
  }
  assert.ok(!/enableSorting: false/.test(blockFor("createdAt")),
    "createdAt stays sortable — the server does support it");
});

check("the createdAt header is wired to the server's dir, not to TanStack state", () => {
  assert.match(tableCode, /state: \{ rowSelection, sorting \}/, "sorting is controlled");
  assert.match(tableCode, /onSortingChange: handleSortingChange/);
  assert.match(tableCode, /files\.setDir\(/, "the header sets the server parameter");
  assert.match(tableCode, /id: "createdAt", desc: files\.dir !== "asc"/,
    "the arrow reflects the direction actually in force");
});

console.log("\nthe table no longer filters or pages in the browser");

check("TanStack is in manual mode for all three", () => {
  for (const flag of ["manualSorting: true", "manualFiltering: true", "manualPagination: true"]) {
    assert.ok(tableCode.includes(flag), `missing ${flag}`);
  }
  assert.match(tableCode, /pageCount: files\.pages/);
});

check("the client row models are gone", () => {
  for (const m of ["getPaginationRowModel", "getFilteredRowModel", "getSortedRowModel"]) {
    assert.ok(!tableCode.includes(m), `${m} would re-page or re-sort only the loaded rows`);
  }
});

check("no client-side narrowing of the rows remains", () => {
  assert.ok(!/data = data\.filter\(/.test(tableCode),
    "filtering 50 loaded rows out of thousands reads as data loss");
  assert.match(tableCode, /const filteredData = allFiles;/);
  assert.match(tableCode, /const totalFiltered = files\.total;/,
    "the count must be the server's, not the page length");
});

check("filter options come from the facets endpoint", () => {
  assert.match(tableCode, /const branchOptions = files\.facets\.branches/);
  assert.match(tableCode, /const districtOptions = files\.facets\.districts/);
  assert.match(tableCode, /const stageOptions = files\.facets\.stages/);
  assert.ok(!/new Set\(allFiles\.map/.test(tableCode),
    "deriving options from the page would offer only what is on it");
});

check("pagination controls drive the server, not the table", () => {
  for (const m of ["table.nextPage(", "table.previousPage(", "table.setPageIndex(", "table.setPageSize("]) {
    assert.ok(!tableCode.includes(m), `${m} would page the loaded rows only`);
  }
  assert.match(tableCode, /files\.setPage\(/);
  assert.match(tableCode, /files\.setPageSize\(/);
});

console.log("\nbulk selection is safe across pages");

check("an explicit selection keeps the row object, so it survives paging", () => {
  assert.match(tableCode, /selectedById/);
  assert.match(tableCode, /map\.set\(id, row\)/,
    "the row must be captured when ticked — it will not be loaded later");
});

check("select-all-matching sends the filter and a count, never ids", () => {
  assert.match(tableCode, /selectAllMatching\s*\n?\s*\?\s*\{ filter: \{ type: filesTab, \.\.\.files\.filterParams \}, expectedCount: totalFiltered \}/,
    "the server must rebuild the same filter the list used");
});

check("the two selection modes are mutually exclusive", () => {
  assert.match(tableCode, /setSelectAllMatching\(false\)/);
  assert.match(tableCode, /useEffect\(\(\) => \{ setSelectAllMatching\(false\); \}, \[files\.filterParams\]\)/,
    "'all 137 matching' is meaningless once the filter moves");
});

check("the UI refuses to submit more than the server will run", () => {
  assert.match(tableCode, /overBulkLimit\s*=\s*selectAllMatching && totalFiltered > MAX_BULK/);
  assert.ok(tableCode.includes("disabled={bulkBusy || overBulkLimit}"),
    "the approve/reject buttons must be disabled over the limit");
});

check("the 409 and 413 guard rails are surfaced distinctly", () => {
  assert.match(tableCode, /status === 409/);
  assert.match(tableCode, /status === 413/);
});

console.log("\nnothing downloads the whole corpus any more");

check("the dashboard no longer holds the three full arrays", () => {
  for (const gone of ["rawData", "applyDateFilter", "filteredPending", "filteredApproved", "filteredRejected"]) {
    assert.ok(!pageCode.includes(gone), `${gone} still present — the full download is still there`);
  }
});

check("stat tiles come from the counts endpoint, date range included", () => {
  assert.match(pageCode, /dashboard\/stats/);
  assert.match(pageCode, /params\.from = toIsoDay\(rangeFrom\)/);
  assert.match(pageCode, /params\.to\s*=\s*toIsoDay\(rangeTo\)/);
  assert.match(pageCode, /const pending\s*=\s*counts\.pending/);
});

check("the local-day helper is used, not toISOString", () => {
  // toISOString() would shift the day backwards east of UTC, moving the range.
  assert.match(pageCode, /const toIsoDay/);
  assert.ok(!/toISOString\(\)\.slice\(0, ?10\)/.test(pageCode), "no UTC day truncation");
});

check("every remaining files request is paginated", () => {
  const calls = pageCode.match(/superadmin\/files\/[^\n]*/g) || [];
  assert.ok(calls.length > 0, "the endpoint is still used");
  for (const c of calls) {
    // Each call site must be followed by a params object carrying page.
    const idx = pageCode.indexOf(c);
    const window = pageCode.slice(idx, idx + 260);
    assert.match(window, /page/, `an unpaginated call remains: ${c.slice(0, 60)}`);
  }
});

check("no three-way parallel full fetch remains", () => {
  assert.ok(!/API\.get\("\/superadmin\/files\/pending",\s*\{\s*headers\s*\}\)/.test(pageCode),
    "the original unbounded Promise.all is gone");
});

console.log(
  `\n${process.exitCode ? "FAILED" : "PASSED"} — ${passed} checks` +
    (process.exitCode ? "" : ", 0 failures")
);
