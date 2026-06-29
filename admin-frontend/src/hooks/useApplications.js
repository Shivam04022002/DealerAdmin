import { useQuery } from '@tanstack/react-query';
import { useState, useCallback, useRef } from 'react';
import API from '../services/api';

const ENDPOINTS = {
  pending:  '/workflow/pending',
  approved: '/workflow/applications/approved',
  rejected: '/workflow/applications/rejected',
};

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

  const queryKey = [type, { page, search, branch, stage, limit: defaultLimit }];

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const t0 = performance.now();
      const params = { page, limit: defaultLimit };
      if (search) params.search = search;
      if (branch) params.branch = branch;
      if (stage && type === 'pending') params.stage = stage;

      const { data } = await API.get(ENDPOINTS[type], { params });

      const ms = Math.round(performance.now() - t0);
      console.log(`[RQ] ${type} page=${page} → ${data.total} total, ${data.items?.length} items, ${ms}ms`);
      return data;
    },
    placeholderData: (prev) => prev, // keep previous page visible while loading next
    staleTime: 30_000,
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
  };
}
