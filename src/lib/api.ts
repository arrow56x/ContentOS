// Data layer — reads/writes Firestore directly from the browser (no backend).
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../firebase';

// ---- Domain types -----------------------------------------------------------

export const STAGES = ['ideation', 'scripting', 'production', 'captions', 'scheduling'] as const;
export type Stage = (typeof STAGES)[number];
export type StageStatus = 'not-started' | 'in-progress' | 'complete';

export type ScriptStatus = 'pending' | 'in-progress' | 'delivered';
export type ScriptApproval = 'none' | 'approved' | 'changes-requested';
export type ProductionStatus = 'awaiting-recording' | 'in-editing' | 'ready';
export type ScheduleStatus = 'pending' | 'scheduled' | 'posted';
export type Platform = 'instagram' | 'tiktok' | 'youtube-shorts' | 'google-business';

export interface SocialConnectionInfo {
  connected: boolean;
  username?: string;
  avatarUrl?: string;
  followers?: number;
  connectedAt?: number;
  autoPost?: boolean;
}

export interface ClientPlan {
  uid: string;
  clientName: string;
  monthlyQuota: number;
  currentMonth: string;
  photoData: string; // profile picture as a data-URL string (empty if none)
  niche: string; // creator's niche, free text (e.g. "Law", "Football", "Fun")
  updated_at: number;
  connections?: {
    youtube?: SocialConnectionInfo;
    tiktok?: SocialConnectionInfo;
    instagram?: SocialConnectionInfo;
    linkedin?: SocialConnectionInfo;
    twitter?: SocialConnectionInfo;
  };
}

export interface VideoCaption {
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
}

export interface VideoSchedule {
  status: ScheduleStatus;
  platform: Platform;
  postDate: number | null;
}

export interface Video {
  id: string;
  uid: string;
  month: string;
  title: string;
  angle: string;
  ideaApproved: boolean;
  scriptStatus: ScriptStatus;
  scriptBody: string;
  scriptDeliveredAt: number | null;
  scriptEta: number | null;
  scriptApproval: ScriptApproval;
  clientFeedback: string;
  productionStatus: ProductionStatus;
  videoUrl: string;
  caption: VideoCaption;
  schedule: VideoSchedule;
  currentStage: Stage;
  order: number;
  created_at: number;
  updated_at: number;
  /** Derived per-stage board status, computed client-side. */
  stages: Record<Stage, StageStatus>;
}

export type ExplorePlatform = 'instagram' | 'facebook' | 'youtube' | 'tiktok';

export interface ScrapedPost {
  id: string;
  type: 'media' | 'hook' | 'script';
  platform: ExplorePlatform;
  author: string;
  username: string;
  avatarUrl: string;
  likes: number;
  commentsCount: number;
  caption: string;
  timeAgo: string;
  mediaUrl: string;
  embedUrl?: string;
  sourceUrl: string;
  hookText: string;
  scriptBody: string;
  ctaText: string;
  hashtags: string[];
  comments: { username: string; text: string }[];
}

export interface ExploreResponse {
  niche: string;
  live: boolean;
  generatedAt: number;
  message: string;
  posts: ScrapedPost[];
}

// ---- Stage derivation (was on the server) -----------------------------------

const DEFAULT_CAPTION: VideoCaption = { hook: '', body: '', cta: '', hashtags: [] };
const DEFAULT_SCHEDULE: VideoSchedule = { status: 'pending', platform: 'instagram', postDate: null };

function stageStatuses(v: Omit<Video, 'stages' | 'currentStage'>): Record<Stage, StageStatus> {
  const ideation: StageStatus = v.ideaApproved ? 'complete' : 'in-progress';
  const scripting: StageStatus =
    v.scriptStatus === 'delivered'
      ? 'complete'
      : v.scriptStatus === 'in-progress'
        ? 'in-progress'
        : 'not-started';
  const production: StageStatus =
    v.productionStatus === 'ready'
      ? 'complete'
      : v.productionStatus === 'in-editing' || v.videoUrl
        ? 'in-progress'
        : 'not-started';
  const hasCaption = Boolean(v.caption.hook || v.caption.body || v.caption.cta);
  const captions: StageStatus = hasCaption ? 'complete' : 'not-started';
  const scheduling: StageStatus =
    v.schedule.status === 'posted'
      ? 'complete'
      : v.schedule.status === 'scheduled'
        ? 'in-progress'
        : 'not-started';
  return { ideation, scripting, production, captions, scheduling };
}

