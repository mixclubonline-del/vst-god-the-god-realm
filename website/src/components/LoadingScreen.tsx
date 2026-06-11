/**
 * LoadingScreen.tsx — Cinematic God Reveal Intro
 *
 * Zeus and Agni emerge from darkness to frame the VST GOD title,
 * then the veil lifts to reveal the site. A dramatic 4-second
 * opening sequence that sets the divine tone.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type Ease4 = [number, number, number, number];
const EASE_OUT_EXPO: Ease4 = [0.22, 1, 0.36, 1];
const EASE_OUT_CUBIC: Ease4 = [0.33, 1, 0.68, 1];

export default function LoadingScreen() {
  const [phase, setPhase] = useState<'dark' | 'gods' | 'title' | 'exit'>('dark');
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase('gods'), 400),
      setTimeout(() => setPhase('title'), 1600),
      setTimeout(() => setPhase('exit'), 3400),
      setTimeout(() => setIsVisible(false), 4200),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const showGods = phase === 'gods' || phase === 'title' || phase === 'exit';
  const showTitle = phase === 'title' || phase === 'exit';

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="loading"
          exit={{ opacity: 0 }}
          transition={{ duration: 1, ease: EASE_OUT_EXPO }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#050507',
            fontFamily: "'Inter', system-ui, sans-serif",
            overflow: 'hidden',
          }}
        >
          {/* ── Ambient Atmosphere ─────────────────────────── */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(ellipse at 50% 50%, rgba(194,150,35,0.04) 0%, transparent 50%)',
              opacity: showTitle ? 1 : 0,
              transition: 'opacity 1.5s ease',
            }}
          />

          {/* ── Zeus — Emerges from Left ──────────────────── */}
          <motion.div
            initial={{ opacity: 0, x: -200, scale: 1.15 }}
            animate={showGods
              ? { opacity: phase === 'exit' ? 0.4 : 0.85, x: 0, scale: 1 }
              : {}
            }
            transition={{ duration: 1.4, ease: EASE_OUT_CUBIC }}
            style={{
              position: 'absolute',
              left: '-2%',
              top: 0,
              width: '45%',
              height: '100%',
              pointerEvents: 'none',
            }}
          >
            <img
              src="/images/gods/zeus-cinematic.png"
              alt=""
              aria-hidden="true"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center top',
                maskImage: 'radial-gradient(ellipse 85% 80% at 35% 45%, black 20%, transparent 70%)',
                WebkitMaskImage: 'radial-gradient(ellipse 85% 80% at 35% 45%, black 20%, transparent 70%)',
                filter: 'brightness(0.6) contrast(1.2) saturate(1.3)',
              }}
            />
            {/* Lightning flash */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={showGods ? { opacity: [0, 0.6, 0, 0.3, 0] } : {}}
              transition={{ duration: 0.8, delay: 0.2, times: [0, 0.1, 0.3, 0.5, 1] }}
              style={{
                position: 'absolute',
                inset: 0,
                background: 'radial-gradient(circle at 60% 40%, rgba(78,203,255,0.4) 0%, transparent 60%)',
                pointerEvents: 'none',
              }}
            />
          </motion.div>

          {/* ── Agni — Emerges from Right ─────────────────── */}
          <motion.div
            initial={{ opacity: 0, x: 200, scale: 1.15 }}
            animate={showGods
              ? { opacity: phase === 'exit' ? 0.4 : 0.85, x: 0, scale: 1 }
              : {}
            }
            transition={{ duration: 1.4, delay: 0.3, ease: EASE_OUT_CUBIC }}
            style={{
              position: 'absolute',
              right: '-2%',
              top: 0,
              width: '45%',
              height: '100%',
              pointerEvents: 'none',
            }}
          >
            <img
              src="/images/gods/agni-cinematic.png"
              alt=""
              aria-hidden="true"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center top',
                maskImage: 'radial-gradient(ellipse 85% 80% at 65% 45%, black 20%, transparent 70%)',
                WebkitMaskImage: 'radial-gradient(ellipse 85% 80% at 65% 45%, black 20%, transparent 70%)',
                filter: 'brightness(0.6) contrast(1.2) saturate(1.3)',
              }}
            />
            {/* Fire glow */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={showGods ? { opacity: [0, 0.5, 0.2, 0.4, 0.15] } : {}}
              transition={{ duration: 1.2, delay: 0.5, times: [0, 0.2, 0.4, 0.6, 1] }}
              style={{
                position: 'absolute',
                inset: 0,
                background: 'radial-gradient(circle at 40% 40%, rgba(255,120,30,0.35) 0%, transparent 60%)',
                pointerEvents: 'none',
              }}
            />
          </motion.div>

          {/* ── Center Vignette ───────────────────────────── */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(ellipse 60% 70% at 50% 50%, transparent 0%, #050507 100%)',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />

          {/* ── Title Reveal ──────────────────────────────── */}
          <div
            style={{
              position: 'relative',
              zIndex: 2,
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            {/* Horizontal line — left */}
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={showTitle ? { scaleX: 1, opacity: 1 } : {}}
              transition={{ duration: 1, delay: 0.1, ease: EASE_OUT_EXPO }}
              style={{
                position: 'absolute',
                top: '50%',
                right: 'calc(50% + clamp(100px, 18vw, 220px))',
                width: 'clamp(40px, 12vw, 140px)',
                height: 1,
                background: 'linear-gradient(90deg, transparent, rgba(194,150,35,0.5))',
                transformOrigin: 'right center',
              }}
            />
            {/* Horizontal line — right */}
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={showTitle ? { scaleX: 1, opacity: 1 } : {}}
              transition={{ duration: 1, delay: 0.1, ease: EASE_OUT_EXPO }}
              style={{
                position: 'absolute',
                top: '50%',
                left: 'calc(50% + clamp(100px, 18vw, 220px))',
                width: 'clamp(40px, 12vw, 140px)',
                height: 1,
                background: 'linear-gradient(90deg, rgba(194,150,35,0.5), transparent)',
                transformOrigin: 'left center',
              }}
            />

            {/* VST GOD */}
            <motion.h1
              initial={{ opacity: 0, y: 20, scale: 0.85, letterSpacing: '0.05em' }}
              animate={showTitle
                ? { opacity: 1, y: 0, scale: 1, letterSpacing: '0.25em' }
                : {}
              }
              transition={{ duration: 1.2, ease: EASE_OUT_EXPO }}
              style={{
                fontSize: 'clamp(2.5rem, 8vw, 5rem)',
                fontWeight: 900,
                lineHeight: 1,
                margin: 0,
                background: 'linear-gradient(180deg, #f0d668 0%, #c29623 40%, #a07818 80%, #e8c547 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 0 30px rgba(194,150,35,0.5)) drop-shadow(0 0 80px rgba(194,150,35,0.2))',
                textTransform: 'uppercase' as const,
              }}
            >
              VST GOD
            </motion.h1>

            {/* THE GOD REALM */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={showTitle ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, delay: 0.5, ease: EASE_OUT_EXPO }}
              style={{
                color: 'rgba(194,150,35,0.7)',
                fontSize: 'clamp(0.55rem, 1.4vw, 0.75rem)',
                fontWeight: 600,
                letterSpacing: '0.45em',
                textTransform: 'uppercase' as const,
                margin: '12px 0 0',
              }}
            >
              THE GOD REALM
            </motion.p>

            {/* Tagline */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={showTitle ? { opacity: 1 } : {}}
              transition={{ duration: 0.8, delay: 0.9, ease: EASE_OUT_EXPO }}
              style={{
                color: 'rgba(255,255,255,0.25)',
                fontSize: 'clamp(0.5rem, 1.1vw, 0.65rem)',
                letterSpacing: '0.15em',
                margin: '16px 0 0',
              }}
            >
              DIVINE ELECTRIC KEYS · ENTER THE PANTHEON
            </motion.p>
          </div>

          {/* ── Bottom Progress ───────────────────────────── */}
          <div
            style={{
              position: 'absolute',
              bottom: 'clamp(30px, 6vh, 60px)',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              zIndex: 2,
            }}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              style={{
                width: 100,
                height: 2,
                background: 'rgba(255,255,255,0.06)',
                borderRadius: 1,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  background: 'linear-gradient(90deg, #c29623, #f0d668)',
                  borderRadius: 1,
                  animation: 'introBar 3.4s ease-in-out forwards',
                }}
              />
            </motion.div>
          </div>

          {/* ── Screen Flash on Exit ──────────────────────── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={phase === 'exit' ? { opacity: [0, 0.15, 0] } : {}}
            transition={{ duration: 0.6 }}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(circle, rgba(194,150,35,0.3) 0%, transparent 70%)',
              pointerEvents: 'none',
              zIndex: 3,
            }}
          />

          <style>{`
            @keyframes introBar {
              0% { width: 0; }
              30% { width: 30%; }
              70% { width: 75%; }
              100% { width: 100%; }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
