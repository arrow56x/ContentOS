import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, RefreshCw, ExternalLink, Database, X, Plus } from 'lucide-react';
import { captionsApi, type Video } from '../../lib/api';

interface Props {
  videos: Video[];
}

type CaptionRow = Record<string, string | number | null>;

// Columns shown in the Captions table — 's no.' is intentionally hidden from the frontend.
const CAPTION_COLUMNS = ['script name', 'edited video', 'posted', 'caption'] as const;

const COLUMN_LABELS: Record<string, string> = {
  'script name': 'Script Name',
  'edited video': 'Edited Video',
  posted: 'Posted',
  caption: 'Caption',
};

// Columns shown for the {email}_scheduled_post table — 's no.' hidden.
const SCHEDULED_DISPLAY_COLUMNS = ['scriptname', 'video', 'scheduled date', 'platform', 'posted'] as const;

const SCHEDULED_LABELS: Record<string, string> = {
  scriptname: 'Script Name',
  video: 'Video',
  'scheduled date': 'Scheduled Date',
  platform: 'Platform',
  posted: 'Posted',
};

function formatDateTime(value: string | number | null): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const POSTED_STYLES: Record<string, string> = {
  yes: 'bg-emerald-100 text-emerald-700',
  posted: 'bg-emerald-100 text-emerald-700',
  no: 'bg-gray-100 text-gray-400',
  scheduled: 'bg-sky-50 text-sky-600',
};