function deriveCurrentStage(stages: Record<Stage, StageStatus>): Stage {
  for (const stage of STAGES) if (stages[stage] !== 'complete') return stage;
  return 'scheduling';
}

/** Normalize a raw Firestore video doc into a full Video with derived fields. */
function hydrateVideo(uid: string, id: string, d: Record<string, unknown>): Video {
  const base = {
    id,
    uid,
    month: (d.month as string) ?? '',
    title: (d.title as string) ?? '',
    angle: (d.angle as string) ?? '',
    ideaApproved: Boolean(d.ideaApproved),
    scriptStatus: (d.scriptStatus as ScriptStatus) ?? 'pending',
    scriptBody: (d.scriptBody as string) ?? '',
    scriptDeliveredAt: (d.scriptDeliveredAt as number) ?? null,
    scriptEta: (d.scriptEta as number) ?? null,
    scriptApproval: (d.scriptApproval as ScriptApproval) ?? 'none',
    clientFeedback: (d.clientFeedback as string) ?? '',
    productionStatus: (d.productionStatus as ProductionStatus) ?? 'awaiting-recording',
    videoUrl: (d.videoUrl as string) ?? '',
    caption: { ...DEFAULT_CAPTION, ...((d.caption as VideoCaption) ?? {}) },
    schedule: { ...DEFAULT_SCHEDULE, ...((d.schedule as VideoSchedule) ?? {}) },
    order: (d.order as number) ?? 0,
    created_at: (d.created_at as number) ?? Date.now(),
    updated_at: (d.updated_at as number) ?? Date.now(),
  };
  const stages = stageStatuses(base);
  return { ...base, stages, currentStage: deriveCurrentStage(stages) };
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in.');
  return uid;
}

// ---- Shared API helpers -----------------------------------------------------

const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

async function authHeaders(): Promise<HeadersInit> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not signed in.');
  return { Authorization: `Bearer ${token}` };
}

// ---- Users -------------------------------------------------------------------

export interface AppUser {
  userId: string;
  name: string;
  email: string;
  createdAt: number;
}

export const usersApi = {
  /** Create the user's record on signup: userId, name, email, createdAt. */
  async create(user: { uid: string; name: string; email: string }): Promise<void> {
    await setDoc(doc(db, 'users', user.uid), {
      userId: user.uid,
      name: user.name,
      email: user.email,
      createdAt: Date.now(),
    });
  },

  /** Create all per-user Supabase tables ({email}_progress, _scripts, _videos). */
  async init(): Promise<void> {
    const response = await fetch(`${API_BASE}/api/users/init`, {
      method: 'POST',
      headers: await authHeaders(),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      // Log but don't throw — a table init failure must not block signup
      console.warn('[usersApi.init] failed:', body?.error ?? response.status);
    }
  },

  /** Create {email}_progress table (idempotent) and return its rows. */
  async loadProgress(): Promise<{ ok: boolean; table: string; columns: string[]; rows: Record<string, string | number | null>[] }> {
    const response = await fetch(`${API_BASE}/api/users/progress/load`, {
      method: 'POST',
      headers: await authHeaders(),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? 'Failed to load progress table.');
    }
    return response.json();
  },

  /**
   * Mark "raw video uploaded" = 'submitted' on the progress row matching scriptName.
   * Inserts a new row if none exists for that script.
   */
  async markRawVideoSubmitted(scriptName: string): Promise<void> {
    const response = await fetch(`${API_BASE}/api/users/progress/raw-video`, {
      method: 'PATCH',
      headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ scriptName }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? 'Failed to update progress table.');
    }
  },
};

// ---- Pipeline API (Firestore-direct) ----------------------------------------

const DEFAULT_QUOTA = 20;

