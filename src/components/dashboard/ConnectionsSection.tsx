import { useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  X,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Check,
} from 'lucide-react';
import { pipelineApi, type ClientPlan, type SocialConnectionInfo } from '../../lib/api';

interface Props {
  plan: ClientPlan | null;
  onPlanUpdated: (newPlan: ClientPlan) => void;
}


interface PlatformConfig {
  id: keyof NonNullable<ClientPlan['connections']>;
  name: string;
  description: string;
  colorClass: string;
  badgeBg: string;
  badgeText: string;
  defaultFollowerType: string;
  mockFollowers: number;
  avatarId: string;
  svgIcon: React.ReactNode;
  /** When true, the platform shows a "Coming soon" state instead of Connect. */
  comingSoon?: boolean;
}

// Custom brand SVGs for the social platforms
const PLATFORMS: PlatformConfig[] = [
  {
    id: 'youtube',
    name: 'YouTube Shorts',
    description: 'Auto-publish video Shorts directly to your YouTube channel and sync viewer analytics.',
    colorClass: 'hover:border-red-200 hover:bg-red-50/10',
    badgeBg: 'bg-red-50 text-red-600 border-red-100',
    badgeText: 'text-red-600',
    defaultFollowerType: 'Subscribers',
    mockFollowers: 12400,
    avatarId: '1535713875002-d1d0cf377fde', // Unsplash user image
    svgIcon: (
      <svg className="w-10 h-10 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M23.02 7.14c-.27-1.02-1.07-1.82-2.09-2.09C19.08 4.5 12 4.5 12 4.5s-7.08 0-8.93.55c-1.02.27-1.82 1.07-2.09 2.09C.43 8.99.43 12 .43 12s0 3.01.55 4.86c.27 1.02 1.07 1.82 2.09 2.09C5.45 19.5 12 19.5 12 19.5s7.08 0 8.93-.55c1.02-.27 1.82-1.07 2.09-2.09c.55-1.85.55-4.86.55-4.86s0-3.01-.55-4.86z" fill="#FF0000" />
        <path d="M9.6 15.5l5.97-3.5-5.97-3.5v7z" fill="#FFFFFF" />
      </svg>
    ),
  },
  {
    id: 'instagram',
    name: 'Instagram Business',
    description: 'Direct publish Reels and feed posts. Sync views, likes, and comment interactions.',
    colorClass: 'hover:border-pink-200 hover:bg-pink-50/10',
    badgeBg: 'bg-pink-50 text-pink-600 border-pink-100',
    badgeText: 'text-pink-600',
    defaultFollowerType: 'Followers',
    mockFollowers: 34100,
    avatarId: '1494790108377-be9c29b29330',
    comingSoon: true,
    svgIcon: (
      <svg className="w-10 h-10 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#feda75" />
            <stop offset="25%" stopColor="#fa7e1e" />
            <stop offset="50%" stopColor="#d62976" />
            <stop offset="75%" stopColor="#962fbf" />
            <stop offset="100%" stopColor="#4f5bd5" />
          </linearGradient>
        </defs>
        <rect width="24" height="24" rx="6" fill="url(#ig-grad)" />
        <rect x="5" y="5" width="14" height="14" rx="4" stroke="#FFFFFF" strokeWidth="1.8" fill="none" />
        <circle cx="12" cy="12" r="3.2" stroke="#FFFFFF" strokeWidth="1.8" fill="none" />
        <circle cx="15.8" cy="8.2" r="0.9" fill="#FFFFFF" />
      </svg>
    ),
  },
  {
    id: 'twitter',
    name: 'Twitter / X',
    description: 'Post text updates, scheduled threads, and video links directly from ContentOS.',
    colorClass: 'hover:border-slate-300 hover:bg-slate-50/10',
    badgeBg: 'bg-gray-100 text-gray-800 border-gray-200',
    badgeText: 'text-gray-800',
    defaultFollowerType: 'Followers',
    mockFollowers: 8900,
    avatarId: '1560250097-0b93528c311a',
    comingSoon: true,
    svgIcon: (
      <svg className="w-10 h-10 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="24" height="24" rx="5" fill="#0F1419" />
        <path d="M18.244 4.5h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 24H1.68l7.73-8.835L1.254 4.5H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 6.376H5.117z" fill="#FFFFFF" />
      </svg>
    ),
  },
];

