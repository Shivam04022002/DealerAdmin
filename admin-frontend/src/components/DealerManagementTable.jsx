// src/components/DealerManagementTable.jsx
import React, {
  useState, useMemo, useCallback, useRef, useEffect,
} from "react";
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  getFilteredRowModel, getPaginationRowModel, flexRender,
} from "@tanstack/react-table";

/* ─── helpers ─────────────────────────────────────────────── */
function fmtDate(raw) {
  if (!raw) return "—";
  const d = new Date(raw);
  return isNaN(d) ? "—" : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDateTime(raw) {
  if (!raw) return "—";
  const d = new Date(raw);
  return isNaN(d) ? "—" : d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function csvEscape(v) {
  const s = String(v ?? "").replace(/"/g, '""');
  return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
}
function exportToCSV(rows) {
  const headers = ["Name","UserID","Email","District","Branch","Mobile","Status","Created"];
  const lines = [
    headers.join(","),
    ...rows.map(r => [
      r.name, r.UserId, r.email, r.District, r.Branch,
      r.mobileNumber || r.Contact, r.isActive !== false ? "Active" : "Inactive",
      r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-IN") : "",
    ].map(csvEscape).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "dealers.csv"; a.click();
  URL.revokeObjectURL(url);
}

/* ─── Dealer Detail Drawer ────────────────────────────────── */
function DealerDrawer({ dealer, onClose, onEdit, onToggle, onDelete, busy }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  const handleClose = () => { setVisible(false); setTimeout(onClose, 260); };
  const isActive = dealer.isActive !== false;

  return (
    <>
      <div style={{ ...DS.backdrop, opacity: visible ? 1 : 0 }} onClick={handleClose} />
      <div style={{ ...DS.drawer, transform: visible ? "translateX(0)" : "translateX(100%)" }}>
        {/* Header */}
        <div style={DS.drawerHdr}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={DS.avatar}>{(dealer.name || "D")[0].toUpperCase()}</div>
            <div>
              <div style={DS.drawerName}>{dealer.name || "—"}</div>
              <div style={DS.brandTag}>Surjit Finance · Dealer</div>
            </div>
          </div>
          <button style={DS.closeBtn} onClick={handleClose}>✕</button>
        </div>

        <div style={DS.drawerBody}>
          {/* Status badge */}
          <div style={{ marginBottom: 20 }}>
            <span style={{ ...DS.statusBadge, ...(isActive ? DS.badgeActive : DS.badgeInactive) }}>
              {isActive ? "● Active" : "● Inactive"}
            </span>
          </div>

          {/* Info grid */}
          <Section title="Contact Information">
            <InfoRow icon="🆔" label="User ID"       value={dealer.UserId} />
            <InfoRow icon="📧" label="Email"          value={dealer.email} />
            <InfoRow icon="📱" label="Mobile"         value={dealer.mobileNumber || dealer.Contact} />
          </Section>

          <Section title="Location">
            <InfoRow icon="🏙️" label="District"      value={dealer.District} />
            <InfoRow icon="🏪" label="Branch"         value={dealer.Branch} />
          </Section>

          <Section title="Activity Summary">
            <InfoRow icon="📅" label="Created"        value={fmtDate(dealer.createdAt)} />
            <InfoRow icon="🕐" label="Last Login"     value={fmtDateTime(dealer.lastLoginAt)} />
            <InfoRow icon="⚡" label="Last Active"    value={fmtDateTime(dealer.lastActive)} />
          </Section>

          <Section title="Applications">
            <InfoRow icon="📁" label="Total Files"    value={dealer.totalApplications ?? "—"} />
            <InfoRow icon="✅" label="Approved"        value={dealer.approvedApplications ?? "—"} />
            <InfoRow icon="❌" label="Rejected"        value={dealer.rejectedApplications ?? "—"} />
            <InfoRow icon="⏳" label="Pending"         value={dealer.pendingApplications ?? "—"} />
          </Section>

          {/* Actions */}
          <div style={DS.drawerActions}>
            <button style={{ ...DS.daBtn, ...DS.daBtnBlue }} onClick={() => { handleClose(); onEdit(dealer); }}>
              ✏️ Edit
            </button>
            <button
              style={{ ...DS.daBtn, ...(isActive ? DS.daBtnAmber : DS.daBtnGreen) }}
              onClick={() => onToggle(dealer._id, isActive)}
              disabled={busy}
            >
              {isActive ? "⏸ Deactivate" : "▶ Activate"}
            </button>
            <button style={{ ...DS.daBtn, ...DS.daBtnRed }} onClick={() => onDelete(dealer._id)} disabled={busy}>
              🗑 Delete
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes _spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

function Section({ title, children }) {
  return (
    <div style={DS.section}>
      <div style={DS.sectionTitle}>{title}</div>
      {children}
    </div>
  );
}
function InfoRow({ icon, label, value }) {
  return (
    <div style={DS.infoRow}>
      <span style={DS.infoIcon}>{icon}</span>
      <span style={DS.infoLabel}>{label}</span>
      <span style={DS.infoValue}>{value || "—"}</span>
    </div>
  );
}

/* ─── Main Component ──────────────────────────────────────── */
export default function DealerManagementTable({
  dealers = [], loading = false, busy = false,
  onEdit, onToggle, onDelete, onBulkToggle, onBulkDelete,
  branchOptions = [],
}) {
  /* ── state ── */
  const [globalFilter, setGlobalFilter]   = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [branchFilter, setBranchFilter]   = useState("");
  const [statusFilter, setStatusFilter]   = useState("");          // "" | "active" | "inactive"
  const [sorting, setSorting]             = useState([]);
  const [rowSelection, setRowSelection]   = useState({});
  const [pageSize, setPageSize]           = useState(25);
  const [drawerDealer, setDrawerDealer]   = useState(null);

  /* ── derived option lists ── */
  const districtOptions = useMemo(() =>
    [...new Set(dealers.map(d => d.District).filter(Boolean))].sort(), [dealers]);
  const branchOptionsFull = useMemo(() =>
    [...new Set([...branchOptions, ...dealers.map(d => d.Branch).filter(Boolean)])].sort(), [dealers, branchOptions]);

  /* ── pre-filter (status + district + branch) ── */
  const data = useMemo(() => {
    let list = dealers;
    if (statusFilter === "active")   list = list.filter(d => d.isActive !== false);
    if (statusFilter === "inactive") list = list.filter(d => d.isActive === false);
    if (districtFilter) list = list.filter(d => d.District === districtFilter);
    if (branchFilter)   list = list.filter(d => d.Branch === branchFilter);
    return list;
  }, [dealers, statusFilter, districtFilter, branchFilter]);

  /* ── stats ── */
  const stats = useMemo(() => ({
    total:    dealers.length,
    active:   dealers.filter(d => d.isActive !== false).length,
    inactive: dealers.filter(d => d.isActive === false).length,
    apps:     dealers.reduce((s, d) => s + (d.totalApplications ?? 0), 0),
  }), [dealers]);

  /* ── column definitions ── */
  const columns = useMemo(() => [
    {
      id: "select",
      header: ({ table }) => (
        <input type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
          style={{ accentColor: "#2563eb", cursor: "pointer" }}
        />
      ),
      cell: ({ row }) => (
        <input type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          onClick={e => e.stopPropagation()}
          style={{ accentColor: "#2563eb", cursor: "pointer" }}
        />
      ),
      enableSorting: false, size: 40,
    },
    {
      accessorKey: "name",
      header: "Dealer Name",
      cell: ({ row }) => (
        <div>
          <div style={{ fontWeight: 700, color: "#111827", fontSize: 13 }}>{row.original.name || "—"}</div>
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{row.original.email}</div>
        </div>
      ),
      size: 200,
    },
    {
      accessorKey: "UserId",
      header: "User ID",
      cell: ({ getValue }) => (
        <span style={{ fontWeight: 700, color: "#2563eb", fontSize: 12, fontFamily: "monospace" }}>
          {getValue() || "—"}
        </span>
      ),
      size: 110,
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ getValue }) => <span style={{ fontSize: 12, color: "#374151" }}>{getValue() || "—"}</span>,
      size: 200,
    },
    {
      accessorKey: "District",
      header: "District",
      cell: ({ getValue }) => <span style={{ fontSize: 13 }}>{getValue() || "—"}</span>,
      size: 120,
    },
    {
      accessorKey: "Branch",
      header: "Branch",
      cell: ({ getValue }) => (
        <span style={T.branchPill}>{getValue() || "—"}</span>
      ),
      size: 130,
    },
    {
      id: "mobile",
      accessorFn: row => row.mobileNumber || row.Contact || "",
      header: "Mobile",
      cell: ({ getValue }) => <span style={{ fontSize: 12, fontFamily: "monospace" }}>{getValue() || "—"}</span>,
      size: 120,
    },
    {
      id: "status",
      accessorFn: row => row.isActive !== false ? "Active" : "Inactive",
      header: "Status",
      cell: ({ row }) => {
        const a = row.original.isActive !== false;
        return <span style={{ ...T.statusPill, ...(a ? T.pillActive : T.pillInactive) }}>{a ? "Active" : "Inactive"}</span>;
      },
      size: 90,
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ getValue }) => <span style={{ fontSize: 12, color: "#6b7280" }}>{fmtDate(getValue())}</span>,
      size: 110,
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: ({ row }) => {
        const d = row.original;
        const isActive = d.isActive !== false;
        return (
          <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
            <ActionBtn color="#2563eb" bg="#dbeafe" onClick={() => setDrawerDealer(d)} title="View">👁</ActionBtn>
            <ActionBtn color="#6b7280" bg="#f1f5f9" onClick={() => onEdit(d)} title="Edit">✏️</ActionBtn>
            <ActionBtn
              color={isActive ? "#b45309" : "#16a34a"}
              bg={isActive ? "#fef3c7" : "#dcfce7"}
              onClick={() => onToggle(d._id, isActive)}
              disabled={busy}
              title={isActive ? "Deactivate" : "Activate"}
            >
              {isActive ? "⏸" : "▶"}
            </ActionBtn>
            <ActionBtn color="#dc2626" bg="#fee2e2" onClick={() => onDelete(d._id)} disabled={busy} title="Delete">🗑</ActionBtn>
          </div>
        );
      },
      size: 130,
    },
  ], [busy, onEdit, onToggle, onDelete]);

  /* ── table instance ── */
  const table = useReactTable({
    data,
    columns,
    // Track selection by dealer id, not row index — otherwise filtering/sorting
    // reorders rows and the selection lands on the wrong dealer.
    getRowId: (row) => row._id,
    state: { globalFilter, sorting, rowSelection, pagination: { pageIndex: 0, pageSize } },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, _colId, filterValue) => {
      const q = filterValue.toLowerCase();
      const { name, UserId, email, mobileNumber, Contact } = row.original;
      return [name, UserId, email, mobileNumber, Contact]
        .filter(Boolean).some(v => String(v).toLowerCase().includes(q));
    },
    enableRowSelection: true,
    manualPagination: false,
  });

  // rowSelection is now keyed by dealer id (getRowId), so the selected keys are
  // the ids directly — stable across filtering, sorting and pagination.
  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k]);

  /* ── bulk export ── */
  const handleBulkExport = () => {
    const byId = new Map(data.map((d) => [d._id, d]));
    const rows = selectedIds.length
      ? selectedIds.map((id) => byId.get(id)).filter(Boolean)
      : table.getFilteredRowModel().rows.map(r => r.original);
    exportToCSV(rows);
  };

  /* ── page rows ── */
  const pageRows = table.getPaginationRowModel().rows;
  const totalFiltered = table.getFilteredRowModel().rows.length;
  const totalPages = table.getPageCount();
  const pageIndex = table.getState().pagination.pageIndex;

  /* ─── render ─────────────────────────────────────────────── */
  return (
    <div style={T.wrap}>
      <style>{`
        .dt-row:hover { background: #f8fafc !important; }
        .dt-th-sort:hover { background: #f1f5f9; cursor: pointer; }
        .dt-sort-icon { display: inline-block; margin-left: 4px; font-size: 10px; opacity: 0.5; }
        .dt-sort-icon.asc { opacity: 1; color: #2563eb; }
        .dt-sort-icon.desc { opacity: 1; color: #2563eb; }
        input[type=checkbox] { width: 15px; height: 15px; }
        ::-webkit-scrollbar { height: 6px; width: 6px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
      `}</style>

      {/* ── Stats Cards ─────────────────────────────────────── */}
      <div style={T.statsRow}>
        <StatCard label="Total Dealers"    value={stats.total}    color="#2563eb" bg="#dbeafe" active={!statusFilter} onClick={() => setStatusFilter("")} />
        <StatCard label="Active Dealers"   value={stats.active}   color="#16a34a" bg="#dcfce7" active={statusFilter === "active"} onClick={() => setStatusFilter(f => f === "active" ? "" : "active")} />
        <StatCard label="Inactive Dealers" value={stats.inactive} color="#dc2626" bg="#fee2e2" active={statusFilter === "inactive"} onClick={() => setStatusFilter(f => f === "inactive" ? "" : "inactive")} />
        <StatCard label="Total Applications" value={stats.apps}  color="#7c3aed" bg="#ede9fe" />
      </div>

      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div style={T.toolbar}>
        {/* Search */}
        <div style={T.searchWrap}>
          <span style={T.searchIcon}>🔍</span>
          <input
            style={T.searchInput}
            placeholder="Search name, user ID, email, mobile…"
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
          />
          {globalFilter && (
            <button style={T.clearSearch} onClick={() => setGlobalFilter("")}>✕</button>
          )}
        </div>

        {/* Filters */}
        <select style={T.filterSelect} value={districtFilter} onChange={e => setDistrictFilter(e.target.value)}>
          <option value="">All Districts</option>
          {districtOptions.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select style={T.filterSelect} value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
          <option value="">All Branches</option>
          {branchOptionsFull.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <select style={T.filterSelect} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        {/* Result count */}
        <span style={T.resultCount}>{totalFiltered} dealers</span>

        {/* Bulk actions (visible when rows are selected) */}
        {selectedIds.length > 0 && (
          <div style={T.bulkActions}>
            <span style={T.bulkCount}>{selectedIds.length} selected</span>
            <BulkBtn color="#16a34a" onClick={() => onBulkToggle(selectedIds, true)}>Activate</BulkBtn>
            <BulkBtn color="#b45309" onClick={() => onBulkToggle(selectedIds, false)}>Deactivate</BulkBtn>
            <BulkBtn color="#2563eb" onClick={handleBulkExport}>Export</BulkBtn>
            <BulkBtn color="#dc2626" onClick={() => onBulkDelete(selectedIds)}>Delete</BulkBtn>
          </div>
        )}

        {/* Export all */}
        <button style={T.exportBtn} onClick={handleBulkExport} title="Export CSV">
          ⬇ Export
        </button>
      </div>

      {/* ── Table container ─────────────────────────────────── */}
      <div style={T.tableWrap}>
        {loading ? (
          <div style={T.emptyState}>
            <div style={T.spinner} />
            <span style={{ color: "#64748b", fontSize: 14 }}>Loading dealers…</span>
          </div>
        ) : pageRows.length === 0 ? (
          <div style={T.emptyState}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🏪</div>
            <div style={{ fontWeight: 700, color: "#64748b" }}>No dealers found</div>
            <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>Try adjusting your filters or search query</div>
          </div>
        ) : (
          <table style={T.table}>
            {/* Sticky header */}
            <thead>
              {table.getHeaderGroups().map(hg => (
                <tr key={hg.id}>
                  {hg.headers.map(header => {
                    const sorted = header.column.getIsSorted();
                    return (
                      <th
                        key={header.id}
                        className={header.column.getCanSort() ? "dt-th-sort" : ""}
                        style={{
                          ...T.th,
                          width: header.column.columnDef.size,
                          minWidth: header.column.columnDef.size,
                          userSelect: "none",
                        }}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <span className={`dt-sort-icon${sorted ? " " + sorted : ""}`}>
                            {sorted === "asc" ? "▲" : sorted === "desc" ? "▼" : "⇅"}
                          </span>
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {pageRows.map((row, ri) => (
                <tr
                  key={row.id}
                  className="dt-row"
                  style={{
                    ...T.tr,
                    background: ri % 2 === 0 ? "#fff" : "#fafbfc",
                    cursor: "pointer",
                  }}
                  onClick={() => setDrawerDealer(row.original)}
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} style={T.td}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ──────────────────────────────────────── */}
      {totalFiltered > 0 && (
        <div style={T.pagination}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={T.pageInfo}>Rows per page:</span>
            <select
              style={T.pageSizeSelect}
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); table.setPageSize(Number(e.target.value)); }}
            >
              {[25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <span style={T.pageInfo}>
            {pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, totalFiltered)} of {totalFiltered}
          </span>

          <div style={{ display: "flex", gap: 4 }}>
            <PageBtn onClick={() => table.setPageIndex(0)}       disabled={!table.getCanPreviousPage()}>«</PageBtn>
            <PageBtn onClick={() => table.previousPage()}        disabled={!table.getCanPreviousPage()}>‹ Prev</PageBtn>
            {/* Page number pills */}
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let p = i;
              if (totalPages > 7) {
                if (pageIndex <= 3) p = i;
                else if (pageIndex >= totalPages - 4) p = totalPages - 7 + i;
                else p = pageIndex - 3 + i;
              }
              return (
                <PageBtn key={p} onClick={() => table.setPageIndex(p)} active={pageIndex === p}>{p + 1}</PageBtn>
              );
            })}
            <PageBtn onClick={() => table.nextPage()}            disabled={!table.getCanNextPage()}>Next ›</PageBtn>
            <PageBtn onClick={() => table.setPageIndex(totalPages - 1)} disabled={!table.getCanNextPage()}>»</PageBtn>
          </div>
        </div>
      )}

      {/* ── Dealer Detail Drawer ─────────────────────────────── */}
      {drawerDealer && (
        <DealerDrawer
          dealer={drawerDealer}
          onClose={() => setDrawerDealer(null)}
          onEdit={d => { setDrawerDealer(null); onEdit(d); }}
          onToggle={(id, isActive) => { onToggle(id, isActive); setDrawerDealer(null); }}
          onDelete={id => { onDelete(id); setDrawerDealer(null); }}
          busy={busy}
        />
      )}
    </div>
  );
}

/* ─── tiny sub-components ────────────────────────────────── */
function StatCard({ label, value, color, bg, active, onClick }) {
  return (
    <div
      style={{
        ...T.statCard,
        background: bg,
        outline: active ? `2px solid ${color}` : "none",
        cursor: onClick ? "pointer" : "default",
      }}
      onClick={onClick}
    >
      <div style={{ ...T.statValue, color }}>{value ?? 0}</div>
      <div style={T.statLabel}>{label}</div>
    </div>
  );
}
function ActionBtn({ children, color, bg, onClick, disabled, title }) {
  return (
    <button
      style={{ ...T.actionBtn, color, background: bg }}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}
function BulkBtn({ children, color, onClick }) {
  return (
    <button style={{ ...T.bulkBtn, color, borderColor: color + "44", background: color + "11" }} onClick={onClick}>
      {children}
    </button>
  );
}
function PageBtn({ children, onClick, disabled, active }) {
  return (
    <button
      style={{
        ...T.pageBtn,
        ...(active ? { background: "#2563eb", color: "#fff", borderColor: "#2563eb" } : {}),
        ...(disabled ? { opacity: 0.4, cursor: "not-allowed" } : {}),
      }}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

/* ─── Styles ─────────────────────────────────────────────── */
const T = {
  wrap: { display: "flex", flexDirection: "column", gap: 14, fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" },

  statsRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 },
  statCard: { borderRadius: 12, padding: "14px 18px", transition: "outline 0.15s", border: "1px solid rgba(0,0,0,0.04)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" },
  statValue: { fontSize: 28, fontWeight: 800, lineHeight: 1 },
  statLabel: { fontSize: 12, fontWeight: 600, color: "#475569", marginTop: 4 },

  toolbar: {
    display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
    background: "#fff", padding: "12px 16px", borderRadius: 12,
    border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  },
  searchWrap: { position: "relative", flex: "1 1 200px", minWidth: 160 },
  searchIcon: { position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, pointerEvents: "none" },
  searchInput: {
    width: "100%", border: "1px solid #e2e8f0", borderRadius: 8,
    padding: "8px 28px 8px 30px", fontSize: 13, outline: "none",
    background: "#f8fafc", color: "#1e293b", boxSizing: "border-box",
  },
  clearSearch: { position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 12 },
  filterSelect: {
    border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px",
    fontSize: 12, color: "#374151", background: "#f8fafc", outline: "none",
    cursor: "pointer", fontWeight: 600,
  },
  resultCount: { fontSize: 12, color: "#94a3b8", fontWeight: 600, whiteSpace: "nowrap" },
  bulkActions: { display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" },
  bulkCount: { fontSize: 12, fontWeight: 700, color: "#374151" },
  bulkBtn: { padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, border: "1px solid", cursor: "pointer", transition: "opacity 0.15s" },
  exportBtn: {
    padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700,
    background: "#f1f5f9", border: "1px solid #e2e8f0", color: "#374151",
    cursor: "pointer", whiteSpace: "nowrap",
  },

  tableWrap: { overflowX: "auto", borderRadius: 12, border: "1px solid #e2e8f0", background: "#fff" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: {
    position: "sticky", top: 0, zIndex: 2,
    background: "#f8fafc", padding: "10px 12px",
    textAlign: "left", fontWeight: 800, fontSize: 11,
    textTransform: "uppercase", letterSpacing: "0.05em",
    color: "#475569", borderBottom: "2px solid #e2e8f0",
    whiteSpace: "nowrap",
  },
  tr: { borderBottom: "1px solid #f1f5f9", transition: "background 0.1s" },
  td: { padding: "10px 12px", verticalAlign: "middle" },

  branchPill: {
    display: "inline-block", fontSize: 11, fontWeight: 700,
    background: "#ede9fe", color: "#7c3aed",
    padding: "2px 8px", borderRadius: 20,
  },
  statusPill: {
    display: "inline-block", fontSize: 11, fontWeight: 700,
    padding: "3px 10px", borderRadius: 20,
  },
  pillActive:   { background: "#dcfce7", color: "#16a34a" },
  pillInactive: { background: "#fee2e2", color: "#dc2626" },

  actionBtn: {
    width: 28, height: 28, borderRadius: 6, border: "none",
    fontSize: 13, cursor: "pointer", display: "inline-flex",
    alignItems: "center", justifyContent: "center",
    transition: "opacity 0.15s",
  },

  pagination: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    flexWrap: "wrap", gap: 8, padding: "10px 4px",
  },
  pageInfo: { fontSize: 12, color: "#6b7280", fontWeight: 600 },
  pageSizeSelect: {
    border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 8px",
    fontSize: 12, background: "#f8fafc", outline: "none", cursor: "pointer",
  },
  pageBtn: {
    padding: "5px 10px", borderRadius: 6, border: "1px solid #e2e8f0",
    fontSize: 12, fontWeight: 700, background: "#fff", color: "#374151",
    cursor: "pointer", transition: "all 0.1s",
  },

  emptyState: {
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", padding: "60px 24px",
  },
  spinner: {
    width: 24, height: 24, borderRadius: "50%",
    border: "3px solid #e2e8f0", borderTop: "3px solid #2563eb",
    animation: "_spin 0.7s linear infinite", marginBottom: 12,
  },
};

/* ─── Drawer styles ──────────────────────────────────────── */
const DS = {
  backdrop: {
    position: "fixed", inset: 0,
    background: "rgba(15,23,42,0.4)", backdropFilter: "blur(3px)",
    zIndex: 9000, transition: "opacity 0.26s ease",
  },
  drawer: {
    position: "fixed", top: 0, right: 0, bottom: 0,
    width: "min(480px, 96vw)", background: "#fff",
    zIndex: 9001, display: "flex", flexDirection: "column",
    boxShadow: "-6px 0 32px rgba(0,0,0,0.15)",
    transition: "transform 0.26s cubic-bezier(0.16,1,0.3,1)",
    borderRadius: "18px 0 0 18px", overflow: "hidden",
  },
  drawerHdr: {
    background: "linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 60%, #3b82f6 100%)",
    padding: "20px 20px 18px",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    flexShrink: 0,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 12,
    background: "rgba(255,255,255,0.2)", color: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 20, fontWeight: 800, flexShrink: 0,
    border: "2px solid rgba(255,255,255,0.3)",
  },
  drawerName: { fontSize: 17, fontWeight: 800, color: "#fff" },
  brandTag: { fontSize: 10, color: "rgba(255,255,255,0.7)", marginTop: 2, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" },
  closeBtn: {
    width: 32, height: 32, borderRadius: 8,
    background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)",
    color: "#fff", fontSize: 14, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  drawerBody: { flex: 1, overflowY: "auto", padding: "20px" },
  statusBadge: { display: "inline-block", fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 20 },
  badgeActive:   { background: "#dcfce7", color: "#16a34a" },
  badgeInactive: { background: "#fee2e2", color: "#dc2626" },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 },
  infoRow: { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f1f5f9" },
  infoIcon: { fontSize: 14, width: 20, textAlign: "center", flexShrink: 0 },
  infoLabel: { fontSize: 12, color: "#64748b", fontWeight: 600, width: 90, flexShrink: 0 },
  infoValue: { fontSize: 13, color: "#1e293b", fontWeight: 700, flex: 1, wordBreak: "break-all" },
  drawerActions: { display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 8, borderTop: "1px solid #e2e8f0" },
  daBtn: { flex: 1, minWidth: 100, padding: "9px 12px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "opacity 0.15s" },
  daBtnBlue:  { background: "#dbeafe", color: "#2563eb" },
  daBtnAmber: { background: "#fef3c7", color: "#b45309" },
  daBtnGreen: { background: "#dcfce7", color: "#16a34a" },
  daBtnRed:   { background: "#fee2e2", color: "#dc2626" },
};
