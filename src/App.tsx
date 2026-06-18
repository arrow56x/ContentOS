import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, X, Play, Pause, Volume2, VolumeX, FastForward, Mail, Star } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { Shader, Swirl, ChromaFlow, FlutedGlass, FilmGrain } from 'shaders/react';
import { auth } from './firebase';
import { useAuth } from './auth/AuthContext';
import LiveClock from './components/LiveClock';
import TextRoll from './components/TextRoll';
import AuthModal from './components/AuthModal';

// Testimonials shown in the auto-scrolling marquee. Photos via randomuser.me.
const testimonials = [
  {
    quote:
      'Social Vert completely transformed our interactive 3D showcase. Their attention to detail and creative execution drove record engagement for our launch.',
    name: 'Sarah Jenkins',
    role: 'Head of Product at Narrativ',
    photo: 'https://randomuser.me/api/portraits/women/44.jpg',
  },
  {
    quote:
      'Working with Social Vert was a game-changer. They turned a dated platform into a conversion machine, while staying incredibly true to our core brand values.',
    name: 'Marcus Aurelius',
    role: 'CEO at Luminar',
    photo: 'https://randomuser.me/api/portraits/men/32.jpg',
  },
  {
    quote:
      'The design craftsmanship and strategy they brought to our rebranding was unmatched. They are category leaders in every sense of the word.',
    name: 'Elena Rostova',
    role: 'Founder at Vektor',
    photo: 'https://randomuser.me/api/portraits/women/68.jpg',
  },
  {
    quote:
      'They shipped a beautiful, fast site in record time. Our bounce rate dropped and demo requests doubled within the first month.',
    name: 'David Okafor',
    role: 'VP Marketing at Northwind',
    photo: 'https://randomuser.me/api/portraits/men/75.jpg',
  },
  {
    quote:
      'The team genuinely understood our audience. Every interaction felt intentional, and the results spoke for themselves.',
    name: 'Priya Nair',
    role: 'Growth Lead at Cadence',
    photo: 'https://randomuser.me/api/portraits/women/12.jpg',
  },
  {
    quote:
      'From strategy to launch, Social Vert felt like an extension of our team. Easily the best agency partnership we have had.',
    name: 'Tomás Herrera',
    role: 'Founder at Aether Labs',
    photo: 'https://randomuser.me/api/portraits/men/41.jpg',
  },
];

