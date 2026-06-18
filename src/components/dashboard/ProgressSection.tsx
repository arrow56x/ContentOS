import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { usersApi } from '../../lib/api';

type ProgressRow = Record<string, string | number | null>;

interface Props {
  username: string;
}

const COLUMNS = [
  'script name',
  'raw video uploaded',
  'video edited',
  'video captioned',
  'video posting',
] as const;

const STATUS_STYLES: Record<string, string> = {
  pending:  'bg-gray-100 text-gray-500',
  done:     'bg-emerald-100 text-emerald-700',
  yes:      'bg-emerald-100 text-emerald-700',
  posted:   'bg-sky-100 text-sky-700',
  no:       'bg-red-50 text-red-500',
};

function statusChip(value: string | number | null) {
  const str = String(value ?? 'pending').toLowerCase();
  const cls = STATUS_STYLES[str] ?? 'bg-amber-50 text-amber-600';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${cls}`}>
      {str}
    </span>
  );
}

export default function ProgressSection({ username }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ProgressRow[]>([]);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchProgress = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await usersApi.loadProgress();
      setRows(result.rows);
      setLastFetched(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load progress.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load immediately on mount
  useEffect(() => {
    void fetchProgress();
  }, [fetchProgress]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const id = setInterval(() => void fetchProgress(), 30_000);
    return () => clearInterval(id);
  }, [fetchProgress]);

  return (
    <section className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/70 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[15px] font-semibold">Progress Tracker</h2>
          <p className="text-[12px] text-gray-400 mt-0.5">
            {username}, here your progress would be shown as per the videos &amp; scripts in pipeline
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastFetched && !loading && (
            <span className="text-[11px] text-gray-400">
              Updated {lastFetched.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={fetchProgress}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-gray-600 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-600 disabled:opacity-50"
          >
            {loading
              ? <Loader2 size={13} className="animate-spin" />
              : <RefreshCw size={13} />
            }
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-4 text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {COLUMNS.map((col) => (
                <th
                  key={col}
                  className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-400 whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-12 text-center">
                  <Loader2 size={20} className="animate-spin text-gray-300 mx-auto" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-12 text-center text-[13px] text-gray-400">
                  No progress rows yet. Your team will add entries here as videos move through the pipeline.
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50/60 transition-colors">
                  {COLUMNS.map((col) => (
                    <td key={col} className="px-4 py-3 whitespace-nowrap">
                      {col === 'script name' ? (
                        <span className="text-gray-800 font-medium">{row[col] ?? '—'}</span>
                      ) : (
                        statusChip(row[col])
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
