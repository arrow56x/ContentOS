import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { type ClientPlan, type Video, usersApi } from '../../lib/api';

type ProgressRow = Record<string, string | number | null>;

const PROGRESS_COLS = [
  'script name',
  'raw video uploaded',
  'video edited',
  'video captioned',
  'video posting',
] as const;

const STATUS_STYLES: Record<string, string> = {
  submitted: 'bg-violet-100 text-violet-700',
  done:      'bg-emerald-100 text-emerald-700',
  posted:    'bg-sky-100 text-sky-700',
  yes:       'bg-emerald-100 text-emerald-700',
  no:        'bg-red-50 text-red-500',
  pending:   'bg-gray-100 text-gray-400',
};

function StatusChip({ value }: { value: string | number | null }) {
  const str = String(value ?? 'pending').toLowerCase();
  const cls = STATUS_STYLES[str] ?? 'bg-amber-50 text-amber-600';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold capitalize ${cls}`}>
      {str}
    </span>
  );
}

type SectionKey = 'overview' | 'explore' | 'scripts' | 'library' | 'schedule';

interface Props {
  plan: ClientPlan | null;
  videos: Video[];
  onJump: (s: SectionKey) => void;
}

/** A progress row counts as completed only when "video posting" === 'done'. */
function isRowDone(row: ProgressRow) {
  return String(row['video posting'] ?? '').trim().toLowerCase() === 'done';
}

// Total videos allowed per month (from the user's plan in Firebase).
const DEFAULT_QUOTA = 20;

export default function OverviewSection({ plan }: Props) {
  // Quota comes from the user's Firebase plan; default to the standard 20/month.
  const quota = plan?.monthlyQuota ?? DEFAULT_QUOTA;

  const [progressRows, setProgressRows] = useState<ProgressRow[]>([]);
  const [progressLoading, setProgressLoading] = useState(true);
  const [progressLastFetched, setProgressLastFetched] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchProgress() {
      setProgressLoading(true);
      try {
        const result = await usersApi.loadProgress();
        if (!cancelled) {
          setProgressRows(result.rows);
          setProgressLastFetched(new Date());
        }
      } catch {
        // silently fail — board just shows empty
      } finally {
        if (!cancelled) setProgressLoading(false);
      }
    }
    void fetchProgress();
    const id = setInterval(() => void fetchProgress(), 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Stats are driven entirely by the user's {email}_progress table:
  //   completed  = rows whose "video posting" is 'done'
  //   inProgress = every other row (not yet 'done')
  const completed = progressRows.filter(isRowDone).length;
  const inProgress = progressRows.length - completed;
  const remaining = Math.max(quota - progressRows.length, 0);
  const pct = quota > 0 ? Math.min(Math.round((completed / quota) * 100), 100) : 0;

  // Show skeletons only on the very first load (before any data has arrived).
  // The 30s auto-refresh won't re-trigger skeletons once data exists.
  const initialLoading = progressLoading && !progressLastFetched;

  if (initialLoading) {
    return <OverviewSkeleton />;
  }

  return (
    <div className="space-y-4">
      {/* 1. VIDEO QUOTA TRACKER */}
      <section className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/70 shadow-sm p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[15px] font-semibold">Monthly Video Quota</h2>
          <span className="text-[13px] text-gray-400">{quota} videos / month plan</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-6 items-center">
          {/* Progress ring */}
          <div className="relative w-[140px] h-[140px] mx-auto">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle cx="60" cy="60" r="52" fill="none" stroke="#e0f2fe" strokeWidth="12" />
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="#0ea5e9"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 52}
                strokeDashoffset={2 * Math.PI * 52 * (1 - pct / 100)}
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[28px] font-bold leading-none">{pct}%</span>
              <span className="text-[12px] text-gray-400 mt-1">{completed}/{quota} posted</span>
            </div>
          </div>

          {/* Stat tiles */}
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Completed" value={completed} tint="text-emerald-600 bg-emerald-50" />
            <Stat label="In Progress" value={inProgress} tint="text-amber-600 bg-amber-50" />
            <Stat label="Remaining" value={remaining} tint="text-sky-600 bg-sky-50" />
          </div>
        </div>

        {/* Linear progress bar */}
        <div className="mt-5">
          <div className="h-2.5 rounded-full bg-sky-100 overflow-hidden flex">
            <div
              className="h-full bg-emerald-500 transition-all duration-700"
              style={{ width: `${quota ? (completed / quota) * 100 : 0}%` }}
              title={`${completed} completed`}
            />
            <div
              className="h-full bg-amber-400 transition-all duration-700"
              style={{ width: `${quota ? (inProgress / quota) * 100 : 0}%` }}
              title={`${inProgress} in progress`}
            />
          </div>
          <div className="mt-2 flex items-center gap-4 text-[12px] text-gray-500">
            <Legend color="bg-emerald-500" label="Completed" />
            <Legend color="bg-amber-400" label="In progress" />
            <Legend color="bg-sky-100" label="Remaining" />
          </div>
        </div>
      </section>

      {/* 2. PIPELINE STATUS BOARD — live {email}_progress table */}
      <section className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/70 shadow-sm p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-[15px] font-semibold">Pipeline Status Board</h2>
          {progressLastFetched && !progressLoading && (
            <span className="text-[11px] text-gray-400">
              Updated {progressLastFetched.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <p className="text-[13px] text-gray-400 mb-4">
          Live status of every script moving through the production pipeline.
        </p>

        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-left text-[11px] sm:text-[13px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {PROGRESS_COLS.map((col) => (
                  <th
                    key={col}
                    className="px-2.5 py-2.5 sm:px-4 sm:py-3 text-[9px] sm:text-[11px] font-semibold uppercase tracking-wide text-gray-400 whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {progressLoading && progressRows.length === 0 ? (
                <tr>
                  <td colSpan={PROGRESS_COLS.length} className="px-4 py-12 text-center">
                    <Loader2 size={20} className="animate-spin text-gray-300 mx-auto" />
                  </td>
                </tr>
              ) : progressRows.length === 0 ? (
                <tr>
                  <td colSpan={PROGRESS_COLS.length} className="px-4 py-12 text-center text-[13px] text-gray-400">
                    No pipeline entries yet. Upload a video and link it to a script to get started.
                  </td>
                </tr>
              ) : (
                progressRows.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50/60 transition-colors">
                    {PROGRESS_COLS.map((col) => (
                      <td key={col} className="px-2.5 py-2.5 sm:px-4 sm:py-3 whitespace-nowrap">
                        {col === 'script name' ? (
                          <span className="block max-w-[120px] sm:max-w-none truncate text-gray-800 font-medium" title={String(row[col] ?? '')}>
                            {row[col] ?? '—'}
                          </span>
                        ) : (
                          <StatusChip value={row[col]} />
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

    </div>
  );
}


function Stat({ label, value, tint }: { label: string; value: number; tint: string }) {
  return (
    <div className={`rounded-xl p-3 ${tint}`}>
      <p className="text-[24px] font-bold leading-none">{value}</p>
      <p className="text-[12px] mt-1 opacity-80">{label}</p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-full ${color}`} /> {label}
    </span>
  );
}

