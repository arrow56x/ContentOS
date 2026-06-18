import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  ChevronRight,
  Check,
  MessageSquare,
  Loader2,
  CalendarClock,
  CheckCircle2,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { pipelineApi, scriptsApi, type ScriptApproval, type Video } from '../../lib/api';
import { SCRIPT_STATUS_STYLES, formatDate } from '../../lib/pipeline';

interface Props {
  videos: Video[];
  username: string;
  onReviewed: (updated: Video) => void;
}

type ScriptRow = Record<string, string | number | null>;

interface ScriptFilters {
  approve: 'all' | 'approved' | 'not-approved';
  progress: 'all' | 'under work' | 'done';
  month: string; // 'all' or 'YYYY-MM'
}

const EMPTY_FILTERS: ScriptFilters = { approve: 'all', progress: 'all', month: 'all' };

/** True when at least one filter is narrowing the results. */
function hasActiveFilters(f: ScriptFilters) {
  return f.approve !== 'all' || f.progress !== 'all' || f.month !== 'all';
}

/** Extract 'YYYY-MM' from a row's uploaded date, or '' if unparseable. */
function rowMonthKey(row: ScriptRow): string {
  // Prefer the named column, but fall back to any column whose key mentions
  // "date" or "upload" — guards against minor naming differences.
  let raw = String(row['uploaded date'] ?? '').trim();
  if (!raw) {
    const dateKey = Object.keys(row).find((k) => /date|upload/i.test(k));
    if (dateKey) raw = String(row[dateKey] ?? '').trim();
  }
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Human label for a 'YYYY-MM' month key. */
function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** Apply approve/progress/month filters to a row. */
function rowMatchesFilters(row: ScriptRow, f: ScriptFilters): boolean {
  if (f.approve !== 'all') {
    const approved = normalizeApprove(row['approve']) === 'approve';
    if (f.approve === 'approved' && !approved) return false;
    if (f.approve === 'not-approved' && approved) return false;
  }
  if (f.progress !== 'all') {
    const progress = normalizeProgress(row['progress']);
    if (f.progress === 'done' && progress !== 'delivered') return false;
    if (f.progress === 'under work' && progress !== 'under work') return false;
  }
  if (f.month !== 'all' && rowMonthKey(row) !== f.month) return false;
  return true;
}

export default function ScriptsSection({ videos, username }: Props) {
  const [checkingScripts, setCheckingScripts] = useState(true);
  const [loadingScripts, setLoadingScripts] = useState(false);
  const [scriptsTable, setScriptsTable] = useState<{
    name: string;
    columns: string[];
    rows: Record<string, string | number | null>[];
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<ScriptFilters>(EMPTY_FILTERS);
  const inProgress = videos.filter((v) => v.scriptStatus === 'in-progress');
  const pending = videos.filter((v) => v.scriptStatus === 'pending');

  // Next-batch ETA = soonest eta among not-yet-delivered scripts.
  const nextEta = [...inProgress, ...pending]
    .map((v) => v.scriptEta)
    .filter((e): e is number => typeof e === 'number')
    .sort((a, b) => a - b)[0];

  useEffect(() => {
    let isMounted = true;

    async function checkScriptsTable() {
      setCheckingScripts(true);
      setLoadError(null);
      try {
        const result = await scriptsApi.status();
        if (isMounted && result.exists) {
          setScriptsTable({ name: result.table, columns: result.columns, rows: result.rows });
        }
      } catch (err) {
        if (isMounted) {
          setLoadError(err instanceof Error ? err.message : 'Failed to check scripts table.');
        }
      } finally {
        if (isMounted) {
          setCheckingScripts(false);
        }
      }
    }

    checkScriptsTable();

    return () => {
      isMounted = false;
    };
  }, []);

  const loadScripts = async () => {
    setLoadingScripts(true);
    setLoadError(null);
    try {
      const result = await scriptsApi.loadScripts();
      setScriptsTable({ name: result.table, columns: result.columns, rows: result.rows });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load scripts.');
    } finally {
      setLoadingScripts(false);
    }
  };

  const approveScript = async (serial: number) => {
    const result = await scriptsApi.approve(serial);
    setScriptsTable((current) => {
      if (!current) return current;
      return {
        ...current,
        rows: current.rows.map((row) =>
          row['s no.'] === result.row['s no.'] ? result.row : row
        ),
      };
    });
  };

  // Month options for the filter: the last 12 calendar months merged with any
  // months that actually appear in the data, newest first. This guarantees the
  // dropdown always offers a full list of months to choose from.
  const availableMonths = (() => {
    const keys = new Set<string>();
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      keys.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    for (const row of scriptsTable?.rows ?? []) {
      const k = rowMonthKey(row);
      if (k) keys.add(k);
    }
    return Array.from(keys).sort((a, b) => b.localeCompare(a));
  })();

  return (
    <section className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/70 shadow-sm p-6">
      <div className="mb-6 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-semibold tracking-tight text-gray-950">Scripts</h2>
          <p className="mt-1 text-[15px] text-gray-500">
            Hey {username}, here are all the scripts for your content
          </p>
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-72 lg:flex-none">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search scripts…"
              className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-9 py-2.5 text-[14px] text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-sky-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex h-5 w-5 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <ScriptsFilter
            filters={filters}
            onChange={setFilters}
            availableMonths={availableMonths}
          />
        </div>
      </div>

      {nextEta && (
        <div className="mb-4 flex items-center gap-2 text-[13px] text-sky-700 bg-sky-50 border border-sky-100 rounded-xl px-3 py-2.5">
          <CalendarClock size={16} />
          Next batch of scripts estimated for{' '}
          <span className="font-semibold">{formatDate(nextEta)}</span>.
        </div>
      )}

      <div className="space-y-2.5">
        {checkingScripts ? (
          <ScriptsTableSkeleton />
        ) : scriptsTable ? (
          <ScriptsTableShell
            columns={scriptsTable.columns}
            rows={scriptsTable.rows}
            search={search}
            filters={filters}
            onApprove={approveScript}
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <p className="text-[14px] font-medium text-gray-400">No scripts this month yet.</p>
            <button
              onClick={loadScripts}
              disabled={loadingScripts}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm shadow-sky-500/20 hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingScripts && <Loader2 size={15} className="animate-spin" />}
              Load scripts
            </button>
            {loadError && <p className="max-w-md text-[12.5px] text-red-600">{loadError}</p>}
          </div>
        )}
      </div>
    </section>
  );
}

function ScriptsFilter({
  filters,
  onChange,
  availableMonths,
}: {
  filters: ScriptFilters;
  onChange: (f: ScriptFilters) => void;
  availableMonths: string[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const activeCount =
    (filters.approve !== 'all' ? 1 : 0) +
    (filters.progress !== 'all' ? 1 : 0) +
    (filters.month !== 'all' ? 1 : 0);

  // Close when clicking outside the dropdown.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-[14px] font-medium transition-colors ${
          activeCount > 0
            ? 'border-sky-300 bg-sky-50 text-sky-600'
            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
        }`}
      >
        <SlidersHorizontal size={16} />
        Filter
        {activeCount > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-500 px-1.5 text-[11px] font-semibold text-white">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-gray-100 bg-white p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-semibold text-gray-900">Filters</p>
            {activeCount > 0 && (
              <button
                type="button"
                onClick={() => onChange(EMPTY_FILTERS)}
                className="text-[12px] font-semibold text-sky-600 hover:text-sky-700"
              >
                Clear all
              </button>
            )}
          </div>

          <FilterGroup
            label="Approval"
            value={filters.approve}
            onChange={(v) => onChange({ ...filters, approve: v as ScriptFilters['approve'] })}
            options={[
              { value: 'all', label: 'All' },
              { value: 'approved', label: 'Approved' },
              { value: 'not-approved', label: 'Not approved' },
            ]}
          />

          <FilterGroup
            label="Progress"
            value={filters.progress}
            onChange={(v) => onChange({ ...filters, progress: v as ScriptFilters['progress'] })}
            options={[
              { value: 'all', label: 'All' },
              { value: 'under work', label: 'Under work' },
              { value: 'done', label: 'Done' },
            ]}
          />

          <div className="mb-3 last:mb-0">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Month</p>
            <select
              value={filters.month}
              onChange={(e) => onChange({ ...filters, month: e.target.value })}
              className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[12.5px] font-medium text-gray-700 outline-none transition-colors focus:border-sky-400"
            >
              <option value="all">All months</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterGroup({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-lg px-2.5 py-1 text-[12.5px] font-medium transition-colors ${
              value === opt.value
                ? 'bg-sky-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ScriptsTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
      <div className="border-b border-gray-100 px-4 py-3">
        <div className="h-5 w-32 rounded bg-gray-100" />
        <div className="mt-3 h-4 w-56 rounded bg-gray-100" />
      </div>
      <div className="grid grid-cols-6 gap-px bg-gray-100">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="bg-gray-50 px-5 py-4">
            <div className="h-4 w-24 rounded bg-gray-200" />
          </div>
        ))}
      </div>
      <div className="px-5 py-10">
        <div className="mx-auto h-4 w-40 rounded bg-gray-100" />
      </div>
    </div>
  );
}

function ScriptsTableShell({
  columns,
  rows,
  search,
  filters,
  onApprove,
}: {
  columns: string[];
  rows: ScriptRow[];
  search: string;
  filters: ScriptFilters;
  onApprove: (serial: number) => Promise<void>;
}) {
  const [openScript, setOpenScript] = useState<string | null>(null);
  const [approvingSerial, setApprovingSerial] = useState<number | null>(null);
  const [approveError, setApproveError] = useState<string | null>(null);

  // Apply the dropdown filters first, then the free-text search across every column.
  const query = search.trim().toLowerCase();
  const visibleRows = rows
    .filter((row) => rowMatchesFilters(row, filters))
    .filter((row) =>
      query
        ? Object.values(row).some((value) =>
            String(value ?? '').toLowerCase().includes(query)
          )
        : true
    );

  const approve = async (serial: number) => {
    setApprovingSerial(serial);
    setApproveError(null);
    try {
      await onApprove(serial);
    } catch (err) {
      setApproveError(err instanceof Error ? err.message : 'Failed to approve script.');
    } finally {
      setApprovingSerial(null);
    }
  };

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full sm:min-w-[980px] text-left text-[12px] sm:text-[15px]">
            <thead className="bg-gray-50 text-[10px] sm:text-[13px] uppercase tracking-wide text-gray-500">
              <tr>
                {columns.filter((c) => c !== 's no.').map((column) => (
                  <th key={column} className="px-2 py-2.5 sm:px-5 sm:py-4 font-semibold whitespace-nowrap">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.length > 0 ? (
                visibleRows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-t border-gray-100">
                    {columns.filter((c) => c !== 's no.').map((column) => (
                      <td key={column} className="px-2 py-3 sm:px-5 sm:py-5 text-gray-700 whitespace-nowrap">
                        {column === 'script' ? (
                          <ScriptCell value={row[column]} onOpen={setOpenScript} />
                        ) : column === 'progress' ? (
                          <ScriptProgressCell value={row[column]} />
                        ) : column === 'approve' ? (
                          <ScriptApproveCell
                            serial={Number(row['s no.'])}
                            value={row[column]}
                            saving={approvingSerial === Number(row['s no.'])}
                            onApprove={approve}
                          />
                        ) : column === 'title' ? (
                          <span className="block max-w-[140px] sm:max-w-none truncate" title={String(row[column] ?? '')}>
                            {formatScriptCell(row[column])}
                          </span>
                        ) : (
                          formatScriptCell(row[column])
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="px-5 py-10 text-center text-[15px] text-gray-400">
                    {query
                      ? `No scripts match “${search.trim()}”.`
                      : hasActiveFilters(filters)
                      ? 'No scripts match the selected filters.'
                      : 'No uploaded scripts yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {approveError && (
          <div className="border-t border-red-100 bg-red-50 px-5 py-3 text-[13px] text-red-600">
            {approveError}
          </div>
        )}
      </div>
      {openScript !== null && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-6"
          style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}
          onClick={() => setOpenScript(null)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-[660px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 shrink-0">
              <p className="text-[15px] font-semibold text-gray-900">Script</p>
              <button
                type="button"
                onClick={() => setOpenScript(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-6">
              <p className="text-[14px] leading-7 text-gray-700 whitespace-pre-wrap font-sans">
                {openScript || 'No script text yet.'}
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function ScriptApproveCell({
  serial,
  value,
  saving,
  onApprove,
}: {
  serial: number;
  value: string | number | null | undefined;
  saving: boolean;
  onApprove: (serial: number) => Promise<void>;
}) {
  const approved = normalizeApprove(value) === 'approve';

  return (
    <button
      type="button"
      disabled={approved || saving || !Number.isFinite(serial)}
      onClick={() => void onApprove(serial)}
      aria-label={approved ? 'Script approved' : 'Approve script'}
      title={approved ? 'Approved' : 'Approve'}
      className={`inline-flex h-7 w-7 sm:h-10 sm:w-10 items-center justify-center rounded-full border transition disabled:cursor-default ${
        approved
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-gray-200 bg-white text-gray-500 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700'
      } ${saving ? 'opacity-60' : ''}`}
    >
      {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
    </button>
  );
}

function ScriptProgressCell({
  value,
}: {
  value: string | number | null | undefined;
}) {
  const progress = normalizeProgress(value);

  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 sm:px-4 sm:py-1.5 text-[10px] sm:text-[13px] font-semibold ${progressStyle(progress)}`}>
      {formatProgress(progress)}
    </span>
  );
}

