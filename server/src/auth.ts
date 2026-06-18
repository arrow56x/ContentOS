import type { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
if (!PROJECT_ID) {
  throw new Error('FIREBASE_PROJECT_ID is not set — cannot verify Firebase ID tokens.');
}

// Google's public keys for Firebase ID tokens (Secure Token service).
// Verification needs only the project id — no service-account key required.
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

const ISSUER = `https://securetoken.google.com/${PROJECT_ID}`;

// Augment Express's Request so route handlers can read req.uid.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      uid?: string;
      userEmail?: string;
    }
  }
}

/**
 * Express middleware: requires a valid Firebase ID token in the
 * `Authorization: Bearer <token>` header. Attaches req.uid on success.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization bearer token.' });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: ISSUER,
      audience: PROJECT_ID,
    });

    if (!payload.sub) {
      return res.status(401).json({ error: 'Token has no subject (uid).' });
    }

    req.uid = payload.sub;
    req.userEmail = typeof payload.email === 'string' ? payload.email : undefined;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}