export default function ConnectionsSection({ plan, onPlanUpdated }: Props) {
  // Simulated Toast/Banner Notification
  const [toast, setToast] = useState<{ type: 'success' | 'info'; message: string } | null>(null);

  // Simulated OAuth states
  const [oauthPlatform, setOauthPlatform] = useState<PlatformConfig | null>(null);
  const [oauthHandle, setOauthHandle] = useState('');
  const [oauthAutoPost, setOauthAutoPost] = useState(true);
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  // Handle autoPost toggle on already connected channel
  const [loadingToggleId, setLoadingToggleId] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleOpenOauth = (platform: PlatformConfig) => {
    const defaultHandle = plan?.clientName
      ? `@${plan.clientName.toLowerCase().replace(/\s+/g, '_')}`
      : '@creator_account';
    setOauthHandle(defaultHandle);
    setOauthAutoPost(true);
    setOauthPlatform(platform);
  };

  const handleAuthorize = async () => {
    if (!oauthPlatform || !plan) return;
    setIsAuthorizing(true);
    
    // Simulate API round-trip delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    try {
      const connections = plan.connections || {};
      const newConnection: SocialConnectionInfo = {
        connected: true,
        username: oauthHandle.trim(),
        avatarUrl: `https://images.unsplash.com/photo-${oauthPlatform.avatarId}?auto=format&fit=crop&w=150&h=150&q=80`,
        followers: oauthPlatform.mockFollowers,
        connectedAt: Date.now(),
        autoPost: oauthAutoPost,
      };

      const updatedConnections = {
        ...connections,
        [oauthPlatform.id]: newConnection,
      };

      await pipelineApi.updateConnections(updatedConnections);
      onPlanUpdated({
        ...plan,
        connections: updatedConnections,
      });

      setOauthPlatform(null);
      showToast(`Successfully connected your ${oauthPlatform.name} account!`);
    } catch (err) {
      console.error('Failed to link account:', err);
      showToast('Connection failed. Please check your credentials and try again.', 'info');
    } finally {
      setIsAuthorizing(false);
    }
  };

  const handleDisconnect = async (platformId: keyof NonNullable<ClientPlan['connections']>) => {
    if (!plan) return;
    const platformName = PLATFORMS.find((p) => p.id === platformId)?.name ?? platformId;

    try {
      const connections = { ...(plan.connections || {}) };
      delete connections[platformId];

      await pipelineApi.updateConnections(connections);
      onPlanUpdated({
        ...plan,
        connections,
      });

      showToast(`Disconnected ${platformName} account.`);
    } catch (err) {
      console.error('Failed to disconnect account:', err);
      showToast('Could not disconnect. Check your connection.', 'info');
    }
  };

  const handleToggleAutoPost = async (
    platformId: keyof NonNullable<ClientPlan['connections']>,
    currentValue: boolean
  ) => {
    if (!plan || !plan.connections) return;
    setLoadingToggleId(platformId);

    try {
      const connections = { ...plan.connections };
      const account = connections[platformId];
      if (account) {
        connections[platformId] = {
          ...account,
          autoPost: !currentValue,
        };

        await pipelineApi.updateConnections(connections);
        onPlanUpdated({
          ...plan,
          connections,
        });

        showToast(
          `${PLATFORMS.find((p) => p.id === platformId)?.name}: Auto-posting ${
            !currentValue ? 'enabled' : 'disabled'
          }.`
        );
      }
    } catch (err) {
      console.error('Toggle autoPost failed:', err);
    } finally {
      setLoadingToggleId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toast system */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-[250] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg transition-all animate-in fade-in slide-in-from-top-4 duration-300 ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <p className="text-[13px] font-semibold">{toast.message}</p>
        </div>
      )}

      {/* Main Page Card */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-[20px] font-semibold text-gray-900 tracking-tight leading-tight">
            Social Connections
          </h2>
          <p className="text-[13.5px] text-gray-500 mt-1.5">
            Connect your social accounts to enable direct scheduling and auto-publishing.
          </p>
        </div>

        {/* Platform list */}
        <div className="flex flex-col gap-3">
          {PLATFORMS.map((platform) => {
            const connectionInfo = plan?.connections?.[platform.id];
            const isConnected = !!connectionInfo?.connected;

            return (
              <div
                key={platform.id}
                className={`flex items-center gap-5 px-5 py-5 rounded-2xl border transition-all duration-200 ${
                  isConnected
                    ? 'bg-emerald-50/30 border-emerald-100'
                    : 'bg-gray-50/50 border-gray-100 hover:border-gray-200 hover:bg-white'
                }`}
              >
                {/* Icon */}
                <div className="shrink-0">{platform.svgIcon}</div>

                {/* Name + description */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-semibold text-gray-900">{platform.name}</span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold border ${
                        isConnected
                          ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                          : 'bg-white border-gray-200 text-gray-400'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                      {isConnected ? 'Connected' : platform.comingSoon ? 'Coming soon' : 'Not linked'}
                    </span>
                  </div>
                  <p className="text-[12.5px] text-gray-400 mt-1 leading-relaxed">
                    {platform.description}
                  </p>
                </div>

                {/* Action — fixed width keeps all buttons right-aligned */}
                <div className="shrink-0 w-[140px] flex items-center justify-end gap-3">
                  {isConnected ? (
                    <>
                      <button
                        onClick={() => handleToggleAutoPost(platform.id, !!connectionInfo.autoPost)}
                        disabled={loadingToggleId === platform.id}
                        className="text-gray-400 hover:text-sky-500 transition-colors"
                        title={connectionInfo.autoPost ? 'Disable auto-post' : 'Enable auto-post'}
                      >
                        {loadingToggleId === platform.id ? (
                          <Loader2 size={20} className="animate-spin" />
                        ) : connectionInfo.autoPost ? (
                          <ToggleRight size={24} className="text-sky-500" />
                        ) : (
                          <ToggleLeft size={24} className="text-gray-300" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDisconnect(platform.id)}
                        className="text-[12px] font-semibold text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-all"
                      >
                        Disconnect
                      </button>
                    </>
                  ) : platform.comingSoon ? (
                    <span className="w-full text-center rounded-xl border border-gray-200 bg-gray-50 py-2.5 text-[13px] font-semibold text-gray-400">
                      Coming soon
                    </span>
                  ) : (
                    <button
                      onClick={() => handleOpenOauth(platform)}
                      className="w-full bg-sky-500 hover:bg-sky-600 active:scale-95 text-white font-semibold text-[13px] rounded-xl py-2.5 transition-all shadow-sm"
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <div className="flex items-center gap-2 mt-5 px-5 py-3.5 rounded-xl bg-gray-50 border border-gray-100">
          <ShieldCheck size={14} className="text-gray-400 shrink-0" />
          <p className="text-[12px] text-gray-500">
            All connections use official platform APIs. ContentOS never stores your credentials.
          </p>
        </div>
      </section>

      {/* Simulated OAuth Modal */}
      {oauthPlatform && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-sky-50 to-white border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-sky-500 text-white flex items-center justify-center font-cursive text-[18px] font-bold shadow-sm">
                  C
                </span>
                <span className="text-[12px] font-bold text-gray-400">⚡ Connecting Account</span>
              </div>
              <button
                onClick={() => setOauthPlatform(null)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-full transition-all"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {/* Animated Linking Visual */}
              <div className="flex items-center justify-center gap-8 py-2">
                <div className="w-14 h-14 rounded-2xl bg-white border border-gray-100 shadow-md flex items-center justify-center text-[22px] font-cursive font-bold text-sky-600">
                  ContentOS
                </div>
                {/* Dots animation */}
                <div className="flex gap-1.5 items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-bounce delay-100" />
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-bounce delay-200" />
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-bounce delay-300" />
                </div>
                <div className="w-14 h-14 rounded-2xl bg-white border border-gray-100 shadow-md flex items-center justify-center">
                  {oauthPlatform.svgIcon}
                </div>
              </div>

              <div className="text-center">
                <h2 className="text-[16px] font-bold text-gray-900">
                  Link ContentOS with {oauthPlatform.name}
                </h2>
                <p className="text-[12.5px] text-gray-500 mt-1 max-w-sm mx-auto">
                  Authorizing grants ContentOS secure access to schedule and post videos on your channel automatically.
                </p>
              </div>

              {/* Form Input */}
              <div className="space-y-1.5 bg-gray-50/50 p-4 border border-gray-100 rounded-xl">
                <label className="block text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
                  Account / Channel Handle
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={oauthHandle}
                    onChange={(e) => setOauthHandle(e.target.value)}
                    placeholder="@username"
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-[13.5px] outline-none focus:border-sky-500 transition-colors font-medium text-gray-800"
                  />
                </div>

                {/* Scope checklist */}
                <div className="mt-4 pt-3 border-t border-gray-100 space-y-2">
                  <p className="text-[11.5px] font-bold text-gray-400 uppercase tracking-wide">
                    Permissions Requested:
                  </p>
                  <ul className="space-y-1.5 text-[12px] text-gray-600">
                    <li className="flex items-center gap-1.5">
                      <Check size={12} className="text-sky-500 stroke-[3]" />
                      Manage and upload video content
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check size={12} className="text-sky-500 stroke-[3]" />
                      Retrieve public channel information
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check size={12} className="text-sky-500 stroke-[3]" />
                      Read post comments and interactions
                    </li>
                  </ul>
                </div>

                {/* Auto post setting */}
                <div className="mt-3 flex items-center justify-between pt-2">
                  <div>
                    <p className="text-[12.5px] font-semibold text-gray-800">Enable Auto-Posting</p>
                    <p className="text-[10px] text-gray-400">Publish scheduled media automatically</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOauthAutoPost(!oauthAutoPost)}
                    className="text-gray-400 hover:text-sky-600 transition-colors"
                  >
                    {oauthAutoPost ? (
                      <ToggleRight size={24} className="text-sky-500" />
                    ) : (
                      <ToggleLeft size={24} className="text-gray-300" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setOauthPlatform(null)}
                disabled={isAuthorizing}
                className="px-4 py-2 text-[13px] font-semibold text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleAuthorize}
                disabled={isAuthorizing || !oauthHandle.trim()}
                className="bg-sky-500 hover:bg-sky-600 text-white font-semibold text-[13px] rounded-xl px-5 py-2 flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-[0.98]"
              >
                {isAuthorizing && <Loader2 size={14} className="animate-spin" />}
                {isAuthorizing ? 'Authorizing...' : 'Confirm Connection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
