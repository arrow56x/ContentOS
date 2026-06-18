import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import {
  Check,
  ExternalLink,
  Heart,
  MessageCircle,
  Plus,
  RefreshCw,
  Send,
  X,
} from 'lucide-react';
import { exploreApi, pipelineApi, type ScrapedPost, type Video } from '../../lib/api';

interface Props {
  videos: Video[];
  niche: string;
  onVideoAdded: (video: Video) => void;
}

export default function ExploreSection({ videos, niche, onVideoAdded }: Props) {
  const [searchNiche, setSearchNiche] = useState(niche || 'Business');
  const [isScraping, setIsScraping] = useState(false);
  const [scrapedData, setScrapedData] = useState<ScrapedPost[]>([]);
  const [scrapeMessage, setScrapeMessage] = useState('');
  const [usingLiveData, setUsingLiveData] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [activePost, setActivePost] = useState<ScrapedPost | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const handleScrape = useCallback(async (targetNiche: string) => {
    const nextNiche = targetNiche.trim() || 'Business';
    setSearchNiche(nextNiche);
    setIsScraping(true);
    setScrapeMessage('');

    try {
      const response = await exploreApi.scrape(nextNiche);
      if (response.posts.length > 0) {
        setScrapedData(response.posts);
        setUsingLiveData(response.live);
        setScrapeMessage(response.message);
      } else {
        setScrapedData([]);
        setUsingLiveData(false);
        setScrapeMessage('No public results were found for this niche right now. Try refreshing in a moment.');
      }
    } catch (err) {
      setScrapedData([]);
      setUsingLiveData(false);
      setScrapeMessage(
        err instanceof Error
          ? `${err.message} — make sure the server is running and try refreshing.`
          : 'Could not reach the content server. Make sure the server is running and try refreshing.'
      );
    } finally {
      setIsScraping(false);
      setLastRefreshed(new Date());
    }
  }, []);

  useEffect(() => {
    const target = niche || 'Business';
    void Promise.resolve().then(() => handleScrape(target));
  }, [handleScrape, niche]);

  // Auto-refresh every 5 minutes while this tab is open
  useEffect(() => {
    const id = setInterval(() => {
      handleScrape(searchNiche);
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [handleScrape, searchNiche]);

  const toggleLike = (id: string) => {
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSaveToPipeline = async (post: ScrapedPost) => {
    setImportingId(post.id);
    try {
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const newVideoId = `scraped-${Date.now()}`;

      const newVideo: Omit<Video, 'uid' | 'stages' | 'currentStage' | 'created_at' | 'updated_at'> = {
        id: newVideoId,
        month: currentMonth,
        title: post.hookText || post.caption.slice(0, 50),
        angle: post.caption,
        ideaApproved: false,
        scriptStatus: post.type === 'script' ? 'delivered' : 'pending',
        scriptBody: post.type === 'script' ? post.scriptBody : '',
        scriptDeliveredAt: post.type === 'script' ? Date.now() : null,
        scriptEta: null,
        scriptApproval: 'none',
        clientFeedback: '',
        productionStatus: 'awaiting-recording',
        videoUrl: post.sourceUrl || '',
        caption: {
          hook: post.hookText,
          body: post.scriptBody || post.caption,
          cta: post.ctaText || '',
          hashtags: post.hashtags || [],
        },
        schedule: {
          status: 'pending',
          platform: post.platform === 'youtube' ? 'youtube-shorts' : post.platform === 'tiktok' ? 'tiktok' : 'instagram',
          postDate: null,
        },
        order: videos.length,
      };

      const saved = await pipelineApi.addVideo(newVideo);
      onVideoAdded(saved);
      setSavedIds((prev) => new Set([...prev, post.id]));
    } catch (err) {
      console.error('Failed to import video:', err);
    } finally {
      setImportingId(null);
    }
  };

  // Only media content is shown, capped at 16 for the 4×4 grid.
  const filteredPosts = scrapedData.filter((post) => post.type === 'media').slice(0, 16);

  return (
    <section className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/70 shadow-sm p-4 sm:p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Explore</h2>
          <button
            onClick={() => handleScrape(searchNiche)}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-gray-600 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-600"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <p className="text-[13px] text-gray-500">
            Here you can see the latest content that is going viral in your niche.
          </p>
          {lastRefreshed && !isScraping && (
            <span className="text-[11px] text-gray-400 shrink-0">
              Updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {isScraping && <SkeletonGrid />}

      {!isScraping && (
        <>
          {!usingLiveData && scrapeMessage && (
            <div className="mb-5 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-[12.5px] text-amber-700">
              {scrapeMessage}
            </div>
          )}

          {filteredPosts.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-[14px] text-gray-400 font-medium">No trending content found right now.</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3 max-w-7xl mx-auto">
              {filteredPosts.map((post) => {
                return (
                  <button
                    key={post.id}
                    onClick={() => setActivePost(post)}
                    className="relative aspect-[9/16] min-h-[320px] bg-black cursor-pointer overflow-hidden group select-none rounded-xl border border-gray-100 shadow-sm text-left"
                  >
                    {post.type === 'media' && (
                      <>
                        {post.embedUrl && usingLiveData && post.platform !== 'youtube' ? (
                          <VideoOnlyEmbed post={post} />
                        ) : (
                          <img
                            src={post.mediaUrl}
                            alt="Thumbnail"
                            className="w-full h-full object-cover"
                          />
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {activePost && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="relative bg-white w-full max-w-5xl h-[90vh] md:h-[82vh] rounded-2xl overflow-hidden flex flex-col md:flex-row shadow-2xl animate-in fade-in zoom-in-95 duration-250">
            <button
              onClick={() => setActivePost(null)}
              className="absolute top-4 right-4 md:right-auto md:left-4 z-[210] bg-black/60 hover:bg-black text-white hover:text-gray-200 w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-colors border border-white/10"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>

            <div className="w-full md:w-[46%] h-[52%] md:h-full bg-black flex items-center justify-center relative select-none">
              {activePost.embedUrl ? (
                <iframe
                  src={activePost.embedUrl}
                  title={`${activePost.platform} embed by ${activePost.username}`}
                  className="h-full w-full max-w-[520px] border-0 rounded-t-2xl md:rounded-t-none md:rounded-l-2xl"
                  allowFullScreen
                  scrolling="no"
                  allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                />
              ) : activePost.type === 'hook' ? (
                <div className="w-full h-full bg-gradient-to-tr from-gray-950 via-slate-900 to-indigo-950 p-6 sm:p-10 flex flex-col justify-between text-white">
                  <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-sky-400 font-bold bg-sky-950/40 border border-sky-800/40 rounded-full px-3 py-1 self-start">
                    Viral Hook Card
                  </span>
                  <div className="my-auto space-y-4">
                    <p className="text-[22px] sm:text-[28px] font-extrabold tracking-tight leading-snug text-white">
                      "{activePost.hookText}"
                    </p>
                    <div className="h-[3px] w-14 bg-sky-500 rounded-full" />
                    <p className="text-[12px] sm:text-[14px] text-sky-300 font-medium leading-relaxed max-w-md">
                      Curiosity hook format optimized for early retention in the {searchNiche} niche.
                    </p>
                  </div>
                  <div className="text-gray-400 text-[12px]">Created by @{activePost.username}</div>
                </div>
              ) : (
                <div className="w-full h-full bg-slate-900 p-6 sm:p-10 flex flex-col justify-between text-white">
                  <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-800/40 rounded-full px-3 py-1 self-start">
                    Teleprompter script view
                  </span>
                  <div className="my-auto bg-white/5 border border-white/10 rounded-xl p-5 font-mono text-[12px] sm:text-[13px] text-gray-200 leading-relaxed shadow-sm max-h-[300px] overflow-y-auto whitespace-pre-line">
                    {activePost.scriptBody}
                  </div>
                  <div className="text-gray-400 text-[12px]">Created by @{activePost.username}</div>
                </div>
              )}
            </div>

            <div className="w-full md:w-[54%] h-[48%] md:h-full flex flex-col justify-between bg-white border-l border-gray-100">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={activePost.avatarUrl}
                    alt={activePost.author}
                    className="w-9 h-9 rounded-full object-cover border border-gray-200"
                  />
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="text-[13px] sm:text-[14px] font-bold text-gray-900 hover:underline cursor-pointer">
                        {activePost.username}
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                    </div>
                    <span className="text-[11px] text-gray-400 block">Trending - {searchNiche}</span>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-sky-500 bg-sky-50 rounded-full px-2.5 py-0.5 uppercase tracking-wider">
                  {activePost.platform}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="text-[13px] sm:text-[13.5px] leading-relaxed text-gray-800">
                  <span className="font-bold text-gray-900 mr-2 hover:underline cursor-pointer">
                    {activePost.username}
                  </span>
                  {activePost.caption}
                </div>

                <div className="flex flex-wrap gap-1">
                  {activePost.hashtags.map((tag) => (
                    <span key={tag} className="text-[12px] text-sky-600 font-medium hover:underline cursor-pointer">
                      {tag}
                    </span>
                  ))}
                </div>

                {activePost.sourceUrl && (
                  <a
                    href={activePost.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-[12px] font-semibold text-gray-600 hover:border-sky-200 hover:text-sky-600"
                  >
                    <ExternalLink size={13} />
                    Open original {activePost.platform}
                  </a>
                )}

                <div className="border-t border-gray-100 my-2" />

                <div className="space-y-3">
                  {activePost.comments.map((comment, cIdx) => (
                    <div key={cIdx} className="text-[12px] sm:text-[12.5px] leading-snug flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-[8px] font-bold text-gray-600 shrink-0">
                        {comment.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-bold text-gray-900 mr-1.5 hover:underline cursor-pointer">{comment.username}</span>
                        <span className="text-gray-600">{comment.text}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 border-t border-gray-100 bg-gray-50/50">
                <div className="flex items-center justify-between mb-3.5">
                  <div className="flex items-center gap-4 text-gray-700">
                    <button
                      onClick={() => toggleLike(activePost.id)}
                      className={`transform active:scale-125 transition-transform ${likedIds.has(activePost.id) ? 'text-rose-500' : 'hover:text-gray-900'}`}
                      aria-label="Like"
                    >
                      <Heart size={21} className={likedIds.has(activePost.id) ? 'fill-rose-500 text-rose-500' : ''} />
                    </button>
                    <button className="hover:text-gray-900" aria-label="Comment">
                      <MessageCircle size={21} />
                    </button>
                    <button className="hover:text-gray-900" aria-label="Share">
                      <Send size={21} />
                    </button>
                  </div>

                  <span className="text-[11px] text-gray-400 font-semibold uppercase">
                    {activePost.timeAgo}
                  </span>
                </div>

                <div className="text-[13px] font-bold text-gray-900 mb-4">
                  {(activePost.likes + (likedIds.has(activePost.id) ? 1 : 0)).toLocaleString()} likes
                </div>

                <button
                  onClick={() => !savedIds.has(activePost.id) && !importingId && handleSaveToPipeline(activePost)}
                  disabled={savedIds.has(activePost.id) || importingId === activePost.id}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13.5px] font-bold border transition-all ${
                    savedIds.has(activePost.id)
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700 cursor-not-allowed'
                      : 'bg-sky-500 border-sky-500 text-white hover:bg-sky-600 hover:border-sky-600 active:scale-[0.98]'
                  }`}
                >
                  {importingId === activePost.id ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : savedIds.has(activePost.id) ? (
                    <Check size={16} />
                  ) : (
                    <Plus size={16} />
                  )}
                  <span>{savedIds.has(activePost.id) ? 'Saved to Your Pipeline' : 'Import to Pipeline'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function VideoOnlyEmbed({ post }: { post: ScrapedPost }) {
  const frameStyle = getVideoCropStyle(post.platform);

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <iframe
        src={post.embedUrl}
        title={`${post.platform} embed by ${post.username}`}
        className="pointer-events-none absolute border-0 bg-black"
        style={frameStyle}
        loading="lazy"
        scrolling="no"
        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-4 gap-3 max-w-7xl mx-auto">
      {Array.from({ length: 16 }).map((_, index) => (
        <div
          key={index}
          className="aspect-[9/16] min-h-[320px] overflow-hidden rounded-xl border border-gray-100 bg-gray-100 shadow-sm"
        >
          <div className="h-full w-full animate-pulse bg-gradient-to-br from-gray-100 via-gray-200 to-gray-100" />
        </div>
      ))}
    </div>
  );
}

function getVideoCropStyle(platform: ScrapedPost['platform']): CSSProperties {
  if (platform === 'instagram') {
    return {
      left: '50%',
      top: '-118px',
      width: '100%',
      height: '900px',
      transform: 'translateX(-50%) scale(1.56)',
      transformOrigin: 'top center',
    };
  }

  if (platform === 'facebook') {
    return {
      left: '50%',
      top: '-70px',
      width: '100%',
      height: '860px',
      transform: 'translateX(-50%) scale(1.34)',
      transformOrigin: 'top center',
    };
  }

  return {
    inset: 0,
    width: '100%',
    height: '100%',
  };
}
