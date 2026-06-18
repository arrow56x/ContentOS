// Domain model + Firestore repository for the SocialVert content pipeline.
//
// Firestore layout (all scoped to a client's Firebase uid):
//   clients/{uid}                         -> ClientPlan (monthly quota + meta)
//   clients/{uid}/videos/{videoId}        -> Video (carries all 5 pipeline stages)
//
// A "video" is the unit that travels through the 5 stages:
//   1. Ideation  2. Scripting  3. Production  4. Captions  5. Scheduling/Posting
import { firestore } from './firestore.js';
import { FieldValue } from 'firebase-admin/firestore';

// ---- The 5 pipeline stages, in order ----------------------------------------
export const STAGES = [
  'ideation',
  'scripting',
  'production',
  'captions',
  'scheduling',
] as const;
export type Stage = (typeof STAGES)[number];

// Generic per-stage status used by the pipeline board.
export type StageStatus = 'not-started' | 'in-progress' | 'complete';

// Per-domain finer-grained statuses.
export type ScriptStatus = 'pending' | 'in-progress' | 'delivered';
export type ScriptApproval = 'none' | 'approved' | 'changes-requested';
export type ProductionStatus = 'awaiting-recording' | 'in-editing' | 'ready';
export type ScheduleStatus = 'pending' | 'scheduled' | 'posted';
export type Platform = 'instagram' | 'tiktok' | 'youtube-shorts' | 'google-business';

export interface ClientPlan {
  uid: string;
  clientName: string;
  monthlyQuota: number; // e.g. 20 videos/month
  currentMonth: string; // e.g. "2026-06"
  photoData: string; // profile picture as a data-URL string (empty if none)
  updated_at: number;
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
  postDate: number | null; // ms epoch of the scheduled/posted day
}

export interface Video {
  id: string;
  uid: string;
  month: string; // "2026-06"
  // --- 1. Ideation ---
  title: string; // working title
  angle: string; // content angle / hook concept
  ideaApproved: boolean;
  // --- 2. Scripting ---
  scriptStatus: ScriptStatus;
  scriptBody: string; // full finalized script text (empty until delivered)
  scriptDeliveredAt: number | null;
  scriptEta: number | null; // estimated delivery for pending scripts
  scriptApproval: ScriptApproval;
  clientFeedback: string;
  // --- 3. Production ---
  productionStatus: ProductionStatus;
  videoUrl: string; // external link (Dropbox/Drive/Frame.io); empty if none yet
  // --- 4. Captions ---
  caption: VideoCaption;
  // --- 5. Scheduling / Posting ---
  schedule: VideoSchedule;
  // --- pipeline meta ---
  currentStage: Stage;
  order: number; // stable sort within a month
  created_at: number;
  updated_at: number;
}

// ---- Helpers ----------------------------------------------------------------

