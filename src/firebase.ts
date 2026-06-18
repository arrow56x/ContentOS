// Firebase initialization — auth + Firestore (no backend server needed).
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: 'AIzaSyBmyaQIu6q10CpaHYp_30iFuvFEZZS1fUs',
  authDomain: 'social-vert.firebaseapp.com',
  projectId: 'social-vert',
  storageBucket: 'social-vert.firebasestorage.app',
  messagingSenderId: '360012378194',
  appId: '1:360012378194:web:296c8c3c99853fbcf22f8b',
  measurementId: 'G-ZK54H2T9ZV',
};

export const app = initializeApp(firebaseConfig);

// Auth instance used across the app (email/password sign-up & login).
export const auth = getAuth(app);

// Firestore — the app reads/writes all data directly (users, pipeline).
export const db = getFirestore(app);

// Analytics only runs in supported browser environments; guard so it never throws.
isSupported()
  .then((ok) => {
    if (ok) getAnalytics(app);
  })
  .catch(() => {
    /* analytics unsupported — safe to ignore */
  });
