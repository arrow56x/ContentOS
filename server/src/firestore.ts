// Firestore initialization via the Firebase Admin SDK.
//
// Auth/credentials resolution order:
//   1. GOOGLE_APPLICATION_CREDENTIALS — path to a service-account JSON (recommended).
//   2. FIREBASE_SERVICE_ACCOUNT — the service-account JSON inlined as a string.
//   3. Application Default Credentials (e.g. when running on Google Cloud / `gcloud auth`).
//
// The project id always comes from FIREBASE_PROJECT_ID so it matches the
// client app and the ID-token verifier in auth.ts.
import { readFileSync } from 'node:fs';
import { initializeApp, cert, applicationDefault, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
if (!PROJECT_ID) {
  throw new Error('FIREBASE_PROJECT_ID is not set — cannot connect to Firestore.');
}

function resolveCredential() {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (inline) {
    try {
      return cert(JSON.parse(inline));
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT is set but is not valid JSON.');
    }
  }

  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (path) {
    try {
      return cert(JSON.parse(readFileSync(path, 'utf8')));
    } catch {
      throw new Error(
        `Could not read service account JSON at GOOGLE_APPLICATION_CREDENTIALS="${path}".`
      );
    }
  }

  // Fall back to ADC. Works on GCP or after `gcloud auth application-default login`.
  return applicationDefault();
}

let app: App;
try {
  app = initializeApp({ credential: resolveCredential(), projectId: PROJECT_ID });
} catch (err) {
  console.error('\n[firestore] Failed to initialize Firebase Admin SDK.');
  console.error('[firestore] Provide a service account via GOOGLE_APPLICATION_CREDENTIALS');
  console.error('[firestore] (path to JSON) or FIREBASE_SERVICE_ACCOUNT (inline JSON).\n');
  throw err;
}

export const firestore: Firestore = getFirestore(app);