/** Derive the per-stage status board from a video's domain data. */
export function stageStatuses(v: Video): Record<Stage, StageStatus> {
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
      : v.productionStatus === 'in-editing'
        ? 'in-progress'
        : v.videoUrl
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

/** The furthest in-progress/just-completed stage, for the "current stage at a glance" chip. */
export function deriveCurrentStage(v: Video): Stage {
  const s = stageStatuses(v);
  // Walk stages forward; current stage is the first non-complete one,
  // or the last stage if everything is complete (i.e. posted).
  for (const stage of STAGES) {
    if (s[stage] !== 'complete') return stage;
  }
  return 'scheduling';
}

// ---- Firestore (de)serialization --------------------------------------------

const DEFAULT_CAPTION: VideoCaption = { hook: '', body: '', cta: '', hashtags: [] };
const DEFAULT_SCHEDULE: VideoSchedule = { status: 'pending', platform: 'instagram', postDate: null };

function videoFromDoc(uid: string, id: string, d: Record<string, unknown>): Video {
  const v: Video = {
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
    currentStage: (d.currentStage as Stage) ?? 'ideation',
    order: (d.order as number) ?? 0,
    created_at: (d.created_at as number) ?? Date.now(),
    updated_at: (d.updated_at as number) ?? Date.now(),
  };
  // Always keep currentStage consistent with derived data on read.
  v.currentStage = deriveCurrentStage(v);
  return v;
}

// ---- Repository -------------------------------------------------------------

const clientsCol = firestore.collection('clients');
const videosCol = (uid: string) => clientsCol.doc(uid).collection('videos');

const DEFAULT_QUOTA = 20;

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export const planRepo = {
  /** Read a client's plan, creating a sensible default doc on first access. */
  async get(uid: string, email?: string): Promise<ClientPlan> {
    const ref = clientsCol.doc(uid);
    const snap = await ref.get();
    if (snap.exists) {
      const d = snap.data() as Record<string, unknown>;
      return {
        uid,
        clientName: (d.clientName as string) ?? email ?? 'Client',
        monthlyQuota: (d.monthlyQuota as number) ?? DEFAULT_QUOTA,
        currentMonth: (d.currentMonth as string) ?? currentMonthKey(),
        photoData: (d.photoData as string) ?? '',
        updated_at: (d.updated_at as number) ?? Date.now(),
      };
    }
    const plan: ClientPlan = {
      uid,
      clientName: email ?? 'Client',
      monthlyQuota: DEFAULT_QUOTA,
      currentMonth: currentMonthKey(),
      photoData: '',
      updated_at: Date.now(),
    };
    await ref.set({
      clientName: plan.clientName,
      monthlyQuota: plan.monthlyQuota,
      currentMonth: plan.currentMonth,
      photoData: plan.photoData,
      updated_at: plan.updated_at,
    });
    return plan;
  },

  /** Save (or clear) the client's profile picture as a data-URL string. */
  async setPhoto(uid: string, photoData: string, email?: string): Promise<ClientPlan> {
    const ref = clientsCol.doc(uid);
    await ref.set({ photoData, updated_at: Date.now() }, { merge: true });
    return this.get(uid, email);
  },
};

export const videoRepo = {
  /** List all of a client's videos (optionally filtered to a month). */
  async list(uid: string, month?: string): Promise<Video[]> {
    let q = videosCol(uid).orderBy('order', 'asc');
    if (month) q = videosCol(uid).where('month', '==', month).orderBy('order', 'asc');
    const snap = await q.get();
    return snap.docs.map((doc) => videoFromDoc(uid, doc.id, doc.data() as Record<string, unknown>));
  },

  async get(uid: string, id: string): Promise<Video | null> {
    const snap = await videosCol(uid).doc(id).get();
    if (!snap.exists) return null;
    return videoFromDoc(uid, snap.id, snap.data() as Record<string, unknown>);
  },

  /** Client-facing write: approve or request changes on a script + leave feedback. */
  async setScriptReview(
    uid: string,
    id: string,
    review: { approval: ScriptApproval; feedback?: string }
  ): Promise<Video | null> {
    const ref = videosCol(uid).doc(id);
    const snap = await ref.get();
    if (!snap.exists) return null;
    const patch: Record<string, unknown> = {
      scriptApproval: review.approval,
      updated_at: Date.now(),
    };
    if (review.feedback !== undefined) patch.clientFeedback = review.feedback;
    await ref.update(patch);
    const updated = await ref.get();
    return videoFromDoc(uid, updated.id, updated.data() as Record<string, unknown>);
  },

  /** Bulk upsert used by the seed script. */
  async upsertMany(uid: string, videos: Omit<Video, 'uid'>[]): Promise<void> {
    const batch = firestore.batch();
    for (const v of videos) {
      const { id, ...rest } = v;
      const ref = videosCol(uid).doc(id);
      batch.set(ref, { ...rest, updated_at: v.updated_at ?? FieldValue.serverTimestamp() });
    }
    await batch.commit();
  },
};
