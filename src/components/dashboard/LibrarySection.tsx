import { useEffect, useState } from 'react';
import { Film, ExternalLink, Play, Link2, X, Loader2, Check, FileText } from 'lucide-react';
import { type Video, pipelineApi, scriptsApi, videosApi, usersApi } from '../../lib/api';

interface Props {
  videos: Video[];
  onVideoUpdated: (video: Video) => void;
}


export default function LibrarySection({ videos, onVideoUpdated }: Props) {
  const [driveLink, setDriveLink] = useState('');
  const [showSelector, setShowSelector] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Supabase scripts state (for the script selector modal)
  const [supabaseRows, setSupabaseRows] = useState<any[]>([]);
  const [loadingSupabase, setLoadingSupabase] = useState(false);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);

  // Supabase videos table state (the {email}_videos table display)
  const [videosTableLoading, setVideosTableLoading] = useState(true);
  const [videosTableData, setVideosTableData] = useState<{
    columns: string[];
    rows: Record<string, string | number | null>[];
  } | null>(null);
  const [videosTableError, setVideosTableError] = useState<string | null>(null);

  // Fetch the Supabase videos table on mount
  useEffect(() => {
    let isMounted = true;
    async function fetchVideosTable() {
      setVideosTableLoading(true);
      setVideosTableError(null);
      try {
        const result = await videosApi.status();
        if (isMounted && result.exists) {
          setVideosTableData({ columns: result.columns, rows: result.rows });
        }
      } catch (err) {
        if (isMounted) {
          setVideosTableError(err instanceof Error ? err.message : 'Failed to load videos table.');
        }
      } finally {
        if (isMounted) setVideosTableLoading(false);
      }
    }
    fetchVideosTable();
    return () => { isMounted = false; };
  }, []);

  // Refresh the videos table data
  const refreshVideosTable = async () => {
    try {
      const result = await videosApi.status();
      if (result.exists) {
        setVideosTableData({ columns: result.columns, rows: result.rows });
      }
    } catch {
      // Silently ignore refresh errors
    }
  };


  const fetchSupabaseScripts = async () => {
    setLoadingSupabase(true);
    setSupabaseError(null);
    try {
      const result = await scriptsApi.status();
      if (result && result.rows) {
        setSupabaseRows(result.rows);
      } else {
        setSupabaseRows([]);
      }
    } catch (err) {
      setSupabaseError(err instanceof Error ? err.message : 'Failed to fetch scripts from Supabase.');
    } finally {
      setLoadingSupabase(false);
    }
  };

  const handleSubmitLink = () => {
    const link = driveLink.trim();
    if (!link) {
      setError('Please paste a link first.');
      return;
    }
    if (!/^https?:\/\/\S+/.test(link)) {
      setError('Please enter a valid link starting with http:// or https://');
      return;
    }
    setError(null);
    setShowSelector(true);
    void fetchSupabaseScripts();
  };

  const handleLinkToSupabaseScript = async (row: any) => {
    setIsLinking(true);
    setError(null);
    try {
      const titleLower = String(row.title || '').trim().toLowerCase();
      const match = videos.find((v) => String(v.title || '').trim().toLowerCase() === titleLower);

      if (match) {
        // Link to existing Firestore video
        const updated = await pipelineApi.updateVideoUrl(match.id, driveLink);
        onVideoUpdated(updated);
      } else {
        // Create a new video in Firestore matching the Supabase script details
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const newVideoId = `supabase-${row['s no.'] || Date.now()}`;
        
        const newVideo: Omit<Video, 'uid' | 'stages' | 'currentStage' | 'created_at' | 'updated_at'> = {
          id: newVideoId,
          month: currentMonth,
          title: row.title,
          angle: 'Created from Supabase scripts table record.',
          ideaApproved: true,
          scriptStatus: 'delivered',
          scriptBody: String(row.script || ''),
          scriptDeliveredAt: Date.now(),
          scriptEta: null,
          scriptApproval: row.approve === 'approve' ? 'approved' : 'none',
          clientFeedback: '',
          productionStatus: 'ready',
          videoUrl: driveLink,
          caption: {
            hook: row.title,
            body: String(row.script || ''),
            cta: '',
            hashtags: []
          },
          schedule: {
            status: 'pending',
            platform: 'instagram',
            postDate: null
          },
          order: videos.length
        };

        const saved = await pipelineApi.addVideo(newVideo);
        onVideoUpdated(saved);
      }

      // Also add a row to the user's Supabase {email}_videos table
      // (creates the table automatically on first upload)
      const scriptTitle = String(row.title || '').trim();
      try {
        await videosApi.addVideo(scriptTitle, driveLink);
        // Refresh the videos table display
        await refreshVideosTable();
      } catch (vidErr) {
        // Log but don't block — the Firestore save already succeeded
        console.error('[LibrarySection] Failed to add to Supabase videos table:', vidErr);
      }

      // Mark "raw video uploaded" = 'submitted' on the matching progress row
      try {
        await usersApi.markRawVideoSubmitted(scriptTitle);
      } catch (progErr) {
        // Log but don't block
        console.error('[LibrarySection] Failed to update progress table:', progErr);
      }

      setDriveLink('');
      setShowSelector(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not link the video. Try again.');
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <section className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/70 shadow-sm p-4 sm:p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Video Library</h2>
          <p className="text-[13px] text-gray-500 mt-1">
            Access final deliverables and submit video links for completed shoots.
          </p>
        </div>
        <span className="text-[12px] font-semibold text-sky-600 bg-sky-50 rounded-full px-3 py-1">
          {videos.length} Videos
        </span>
      </div>

      {/* Clean Link Paste Section */}
      <div className="mb-6 rounded-2xl border border-sky-100 bg-sky-50/50 p-5">
        <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between max-w-5xl mx-auto">
          {/* Left: Collecting videos info column */}
          <div className="w-full lg:w-[45%] text-left space-y-3 pb-2 lg:pb-0">
            <h3 className="text-[17px] font-bold text-gray-900 tracking-tight">Collecting videos in Drive</h3>
            <p className="text-[13px] text-gray-500 leading-relaxed">
              Before submitting, please verify that the linked video folders or files are:
            </p>
            <ul className="space-y-2.5">
              <li className="flex items-center gap-2 text-[13.5px] text-gray-700 font-semibold">
                <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center shrink-0 border border-sky-200">
                  <Check size={11} strokeWidth={3.5} />
                </span>
                High quality
              </li>
              <li className="flex items-center gap-2 text-[13.5px] text-gray-700 font-semibold">
                <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center shrink-0 border border-sky-200">
                  <Check size={11} strokeWidth={3.5} />
                </span>
                Easily downloadable
              </li>
              <li className="flex items-center gap-2 text-[13.5px] text-gray-700 font-semibold">
                <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center shrink-0 border border-sky-200">
                  <Check size={11} strokeWidth={3.5} />
                </span>
                Shareable with others
              </li>
            </ul>
          </div>

          {/* Right: Submission Form */}
          <div className="w-full lg:w-[50%] flex flex-col justify-between rounded-xl border border-gray-200/60 bg-white p-5 shadow-sm">
            <div>
              <div className="flex items-center gap-2 text-gray-900">
                <Link2 size={18} className="text-sky-500" />
                <p className="text-[15px] font-bold">Paste Video Deliverable Link</p>
              </div>
              <p className="mt-1.5 text-[13px] text-gray-500 leading-normal">
                Link a shareable Google Drive, Dropbox, Frame.io, or other video host link to one of your scripts.
              </p>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                value={driveLink}
                onChange={(event) => {
                  setDriveLink(event.target.value);
                  if (error) setError(null);
                }}
                placeholder="https://drive.google.com/..."
                className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 text-[13px] outline-none focus:border-sky-400 focus:bg-white transition-all"
              />
              <button
                type="button"
                onClick={handleSubmitLink}
                className="rounded-xl bg-sky-500 hover:bg-sky-600 text-white px-5 py-2.5 text-[13px] font-bold shadow-sm shadow-sky-500/20 active:scale-95 transition-all whitespace-nowrap"
              >
                Submit Link
              </button>
            </div>
            {error && (
              <p className="mt-2 text-[12.5px] text-red-600 font-medium">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Supabase Videos Table — strict table display */}
      <div className="mb-6">
        <h3 className="text-[15px] font-bold text-gray-900 mb-3">Uploaded Videos</h3>
        {videosTableLoading ? (
          <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
            <div className="border-b border-gray-100 px-4 py-3">
              <div className="h-5 w-32 rounded bg-gray-100" />
              <div className="mt-3 h-4 w-56 rounded bg-gray-100" />
            </div>
            <div className="grid grid-cols-5 gap-px bg-gray-100">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-gray-50 px-5 py-4">
                  <div className="h-4 w-24 rounded bg-gray-200" />
                </div>
              ))}
            </div>
            <div className="px-5 py-10">
              <div className="mx-auto h-4 w-40 rounded bg-gray-100" />
            </div>
          </div>
        ) : videosTableError ? (
          <div className="rounded-xl border border-red-100 bg-red-50 px-5 py-4 text-[13px] text-red-600">
            {videosTableError}
          </div>
        ) : videosTableData ? (
          <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full sm:min-w-[800px] text-left text-[12px] sm:text-[15px]">
                <thead className="bg-gray-50 text-[10px] sm:text-[13px] uppercase tracking-wide text-gray-500">
                  <tr>
                    {videosTableData.columns.filter((c) => c !== 's no.').map((col) => (
                      <th key={col} className="px-2.5 py-2.5 sm:px-5 sm:py-4 font-semibold">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {videosTableData.rows.length > 0 ? (
                    videosTableData.rows.map((row, idx) => (
                      <tr key={idx} className="border-t border-gray-100">
                        {videosTableData.columns.filter((c) => c !== 's no.').map((col) => (
                          <td key={col} className="px-2 py-3 sm:px-5 sm:py-5 text-gray-700 whitespace-nowrap">
                            {col === 'view video' ? (
                              row[col] ? (
                                <a
                                  href={String(row[col])}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 font-semibold text-sky-600 hover:text-sky-700 hover:underline"
                                >
                                  <Play size={13} className="fill-sky-600" /> View
                                  <ExternalLink size={12} />
                                </a>
                              ) : '-'
                            ) : col === 'edited video' ? (
                              String(row['current status'] ?? '').trim().toLowerCase() === 'submitted'
                                ? <span className="text-gray-400 font-medium">--</span>
                                : row[col] ? (
                                  <a
                                    href={String(row[col])}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 font-semibold text-sky-600 hover:text-sky-700 hover:underline"
                                  >
                                    <Play size={13} className="fill-sky-600" /> View
                                    <ExternalLink size={12} />
                                  </a>
                                ) : '-'
                            ) : col === 'current status' ? (
                              <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 sm:px-4 sm:py-1.5 text-[10px] sm:text-[13px] font-semibold ${
                                formatVideoStatus(row[col]).style
                              }`}>
                                {formatVideoStatus(row[col]).label}
                              </span>
                            ) : col === 'date and time of upload' ? (
                              formatVideoDate(row[col])
                            ) : col === 'script name' ? (
                              <span className="block max-w-[130px] sm:max-w-none truncate" title={String(row[col] ?? '')}>
                                {row[col] ?? '-'}
                              </span>
                            ) : (
                              row[col] ?? '-'
                            )}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={videosTableData.columns.filter((c) => c !== 's no.').length} className="px-5 py-10 text-center text-[15px] text-gray-400">
                        No uploaded videos yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <Film size={28} className="mx-auto text-gray-300 mb-2" />
            <p className="text-[14px] text-gray-400 font-medium">No videos table yet. Submit a video link above to get started.</p>
          </div>
        )}
      </div>


      {/* Which Script Selection Modal - Background stays normal and clear */}
      {showSelector && (
        <div className="fixed inset-0 bg-transparent z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl overflow-hidden flex flex-col shadow-2xl border border-gray-200/80 p-5 animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
              <div>
                <h3 className="text-[16px] font-bold text-gray-900">Select Target Script</h3>
                <p className="text-[12.5px] text-gray-500 mt-0.5">Choose a script to link this video to.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowSelector(false)}
                className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 flex items-center justify-center transition-colors"
                aria-label="Close selector"
              >
                <X size={15} />
              </button>
            </div>

            {/* List of scripts loaded from Supabase */}
            <div className="flex-1 max-h-[320px] overflow-y-auto divide-y divide-gray-100 pr-1 py-1 space-y-1">
              {loadingSupabase ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
                  <Loader2 size={24} className="animate-spin text-sky-500" />
                  <span className="text-[13px] font-medium">Loading...</span>
                </div>
              ) : supabaseError ? (
                <p className="text-[13px] text-red-500 text-center py-8">{supabaseError}</p>
              ) : supabaseRows.length === 0 ? (
                <p className="text-[13px] text-gray-400 text-center py-8 font-medium">No scripts found in your Supabase table.</p>
              ) : (
                supabaseRows.map((row) => {
                  return (
                    <button
                      key={row['s no.']}
                      onClick={() => !isLinking && handleLinkToSupabaseScript(row)}
                      disabled={isLinking}
                      className="w-full text-left p-3 hover:bg-sky-50/50 hover:border-sky-200/60 rounded-xl border border-transparent transition-all flex items-start gap-3 group"
                    >
                      <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-100 transition-colors">
                        <FileText size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-bold text-gray-900 leading-snug group-hover:text-emerald-600 transition-colors">
                          {row.title}
                        </p>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0 uppercase tracking-wide group-hover:bg-emerald-100 transition-all self-center">
                        Select
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Modal Actions */}
            <div className="border-t border-gray-100 pt-3.5 mt-3 flex items-center justify-end">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSelector(false)}
                  className="text-[13px] font-semibold text-gray-600 hover:text-gray-900 px-4 py-2 hover:bg-gray-50 rounded-xl transition-all"
                >
                  Cancel
                </button>
                {isLinking && (
                  <span className="flex items-center gap-1.5 text-[13px] text-sky-600 font-semibold">
                    <Loader2 size={14} className="animate-spin" />
                    Linking...
                  </span>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </section>
  );
}

function formatVideoStatus(value: string | number | null | undefined): { label: string; style: string } {
  const status = String(value ?? '').trim().toLowerCase();
  if (status === 'published' || status === 'posted') {
    return { label: 'Published', style: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
  }
  if (status === 'edited') {
    return { label: 'Edited', style: 'border-green-200 bg-green-50 text-green-700' };
  }
  if (status === 'editing' || status === 'in editing') {
    return { label: 'Editing', style: 'border-amber-200 bg-amber-50 text-amber-700' };
  }
  if (status === 'in review' || status === 'review') {
    return { label: 'In Review', style: 'border-sky-200 bg-sky-50 text-sky-700' };
  }
  if (status === 'submitted') {
    return { label: 'Submitted', style: 'border-violet-200 bg-violet-50 text-violet-700' };
  }
  return { label: status || 'Unknown', style: 'border-gray-200 bg-gray-50 text-gray-500' };
}

function formatVideoDate(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-';
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}T/.test(str) || /^\d{4}-\d{2}-\d{2}\s/.test(str)) {
    const d = new Date(str);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return str;
}
