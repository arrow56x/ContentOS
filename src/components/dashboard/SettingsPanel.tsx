import { useEffect, useRef, useState } from 'react';
import {
  X,
  Mail,
  CalendarCheck,
  Pencil,
  Camera,
  Upload,
  Tag,
  Info,
  LogOut,
  Check,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { updateProfile, type User } from 'firebase/auth';
import { pipelineApi } from '../../lib/api';

interface Props {
  open: boolean;
  user: User | null;
  /** Current profile picture as a data-URL (stored in Firestore). */
  photoData: string;
  /** Creator's niche (free text), stored in Firestore. */
  niche: string;
  onClose: () => void;
  onLogout: () => void;
  /** Reload the user after a name edit so the UI reflects it. */
  refreshUser: () => Promise<void>;
  /** Called after the picture changes so parents can update live. */
  onPhotoChange: (dataUrl: string) => void;
  /** Called after the niche changes so parents can update live. */
  onNicheChange: (niche: string) => void;
}

/** Read an image File, resize/crop to a square thumbnail, return a JPEG data-URL. */
function fileToThumbnailDataUrl(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file is not a valid image.'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas not supported.'));
        // Center-crop to a square, then draw scaled to size×size.
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function memberSince(user: User | null): string {
  const iso = user?.metadata?.creationTime;
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function SettingsPanel({
  open,
  user,
  photoData,
  niche,
  onClose,
  onLogout,
  refreshUser,
  onPhotoChange,
  onNicheChange,
}: Props) {
  const displayName = user?.displayName ?? '';
  const photoURL = photoData; // data-URL from Firestore
  const initials = (displayName || user?.email || '?').slice(0, 2).toUpperCase();

  // Which inline editor is open: 'name' | 'photo' | 'niche' | null
  const [editing, setEditing] = useState<null | 'name' | 'photo' | 'niche'>(null);
  const [nameInput, setNameInput] = useState(displayName);
  const [nicheInput, setNicheInput] = useState(niche);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keep mounted through the slide-out transition.
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMounted(true);
      // Double-rAF: ensures the browser paints the off-screen (translate-x-full)
      // state first, then triggers the slide-in on the next frame.
      let raf2: number;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setShow(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }
    setShow(false);
    const t = setTimeout(() => setMounted(false), 350);
    return () => clearTimeout(t);
  }, [open]);

  // Reset editors + fields whenever the panel opens.
  useEffect(() => {
    if (open) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setEditing(null);
      setNameInput(user?.displayName ?? '');
      setNicheInput(niche);
      setError(null);
      setSaving(false);
      setUploading(false);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [open, user, niche]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  const saveName = async () => {
    if (!user) return;
    const name = nameInput.trim();
    if (!name) {
      setError('Name can’t be empty.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateProfile(user, { displayName: name });
      await refreshUser();
      setEditing(null);
    } catch {
      setError('Could not update your name. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const saveNiche = async () => {
    setSaving(true);
    setError(null);
    try {
      const value = nicheInput.trim();
      await pipelineApi.setNiche(value);
      onNicheChange(value);
      setEditing(null);
    } catch {
      setError('Could not save your niche. Try again.');
    } finally {
      setSaving(false);
    }
  };

  // Read an image from the user's PC, shrink it to a thumbnail, and save it as a
  // data-URL string in Firestore (no Firebase Storage needed).
  const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so picking the same file again still fires onChange.
    e.target.value = '';
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image is too large. Please pick one under 10 MB.');
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const dataUrl = await fileToThumbnailDataUrl(file);
      await pipelineApi.setPhoto(dataUrl);
      onPhotoChange(dataUrl);
    } catch (err) {
      console.error('[avatar upload]', err);
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] font-apple">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-[350ms] ${
          show ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className={`absolute top-0 right-0 h-full w-full max-w-[400px] bg-white shadow-2xl flex flex-col transition-transform duration-[350ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
          show ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-[17px] font-semibold">Account & Settings</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* Hidden native file picker (images only). */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFilePicked}
          />

          {/* Profile card — clicking the avatar uploads a new picture from the PC. */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => !uploading && fileInputRef.current?.click()}
              disabled={uploading}
              title="Upload profile picture from your PC"
              className="group relative w-16 h-16 rounded-full shrink-0 ring-2 ring-sky-100 overflow-hidden"
            >
              {photoURL ? (
                <img
                  src={photoURL}
                  alt={displayName || 'Profile'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="w-full h-full flex items-center justify-center bg-gradient-to-br from-sky-400 to-sky-600 text-white text-[20px] font-semibold">
                  {initials}
                </span>
              )}
              {/* Overlay: camera on hover, spinner while uploading. */}
              <span
                className={`absolute inset-0 flex items-center justify-center bg-black/45 text-white transition-opacity ${
                  uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
              >
                {uploading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
              </span>
            </button>
            <div className="min-w-0">
              <p className="text-[17px] font-semibold text-gray-900 truncate">
                {displayName || 'Your account'}
              </p>
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                <span className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">
                  <ShieldCheck size={12} /> Member
                </span>
                {niche && (
                  <span className="inline-flex items-center gap-1 text-[12px] font-medium text-sky-700 bg-sky-50 rounded-full px-2 py-0.5">
                    <Tag size={11} /> {niche}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Upload from PC */}
          <button
            onClick={() => !uploading && fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100 hover:border-sky-200 hover:bg-sky-50/40 disabled:opacity-60 transition-all text-left"
          >
            <span className="w-8 h-8 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            </span>
            <span className="text-[14px] font-medium text-gray-900">
              {uploading ? 'Uploading…' : 'Upload from PC'}
            </span>
          </button>

          {/* Identity facts */}
          <div className="rounded-xl border border-gray-100 divide-y divide-gray-100">
            <InfoRow icon={Mail} label="Email" value={user?.email ?? '—'} />
            <InfoRow icon={CalendarCheck} label="Member since" value={memberSince(user)} />
            <InfoRow icon={Tag} label="Niche" value={niche || 'Not set'} />
          </div>

          {error && (
            <p className="text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Edit name */}
          {editing === 'name' ? (
            <EditBox
              label="Edit name"
              value={nameInput}
              onChange={setNameInput}
              placeholder="Your name"
              saving={saving}
              onSave={saveName}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <ActionRow icon={Pencil} label="Edit name" onClick={() => setEditing('name')} />
          )}

          {/* Edit niche */}
          {editing === 'niche' ? (
            <EditBox
              label="Your niche"
              value={nicheInput}
              onChange={setNicheInput}
              placeholder="e.g. Law, Football, Engineering, Fun…"
              saving={saving}
              onSave={saveNiche}
              onCancel={() => setEditing(null)}
              hint="Write whatever describes your content. Leave blank to clear it."
            />
          ) : (
            <ActionRow
              icon={Tag}
              label={niche ? 'Edit niche' : 'Add your niche'}
              onClick={() => setEditing('niche')}
            />
          )}

          {/* About / Info */}
          <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Info size={16} className="text-sky-600" />
              <p className="text-[14px] font-semibold text-gray-900">About ContentOS</p>
            </div>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              ContentOS is SocialVert’s client dashboard. It tracks every video through the
              full 5-stage content pipeline — <strong>Ideation, Scripting, Video Production,
              Captions,</strong> and <strong>Scheduling/Posting</strong> — so you always know
              exactly where your content stands. Review and approve scripts, read final
              captions, grab video files, and see what’s posting and when, all in one place.
            </p>
          </div>
        </div>

        {/* Footer: logout */}
        <div className="px-5 py-4 border-t border-gray-100">
          <button
            onClick={onLogout}
            className="w-full inline-flex items-center justify-center gap-2 text-[14px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl px-4 py-3 transition-colors"
          >
            <LogOut size={16} /> Log out
          </button>
        </div>
      </aside>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-[12px] text-gray-400">{label}</p>
        <p className="text-[14px] font-medium text-gray-900 truncate">{value}</p>
      </div>
    </div>
  );
}

function ActionRow({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Pencil;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100 hover:border-sky-200 hover:bg-sky-50/40 transition-all text-left"
    >
      <span className="w-8 h-8 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
        <Icon size={16} />
      </span>
      <span className="text-[14px] font-medium text-gray-900">{label}</span>
    </button>
  );
}

function EditBox({
  label,
  value,
  onChange,
  placeholder,
  saving,
  onSave,
  onCancel,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-sky-200 bg-white p-4">
      <label className="text-[13px] font-semibold text-gray-700">{label}</label>
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-[14px] outline-none focus:border-sky-400 focus:bg-white transition-colors"
      />
      {hint && <p className="mt-1.5 text-[12px] text-gray-400">{hint}</p>}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white bg-sky-500 hover:bg-sky-600 disabled:opacity-50 rounded-lg px-3 py-2"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Save
        </button>
        <button
          onClick={onCancel}
          className="text-[13px] font-semibold text-gray-600 hover:text-gray-900 px-3 py-2"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
