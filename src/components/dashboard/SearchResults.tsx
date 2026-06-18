import { useMemo } from 'react';
import { Search, FileText, Film, Lightbulb, MessageSquare, ArrowRight } from 'lucide-react';
import type { Video } from '../../lib/api';
import { STAGE_SHORT, PLATFORM_META } from '../../lib/pipeline';

type SectionKey = 'overview' | 'explore' | 'scripts' | 'library' | 'schedule';

interface Hit {
  video: Video;
  where: string; // which field matched, for context
  snippet: string;
  jump: SectionKey;
  icon: typeof FileText;
}

interface Props {
  query: string;
  videos: Video[];
  onJump: (s: SectionKey) => void;
  onClear: () => void;
}

/** Build a short snippet around the first match of `q` in `text`. */
function snippetAround(text: string, q: string, pad = 40): string {
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return text.slice(0, pad * 2);
  const start = Math.max(0, idx - pad);
  const end = Math.min(text.length, idx + q.length + pad);
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

export default function SearchResults({ query, videos, onJump, onClear }: Props) {
  const q = query.trim().toLowerCase();

  const hits = useMemo<Hit[]>(() => {
    if (!q) return [];
    const out: Hit[] = [];
    for (const v of videos) {
      // Title / idea angle → scripts (or overview ideas).
      if (v.title.toLowerCase().includes(q)) {
        out.push({ video: v, where: 'Title', snippet: v.title, jump: 'scripts', icon: Lightbulb });
      } else if (v.angle.toLowerCase().includes(q)) {
        out.push({ video: v, where: 'Idea angle', snippet: snippetAround(v.angle, q), jump: 'overview', icon: Lightbulb });
      }
      // Script body → scripts.
      if (v.scriptBody.toLowerCase().includes(q)) {
        out.push({ video: v, where: 'Script', snippet: snippetAround(v.scriptBody, q), jump: 'scripts', icon: FileText });
      }
      // Caption (hook/body/cta/hashtags) → captions & schedule.
      const capText = [v.caption.hook, v.caption.body, v.caption.cta, v.caption.hashtags.join(' ')]
        .join(' ')
        .toLowerCase();
      if (capText.includes(q)) {
        const field = [v.caption.hook, v.caption.body, v.caption.cta, v.caption.hashtags.join(' ')].find(
          (t) => t.toLowerCase().includes(q)
        );
        out.push({ video: v, where: 'Caption', snippet: snippetAround(field ?? '', q), jump: 'schedule', icon: MessageSquare });
      }
      // Platform → library / schedule.
      if (PLATFORM_META[v.schedule.platform].label.toLowerCase().includes(q)) {
        out.push({ video: v, where: 'Platform', snippet: PLATFORM_META[v.schedule.platform].label, jump: 'library', icon: Film });
      }
    }
    return out;
  }, [q, videos]);

  if (!q) return null;

  return (
    <section className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/70 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Search size={17} className="text-sky-500" />
          <h2 className="text-[15px] font-semibold">
            Results for “<span className="text-sky-600">{query.trim()}</span>”
          </h2>
        </div>
        <button onClick={onClear} className="text-[13px] font-semibold text-gray-500 hover:text-gray-800">
          Clear
        </button>
      </div>

      {hits.length === 0 ? (
        <p className="text-center text-[14px] text-gray-400 py-10">
          No matches in your ideas, scripts, captions, or videos.
        </p>
      ) : (
        <div className="space-y-2">
          {hits.map((h, i) => {
            const Icon = h.icon;
            return (
              <button
                key={`${h.video.id}-${h.where}-${i}`}
                onClick={() => onJump(h.jump)}
                className="w-full text-left flex items-start gap-3 border border-gray-100 rounded-xl px-4 py-3 hover:border-sky-200 hover:bg-sky-50/40 transition-all"
              >
                <span className="w-8 h-8 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[14px] font-semibold text-gray-900 truncate">{h.video.title}</p>
                    <span className="text-[11px] font-medium text-gray-400 bg-gray-100 rounded-full px-2 py-0.5 shrink-0">
                      {h.where}
                    </span>
                  </div>
                  <p className="text-[13px] text-gray-500 mt-0.5 line-clamp-2">{h.snippet}</p>
                  <span className="text-[11px] text-gray-400 mt-1 inline-block">
                    Stage: {STAGE_SHORT[h.video.currentStage]}
                  </span>
                </div>
                <ArrowRight size={16} className="text-gray-300 shrink-0 mt-1" />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