export const pipelineApi = {
  /** Read the user's plan (stored on their users/{uid} doc). */
  async plan(): Promise<ClientPlan> {
    const uid = requireUid();
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    const d = snap.exists() ? snap.data() : {};
    return {
      uid,
      clientName:
        (d.clientName as string) ??
        (d.name as string) ??
        auth.currentUser?.displayName ??
        'Client',
      monthlyQuota: (d.monthlyQuota as number) ?? DEFAULT_QUOTA,
      currentMonth: (d.currentMonth as string) ?? currentMonthKey(),
      photoData: (d.photoData as string) ?? '',
      niche: (d.niche as string) ?? '',
      updated_at: (d.updated_at as number) ?? Date.now(),
      connections: d.connections ?? {},
    };
  },

  /** List the user's videos (optionally filtered to a month). */
  async videos(month?: string): Promise<Video[]> {
    const uid = requireUid();
    const col = collection(db, 'users', uid, 'videos');
    const q = month
      ? query(col, where('month', '==', month), orderBy('order', 'asc'))
      : query(col, orderBy('order', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((docSnap) => hydrateVideo(uid, docSnap.id, docSnap.data()));
  },

  /** Approve / request changes on a script and optionally leave feedback. */
  async reviewScript(
    id: string,
    review: { approval: ScriptApproval; feedback?: string }
  ): Promise<Video> {
    const uid = requireUid();
    const ref = doc(db, 'users', uid, 'videos', id);
    const patch: Record<string, unknown> = {
      scriptApproval: review.approval,
      updated_at: Date.now(),
    };
    if (review.feedback !== undefined) patch.clientFeedback = review.feedback.trim();
    await updateDoc(ref, patch);
    const snap = await getDoc(ref);
    return hydrateVideo(uid, snap.id, snap.data() ?? {});
  },

  /** Save (or clear) the profile picture as a data-URL string. */
  async setPhoto(photoData: string): Promise<void> {
    const uid = requireUid();
    await setDoc(
      doc(db, 'users', uid),
      { photoData, updated_at: Date.now() },
      { merge: true }
    );
  },

  /** Save the creator's niche (free text). */
  async setNiche(niche: string): Promise<void> {
    const uid = requireUid();
    await setDoc(
      doc(db, 'users', uid),
      { niche: niche.trim(), updated_at: Date.now() },
      { merge: true }
    );
  },

  /** Save a scraped video draft into the user's ideation pipeline. */
  async addVideo(video: Omit<Video, 'uid' | 'stages' | 'currentStage' | 'created_at' | 'updated_at'>): Promise<Video> {
    const uid = requireUid();
    const ref = doc(db, 'users', uid, 'videos', video.id);
    await setDoc(ref, {
      ...video,
      uid,
      created_at: Date.now(),
      updated_at: Date.now(),
    });
    const snap = await getDoc(ref);
    return hydrateVideo(uid, snap.id, snap.data() ?? {});
  },

  /** Link a submitted raw video URL to a specific script and mark its production as ready. */
  async updateVideoUrl(id: string, url: string): Promise<Video> {
    const uid = requireUid();
    const ref = doc(db, 'users', uid, 'videos', id);
    await updateDoc(ref, {
      videoUrl: url.trim(),
      productionStatus: 'ready',
      updated_at: Date.now(),
    });
    const snap = await getDoc(ref);
    return hydrateVideo(uid, snap.id, snap.data() ?? {});
  },

  /** Save the social connections map. */
  async updateConnections(connections: NonNullable<ClientPlan['connections']>): Promise<void> {
    const uid = requireUid();
    await setDoc(
      doc(db, 'users', uid),
      { connections, updated_at: Date.now() },
      { merge: true }
    );
  },

};

// ---- Explore API ------------------------------------------------------------

export const exploreApi = {
  async scrape(niche: string): Promise<ExploreResponse> {
    const response = await fetch(`${API_BASE}/api/explore?niche=${encodeURIComponent(niche)}`, {
      headers: await authHeaders(),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;
      throw new Error(body?.message ?? body?.error ?? 'Failed to load live social content.');
    }

    return response.json() as Promise<ExploreResponse>;
  },
};

// ---- Scripts/Supabase API ---------------------------------------------------

export interface LoadScriptsResponse {
  ok: boolean;
  table: string;
  columns: string[];
  rows: Record<string, string | number | null>[];
}

export interface UpdateScriptProgressResponse {
  ok: boolean;
  row: Record<string, string | number | null>;
}

export interface ApproveScriptResponse {
  ok: boolean;
  row: Record<string, string | number | null>;
}

export interface ScriptsStatusResponse extends LoadScriptsResponse {
  exists: boolean;
}

export const scriptsApi = {
  async status(): Promise<ScriptsStatusResponse> {
    const response = await fetch(`${API_BASE}/api/scripts/status`, {
      headers: await authHeaders(),
      cache: 'no-store',
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? 'Failed to check scripts table.');
    }

    return response.json() as Promise<ScriptsStatusResponse>;
  },

  async loadScripts(): Promise<LoadScriptsResponse> {
    const response = await fetch(`${API_BASE}/api/scripts/load`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        ...(await authHeaders()),
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? 'Failed to load scripts.');
    }

    return response.json() as Promise<LoadScriptsResponse>;
  },

  async updateProgress(serial: number, progress: string): Promise<UpdateScriptProgressResponse> {
    const response = await fetch(`${API_BASE}/api/scripts/${serial}/progress`, {
      method: 'PATCH',
      cache: 'no-store',
      headers: {
        ...(await authHeaders()),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ progress }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? 'Failed to update script progress.');
    }

    return response.json() as Promise<UpdateScriptProgressResponse>;
  },

  async approve(serial: number): Promise<ApproveScriptResponse> {
    const response = await fetch(`${API_BASE}/api/scripts/${serial}/approve`, {
      method: 'PATCH',
      cache: 'no-store',
      headers: await authHeaders(),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? 'Failed to approve script.');
    }

    return response.json() as Promise<ApproveScriptResponse>;
  },
};

// ---- Videos/Supabase API (per-user {email}_videos table) --------------------

export interface VideosStatusResponse {
  ok: boolean;
  exists: boolean;
  table: string;
  columns: string[];
  rows: Record<string, string | number | null>[];
}

export interface LoadVideosResponse {
  ok: boolean;
  table: string;
  columns: string[];
  rows: Record<string, string | number | null>[];
}

export interface AddVideoResponse {
  ok: boolean;
  table: string;
  row: Record<string, string | number | null>;
}

export const videosApi = {
  async status(): Promise<VideosStatusResponse> {
    const response = await fetch(`${API_BASE}/api/videos/status`, {
      headers: await authHeaders(),
      cache: 'no-store',
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? 'Failed to check videos table.');
    }

    return response.json() as Promise<VideosStatusResponse>;
  },

  async loadVideos(): Promise<LoadVideosResponse> {
    const response = await fetch(`${API_BASE}/api/videos/load`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        ...(await authHeaders()),
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? 'Failed to load videos table.');
    }

    return response.json() as Promise<LoadVideosResponse>;
  },

  async addVideo(scriptName: string, videoUrl: string): Promise<AddVideoResponse> {
    const response = await fetch(`${API_BASE}/api/videos/add`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        ...(await authHeaders()),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ scriptName, videoUrl }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? 'Failed to add video.');
    }

    return response.json() as Promise<AddVideoResponse>;
  },
};

