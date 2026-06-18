import { Users, Mail, MessageCircle, Calendar, Send } from 'lucide-react';

// SocialVert team assigned to the client. (Static for now — could come from
// Firestore later under the user's account.)
const TEAM = [
  {
    name: 'Jordan Mills',
    role: 'Account Manager',
    blurb: 'Your main point of contact for anything about your plan or schedule.',
    email: 'jordan@socialvert.com',
    tint: 'bg-sky-100 text-sky-600',
  },
  {
    name: 'Priya Shah',
    role: 'Content Strategist',
    blurb: 'Plans your monthly ideas and content angles.',
    email: 'priya@socialvert.com',
    tint: 'bg-violet-100 text-violet-600',
  },
  {
    name: 'Diego Romero',
    role: 'Scriptwriter',
    blurb: 'Writes and revises your video scripts.',
    email: 'diego@socialvert.com',
    tint: 'bg-amber-100 text-amber-600',
  },
  {
    name: 'Mei Tanaka',
    role: 'Video Editor',
    blurb: 'Edits and delivers your final videos.',
    email: 'mei@socialvert.com',
    tint: 'bg-emerald-100 text-emerald-600',
  },
];

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function TeamConnectSection() {
  return (
    <div className="space-y-4">
      {/* Intro */}
      <section className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/70 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-8 h-8 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center">
            <Users size={17} />
          </span>
          <h2 className="text-[15px] font-semibold">Team Connect</h2>
        </div>
        <p className="text-[13px] text-gray-400">
          The SocialVert team working on your content. Reach out to anyone directly.
        </p>

        {/* Quick actions */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <a
            href="mailto:team@socialvert.com"
            className="flex items-center gap-3 border border-gray-100 rounded-xl p-3 hover:border-sky-200 hover:bg-sky-50/40 transition-all"
          >
            <span className="w-9 h-9 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
              <Mail size={17} />
            </span>
            <div>
              <p className="text-[14px] font-semibold text-gray-900">Email the team</p>
              <p className="text-[12px] text-gray-400">team@socialvert.com</p>
            </div>
          </a>
          <a
            href="#"
            className="flex items-center gap-3 border border-gray-100 rounded-xl p-3 hover:border-sky-200 hover:bg-sky-50/40 transition-all"
          >
            <span className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <MessageCircle size={17} />
            </span>
            <div>
              <p className="text-[14px] font-semibold text-gray-900">Open chat</p>
              <p className="text-[12px] text-gray-400">Message your team</p>
            </div>
          </a>
          <a
            href="#"
            className="flex items-center gap-3 border border-gray-100 rounded-xl p-3 hover:border-sky-200 hover:bg-sky-50/40 transition-all"
          >
            <span className="w-9 h-9 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
              <Calendar size={17} />
            </span>
            <div>
              <p className="text-[14px] font-semibold text-gray-900">Book a call</p>
              <p className="text-[12px] text-gray-400">Schedule a quick sync</p>
            </div>
          </a>
        </div>
      </section>

      {/* Team members */}
      <section className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/70 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-semibold">Your Team</h2>
          <span className="text-[13px] text-gray-400">{TEAM.length} members</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TEAM.map((m) => (
            <div
              key={m.email}
              className="border border-gray-100 rounded-xl p-4 hover:border-sky-200 hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-11 h-11 rounded-full flex items-center justify-center text-[14px] font-semibold shrink-0 ${m.tint}`}
                >
                  {initials(m.name)}
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-gray-900 truncate">{m.name}</p>
                  <p className="text-[12px] text-gray-500">{m.role}</p>
                </div>
              </div>
              <p className="mt-3 text-[13px] text-gray-500 leading-relaxed">{m.blurb}</p>
              <div className="mt-3 flex items-center gap-2">
                <a
                  href={`mailto:${m.email}`}
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-sky-600 hover:text-sky-700"
                >
                  <Mail size={13} /> Email
                </a>
                <span className="text-gray-200">·</span>
                <a
                  href="#"
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-gray-600 hover:text-gray-900"
                >
                  <MessageCircle size={13} /> Message
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Quick message box */}
      <section className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/70 shadow-sm p-5">
        <h2 className="text-[15px] font-semibold mb-1">Send a quick message</h2>
        <p className="text-[13px] text-gray-400 mb-3">
          Have a question or request? Drop your team a note.
        </p>
        <form onSubmit={(e) => e.preventDefault()}>
          <textarea
            rows={3}
            placeholder="Type your message to the team…"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-[14px] outline-none focus:border-sky-400 focus:bg-white transition-colors resize-y"
          />
          <button
            type="submit"
            className="mt-2 inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white text-[14px] font-semibold rounded-xl px-4 py-2.5 transition-colors"
          >
            <Send size={15} /> Send message
          </button>
        </form>
      </section>
    </div>
  );
}
