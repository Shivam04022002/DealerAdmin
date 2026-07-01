import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useRef, useMemo } from 'react';
import API from '../services/api';

const ENDPOINTS = {
  pending:  '/workflow/pending',
  approved: '/workflow/applications/approved',
  rejected: '/workflow/applications/rejected',
};

// staleTime per type:
//   pending  — 20s: new submissions must surface quickly
//   approved/rejected — 60s: finalized records change rarely
const STALE_TIMES = { pending: 20_000, approved: 60_000, rejected: 60_000 };

// Auto-refetch interval — only for pending (15s background poll)
const REFETCH_INTERVALS = { pending: 15_000, approved: false, rejected: false };

/**
 * Shared hook for all three application list pages.
 *
 * @param {'pending'|'approved'|'rejected'} type
 * @param {number} defaultLimit  rows per page (default 50)
 */
export function useApplications(type, defaultLimit = 50) {
  const [page, setPage]     = useState(1);
  const [search, setSearch] = useState('');
  const [branch, setBranch] = useState('');
  const [stage, setStage]   = useState('');

  const debounceRef = useRef(null);

  // Debounced search — fires 300ms after last keystroke
  const handleSearchChange = useCallback((value) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 300);
  }, []);

  const handleBranchChange = useCallback((value) => {
    setBranch(value);
    setPage(1);
  }, []);

  const handleStageChange = useCallback((value) => {
    setStage(value);
    setPage(1);
  }, []);

  // Stable query key — memoized so object reference only changes when values change.
  // Prevents TanStack Query from seeing a "new" key on every render.
  const queryKey = useMemo(
    () => [type, { page, search, branch, stage, limit: defaultLimit }],
    [type, page, search, branch, stage, defaultLimit],
  );

  // Stable queryFn — useCallback ensures the function reference is stable
  // across renders when its captured variables haven't changed, preventing
  // TanStack Query from scheduling redundant background refetches.
  const queryFn = useCallback(async () => {
    const t0 = performance.now();
    const params = { page, limit: defaultLimit };
    if (search) params.search = search;
    if (branch) params.branch = branch;
    if (stage && type === 'pending') params.stage = stage;

    const { data } = await API.get(ENDPOINTS[type], { params });

    const ms = Math.round(performance.now() - t0);
    console.log(`[RQ] ${type} page=${page} → ${data.total} total, ${data.items?.length} items, ${ms}ms`);
    return data;
  }, [type, page, search, branch, stage, defaultLimit]);

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey,
    queryFn,
    placeholderData: (prev) => prev,   // keep previous page visible while fetching next
    staleTime: STALE_TIMES[type],
    // pending auto-polls every 15s so new applications appear without manual refresh.
    // approved/rejected poll is disabled — they rarely change.
    refetchInterval: REFETCH_INTERVALS[type],
    // Re-fetch when the user returns to the tab — catches changes made in other tabs.
    refetchOnWindowFocus: type === 'pending',
  });

  return {
    items:    data?.items   ?? [],
    total:    data?.total   ?? 0,
    pages:    data?.pages   ?? 1,
    page,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    setPage,
    handleSearchChange,
    handleBranchChange,
    handleStageChange,
    // Expose queryKey so callers can imperatively invalidate (e.g. after approve/reject)
    queryKey,
  };
}

/**
 * usePendingQueryKey()
 *
 * Returns the base query key prefix for pending applications.
 * Use with queryClient.invalidateQueries({ queryKey: ['pending'] })
 * to immediately refetch after a merge, approve, or reject action.
 */
export function usePendingInvalidate() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['pending'] });
  }, [queryClient]);
}