// ---- Captions & Schedule API (per-user {email}_captions_schedule table) -----

export interface CaptionsStatusResponse {
  ok: boolean;
  exists: boolean;
  table: string;
  columns: string[];
  rows: Record<string, string | number | null>[];
}

export interface LoadCaptionsResponse {
  ok: boolean;
  table: string;
  columns: string[];
  rows: Record<string, string | number | null>[];
}

export const captionsApi = {
  async status(): Promise<CaptionsStatusResponse> {
    const response = await fetch(`${API_BASE}/api/captions/status`, {
      headers: await authHeaders(),
      cache: 'no-store',
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? 'Failed to check captions table.');
    }

    return response.json() as Promise<CaptionsStatusResponse>;
  },

  async loadTable(): Promise<LoadCaptionsResponse> {
    const response = await fetch(`${API_BASE}/api/captions/load`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        ...(await authHeaders()),
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? 'Failed to load captions table.');
    }

    return response.json() as Promise<LoadCaptionsResponse>;
  },

  async schedule(input: {
    scriptName: string;
    video: string;
    scheduledDate: string;
    platform: string;
  }): Promise<{ ok: boolean; table: string; row: Record<string, string | number | null> }> {
    const response = await fetch(`${API_BASE}/api/captions/schedule`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        ...(await authHeaders()),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? 'Failed to schedule the video.');
    }

    return response.json() as Promise<{
      ok: boolean;
      table: string;
      row: Record<string, string | number | null>;
    }>;
  },

  async loadScheduled(): Promise<{
    ok: boolean;
    table: string;
    columns: string[];
    rows: Record<string, string | number | null>[];
  }> {
    const response = await fetch(`${API_BASE}/api/captions/scheduled/load`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        ...(await authHeaders()),
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? 'Failed to load scheduled posts.');
    }

    return response.json() as Promise<{
      ok: boolean;
      table: string;
      columns: string[];
      rows: Record<string, string | number | null>[];
    }>;
  },
};