function ScriptCell({
  value,
  onOpen,
}: {
  value: string | number | null | undefined;
  onOpen: (script: string) => void;
}) {
  const script = value === null || value === undefined ? '' : String(value);
  if (!script.trim()) return '-';

  return (
    <button
      type="button"
      onClick={() => onOpen(script)}
      className="font-semibold text-sky-600 hover:text-sky-700 hover:underline"
    >
      View script
    </button>
  );
}

function normalizeApprove(value: string | number | null | undefined) {
  const approval = String(value ?? '').trim().toLowerCase();
  if (approval === 'approve' || approval === 'approved') return 'approve';
  return 'pending';
}

function normalizeProgress(value: string | number | null | undefined) {
  const progress = String(value ?? '').trim().toLowerCase();
  if (progress === 'delivered') return 'delivered';
  if (progress === 'under work' || progress === 'under-work') return 'under work';
  if (progress === 'in progress' || progress === 'in-progress') return 'in progress';
  return 'pending';
}

function progressStyle(progress: string) {
  if (progress === 'delivered') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (progress === 'under work') return 'border-sky-200 bg-sky-50 text-sky-700';
  if (progress === 'in progress') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-gray-200 bg-gray-50 text-gray-500';
}

function formatProgress(progress: string) {
  if (progress === 'delivered') return 'Delivered';
  if (progress === 'under work') return 'Under work';
  if (progress === 'in progress') return 'In progress';
  return 'Pending';
}

