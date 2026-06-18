import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import {
  LayoutDashboard,
  Compass,
  FileText,
  TrendingUp,
  Film,
  CalendarDays,
  Loader2,
  Link2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { auth } from '../firebase';
import { useAuth } from '../auth/AuthContext';
import { pipelineApi, type ClientPlan, type Video } from '../lib/api';
import OverviewSection from '../components/dashboard/OverviewSection';
import ScriptsSection from '../components/dashboard/ScriptsSection';
import LibrarySection from '../components/dashboard/LibrarySection';
import CaptionsScheduleSection from '../components/dashboard/CaptionsScheduleSection';
import ExploreSection from '../components/dashboard/ExploreSection';
import ProgressSection from '../components/dashboard/ProgressSection';
import ConnectionsSection from '../components/dashboard/ConnectionsSection';
import SettingsPanel from '../components/dashboard/SettingsPanel';

type SectionKey =
  | 'overview'
  | 'explore'
  | 'scripts'
  | 'progress'
  | 'library'
  | 'schedule'
  | 'connections';

const SECTIONS: { key: SectionKey; label: string; shortLabel: string; icon: LucideIcon }[] = [
  { key: 'overview', label: 'Overview', shortLabel: 'Home', icon: LayoutDashboard },
  { key: 'scripts', label: 'Scripts', shortLabel: 'Scripts', icon: FileText },
  { key: 'library', label: 'Video Library', shortLabel: 'Library', icon: Film },
  { key: 'progress', label: 'Progress', shortLabel: 'Progress', icon: TrendingUp },
  { key: 'schedule', label: 'Captions & Schedule', shortLabel: 'Schedule', icon: CalendarDays },
  { key: 'connections', label: 'Connections', shortLabel: 'Connect', icon: Link2 },
];

const SECTION_KEYS = new Set<SectionKey>([
  'overview',
  'explore',
  'scripts',
  'library',
  'schedule',
  'progress',
  'connections',
]);

/** The URL path for a section ('overview' is the bare /dashboard). */
function pathForSection(s: SectionKey): string {
  return s === 'overview' ? '/dashboard' : `/dashboard/${s}`;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { section: sectionParam } = useParams<{ section?: string }>();
  const { user, refreshUser } = useAuth();

  // The active section comes from the URL; unknown params fall back to Overview.
  const section: SectionKey =
    sectionParam && SECTION_KEYS.has(sectionParam as SectionKey)
      ? (sectionParam as SectionKey)
      : 'overview';

  const [plan, setPlan] = useState<ClientPlan | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Navigate to a section's route.
  const goToSection = (s: SectionKey) => navigate(pathForSection(s));

  const load = async () => {
    // Yield a microtask first so the synchronous setState calls below don't run
    // inside the effect body (avoids cascading-render lint + matches real async).
    await Promise.resolve();
    setLoading(true);
    setError(null);
    try {
      // Log the uid so it's easy to grab for the seed script.
      if (auth.currentUser) console.info('[SocialVert] your uid:', auth.currentUser.uid);
      const [planData, videoData] = await Promise.all([
        pipelineApi.plan(),
        pipelineApi.videos(),
      ]);
      setPlan(planData);
      setVideos(videoData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load your dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch the dashboard once on mount. `load` awaits a microtask before any
    // setState, so this is not a synchronous-in-effect update.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  const displayName = user?.displayName ?? undefined;
  const photoURL = plan?.photoData ?? '';
  const initials = (displayName ?? user?.email ?? '?').slice(0, 2).toUpperCase();
  // Greeting name: username, else the part before the @ in email.
  const greetingName = displayName ?? user?.email?.split('@')[0] ?? 'there';

  // Apply a script review locally after the API confirms it.
  const onReviewed = (updated: Video) => {
    setVideos((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
  };

  const onVideoAdded = (newVideo: Video) => {
    setVideos((prev) => [...prev, newVideo]);
  };

  const logout = async () => {
    await signOut(auth);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-100 via-sky-50 to-white font-apple text-gray-900 p-3 sm:p-5 pb-24 lg:pb-5">
      {/* Mobile top bar — brand + explore + avatar (hidden on desktop) */}
      <div className="lg:hidden mb-3 flex items-center justify-between rounded-2xl bg-white/80 backdrop-blur-md border border-white/70 shadow-sm px-4 py-3">
        <button onClick={() => navigate('/')} className="flex items-center shrink-0" title="Back to site">
          <span className="font-cursive text-sky-600 text-[22px] font-bold leading-none">ContentOS</span>
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => goToSection('explore')}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
              section === 'explore' ? 'bg-sky-500 text-white shadow-sm' : 'bg-sky-50 text-gray-600'
            }`}
            title="Explore"
            aria-label="Explore"
          >
            <Compass size={18} />
          </button>
          <button onClick={() => setSettingsOpen(true)} title="Account & settings" aria-label="Account & settings">
            {photoURL ? (
              <img src={photoURL} alt={greetingName} className="w-9 h-9 rounded-full object-cover shadow-sm ring-2 ring-white" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 text-white flex items-center justify-center text-[13px] font-semibold shadow-sm ring-2 ring-white">
                {initials}
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Body grid — no top bar; sidebar holds brand, nav, and the profile area */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5 items-start">
        {/* Sidebar — desktop only; mobile uses the bottom nav bar instead */}
        <aside className="hidden lg:flex bg-white/80 backdrop-blur-md rounded-2xl border border-white/70 shadow-sm p-5 lg:sticky lg:top-5 lg:h-[calc(100vh-2.5rem)] flex-col gap-4">
          {/* Brand */}
          <div className="flex items-center justify-between gap-3 px-1">
            <button
              onClick={() => navigate('/')}
              className="flex items-center shrink-0"
              title="Back to site"
            >
              <span className="font-cursive text-sky-600 text-[26px] font-bold leading-none">
                ContentOS
              </span>
            </button>
            <button
              onClick={() => goToSection('explore')}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                section === 'explore'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'bg-sky-50 text-gray-600 hover:bg-sky-100'
              }`}
              title="Explore"
              aria-label="Explore"
            >
              <Compass size={18} />
            </button>
          </div>

          {/* Nav grows to fill, spreading items evenly down the sidebar */}
          <nav className="flex flex-col gap-1 flex-1 justify-evenly">
            {SECTIONS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => goToSection(key)}
                className={`flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-[15px] font-medium transition-colors whitespace-nowrap ${
                  section === key ? 'bg-sky-500 text-white shadow-sm' : 'text-gray-600 hover:bg-sky-50'
                }`}
              >
                <Icon size={19} />
                {label}
              </button>
            ))}
          </nav>

          <div className="border-t border-gray-100 hidden lg:block" />

          {/* Profile + notifications (replaces the old logout button) */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSettingsOpen(true)}
              title="Account & settings"
              className="flex items-center gap-3 flex-1 min-w-0 rounded-xl p-2 hover:bg-sky-50 transition-colors text-left"
            >
              {photoURL ? (
                <img
                  src={photoURL}
                  alt={greetingName}
                  className="w-10 h-10 rounded-full object-cover shrink-0 shadow-sm ring-2 ring-white"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 text-white flex items-center justify-center text-[14px] font-semibold shrink-0 shadow-sm ring-2 ring-white">
                  {initials}
                </div>
              )}
              <div className="min-w-0 leading-tight">
                <p className="text-[10px] uppercase tracking-wide text-gray-400">Welcome back</p>
                <p className="text-[15px] font-semibold text-gray-900 truncate">{greetingName}</p>
              </div>
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0 space-y-4">
          {error && (
            <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-red-100 shadow-sm p-4">
              <p className="text-[14px] text-red-600">{error}</p>
              <p className="mt-1 text-[13px] text-gray-500">
                Check your connection and that you're signed in, then try again.
              </p>
              <button
                onClick={load}
                className="mt-3 text-[13px] font-semibold text-sky-600 hover:text-sky-700"
              >
                Retry
              </button>
            </div>
          )}

          {loading ? (
            <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/70 shadow-sm flex items-center justify-center py-24 text-gray-300">
              <Loader2 size={28} className="animate-spin" />
            </div>
          ) : (
            <>
              {section === 'overview' && (
                <OverviewSection plan={plan} videos={videos} onJump={goToSection} />
              )}
              {section === 'explore' && (
                <ExploreSection
                  videos={videos}
                  niche={plan?.niche ?? ''}
                  onVideoAdded={onVideoAdded}
                />
              )}
              {section === 'scripts' && (
                <ScriptsSection
                  videos={videos}
                  username={greetingName}
                  onReviewed={onReviewed}
                />
              )}
              {section === 'progress' && <ProgressSection username={greetingName} />}
              {section === 'library' && (
                <LibrarySection videos={videos} onVideoUpdated={onReviewed} />
              )}
              {section === 'schedule' && <CaptionsScheduleSection videos={videos} />}
              {section === 'connections' && (
                <ConnectionsSection
                  plan={plan}
                  onPlanUpdated={(updatedPlan) => setPlan(updatedPlan)}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Mobile bottom navigation — icons only (hidden on desktop) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-gray-100 bg-white/95 backdrop-blur-md shadow-[0_-2px_12px_rgba(0,0,0,0.05)]">
        <div className="flex items-stretch justify-around px-1 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
          {SECTIONS.map(({ key, shortLabel, icon: Icon }) => {
            const active = section === key;
            return (
              <button
                key={key}
                onClick={() => goToSection(key)}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 transition-colors ${
                  active ? 'text-sky-600' : 'text-gray-400'
                }`}
                aria-label={shortLabel}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={20} className={active ? 'text-sky-600' : 'text-gray-400'} />
                <span className="text-[10px] font-medium leading-none">{shortLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Account & settings drawer (opened from the avatar) */}
      <SettingsPanel
        open={settingsOpen}
        user={user}
        photoData={photoURL}
        niche={plan?.niche ?? ''}
        onClose={() => setSettingsOpen(false)}
        onLogout={logout}
        refreshUser={refreshUser}
        onPhotoChange={(dataUrl) =>
          setPlan((prev) => (prev ? { ...prev, photoData: dataUrl } : prev))
        }
        onNicheChange={(value) =>
          setPlan((prev) => (prev ? { ...prev, niche: value } : prev))
        }
      />
    </div>
  );
}
