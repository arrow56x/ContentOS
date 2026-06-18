// Seed script — populates Firestore with a realistic month of SocialVert
// pipeline data for a single client.
//
// Usage:
//   SEED_UID=<firebase-uid> npm run seed
//   npm run seed -- <firebase-uid>
//
// Get the uid from Firebase Console → Authentication → Users, or from the
// dashboard (it's logged to the browser console on load).
import 'dotenv/config';
import { firestore } from './firestore.js';
import { videoRepo, type Video, type Platform } from './db.js';

const uid = process.env.SEED_UID || process.argv[2];
if (!uid) {
  console.error('\n✗ No target uid. Pass it via SEED_UID env var or as an argument:');
  console.error('    SEED_UID=abc123 npm run seed');
  console.error('    npm run seed -- abc123\n');
  process.exit(1);
}

// Current month key, e.g. "2026-06".
const now = new Date();
const MONTH = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const year = now.getFullYear();
const month0 = now.getMonth(); // 0-based

// Build a ms timestamp for a given day this month.
const day = (d: number) => new Date(year, month0, d, 12, 0, 0).getTime();

const CLIENT_NAME = 'Apex Auto Injury Law';
const MONTHLY_QUOTA = 20;

type Seed = Omit<
  Video,
  'id' | 'uid' | 'created_at' | 'updated_at' | 'currentStage' | 'order' | 'month'
>;