export default function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  // Auth
  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  // Scroll reveal: fade + slide up elements with the `reveal` class as they enter view.
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.reveal'));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const openAuth = (mode: 'login' | 'signup') => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  // Hero video controls
  const heroVideoRef = useRef<HTMLVideoElement>(null);
  const [isHeroPlaying, setIsHeroPlaying] = useState(true);
  const [isHeroMuted, setIsHeroMuted] = useState(true);

  const toggleHeroPlay = () => {
    const video = heroVideoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsHeroPlaying(true);
    } else {
      video.pause();
      setIsHeroPlaying(false);
    }
  };

  const toggleHeroMute = () => {
    const video = heroVideoRef.current;
    if (!video) return;
    const nextMuted = !video.muted;
    video.muted = nextMuted;
    if (!nextMuted) {
      // Unmuting: ensure full volume and that playback is actually running,
      // since some browsers pause/zero-volume autoplay-muted videos.
      video.volume = 1;
      void video.play();
    }
    setIsHeroMuted(nextMuted);
  };

  const skipHeroForward = () => {
    const video = heroVideoRef.current;
    if (!video) return;
    video.currentTime = Math.min(video.currentTime + 5, video.duration || video.currentTime + 5);
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-[#38bdf8]/20 select-none">
      
      {/* SECTION 1: HERO */}
      <section 
        id="hero" 
        className="relative h-screen min-h-[650px] bg-[#EFEFEF] overflow-hidden flex flex-col justify-between"
      >
        {/* Full-screen animated shader overlay */}
        <div className="absolute inset-0 z-10 pointer-events-none">
          <Shader className="w-full h-full">
            <Swirl 
              colorA="#ffffff" 
              colorB="#f0f0f0" 
              detail={1.7} 
            />
            <ChromaFlow 
              baseColor="#ffffff" 
              downColor="#38bdf8" 
              leftColor="#38bdf8" 
              rightColor="#38bdf8" 
              upColor="#38bdf8" 
              momentum={13} 
              radius={3.5} 
            />
            <FlutedGlass 
              aberration={0.61} 
              angle={31} 
              frequency={8} 
              highlight={0.12} 
              highlightSoftness={0} 
              lightAngle={-90} 
              refraction={4} 
              shape="rounded" 
              softness={1} 
              speed={0.15} 
            />
            <FilmGrain strength={0.05} />
          </Shader>
        </div>

        {/* Navigation (z-20, relative) */}
        <div className="w-full max-w-[1440px] mx-auto p-2 sm:p-3 relative z-20">
          <nav className="bg-white/70 backdrop-blur-md rounded-full px-2 relative flex items-center justify-center h-12 shadow-[0_8px_32px_0_rgba(0,0,0,0.04)] border border-white/50">
            {/* Mobile brand (top-left) */}
            <button
              id="nav-brand-mobile"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="absolute left-4 top-1/2 -translate-y-1/2 md:hidden font-cursive text-sky-600 text-[20px] font-bold leading-none"
            >
              ContentOS
            </button>

            {/* Desktop Nav Links (centered) */}
            <div className="hidden md:flex items-center gap-6 lg:gap-10">
              <a
                id="nav-projects"
                href="#projects"
                className="font-['Inter'] text-[14px] font-medium tracking-[-0.01em] text-gray-900 hover:text-gray-500 transition-colors duration-300"
              >
                Projects
              </a>
              <a
                id="nav-testimonials"
                href="#testimonials"
                className="font-['Inter'] text-[14px] font-medium tracking-[-0.01em] text-gray-900 hover:text-gray-500 transition-colors duration-300"
              >
                Testimonials
              </a>
              <a
                id="nav-support"
                href="#footer"
                className="font-['Inter'] text-[14px] font-medium tracking-[-0.01em] text-gray-900 hover:text-gray-500 transition-colors duration-300"
              >
                Support
              </a>
              <a
                id="nav-about"
                href="#about"
                className="font-['Inter'] text-[14px] font-medium tracking-[-0.01em] text-gray-900 hover:text-gray-500 transition-colors duration-300"
              >
                About Us
              </a>
            </div>

            {/* Mobile Log in (top-right, logged-out only) */}
            {!user && (
              <button
                id="btn-mobile-login"
                onClick={() => openAuth('login')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 px-4 bg-sky-500 hover:bg-sky-600 text-white rounded-full flex items-center justify-center md:hidden text-[13px] font-semibold transition-transform duration-300 active:scale-95"
              >
                Log in
              </button>
            )}

            {/* Mobile menu toggle (left of Log in) */}
            <button
              id="btn-mobile-toggle"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`absolute top-1/2 -translate-y-1/2 w-9 h-9 bg-gray-900 text-white rounded-full flex items-center justify-center md:hidden transition-transform duration-300 active:scale-95 ${
                user ? 'right-1.5' : 'right-[88px]'
              }`}
            >
              {isMobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          </nav>
        </div>

        {/* Mobile Menu Overlay */}
        <div 
          id="mobile-menu-overlay"
          className={`fixed inset-0 z-50 transition-opacity duration-500 ${isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        >
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          
          {/* Bottom Sheet */}
          <div 
            className={`absolute bottom-0 left-0 right-0 mx-3 mb-3 bg-white rounded-2xl p-6 shadow-2xl flex flex-col gap-6 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isMobileMenuOpen ? 'translate-y-0' : 'translate-y-[110%]'}`}
          >
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <LiveClock id="mobile-live-clock" />
              <button 
                id="btn-mobile-close"
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-8 h-8 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-full flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            
            {/* Links */}
            <div className="flex flex-col gap-4 py-2">
              <a
                id="mobile-nav-projects"
                href="#projects"
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-[28px] sm:text-[32px] font-medium text-gray-900 hover:text-gray-500 transition-colors"
              >
                Projects
              </a>
              <a
                id="mobile-nav-testimonials"
                href="#testimonials"
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-[28px] sm:text-[32px] font-medium text-gray-900 hover:text-gray-500 transition-colors"
              >
                Testimonials
              </a>
              <a
                id="mobile-nav-support"
                href="#footer"
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-[28px] sm:text-[32px] font-medium text-gray-900 hover:text-gray-500 transition-colors"
              >
                Support
              </a>
              <a
                id="mobile-nav-about"
                href="#about"
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-[28px] sm:text-[32px] font-medium text-gray-900 hover:text-gray-500 transition-colors"
              >
                About Us
              </a>
            </div>
          </div>
        </div>

        {/* Hero Content (z-20) — fills remaining height and centers vertically */}
        <div className="flex-1 w-full max-w-[1440px] mx-auto px-5 sm:px-8 lg:px-12 py-10 relative z-20 flex flex-col justify-center lg:flex-row lg:items-center lg:justify-between gap-10 lg:gap-16">

          {/* Left column: text + CTA */}
          <div className="flex flex-col items-start flex-1 min-w-0">
            <span
              id="hero-label"
              className="reveal font-['Dancing_Script'] text-[24px] sm:text-[30px] text-sky-600 font-bold tracking-normal normal-case mb-5 sm:mb-8 inline-block"
            >
              by social vert
            </span>

            <h1
              id="hero-headline"
              className="reveal reveal-delay-1 font-apple font-light leading-[1.1] tracking-[-0.025em] text-gray-900 text-[clamp(2.6rem,8vw,5.25rem)] sm:text-[clamp(3.25rem,6vw,5.25rem)] max-w-[860px]"
            >
              All your content updates, now in{' '}
              <span className="font-cursive text-[#0ea5e9] text-[1.1em] font-semibold align-baseline">one place</span>.
            </h1>

            {/* CTA Row */}
            <div className="reveal reveal-delay-2 mt-8 sm:mt-12 flex flex-row gap-3 sm:gap-4 items-center w-full sm:w-auto">
              {user ? (
                <>
                  <button
                    id="btn-hero-dashboard"
                    onClick={() => navigate('/dashboard')}
                    className="min-w-[150px] bg-sky-500 hover:bg-sky-600 border border-sky-500 text-white font-['Inter'] text-[14px] font-semibold tracking-[-0.01em] rounded-full px-6 py-2.5 flex items-center justify-center shadow-sm hover:shadow-md transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
                  >
                    Dashboard
                  </button>
                  <button
                    id="btn-hero-logout"
                    onClick={() => signOut(auth)}
                    className="min-w-[120px] bg-white hover:bg-sky-50 border border-sky-500 text-sky-600 font-['Inter'] text-[14px] font-semibold tracking-[-0.01em] rounded-full px-6 py-2.5 flex items-center justify-center shadow-sm hover:shadow-md transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
                  >
                    Log out
                  </button>
                </>
              ) : (
                <>
                  {/* Log in (white bg, blue text — secondary).
                      Hidden on mobile — mobile uses the top-right nav Log in button. */}
                  <button
                    id="btn-hero-login"
                    onClick={() => openAuth('login')}
                    className="hidden sm:flex min-w-[150px] bg-white hover:bg-sky-50 border border-sky-500 text-sky-600 font-['Inter'] text-[14px] font-semibold tracking-[-0.01em] rounded-full px-6 py-2.5 items-center justify-center shadow-sm hover:shadow-md transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
                  >
                    <TextRoll text="Log in" />
                  </button>

                  {/* Sign in (sign up) — hidden for now.
                  <button
                    id="btn-hero-signin"
                    onClick={() => openAuth('signup')}
                    className="min-w-[150px] bg-sky-500 hover:bg-sky-600 border border-sky-500 text-white font-['Inter'] text-[14px] font-semibold tracking-[-0.01em] rounded-full px-6 py-2.5 flex items-center justify-center shadow-sm hover:shadow-md transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
                  >
                    <TextRoll text="Sign in" />
                  </button>
                  */}
                </>
              )}
            </div>
          </div>

          {/* Right column: 9:16 hero video */}
          <div
            id="hero-video-wrap"
            className="reveal reveal-delay-2 group relative w-[200px] sm:w-[240px] lg:w-[320px] shrink-0 self-center aspect-[9/16] rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.18)] border border-white/40 bg-black/5"
          >
            <video
              ref={heroVideoRef}
              id="hero-video"
              src="/hero-video.mp4"
              autoPlay
              muted
              loop
              playsInline
              onPlay={() => setIsHeroPlaying(true)}
              onPause={() => setIsHeroPlaying(false)}
              className="w-full h-full object-cover"
            />

            {/* Always-visible "tap for sound" badge while muted (desktop + mobile) */}
            {isHeroMuted && (
              <button
                id="hero-unmute-badge"
                onClick={toggleHeroMute}
                aria-label="Tap for sound"
                className="absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-md px-3 py-1.5 text-[12px] font-semibold text-white shadow-md hover:bg-black/75 transition-colors active:scale-95"
              >
                <VolumeX size={14} /> Tap for sound
              </button>
            )}

            {/* Hover controls overlay */}
            <div
              id="hero-video-controls"
              className="absolute inset-0 flex items-end justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none"
            >
              <div className="mb-4 flex items-center gap-2 pointer-events-auto">
                {/* Play / Pause */}
                <button
                  id="hero-btn-play"
                  onClick={toggleHeroPlay}
                  aria-label={isHeroPlaying ? 'Pause video' : 'Play video'}
                  className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-md text-gray-900 flex items-center justify-center shadow-md hover:bg-white transition-colors duration-200 active:scale-95"
                >
                  {isHeroPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                </button>

                {/* Mute / Unmute (enables audio) */}
                <button
                  id="hero-btn-mute"
                  onClick={toggleHeroMute}
                  aria-label={isHeroMuted ? 'Unmute video' : 'Mute video'}
                  className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-md text-gray-900 flex items-center justify-center shadow-md hover:bg-white transition-colors duration-200 active:scale-95"
                >
                  {isHeroMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>

                {/* Skip forward 5s */}
                <button
                  id="hero-btn-forward"
                  onClick={skipHeroForward}
                  aria-label="Skip forward 5 seconds"
                  className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-md text-gray-900 flex items-center justify-center shadow-md hover:bg-white transition-colors duration-200 active:scale-95"
                >
                  <FastForward size={16} fill="currentColor" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: TESTIMONIALS */}
      <section
        id="testimonials"
        className="bg-white pt-16 sm:pt-20 lg:pt-32 pb-12 sm:pb-16 lg:pb-24 overflow-hidden"
      >
        {/* Centered eyebrow label */}
        <div className="reveal flex items-center justify-center mb-4 sm:mb-6 px-5">
          <span
            id="testimonials-badge-label"
            className="font-apple text-[26px] sm:text-[32px] font-bold tracking-[-0.02em] text-gray-900"
          >
            What clients say
          </span>
        </div>

        {/* Centered heading */}
        <div className="px-5 sm:px-8 lg:px-12">
          <h2
            id="testimonials-headline"
            className="reveal reveal-delay-1 font-apple font-medium leading-[1.2] lg:leading-[1.12] tracking-[-0.02em] text-gray-900 text-[clamp(1.5rem,4vw,3.2rem)] mb-12 sm:mb-16 lg:mb-20 max-w-[900px] mx-auto text-center"
          >
            Hear from the <span className="font-cursive text-[#0ea5e9] text-[1.15em] font-semibold align-baseline">brands</span> we've helped scale to the top of their category.
          </h2>
        </div>

        {/* Auto-scrolling marquee (hover to pause) */}
        <div className="marquee-track relative [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
          <div className="flex w-max animate-marquee gap-6">
            {[...testimonials, ...testimonials].map((t, i) => (
              <div
                key={i}
                className="w-[330px] sm:w-[380px] shrink-0 bg-white border border-gray-100 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_36px_rgba(14,165,233,0.12)] hover:border-sky-200 p-7 sm:p-8 flex flex-col transition-all duration-300"
              >
                {/* Star rating */}
                <div className="flex gap-1 text-sky-400 mb-5">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star key={s} size={16} fill="currentColor" strokeWidth={0} />
                  ))}
                </div>

                <p className="font-apple text-[15px] sm:text-[16px] leading-[1.65] text-gray-700 flex-1">
                  “{t.quote}”
                </p>

                <div className="mt-7 pt-5 border-t border-gray-100 flex items-center gap-3">
                  <img
                    src={t.photo}
                    alt={t.name}
                    loading="lazy"
                    className="w-12 h-12 rounded-full object-cover shrink-0 ring-2 ring-sky-100"
                  />
                  <div className="flex flex-col text-left">
                    <span className="font-apple text-[14px] font-semibold text-gray-900">{t.name}</span>
                    <span className="font-apple text-[13px] text-gray-500">{t.role}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

            {/* FOOTER */}
      <footer id="footer" className="bg-sky-500 text-white">
        <div className="max-w-[1440px] mx-auto px-5 sm:px-8 lg:px-12 py-8 lg:py-10">
          {/* Top: brand + links */}
          <div className="reveal flex flex-col lg:flex-row lg:justify-between gap-8 lg:gap-8">
            {/* Brand block */}
            <div className="max-w-sm">
              <span className="font-cursive text-[34px] font-bold leading-none">social vert</span>
              <p className="font-apple mt-3 text-[14px] text-white/80 leading-relaxed">
                All your content updates, now in one place. We craft digital experiences for brands ready to dominate their category online.
              </p>
              {/* Newsletter */}
              <form className="mt-4 flex items-center gap-2 max-w-[340px]" onSubmit={(e) => e.preventDefault()}>
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="font-apple flex-1 min-w-0 bg-white/15 placeholder-white/60 text-white text-[14px] rounded-full px-4 py-2.5 border border-white/25 outline-none focus:bg-white/25 transition-colors duration-300"
                />
                <button
                  type="submit"
                  className="font-apple shrink-0 bg-white text-sky-600 text-[14px] font-semibold rounded-full px-5 py-2.5 hover:bg-sky-50 transition-colors duration-300"
                >
                  Subscribe
                </button>
              </form>
              {/* Socials */}
              <div className="flex items-center gap-3 mt-4">
                <a href="#" aria-label="X (Twitter)" className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors duration-300">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                </a>
                <a href="#" aria-label="LinkedIn" className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors duration-300">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
                </a>
                <a href="#" aria-label="Instagram" className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors duration-300">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.012-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" /></svg>
                </a>
                <a href="#" aria-label="GitHub" className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors duration-300">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></svg>
                </a>
                <a href="mailto:hello@socialvert.com" aria-label="Email" className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors duration-300"><Mail size={16} /></a>
              </div>
            </div>

            {/* Link columns */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 sm:gap-12 lg:gap-16 font-apple">
              <div className="flex flex-col gap-3">
                <span className="text-[13px] font-semibold uppercase tracking-wider text-white/60">Product</span>
                <a href="#" className="text-[14px] text-white/90 hover:text-white transition-colors duration-200">Features</a>
                <a href="#" className="text-[14px] text-white/90 hover:text-white transition-colors duration-200">Pricing</a>
                <a href="#" className="text-[14px] text-white/90 hover:text-white transition-colors duration-200">Integrations</a>
                <a href="#" className="text-[14px] text-white/90 hover:text-white transition-colors duration-200">Changelog</a>
              </div>
              <div className="flex flex-col gap-3">
                <span className="text-[13px] font-semibold uppercase tracking-wider text-white/60">Company</span>
                <a href="#" className="text-[14px] text-white/90 hover:text-white transition-colors duration-200">About</a>
                <a href="#" className="text-[14px] text-white/90 hover:text-white transition-colors duration-200">Careers</a>
                <a href="#journal" className="text-[14px] text-white/90 hover:text-white transition-colors duration-200">Blog</a>
                <a href="#connect" className="text-[14px] text-white/90 hover:text-white transition-colors duration-200">Contact</a>
              </div>
              <div className="flex flex-col gap-3">
                <span className="text-[13px] font-semibold uppercase tracking-wider text-white/60">Legal</span>
                <a href="#" className="text-[14px] text-white/90 hover:text-white transition-colors duration-200">Privacy Policy</a>
                <a href="#" className="text-[14px] text-white/90 hover:text-white transition-colors duration-200">Terms of Service</a>
                <a href="#" className="text-[14px] text-white/90 hover:text-white transition-colors duration-200">Cookie Policy</a>
                <a href="#" className="text-[14px] text-white/90 hover:text-white transition-colors duration-200">Security</a>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="font-apple border-t border-white/20 mt-8 pt-5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-[13px] text-white/70">&copy; 2026 Social Vert. All rights reserved.</span>
            <span className="text-[13px] text-white/70">Made for brands ready to dominate.</span>
          </div>
        </div>
      </footer>

      {/* Auth modal (email/password) — redirects to /dashboard on success */}
      <AuthModal open={authOpen} initialMode={authMode} onClose={() => setAuthOpen(false)} />

    </div>
  );
}
