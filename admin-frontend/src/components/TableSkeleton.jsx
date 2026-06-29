/**
 * Skeleton loader for application list tables.
 * Renders `rows` shimmer rows with `cols` cells each.
 */
export default function TableSkeleton({ rows = 10, cols = 6 }) {
  return (
    <div className="table-responsive">
      <table className="table table-striped align-middle mb-0">
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c}>
                  <div
                    className="rounded"
                    style={{
                      height: '1rem',
                      width: c === 0 ? '6rem' : c === cols - 1 ? '4rem' : '100%',
                      background: 'linear-gradient(90deg, #e9ecef 25%, #dee2e6 50%, #e9ecef 75%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.4s infinite',
                    }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