// 12 videos spread across every pipeline stage so the dashboard demonstrates
// the full lifecycle: posted → scheduled → captioned → in-editing → scripted →
// awaiting-recording → just-an-idea.
const seeds: Seed[] = [
  {
    title: '5 things you should never say to your insurance company after a car accident',
    angle: 'Authority / mistakes-to-avoid hook. Position the firm as the protector.',
    ideaApproved: true,
    scriptStatus: 'delivered',
    scriptBody:
      "HOOK: Never say these 5 things to your insurance company after a wreck.\n\n1. \"I'm sorry.\" Apologizing sounds like admitting fault — even when it's not.\n2. \"I'm fine.\" Injuries like whiplash show up days later. Don't lock yourself out of a claim.\n3. \"I think...\" Guessing about speed or distance becomes a recorded statement against you.\n4. \"Sure, record me.\" You are NOT required to give a recorded statement to the other driver's insurer.\n5. \"I'll just take the first offer.\" First offers are almost always lowballs.\n\nCTA: Been in an accident? Talk to us before you talk to them. Link in bio.",
    scriptDeliveredAt: day(2),
    scriptEta: null,
    scriptApproval: 'approved',
    clientFeedback: 'Love this one. Approved as-is.',
    productionStatus: 'ready',
    videoUrl: 'https://drive.google.com/file/d/1aBcDeFgHiJkLmNoP/view',
    caption: {
      hook: 'Never say these 5 things to your insurance company after a car accident 🚗⚖️',
      body: "Apologizing, saying you're 'fine', or giving a recorded statement can quietly destroy your claim. Insurers are trained to minimize what they pay you — here's how to protect yourself before you ever pick up the phone.",
      cta: 'Injured in a wreck? DM us "ACCIDENT" for a free case review.',
      hashtags: ['#caraccident', '#personalinjury', '#injurylawyer', '#knowyourrights'],
    },
    schedule: { status: 'posted', platform: 'instagram', postDate: day(3) },
  },
  {
    title: 'How long do you really have to file an injury claim?',
    angle: 'Urgency via statute-of-limitations. Drive consultations now.',
    ideaApproved: true,
    scriptStatus: 'delivered',
    scriptBody:
      "HOOK: The clock is ticking on your injury claim — and most people don't realize it.\n\nEvery state has a statute of limitations. Miss it and your case is gone — no matter how strong it was. In most states you have 2 years from the accident, but exceptions can shrink that to months.\n\nCTA: Don't gamble with the deadline. Get a free review today.",
    scriptDeliveredAt: day(4),
    scriptEta: null,
    scriptApproval: 'approved',
    clientFeedback: '',
    productionStatus: 'ready',
    videoUrl: 'https://www.dropbox.com/s/abc123/clock-ticking.mp4?dl=0',
    caption: {
      hook: '⏰ The clock is already ticking on your injury claim.',
      body: "Most states give you about 2 years to file — but exceptions can cut that down to months. Wait too long and even a slam-dunk case disappears.",
      cta: 'Not sure how long you have? Comment "TIME" and we\'ll help.',
      hashtags: ['#statuteoflimitations', '#injuryclaim', '#legaltips', '#carcrash'],
    },
    schedule: { status: 'scheduled', platform: 'tiktok', postDate: day(18) },
  },
  {
    title: 'Why the at-fault driver’s insurance called you so fast',
    angle: 'Behind-the-curtain reveal. Build distrust of quick settlement calls.',
    ideaApproved: true,
    scriptStatus: 'delivered',
    scriptBody:
      "HOOK: If the other driver's insurance called you within 24 hours — that's not customer service.\n\nThey call fast because you're most vulnerable right after a crash: shaken, not yet treated, not yet lawyered up. The goal is a quick, cheap settlement before you know what your claim is worth.\n\nCTA: Before you accept anything, know your number.",
    scriptDeliveredAt: day(6),
    scriptEta: null,
    scriptApproval: 'changes-requested',
    clientFeedback: 'Great hook — can we soften the CTA and add our phone number on screen?',
    productionStatus: 'in-editing',
    videoUrl: 'https://frame.io/presentations/xyz-fast-call-review',
    caption: {
      hook: "They called you within 24 hours? That's not kindness. 👀",
      body: "Insurers move fast on purpose — before you've seen a doctor or learned what your claim is really worth. A quick settlement is a cheap settlement.",
      cta: 'Got a fast call? Talk to us first. Link in bio.',
      hashtags: ['#insurancetips', '#caraccidentclaim', '#injurylawyer'],
    },
    schedule: { status: 'pending', platform: 'instagram', postDate: null },
  },
  {
    title: 'The 3 documents that make or break your case',
    angle: 'Practical checklist. Saveable / shareable value content.',
    ideaApproved: true,
    scriptStatus: 'delivered',
    scriptBody:
      'HOOK: These 3 documents can make or break your injury case.\n\n1. The police report — establishes fault on the record.\n2. Your medical records — they connect the crash to your injuries.\n3. Proof of lost wages — pay stubs and employer letters quantify your losses.\n\nCTA: Missing one of these? We can help you get it.',
    scriptDeliveredAt: day(8),
    scriptEta: null,
    scriptApproval: 'none',
    clientFeedback: '',
    productionStatus: 'in-editing',
    videoUrl: 'https://www.dropbox.com/s/def456/three-docs.mp4?dl=0',
    caption: {
      hook: '📄 3 documents that can make or break your injury case.',
      body: 'The police report, your medical records, and proof of lost wages do most of the heavy lifting. Miss one and you leave money on the table.',
      cta: 'Save this for later — and DM us if you need help gathering them.',
      hashtags: ['#injurycase', '#legaltips', '#caraccident', '#documentation'],
    },
    schedule: { status: 'pending', platform: 'youtube-shorts', postDate: null },
  },
  {
    title: 'Do you actually need a lawyer for a “minor” accident?',
    angle: 'Myth-busting. Capture the “it was just a fender bender” crowd.',
    ideaApproved: true,
    scriptStatus: 'delivered',
    scriptBody:
      "HOOK: \"It was just a fender bender, I don't need a lawyer.\" Maybe. Maybe not.\n\nSoft-tissue injuries and concussions often surface days later. And once you accept a settlement, you can't reopen it. A 10-minute consult costs you nothing and can save you thousands.\n\nCTA: Not sure? Ask us — free.",
    scriptDeliveredAt: day(10),
    scriptEta: null,
    scriptApproval: 'none',
    clientFeedback: '',
    productionStatus: 'awaiting-recording',
    videoUrl: '',
    caption: {
      hook: '"It was just a fender bender." Famous last words. 🚙',
      body: 'Minor crashes cause major hidden injuries all the time — and once you sign a settlement, it\'s final. A free consult could save you thousands.',
      cta: 'Comment "MINOR" and we\'ll tell you if you have a case.',
      hashtags: ['#fenderbender', '#doineedalawyer', '#injurylawyer'],
    },
    schedule: { status: 'pending', platform: 'instagram', postDate: null },
  },
  {
    title: 'What “pain and suffering” is actually worth',
    angle: 'Demystify damages. High-search-intent topic.',
    ideaApproved: true,
    scriptStatus: 'delivered',
    scriptBody:
      'HOOK: "Pain and suffering" isn\'t made-up — and it can be worth more than your medical bills.\n\nIt covers physical pain, emotional distress, and lost quality of life. It\'s real, it\'s claimable, and insurers routinely pretend it\'s worth far less than it is.\n\nCTA: Find out what your claim is really worth.',
    scriptDeliveredAt: day(12),
    scriptEta: null,
    scriptApproval: 'none',
    clientFeedback: '',
    productionStatus: 'awaiting-recording',
    videoUrl: '',
    caption: {
      hook: '💸 What is "pain and suffering" actually worth?',
      body: "It's not made up. Physical pain, emotional distress, and lost quality of life are all claimable — and often worth more than the medical bills themselves.",
      cta: 'DM "WORTH" for a free estimate on your claim.',
      hashtags: ['#painandsuffering', '#damages', '#injurysettlement'],
    },
    schedule: { status: 'pending', platform: 'google-business', postDate: null },
  },
  {
    title: 'The biggest mistake people make at the scene of a crash',
    angle: 'Single-mistake hook. Strong scroll-stopper.',
    ideaApproved: true,
    scriptStatus: 'in-progress',
    scriptBody: '',
    scriptDeliveredAt: null,
    scriptEta: day(20),
    scriptApproval: 'none',
    clientFeedback: '',
    productionStatus: 'awaiting-recording',
    videoUrl: '',
    caption: { hook: '', body: '', cta: '', hashtags: [] },
    schedule: { status: 'pending', platform: 'tiktok', postDate: null },
  },
  {
    title: 'How we got a client 6x their first settlement offer',
    angle: 'Case-study / social proof. Builds credibility.',
    ideaApproved: true,
    scriptStatus: 'in-progress',
    scriptBody: '',
    scriptDeliveredAt: null,
    scriptEta: day(20),
    scriptApproval: 'none',
    clientFeedback: '',
    productionStatus: 'awaiting-recording',
    videoUrl: '',
    caption: { hook: '', body: '', cta: '', hashtags: [] },
    schedule: { status: 'pending', platform: 'instagram', postDate: null },
  },
  {
    title: 'Rideshare accident? Whose insurance pays?',
    angle: 'Niche, high-confusion topic (Uber/Lyft). Owns a specific search.',
    ideaApproved: true,
    scriptStatus: 'pending',
    scriptBody: '',
    scriptDeliveredAt: null,
    scriptEta: day(24),
    scriptApproval: 'none',
    clientFeedback: '',
    productionStatus: 'awaiting-recording',
    videoUrl: '',
    caption: { hook: '', body: '', cta: '', hashtags: [] },
    schedule: { status: 'pending', platform: 'youtube-shorts', postDate: null },
  },
  {
    title: 'Should you post about your accident on social media?',
    angle: 'Counterintuitive warning. Insurers watch your feeds.',
    ideaApproved: true,
    scriptStatus: 'pending',
    scriptBody: '',
    scriptDeliveredAt: null,
    scriptEta: day(24),
    scriptApproval: 'none',
    clientFeedback: '',
    productionStatus: 'awaiting-recording',
    videoUrl: '',
    caption: { hook: '', body: '', cta: '', hashtags: [] },
    schedule: { status: 'pending', platform: 'instagram', postDate: null },
  },
  {
    title: 'What to do in the first 60 minutes after a crash',
    angle: 'Step-by-step urgency content. Highly saveable.',
    ideaApproved: true,
    scriptStatus: 'pending',
    scriptBody: '',
    scriptDeliveredAt: null,
    scriptEta: day(27),
    scriptApproval: 'none',
    clientFeedback: '',
    productionStatus: 'awaiting-recording',
    videoUrl: '',
    caption: { hook: '', body: '', cta: '', hashtags: [] },
    schedule: { status: 'pending', platform: 'tiktok', postDate: null },
  },
  {
    title: 'Can you still claim if you were partly at fault?',
    angle: 'Comparative-negligence explainer. Removes a key objection.',
    ideaApproved: false, // still in ideation — not yet approved
    scriptStatus: 'pending',
    scriptBody: '',
    scriptDeliveredAt: null,
    scriptEta: null,
    scriptApproval: 'none',
    clientFeedback: '',
    productionStatus: 'awaiting-recording',
    videoUrl: '',
    caption: { hook: '', body: '', cta: '', hashtags: [] },
    schedule: { status: 'pending', platform: 'instagram', postDate: null },
  },
];

async function run() {
  console.log(`\nSeeding client "${CLIENT_NAME}" (uid: ${uid}) for ${MONTH}…`);

  // Upsert the client plan.
  await firestore.collection('clients').doc(uid).set(
    {
      clientName: CLIENT_NAME,
      monthlyQuota: MONTHLY_QUOTA,
      currentMonth: MONTH,
      updated_at: Date.now(),
    },
    { merge: true }
  );

  const ts = Date.now();
  const videos = seeds.map((s, i) => ({
    ...s,
    id: `${MONTH}-${String(i + 1).padStart(2, '0')}`,
    month: MONTH,
    currentStage: 'ideation' as const, // recomputed on read
    order: i,
    created_at: ts,
    updated_at: ts,
  }));

  await videoRepo.upsertMany(uid, videos);

  console.log(`✓ Seeded ${videos.length} videos across all 5 pipeline stages.`);
  console.log(`  Quota: ${MONTHLY_QUOTA}/month`);
  const platforms = new Set<Platform>(videos.map((v) => v.schedule.platform));
  console.log(`  Platforms used: ${[...platforms].join(', ')}\n`);
  process.exit(0);
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
