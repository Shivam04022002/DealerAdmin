import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import API from "../services/api";

/**
 * useSuperAdminFiles — server-driven state for the Super Admin file lists.
 *
 * The dashboard used to download every pending, approved and rejected record
 * and then search, filter, sort and paginate them in the browser. That is what
 * made the old Admin slow at ~1,000 records and time out at ~1,500, and at
 * 500–700 new files a month it was months away from returning.
 *
 * Every one of those decisions now belongs to the server. This hook owns the
 * query state, asks for one page at a time, and hands the table exactly what it
 * needs to render — nothing more is ever in memory.
 *
 * The filter object it builds is also what a bulk action sends, so "approve
 * everything matching" is defined by the same criteria the operator was looking
 * at. See MAX_BULK on the server for why that is capped.
 */

export const PAGE_SIZES = [25, 50, 100];
export const DEFAULT_PAGE_SIZE = 50;
/** Mirrors MAX_BULK in admin-backend/utils/filesQuery.js. Kept in step manually. */
export const MAX_BULK = 200;

const EMPTY_FACETS = { branches: [], districts: [], stages: [] };

/** Only the keys the server understands as filters — never paging or sort. */
const filterParamsOf = ({ search, branch, district, stage, from, to }) => {
  const p = {};
  if (search) p.search = search;
  if (branch) p.branch = branch;
  if (district) p.district = district;
  if (stage) p.stage = stage;
  if (from) p.from = from;
  if (to) p.to = to;
  return p;
};

export default function useSuperAdminFiles(type = "pending") {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Sort direction on createdAt. The server sorts by createdAt and nothing
  // else — it is the only field indexed for it — so this is a direction, not a
  // column choice. It is kept out of `filterParams` because it does not change
  // WHICH records match, only their order: a bulk action built from the filter
  // must not be affected by it.
  const [dir, setDir] = useState("desc");

  // `search` is what the box shows; `searchQuery` is what has been sent. The
  // split is what stops a request per keystroke.
  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [branch, setBranch] = useState("");
  const [district, setDistrict] = useState("");
  const [stage, setStage] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [facets, setFacets] = useState(EMPTY_FACETS);

  const debounceRef = useRef(null);
  // Guards against a slow earlier request landing after a newer one and
  // repainting the table with stale rows.
  const requestRef = useRef(0);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(search.trim()), 350);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const filterParams = useMemo(
    () => filterParamsOf({ search: searchQuery, branch, district, stage, from, to }),
    [searchQuery, branch, district, stage, from, to]
  );
  // Stable identity for the effect dependency, so an unchanged filter object
  // does not refetch on every render.
  const filterKey = JSON.stringify(filterParams);

  // Any change to what is being asked for puts the user back on page 1 —
  // otherwise a filter that yields two pages leaves them stranded on page 7
  // looking at an empty table.
  useEffect(() => { setPage(1); }, [filterKey, type, pageSize, dir]);

  const fetchPage = useCallback(async () => {
    const id = ++requestRef.current;
    setLoading(true);
    setError("");
    try {
      const { data } = await API.get(`/superadmin/files/${type}`, {
        params: { ...filterParams, page, limit: pageSize, dir },
      });
      if (id !== requestRef.current) return;      // superseded
      setItems(Array.isArray(data?.items) ? data.items : []);
      setTotal(Number(data?.total) || 0);
      setPages(Number(data?.pages) || 1);
    } catch (err) {
      if (id !== requestRef.current) return;
      console.error(`Failed to load ${type} files`, err?.response?.data || err.message);
      setItems([]); setTotal(0); setPages(1);
      setError(err?.response?.data?.message || "Could not load files.");
    } finally {
      if (id === requestRef.current) setLoading(false);
    }
    // filterParams is covered by filterKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, page, pageSize, dir, filterKey]);

  useEffect(() => { fetchPage(); }, [fetchPage]);

  // Facets follow the filter but not the page: the options offered must not
  // change as the operator pages through.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await API.get(`/superadmin/files/${type}/facets`, { params: filterParams });
        if (!cancelled) {
          setFacets({
            branches: data?.branches || [],
            districts: data?.districts || [],
            stages: data?.stages || [],
          });
        }
      } catch {
        if (!cancelled) setFacets(EMPTY_FACETS);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, filterKey]);

  const resetFilters = useCallback(() => {
    setSearch(""); setSearchQuery(""); setBranch(""); setDistrict(""); setStage("");
    setFrom(""); setTo(""); setPage(1);
  }, []);

  return {
    // query state
    page, setPage, pageSize, setPageSize,
    dir, setDir,
    search, setSearch,
    branch, setBranch, district, setDistrict, stage, setStage,
    from, setFrom, to, setTo,
    resetFilters,
    // what the server said
    items, total, pages, loading, error, facets,
    // for bulk + export
    filterParams, refresh: fetchPage,
  };
}
