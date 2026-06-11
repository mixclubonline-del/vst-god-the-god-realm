/**
 * GodRealmSection.tsx — Individual God Showcase Section
 *
 * Renders a full-viewport immersive showcase for a single god from the
 * Electric Pantheon. Features 3D tilt artwork card, alternating layout,
 * glassmorphic Realm FX cards with flip animations, inline audio player,
 * and scroll-driven entrance animations via Framer Motion.
 */

import { useCallback, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Play, Pause, Volume2 } from 'lucide-react';
import type { GodData } from '@/data/godData';

/* ─────────────────────────── Types ─────────────────────────── */

interface GodRealmSectionProps {
  god: GodData;
  index: number;
}

/* ─────────────────────────── Helpers ─────────────────────────── */

const isTouchDevice = (): boolean =>
  typeof window !== 'undefined' &&
  ('ontouchstart' in window || navigator.maxTouchPoints > 0);

/* ─────────────────────────── Shared Styles ─────────────────────────── */

const glassBase: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.03)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255, 255, 255, 0.06)',
};

const chipStyle: React.CSSProperties = {
  ...glassBase,
  padding: '6px 14px',
  borderRadius: 999,
  fontSize: '0.75rem',
  fontFamily: "'JetBrains Mono', monospace",
  letterSpacing: '0.04em',
  whiteSpace: 'nowrap',
};

/* ─────────────────────────── Motion Variants ─────────────────────────── */

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

const fxCardVariants = {
  hidden: { opacity: 0, scale: 0.85, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

/* ─────────────────────────── Sub-Components ─────────────────────────── */

/**
 * 3D tilt artwork card with mouse-tracking perspective rotation.
 * Falls back to a static presentation on touch devices or when
 * prefers-reduced-motion is active.
 */
function ArtworkCard({
  god,
  isReversed,
  reducedMotion,
}: {
  god: GodData;
  isReversed: boolean;
  reducedMotion: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const disableTilt = reducedMotion || isTouchDevice();

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disableTilt || !cardRef.current) return;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const rect = cardRef.current!.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const px = (e.clientX - cx) / (rect.width / 2);
        const py = (e.clientY - cy) / (rect.height / 2);
        setTilt({ rotateX: -py * 12, rotateY: px * 12 });
      });
    },
    [disableTilt],
  );

  const handleMouseLeave = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setTilt({ rotateX: 0, rotateY: 0 });
    setIsHovering(false);
  }, []);

  const slideFrom = isReversed ? 80 : -80;

  return (
    <motion.div
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: slideFrom }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
      style={{ perspective: '1000px', display: 'flex', justifyContent: 'center' }}
    >
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={handleMouseLeave}
        style={{
          ...glassBase,
          position: 'relative',
          borderRadius: 16,
          padding: 8,
          maxWidth: 500,
          width: '100%',
          transform: `rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`,
          transition: disableTilt
            ? 'none'
            : 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
          willChange: 'transform',
          borderColor: isHovering
            ? 'var(--god-primary)'
            : 'rgba(255, 255, 255, 0.06)',
          boxShadow: `
            0 0 60px 10px var(--god-glow),
            0 20px 60px -15px rgba(0, 0, 0, 0.5)
          `,
          cursor: 'default',
        }}
      >
        {/* Ambient glow behind card */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: -40,
            borderRadius: 32,
            background: `radial-gradient(ellipse at center, var(--god-glow), transparent 70%)`,
            opacity: 0.4,
            pointerEvents: 'none',
            zIndex: -1,
          }}
        />
        <img
          src={god.heroImage}
          alt={`${god.name} — ${god.title}`}
          loading="lazy"
          style={{
            width: '100%',
            maxWidth: 500,
            aspectRatio: '4 / 5',
            objectFit: 'cover',
            borderRadius: 12,
            display: 'block',
          }}
        />
      </div>
    </motion.div>
  );
}

/**
 * Realm FX card with 3D flip on hover.
 * Front: FX name with icon. Back: god name context.
 */
