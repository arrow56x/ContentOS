# SocialVert — Client Content Dashboard (ContentOS)

A client-facing dashboard that surfaces SocialVert's full content process across all
**5 pipeline stages**: Ideation → Scripting → Video Production → Captions → Scheduling/Posting.

- **Frontend:** React + TypeScript + Vite + Tailwind (Firebase email/password auth).
- **Backend:** Express API that verifies Firebase ID tokens and reads/writes **Firestore**
  (via the Firebase Admin SDK).
- **Database:** Cloud Firestore.

## What the dashboard shows

| Section | Requirement | Stage(s) |
| --- | --- | --- |
| **Overview** | Video Quota Tracker (ring + bar), Pipeline Status Board (5-stage, color-coded), Approved Ideas | 1, 2 |
| **Scripts** | Delivered / in-progress / pending, next-batch ETA, expandable full scripts, **Approve / Request changes + feedback** | 2 |
| **Video Library** | Grid grouped by month: title, platform, status, external file link | 3 |
| **Captions & Schedule** | Final captions (hook / body / CTA / hashtags) + calendar & list schedule (date, day, platform, status) | 4, 5 |
| **Search bar** | Account-wide search across ideas, scripts, captions, and videos | — |

## Data model (Firestore)

```
clients/{uid}                    -> ClientPlan  (monthlyQuota, currentMonth, clientName)
clients/{uid}/videos/{videoId}   -> Video       (carries all 5 stages for that video)
```

Each `Video` document holds its idea (title + angle), script (body, status, ETA, delivery,
approval + feedback), production (status + external URL), caption (hook/body/cta/hashtags),
and schedule (platform, date, status). The pipeline board statuses are **derived** from this
data on the server so the client always sees one consistent snapshot.

## Setup

### 1. Frontend

```bash
npm install
npm run dev          # http://localhost:5173
```

The Firebase web config lives in `src/firebase.ts`. Set `VITE_API_URL` if the API
isn't at `http://localhost:4000`.

### 2. Backend + Firestore credentials

The Admin SDK needs a service account to reach Firestore:

1. Firebase Console → **Project settings → Service accounts → Generate new private key**.
2. Save the JSON as `server/service-account.json` (git-ignored).
3. `cd server && cp .env.example .env` and confirm:
   - `FIREBASE_PROJECT_ID=social-vert`
   - `GOOGLE_APPLICATION_CREDENTIALS=./service-account.json`

```bash
cd server
npm install
npm run dev          # http://localhost:4000
```

> Auth works without a service account (ID tokens are verified via Google's public keys),
> but Firestore reads/writes require one.

### 3. Seed demo data

Log in once on the dashboard — your Firebase **uid** is printed to the browser console
(`[SocialVert] your uid: …`). Then:

```bash
cd server
SEED_UID=<your-uid> npm run seed
# or: npm run seed -- <your-uid>
```

This populates a realistic month (a personal-injury law firm) with 12 videos spread
across every stage and platform, so the whole dashboard is fully demonstrable.

## API

All endpoints require `Authorization: Bearer <Firebase ID token>`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/pipeline/plan` | The client's monthly plan (quota + meta) |
| GET | `/api/pipeline/videos?month=YYYY-MM` | All videos + derived stage statuses |
| PATCH | `/api/pipeline/videos/:id/review` | Approve / request changes + leave feedback |

## Build / typecheck

```bash
npm run build              # frontend (tsc + vite)
cd server && npm run typecheck
```