/** Animated placeholder shown while the progress data loads for the first time. */
function OverviewSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Quota tracker skeleton */}
      <section className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/70 shadow-sm p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="h-4 w-40 rounded bg-gray-200" />
          <div className="h-3 w-32 rounded bg-gray-100" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-6 items-center">
          {/* Ring placeholder */}
          <div className="mx-auto h-[140px] w-[140px] rounded-full border-[12px] border-gray-100" />
          {/* Stat tiles */}
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-gray-100 p-3">
                <div className="h-6 w-10 rounded bg-gray-200" />
                <div className="mt-2 h-3 w-16 rounded bg-gray-200" />
              </div>
            ))}
          </div>
        </div>

        {/* Bar placeholder */}
        <div className="mt-5">
          <div className="h-2.5 w-full rounded-full bg-gray-100" />
          <div className="mt-2 flex items-center gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-3 w-20 rounded bg-gray-100" />
            ))}
          </div>
        </div>
      </section>

      {/* Pipeline board skeleton */}
      <section className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/70 shadow-sm p-5">
        <div className="h-4 w-44 rounded bg-gray-200 mb-2" />
        <div className="h-3 w-72 rounded bg-gray-100 mb-4" />

        <div className="rounded-xl border border-gray-100 overflow-hidden">
          {/* Header strip */}
          <div className="grid grid-cols-5 gap-2 bg-gray-50 px-4 py-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-3 w-20 rounded bg-gray-200" />
            ))}
          </div>
          {/* Row strips */}
          {Array.from({ length: 3 }).map((_, r) => (
            <div key={r} className="grid grid-cols-5 gap-2 px-4 py-4 border-t border-gray-50">
              {Array.from({ length: 5 }).map((_, c) => (
                <div key={c} className="h-4 w-24 rounded bg-gray-100" />
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
