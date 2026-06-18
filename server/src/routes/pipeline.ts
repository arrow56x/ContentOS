// Pipeline API — the client-facing dashboard reads from here, plus the one
// write the client is allowed to make: approving / requesting changes on a script.
import { Router } from 'express';
import {
  planRepo,
  videoRepo,
  stageStatuses,
  type ScriptApproval,
} from '../db.js';

export const pipelineRouter = Router();

const VALID_APPROVALS: ScriptApproval[] = ['none', 'approved', 'changes-requested'];

// GET /api/pipeline/plan — the client's monthly plan (quota + meta)
pipelineRouter.get('/plan', async (req, res) => {
  try {
    const plan = await planRepo.get(req.uid!, req.userEmail);
    res.json(plan);
  } catch (err) {
    console.error('[pipeline] plan error:', err);
    res.status(500).json({ error: 'Failed to load plan.' });
  }
});

// GET /api/pipeline/videos?month=YYYY-MM — all videos with derived stage statuses.
// This single endpoint feeds every dashboard section (quota, board, scripts,
// library, captions & schedule) so the client gets one consistent snapshot.
pipelineRouter.get('/videos', async (req, res) => {
  try {
    const month = typeof req.query.month === 'string' ? req.query.month : undefined;
    const videos = await videoRepo.list(req.uid!, month);
    res.json(videos.map((v) => ({ ...v, stages: stageStatuses(v) })));
  } catch (err) {
    console.error('[pipeline] videos error:', err);
    res.status(500).json({ error: 'Failed to load videos.' });
  }
});

// PATCH /api/pipeline/videos/:id/review — approve / request changes + feedback.
pipelineRouter.patch('/videos/:id/review', async (req, res) => {
  const { approval, feedback } = req.body ?? {};

  if (!VALID_APPROVALS.includes(approval)) {
    return res
      .status(400)
      .json({ error: `"approval" must be one of ${VALID_APPROVALS.join(', ')}.` });
  }
  if (feedback !== undefined && typeof feedback !== 'string') {
    return res.status(400).json({ error: '"feedback" must be a string.' });
  }

  try {
    const updated = await videoRepo.setScriptReview(req.uid!, req.params.id, {
      approval,
      feedback: typeof feedback === 'string' ? feedback.trim() : undefined,
    });
    if (!updated) return res.status(404).json({ error: 'Video not found.' });
    res.json({ ...updated, stages: stageStatuses(updated) });
  } catch (err) {
    console.error('[pipeline] review error:', err);
    res.status(500).json({ error: 'Failed to save review.' });
  }
});