function RealmFxCard({
  fxName,
  godName,
  godIcon,
  reducedMotion,
}: {
  fxName: string;
  godName: string;
  godIcon: string;
  reducedMotion: boolean;
}) {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <motion.div
      variants={fxCardVariants}
      onMouseEnter={() => !reducedMotion && setIsFlipped(true)}
      onMouseLeave={() => setIsFlipped(false)}
      style={{
        perspective: '800px',
        height: 90,
        cursor: 'default',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          transformStyle: 'preserve-3d',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          transition: 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {/* Front face */}
        <div
          style={{
            ...glassBase,
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            borderRadius: 12,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            borderColor: 'color-mix(in srgb, var(--god-primary) 20%, transparent)',
            padding: '12px 16px',
          }}
        >
          <span style={{ fontSize: '1.1rem' }} aria-hidden="true">✦</span>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.72rem',
              letterSpacing: '0.06em',
              textAlign: 'center',
              color: 'var(--god-primary)',
              fontWeight: 500,
            }}
          >
            {fxName}
          </span>
        </div>

        {/* Back face */}
        <div
          style={{
            ...glassBase,
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            borderRadius: 12,
            transform: 'rotateY(180deg)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            background: 'color-mix(in srgb, var(--god-primary) 8%, rgba(0,0,0,0.6))',
            borderColor: 'var(--god-primary)',
            padding: '12px 16px',
          }}
        >
          <span style={{ fontSize: '1.3rem' }}>{godIcon}</span>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.65rem',
              letterSpacing: '0.1em',
              color: 'rgba(255, 255, 255, 0.6)',
              textTransform: 'uppercase',
            }}
          >
            {godName} Realm
          </span>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Minimalist inline audio player with play/pause and progress bar.
 */