function PostedChip({ value }: { value: string | number | null }) {
  const str = String(value ?? 'no').toLowerCase();
  const cls = POSTED_STYLES[str] ?? 'bg-amber-50 text-amber-600';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold capitalize ${cls}`}>
      {str}
    </span>
  );
}

function VideoLink({ value }: { value: string | number | null }) {
  const url = String(value ?? '').trim();
  if (!url) return <span className="text-gray-300">—</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-sky-600 hover:text-sky-700 hover:underline"
    >
      Open <ExternalLink size={13} />
    </a>
  );
}

export default function CaptionsScheduleSection(_props: Props) {
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [tableExists, setTableExists] = useState(false);
  const [rows, setRows] = useState<CaptionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  // Caption text shown in the modal (null = closed).
  const [openCaption, setOpenCaption] = useState<string | null>(null);
  // Active tab.
  const [tab, setTab] = useState<'captions' | 'schedule'>('captions');
  // Schedule-a-new-video modal open state.
  const [scheduleOpen, setScheduleOpen] = useState(false);
  // Scheduled-post table data.
  const [scheduledRows, setScheduledRows] = useState<CaptionRow[]>([]);
  const [scheduledLoading, setScheduledLoading] = useState(false);

  // On mount, just check whether the table already exists (no creation).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setChecking(true);
      try {
        const result = await captionsApi.status();
        if (!cancelled && result.exists) {
          setTableExists(true);
          setRows(result.rows);
          setLastFetched(new Date());
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to check table.');
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Create the table (idempotent) and load its rows.
  const loadTable = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await captionsApi.loadTable();
      setTableExists(true);
      setRows(result.rows);
      setLastFetched(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load table.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load the scheduled-post rows (creates the table if missing, saves meta).
  const loadScheduled = useCallback(async () => {
    setScheduledLoading(true);
    try {
      const result = await captionsApi.loadScheduled();
      setScheduledRows(result.rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scheduled posts.');
    } finally {
      setScheduledLoading(false);
    }
  }, []);

  // Fetch scheduled posts whenever the Schedule tab becomes active.
  useEffect(() => {
    if (tab === 'schedule') void loadScheduled();
  }, [tab, loadScheduled]);

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        {/* Tab switcher: Captions | Schedule */}
        <div className="inline-flex items-center gap-1 rounded-xl bg-gray-100 p-1 self-start">
          <button
            onClick={() => setTab('captions')}
            className={`rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors ${
              tab === 'captions' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Captions
          </button>
          <button
            onClick={() => setTab('schedule')}
            className={`rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors ${
              tab === 'schedule' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Schedule
          </button>
        </div>

        <div className="flex items-center gap-3">
          {lastFetched && !loading && tableExists && (
            <span className="text-[11px] text-gray-400">
              Updated {lastFetched.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {tab === 'schedule' && (
            <button
              onClick={() => setScheduleOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-sky-500 px-4 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-sky-600"
            >
              <Plus size={15} />
              Schedule a new video
            </button>
          )}
          {tableExists && (
            <button
              onClick={loadTable}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-gray-600 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-600 disabled:opacity-50"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Refresh
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="mb-4 text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      {tab === 'schedule' ? (
        // Schedule tab — shows the {email}_scheduled_post table.
        scheduledLoading && scheduledRows.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={22} className="animate-spin text-gray-300" />
          </div>
        ) : scheduledRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-gray-200 py-16 text-center">
            <p className="text-[14px] text-gray-500">No videos scheduled yet.</p>
            <button
              onClick={() => setScheduleOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-sky-600"
            >
              <Plus size={15} />
              Schedule a new video
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-left text-[11px] sm:text-[13px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {SCHEDULED_DISPLAY_COLUMNS.map((col) => (
                    <th
                      key={col}
                      className="px-2.5 py-2.5 sm:px-4 sm:py-3 text-[9px] sm:text-[11px] font-semibold uppercase tracking-wide text-gray-400 whitespace-nowrap"
                    >
                      {SCHEDULED_LABELS[col]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {scheduledRows.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50/60 transition-colors">
                    {SCHEDULED_DISPLAY_COLUMNS.map((col) => (
                      <td key={col} className="px-2.5 py-2.5 sm:px-4 sm:py-3 align-top whitespace-nowrap">
                        {col === 'scriptname' ? (
                          <span className="block max-w-[120px] sm:max-w-none truncate text-gray-800 font-medium" title={String(row[col] ?? '')}>
                            {row[col] || '—'}
                          </span>
                        ) : col === 'video' ? (
                          <VideoLink value={row[col]} />
                        ) : col === 'scheduled date' ? (
                          <span className="text-gray-600">{formatDateTime(row[col])}</span>
                        ) : col === 'posted' ? (
                          <PostedChip value={row[col]} />
                        ) : (
                          <span className="text-gray-600">{row[col] || '—'}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : checking ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={22} className="animate-spin text-gray-300" />
        </div>
      ) : !tableExists ? (
        // No table yet — show the Load table button.
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-gray-200 py-16 text-center">
          <p className="text-[14px] text-gray-500">No table yet.</p>
          <button
            onClick={loadTable}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-sky-600 disabled:opacity-60"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Database size={15} />}
            Load table
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-left text-[11px] sm:text-[13px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {CAPTION_COLUMNS.map((col) => (
                  <th
                    key={col}
                    className="px-2.5 py-2.5 sm:px-4 sm:py-3 text-[9px] sm:text-[11px] font-semibold uppercase tracking-wide text-gray-400 whitespace-nowrap"
                  >
                    {COLUMN_LABELS[col]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={CAPTION_COLUMNS.length} className="px-4 py-12 text-center text-[13px] text-gray-400">
                    Table created. No rows yet.
                  </td>
                </tr>
              ) : (
                rows.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50/60 transition-colors">
                    {CAPTION_COLUMNS.map((col) => (
                      <td key={col} className="px-2.5 py-2.5 sm:px-4 sm:py-3 align-top">
                        {col === 'script name' ? (
                          <span className="block max-w-[120px] sm:max-w-none truncate text-gray-800 font-medium" title={String(row[col] ?? '')}>
                            {row[col] || '—'}
                          </span>
                        ) : col === 'edited video' ? (
                          <VideoLink value={row[col]} />
                        ) : col === 'posted' ? (
                          <PostedChip value={row[col]} />
                        ) : (
                          <CaptionCell value={row[col]} onOpen={setOpenCaption} />
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {openCaption !== null && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-6"
          style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}
          onClick={() => setOpenCaption(null)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 shrink-0">
              <p className="text-[15px] font-semibold text-gray-900">Caption</p>
              <button
                type="button"
                onClick={() => setOpenCaption(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-6">
              <p className="text-[14px] leading-7 text-gray-700 whitespace-pre-wrap font-sans">
                {openCaption || 'No caption text yet.'}
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}

      {scheduleOpen && createPortal(
        <ScheduleModal
          onClose={() => setScheduleOpen(false)}
          onScheduled={() => {
            void loadScheduled();
          }}
        />,
        document.body
      )}
    </section>
  );
}

const PLATFORMS = [
  { id: 'youtube', label: 'YouTube', available: true },
  { id: 'instagram', label: 'Instagram', available: false },
  { id: 'tiktok', label: 'TikTok', available: false },
  { id: 'twitter', label: 'Twitter / X', available: false },
] as const;

function ScheduleModal({
  onClose,
  onScheduled,
}: {
  onClose: () => void;
  onScheduled: () => void;
}) {
  // Load the user's captions table so they can pick a video to schedule.
  const [videos, setVideos] = useState<CaptionRow[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(true);

  const [selectedIdx, setSelectedIdx] = useState<number | ''>('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [platform, setPlatform] = useState('youtube');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingVideos(true);
      try {
        const result = await captionsApi.loadTable();
        if (!cancelled) setVideos(result.rows);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load videos.');
      } finally {
        if (!cancelled) setLoadingVideos(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = selectedIdx === '' ? null : videos[selectedIdx];
  const canSave = !!selected && !!scheduledDate && !saving;

  const handleSchedule = async () => {
    if (!selected || !scheduledDate) return;
    setSaving(true);
    setError(null);
    try {
      await captionsApi.schedule({
        scriptName: String(selected['script name'] ?? '').trim(),
        video: String(selected['edited video'] ?? '').trim(),
        scheduledDate,
        platform: PLATFORMS.find((p) => p.id === platform)?.label ?? platform,
      });
      setSaved(true);
      onScheduled();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule the video.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-6"
      style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-[480px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <p className="text-[15px] font-semibold text-gray-900">Schedule a new video</p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {saved ? (
          <div className="px-6 py-10 text-center">
            <p className="text-[14px] font-semibold text-gray-900">Scheduled!</p>
            <p className="mt-1.5 text-[13px] text-gray-500">
              “{String(selected?.['script name'] ?? '')}” is scheduled on{' '}
              {PLATFORMS.find((p) => p.id === platform)?.label}.
            </p>
            <button
              onClick={onClose}
              className="mt-5 rounded-xl bg-sky-500 px-5 py-2 text-[13px] font-semibold text-white hover:bg-sky-600"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4">
            {error && (
              <p className="text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {/* 1. Select video from captions table */}
            <Field label="Select a video">
              {loadingVideos ? (
                <div className="flex items-center gap-2 text-[13px] text-gray-400 py-2">
                  <Loader2 size={14} className="animate-spin" /> Loading your videos…
                </div>
              ) : videos.length === 0 ? (
                <p className="text-[13px] text-gray-400 py-2">
                  No videos in your captions table yet.
                </p>
              ) : (
                <select
                  value={selectedIdx}
                  onChange={(e) => setSelectedIdx(e.target.value === '' ? '' : Number(e.target.value))}
                  className="font-apple w-full rounded-lg border border-gray-200 px-3 py-2.5 text-[14px] font-medium text-gray-800 outline-none transition-colors focus:border-sky-400"
                >
                  <option value="" className="font-apple text-gray-400">Choose a video…</option>
                  {videos.map((v, i) => (
                    <option key={i} value={i} className="font-apple text-gray-800">
                      {String(v['script name'] ?? `Video ${i + 1}`)}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            {/* 2. Date & time to post */}
            <Field label="Date &amp; time to post">
              <input
                type="datetime-local"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[13.5px] outline-none focus:border-sky-400"
              />
            </Field>

            {/* 3. Platform */}
            <Field label="Platform">
              <div className="grid grid-cols-2 gap-2">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!p.available}
                    onClick={() => p.available && setPlatform(p.id)}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors ${
                      platform === p.id && p.available
                        ? 'border-sky-400 bg-sky-50 text-sky-700'
                        : p.available
                        ? 'border-gray-200 text-gray-700 hover:border-gray-300'
                        : 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    {p.label}
                    {!p.available && <span className="text-[10px] font-semibold">Soon</span>}
                  </button>
                ))}
              </div>
            </Field>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-[13px] font-semibold text-gray-500 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSchedule}
                disabled={!canSave}
                className="inline-flex items-center gap-1.5 rounded-xl bg-sky-500 px-5 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-sky-600 disabled:opacity-50"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Schedule
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-semibold text-gray-500">{label}</label>
      {children}
    </div>
  );
}

function CaptionCell({
  value,
  onOpen,
}: {
  value: string | number | null;
  onOpen: (caption: string) => void;
}) {
  const caption = value === null || value === undefined ? '' : String(value);
  if (!caption.trim()) return <span className="text-gray-300">—</span>;

  return (
    <button
      type="button"
      onClick={() => onOpen(caption)}
      className="font-semibold text-sky-600 hover:text-sky-700 hover:underline whitespace-nowrap"
    >
      View caption
    </button>
  );
}
