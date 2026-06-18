import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { auth } from '../firebase';
import { usersApi } from '../lib/api';

type AuthMode = 'login' | 'signup';

interface AuthModalProps {
  open: boolean;
  initialMode?: AuthMode;
  onClose: () => void;
}

/** Maps Firebase auth error codes to friendly messages. */
function messageForError(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try logging in.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    case 'auth/operation-not-allowed':
    case 'auth/configuration-not-found':
      return 'Email/password sign-in is not enabled. Enable it in Firebase Console → Authentication → Sign-in method.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    default:
      return code
        ? `Sign-in failed (${code}). Please try again.`
        : 'Something went wrong. Please try again.';
  }
}

export default function AuthModal({ open, initialMode = 'login', onClose }: AuthModalProps) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Animation: keep mounted through the exit transition.
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMounted(true);
      // Next frame so the enter transition runs from the initial (hidden) state.
      const raf = requestAnimationFrame(() => setShow(true));
      return () => cancelAnimationFrame(raf);
    }
    setShow(false);
    const timer = setTimeout(() => setMounted(false), 300); // match transition duration
    return () => clearTimeout(timer);
  }, [open]);

  // Reset to the requested mode and clear fields each time the modal opens.
  useEffect(() => {
    if (open) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setMode(initialMode);
      setUsername('');
      setEmail('');
      setPassword('');
      setError(null);
      setLoading(false);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [open, initialMode]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'signup') {
        const name = username.trim();
        if (!name) {
          setError('Please choose a username.');
          setLoading(false);
          return;
        }
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        // Save the username on the Firebase user profile so the dashboard can greet them.
        await updateProfile(cred.user, { displayName: name });
        // Record the user in Firestore: userId, name, email, createdAt.
        await usersApi.create({ uid: cred.user.uid, name, email: cred.user.email ?? email.trim() });
        // Create per-user Supabase tables ({email}_progress, _scripts, _videos).
        void usersApi.init();
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      onClose();
      navigate('/dashboard');
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : '';
      setError(messageForError(code));
    } finally {
      setLoading(false);
    }
  };

  const isSignup = mode === 'signup';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 font-apple">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ease-out ${
          show ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Card */}
      <div
        className={`relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-7 sm:p-8 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          show ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'
        }`}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition-colors"
        >
          <X size={16} />
        </button>

        <span className="font-cursive text-sky-600 text-[24px] font-bold">ContentOS</span>
        <h2 className="mt-1 text-[24px] font-semibold tracking-[-0.02em] text-gray-900">
          {isSignup ? 'Create your account' : 'Welcome back'}
        </h2>
        <p className="mt-1 text-[14px] text-gray-500">
          {isSignup
            ? 'Sign up with your email and a password.'
            : 'Log in with your email and password.'}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          {isSignup && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="auth-username" className="text-[13px] font-medium text-gray-700">
                Username
              </label>
              <input
                id="auth-username"
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="yourname"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[14px] text-gray-900 outline-none focus:border-sky-500 focus:bg-white transition-colors"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="auth-email" className="text-[13px] font-medium text-gray-700">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[14px] text-gray-900 outline-none focus:border-sky-500 focus:bg-white transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="auth-password" className="text-[13px] font-medium text-gray-700">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              required
              minLength={6}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[14px] text-gray-900 outline-none focus:border-sky-500 focus:bg-white transition-colors"
            />
          </div>

          {error && (
            <p className="text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 w-full bg-sky-500 hover:bg-sky-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-[15px] font-semibold rounded-full px-6 py-3 transition-colors duration-300"
          >
            {loading ? 'Please wait…' : isSignup ? 'Sign up' : 'Log in'}
          </button>
        </form>

        <p className="mt-5 text-center text-[14px] text-gray-500">
          {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            onClick={() => {
              setMode(isSignup ? 'login' : 'signup');
              setError(null);
            }}
            className="text-sky-600 font-semibold hover:text-sky-700 transition-colors"
          >
            {isSignup ? 'Log in' : 'Sign up'}
          </button>
        </p>
      </div>
    </div>
  );
}