function AudioPlayer({
  src,
  primaryColor,
}: {
  src: string;
  primaryColor: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [duration, setDuration] = useState(0);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        // Stop all other audio players on the page first
        document.querySelectorAll('audio').forEach((el) => {
          if (el !== audio && !el.paused) {
            el.pause();
            el.currentTime = 0;
          }
        });
        await audio.play();
        setIsPlaying(true);
      } catch (err) {
        console.warn('Audio playback failed:', err);
        setIsPlaying(false);
      }
    }
  }, [isPlaying]);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    setProgress((audio.currentTime / audio.duration) * 100);
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setProgress(0);
  }, []);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setIsLoaded(true);
    setHasError(false);
    setDuration(audio.duration);
  }, []);

  const handleError = useCallback(() => {
    setHasError(true);
    setIsLoaded(false);
    setIsPlaying(false);
  }, []);

  const handleBarClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const audio = audioRef.current;
      if (!audio || !audio.duration) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      audio.currentTime = x * audio.duration;
      setProgress(x * 100);
    },
    [],
  );

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginTop: 8,
      }}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onPause={handlePause}
        onPlay={handlePlay}
        onLoadedMetadata={handleLoadedMetadata}
        onError={handleError}
      />

      <button
        onClick={togglePlay}
        disabled={hasError}
        aria-label={isPlaying ? 'Pause audio preview' : 'Play audio preview'}
        style={{
          background: 'none',
          border: `1px solid ${hasError ? 'rgba(255,255,255,0.15)' : primaryColor}`,
          borderRadius: '50%',
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: hasError ? 'rgba(255,255,255,0.3)' : primaryColor,
          cursor: hasError ? 'not-allowed' : 'pointer',
          flexShrink: 0,
          transition: 'background 0.2s, transform 0.2s',
          opacity: hasError ? 0.5 : 1,
        }}
        onMouseEnter={(e) => {
          if (!hasError) {
            e.currentTarget.style.background = `color-mix(in srgb, ${primaryColor} 15%, transparent)`;
            e.currentTarget.style.transform = 'scale(1.08)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'none';
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        {isPlaying ? <Pause size={14} /> : <Play size={14} style={{ marginLeft: 2 }} />}
      </button>

      {/* Waveform-style progress bar */}
      <div
        onClick={handleBarClick}
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Audio progress"
        style={{
          flex: 1,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          cursor: hasError ? 'default' : 'pointer',
          position: 'relative',
        }}
      >
        {/* Waveform bars */}
        {Array.from({ length: 40 }, (_, i) => {
          const barProgress = (i / 40) * 100;
          const isFilled = barProgress < progress;
          // Generate pseudo-random bar heights for waveform look
          const seed = Math.sin(i * 127.1 + 311.7) * 43758.5453;
          const height = 30 + (((seed - Math.floor(seed)) * 70) | 0);
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${height}%`,
                borderRadius: 1,
                background: isFilled
                  ? primaryColor
                  : 'rgba(255, 255, 255, 0.1)',
                transition: 'background 0.15s',
              }}
            />
          );
        })}
      </div>

      {/* Duration / status */}
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.55rem',
          color: 'rgba(255,255,255,0.3)',
          flexShrink: 0,
          minWidth: 30,
          textAlign: 'right',
        }}
      >
        {hasError ? 'ERR' : isLoaded && duration > 0 ? formatTime(duration) : '···'}
      </span>

      <Volume2
        size={14}
        style={{ color: 'rgba(255, 255, 255, 0.3)', flexShrink: 0 }}
        aria-hidden="true"
      />
    </div>
  );
}

/* ─────────────────────────── Main Component ─────────────────────────── */

export default function GodRealmSection({ god, index }: GodRealmSectionProps) {
  const prefersReduced = useReducedMotion();
  const reducedMotion = prefersReduced ?? false;
  const isReversed = index % 2 !== 0;

  return (
    <section
      id={god.id}
      style={{
        // @ts-expect-error -- CSS custom properties
        '--god-primary': god.colors.primary,
        '--god-secondary': god.colors.secondary,
        '--god-accent': god.colors.accent,
        '--god-glow': god.colors.glow,

        position: 'relative',
        overflow: 'hidden',
        minHeight: '100vh',
        padding: '120px clamp(20px, 5vw, 80px)',
        background: `radial-gradient(ellipse at center, ${god.colors.glow}, transparent 65%)`,
      }}
    >
      {/* ─── Content wrapper ─── */}
      <div
        style={{
          maxWidth: 1400,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 60,
        }}
      >
        {/* ─── Main 2-column grid ─── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))',
            gap: 'clamp(40px, 5vw, 60px)',
            alignItems: 'center',
          }}
        >
          {/* Artwork — conditionally first or second via CSS order */}
          <div className="god-artwork-col" style={{ order: isReversed ? 2 : 1 }}>
            <ArtworkCard
              god={god}
              isReversed={isReversed}
              reducedMotion={reducedMotion}
            />
          </div>

          {/* Info Panel */}
          <motion.div
            className="god-info-col"
            style={{ order: isReversed ? 1 : 2 }}
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.25 }}
          >
            {/* God Icon + Name */}
            <motion.div variants={itemVariants} style={{ marginBottom: 4 }}>
              <span
                style={{ fontSize: '2.2rem', marginRight: 12 }}
                aria-hidden="true"
              >
                {god.icon}
              </span>
              <span
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 'clamp(2rem, 4vw, 3.2rem)',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: god.colors.primary,
                  lineHeight: 1.1,
                }}
              >
                {god.name}
              </span>
            </motion.div>

            {/* Title */}
            <motion.p
              variants={itemVariants}
              style={{
                fontStyle: 'italic',
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: 'clamp(1rem, 2vw, 1.25rem)',
                marginTop: 4,
                marginBottom: 24,
              }}
            >
              {god.title}
            </motion.p>

            {/* Quote */}
            <motion.blockquote
              variants={itemVariants}
              style={{
                ...glassBase,
                borderRadius: 12,
                padding: '16px 20px',
                borderLeft: `3px solid var(--god-accent)`,
                fontStyle: 'italic',
                fontSize: 'clamp(0.95rem, 1.5vw, 1.1rem)',
                color: 'rgba(255, 255, 255, 0.85)',
                lineHeight: 1.6,
                marginBottom: 24,
                margin: '0 0 24px 0',
              }}
            >
              "{god.quote}"
            </motion.blockquote>

            {/* Element / Domain / Mood chips */}
            <motion.div
              variants={itemVariants}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: 20,
              }}
            >
              {[
                { label: 'Element', value: god.element },
                { label: 'Domain', value: god.domain },
                { label: 'Mood', value: god.mood },
              ].map(({ label, value }) => (
                <span
                  key={label}
                  style={{
                    ...chipStyle,
                    color: god.colors.primary,
                  }}
                >
                  <span style={{ color: 'rgba(255,255,255,0.4)', marginRight: 6 }}>
                    {label}
                  </span>
                  {value}
                </span>
              ))}
            </motion.div>

            {/* Best For */}
            <motion.div variants={itemVariants} style={{ marginBottom: 20 }}>
              <p
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.68rem',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'rgba(255, 255, 255, 0.35)',
                  marginBottom: 10,
                }}
              >
                Best For
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {god.bestFor.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      ...chipStyle,
                      background: 'rgba(255, 255, 255, 0.04)',
                      color: 'rgba(255, 255, 255, 0.75)',
                      fontSize: '0.7rem',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </motion.div>

            {/* Emotional Purpose */}
            <motion.p
              variants={itemVariants}
              style={{
                fontSize: 'clamp(0.9rem, 1.3vw, 1rem)',
                color: 'rgba(255, 255, 255, 0.6)',
                lineHeight: 1.6,
                marginBottom: 16,
              }}
            >
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.65rem',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'rgba(255, 255, 255, 0.3)',
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                Emotional Purpose
              </span>
              {god.emotionalPurpose}
            </motion.p>

            {/* Audio Preview */}
            {god.audioPreview && (
              <motion.div variants={itemVariants}>
                <p
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.65rem',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'rgba(255, 255, 255, 0.3)',
                    marginBottom: 6,
                  }}
                >
                  Audio Preview
                </p>
                <AudioPlayer
                  src={god.audioPreview}
                  primaryColor={god.colors.primary}
                />
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* ─── Realm FX Cards ─── */}
        <motion.div
          className="realm-fx-grid"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 14,
          }}
        >
          {god.realmFx.slice(0, 4).map((fx) => (
            <RealmFxCard
              key={fx}
              fxName={fx}
              godName={god.name}
              godIcon={god.icon}
              reducedMotion={reducedMotion}
            />
          ))}
        </motion.div>

        {/* ─── Sonic References ─── */}
        {god.sonicReferences.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <p
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.6rem',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'rgba(255, 255, 255, 0.25)',
                marginBottom: 8,
              }}
            >
              Sonic References
            </p>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexWrap: 'wrap',
                gap: '4px 20px',
              }}
            >
              {god.sonicReferences.map((ref) => (
                <li
                  key={ref}
                  style={{
                    fontStyle: 'italic',
                    fontSize: '0.82rem',
                    color: 'rgba(255, 255, 255, 0.35)',
                    lineHeight: 1.7,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: 4,
                      height: 4,
                      borderRadius: '50%',
                      background: 'var(--god-primary)',
                      opacity: 0.4,
                      marginRight: 8,
                      verticalAlign: 'middle',
                    }}
                  />
                  {ref}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </div>

      {/* ─── Responsive overrides via <style> ─── */}
      <style>{`
        /* Mobile: always stack image on top, info below */
        @media (max-width: 768px) {
          #${god.id} .god-artwork-col { order: 1 !important; }
          #${god.id} .god-info-col    { order: 2 !important; }
        }

        @media (max-width: 640px) {
          #${god.id} {
            padding-top: 80px !important;
            padding-bottom: 80px !important;
          }

          /* Realm FX grid: 2x2 on mobile */
          #${god.id} .realm-fx-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>
    </section>
  );
}