function formatScriptCell(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Date(value).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  return value;
}

function ScriptRow({ video, onReviewed }: { video: Video; onReviewed: (v: Video) => void }) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState(video.clientFeedback);
  const [showFeedback, setShowFeedback] = useState(false);
  const [saving, setSaving] = useState<null | ScriptApproval>(null);
  const [err, setErr] = useState<string | null>(null);

  const isDelivered = video.scriptStatus === 'delivered';
  const status = SCRIPT_STATUS_STYLES[video.scriptStatus];

  const submit = async (approval: ScriptApproval) => {
    setSaving(approval);
    setErr(null);
    try {
      const updated = await pipelineApi.reviewScript(video.id, {
        approval,
        feedback: feedback.trim(),
      });
      onReviewed(updated);
      setShowFeedback(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => isDelivered && setOpen((o) => !o)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left ${isDelivered ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'
          }`}
      >
        <span className="text-gray-400 shrink-0">
          {isDelivered ? (
            open ? <ChevronDown size={18} /> : <ChevronRight size={18} />
          ) : (
            <ChevronRight size={18} className="opacity-30" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium text-gray-900 truncate">{video.title}</p>
          <p className="text-[12px] text-gray-400 truncate">{video.angle}</p>
        </div>

        {/* Approval badge */}
        {video.scriptApproval === 'approved' && (
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">
            <CheckCircle2 size={12} /> Approved
          </span>
        )}
        {video.scriptApproval === 'changes-requested' && (
          <span className="hidden sm:inline-flex items-center text-[11px] font-medium text-rose-700 bg-rose-50 rounded-full px-2 py-0.5">
            Changes requested
          </span>
        )}

        <span className={`text-[12px] font-medium rounded-full px-2.5 py-1 shrink-0 ${status.chip}`}>
          {status.label}
        </span>
        <span className="hidden md:block text-[12px] text-gray-400 w-[90px] text-right shrink-0">
          {isDelivered ? formatDate(video.scriptDeliveredAt) : `ETA ${formatDate(video.scriptEta)}`}
        </span>
      </button>

      {/* Expanded script body + review controls */}
      {open && isDelivered && (
        <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-4">
          <pre className="whitespace-pre-wrap font-apple text-[13px] leading-relaxed text-gray-700 bg-white border border-gray-100 rounded-lg p-4">
            {video.scriptBody || 'Script content not available.'}
          </pre>

          {/* Approve / Request changes / Feedback */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={() => submit('approved')}
              disabled={saving !== null}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 rounded-lg px-3 py-2"
            >
              {saving === 'approved' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Approve
            </button>
            <button
              onClick={() => setShowFeedback((s) => !s)}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-gray-700 bg-white border border-gray-200 hover:border-gray-300 rounded-lg px-3 py-2"
            >
              <MessageSquare size={14} /> Request changes / Feedback
            </button>
          </div>

          {showFeedback && (
            <div className="mt-3">
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
                placeholder="Leave feedback or request changes…"
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-[13px] outline-none focus:border-sky-400 resize-y"
              />
              <button
                onClick={() => submit('changes-requested')}
                disabled={saving !== null}
                className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-white bg-sky-500 hover:bg-sky-600 disabled:opacity-50 rounded-lg px-3 py-2"
              >
                {saving === 'changes-requested' ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <MessageSquare size={14} />
                )}
                Send feedback
              </button>
            </div>
          )}

          {video.clientFeedback && !showFeedback && (
            <p className="mt-3 text-[13px] text-gray-600 bg-white border border-gray-100 rounded-lg px-3 py-2">
              <span className="font-semibold text-gray-700">Your feedback: </span>
              {video.clientFeedback}
            </p>
          )}

          {err && <p className="mt-2 text-[12px] text-red-600">{err}</p>}
        </div>
      )}
    </div>
  );
}
