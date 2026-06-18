// Presentation helpers shared across the dashboard sections: human labels,
// color tokens, and small formatters for the pipeline domain.
import type {
  Platform,
  ProductionStatus,
  ScheduleStatus,
  ScriptStatus,
  Stage,
  StageStatus,
} from './api';

export const STAGE_LABELS: Record<Stage, string> = {
  ideation: 'Script',
  scripting: 'Progress',
  production: 'Raw Video',
  captions: 'Captions',
  scheduling: 'Scheduling',
};

export const STAGE_SHORT: Record<Stage, string> = {
  ideation: 'Script',
  scripting: 'Progress',
  production: 'Raw Video',
  captions: 'Captions',
  scheduling: 'Scheduling',
};

// Color classes for the generic per-stage board status.
export const STAGE_STATUS_STYLES: Record<StageStatus, { dot: string; chip: string; label: string }> = {
  'not-started': { dot: 'bg-gray-300', chip: 'bg-gray-100 text-gray-500', label: 'Not Started' },
  'in-progress': { dot: 'bg-amber-400', chip: 'bg-amber-100 text-amber-700', label: 'In Progress' },
  complete: { dot: 'bg-emerald-500', chip: 'bg-emerald-100 text-emerald-700', label: 'Complete' },
};

export const SCRIPT_STATUS_STYLES: Record<ScriptStatus, { chip: string; label: string }> = {
  pending: { chip: 'bg-gray-100 text-gray-500', label: 'Pending' },
  'in-progress': { chip: 'bg-amber-100 text-amber-700', label: 'In Progress' },
  delivered: { chip: 'bg-emerald-100 text-emerald-700', label: 'Delivered' },
};

export const PRODUCTION_STATUS_STYLES: Record<ProductionStatus, { chip: string; label: string }> = {
  'awaiting-recording': { chip: 'bg-gray-100 text-gray-500', label: 'Awaiting Recording' },
  'in-editing': { chip: 'bg-amber-100 text-amber-700', label: 'In Editing' },
  ready: { chip: 'bg-emerald-100 text-emerald-700', label: 'Ready' },
};

export const SCHEDULE_STATUS_STYLES: Record<ScheduleStatus, { chip: string; label: string }> = {
  pending: { chip: 'bg-gray-100 text-gray-500', label: 'Pending' },
  scheduled: { chip: 'bg-sky-100 text-sky-700', label: 'Scheduled' },
  posted: { chip: 'bg-emerald-100 text-emerald-700', label: 'Posted' },
};

export const PLATFORM_META: Record<Platform, { label: string; tint: string }> = {
  instagram: { label: 'Instagram', tint: 'bg-pink-100 text-pink-600' },
  tiktok: { label: 'TikTok', tint: 'bg-gray-900 text-white' },
  'youtube-shorts': { label: 'YouTube Shorts', tint: 'bg-red-100 text-red-600' },
  'google-business': { label: 'Google My Business', tint: 'bg-blue-100 text-blue-600' },
};

export function formatDate(ms: number | null): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDay(ms: number | null): string {
  if (!ms) return '';
  return new Date(ms).toLocaleDateString(undefined, { weekday: 'long' });
}
