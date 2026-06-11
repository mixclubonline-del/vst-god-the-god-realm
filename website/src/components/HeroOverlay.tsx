/**
 * HeroOverlay.tsx — Cinematic God-tier hero overlay
 *
 * Layered on top of the Three.js particle canvas. Features:
 * - Zeus & Agni cinematic god artwork flanking the title
 * - Metallic gold gradient title text with multi-layer glow
 * - Floating plugin UI preview card with perspective tilt
 * - Staggered framer-motion entrance animations
 * - Scroll indicator with bouncing chevron
 */

import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

/* ── Ease Tuple ─────────────────────────────────────────────── */
type Ease4 = [number, number, number, number];
const EASE_OUT_EXPO: Ease4 = [0.22, 1, 0.36, 1];

/* ── Reduced Motion ─────────────────────────────────────────── */
const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const fadeInUp = (delay: number) =>
  prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 30, rotateX: 8 },
        animate: { opacity: 1, y: 0, rotateX: 0 },
        transition: {
          duration: 0.9,
          delay,
          ease: EASE_OUT_EXPO,
        },
      };

/* ── Component ─────────────────────────────────────────────── */
export default function HeroOverlay() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 2,
        overflow: 'hidden',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* ── Cinematic God Artwork — Zeus Left, Agni Right ─── */}
      <div
        className="hero-gods-wrapper"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      >
        {/* Zeus — Left Side */}
        <motion.div
          className="hero-god-zeus"
          initial={prefersReducedMotion ? {} : { opacity: 0, x: -120, scale: 1.05 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 1.2, delay: 0.3, ease: EASE_OUT_EXPO }}
          style={{
            position: 'absolute',
            left: '-5%',
            top: '5%',
            width: '42%',
            height: '85%',
            overflow: 'hidden',
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
              maskImage: 'radial-gradient(ellipse 80% 80% at 40% 40%, black 30%, transparent 75%)',
              WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 40% 40%, black 30%, transparent 75%)',
              filter: 'brightness(0.7) contrast(1.15) saturate(1.2)',
              transform: 'perspective(800px) rotateY(6deg)',
            }}
          />
          {/* Blue glow behind Zeus */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '20%',
              left: '30%',
              width: '60%',
              height: '60%',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(100,150,255,0.2) 0%, transparent 70%)',
              filter: 'blur(40px)',
              pointerEvents: 'none',
            }}
          />
        </motion.div>

        {/* Agni — Right Side */}
        <motion.div
          className="hero-god-agni"
          initial={prefersReducedMotion ? {} : { opacity: 0, x: 120, scale: 1.05 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 1.2, delay: 0.5, ease: EASE_OUT_EXPO }}
          style={{
            position: 'absolute',
            right: '-5%',
            top: '5%',
            width: '42%',
            height: '85%',
            overflow: 'hidden',
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
              maskImage: 'radial-gradient(ellipse 80% 80% at 60% 40%, black 30%, transparent 75%)',
              WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 60% 40%, black 30%, transparent 75%)',
              filter: 'brightness(0.7) contrast(1.15) saturate(1.2)',
              transform: 'perspective(800px) rotateY(-6deg)',
            }}
          />
          {/* Orange glow behind Agni */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '20%',
              right: '30%',
              width: '60%',
              height: '60%',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,120,30,0.2) 0%, transparent 70%)',
              filter: 'blur(40px)',
              pointerEvents: 'none',
            }}
          />
        </motion.div>
      </div>

      {/* ── Central Content ───────────────────────────────── */}
      <div
        style={{
          position: 'relative',
          zIndex: 3,
          textAlign: 'center',
          maxWidth: 900,
          padding: '0 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0,
        }}
      >
        {/* Main Title — VST GOD */}
        <motion.h1
          {...fadeInUp(0.1)}
          style={{
            fontSize: 'clamp(3.5rem, 10vw, 8rem)',
            fontWeight: 900,
            letterSpacing: '0.2em',
            textTransform: 'uppercase' as const,
            lineHeight: 0.95,
            margin: '0 0 12px',
            background: 'linear-gradient(180deg, #f0d668 0%, #c29623 40%, #a07818 70%, #e8c547 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: 'drop-shadow(0 0 30px rgba(194,150,35,0.4)) drop-shadow(0 0 80px rgba(194,150,35,0.15))',
          }}
        >
          VST GOD
        </motion.h1>

        {/* Subtitle — THE GOD REALM */}
        <motion.div
          {...fadeInUp(0.35)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 20,
          }}
        >
          <span
            style={{
              height: 1,
              width: 60,
              background: 'linear-gradient(90deg, transparent, #c29623)',
            }}
            aria-hidden="true"
          />
          <span
            style={{
              color: '#c29623',
              fontSize: 'clamp(0.7rem, 1.8vw, 1rem)',
              fontWeight: 700,
              letterSpacing: '0.4em',
              textTransform: 'uppercase' as const,
              textShadow: '0 0 20px rgba(194,150,35,0.4)',
            }}
          >
            THE GOD REALM
          </span>
          <span
            style={{
              height: 1,
              width: 60,
              background: 'linear-gradient(90deg, #c29623, transparent)',
            }}
            aria-hidden="true"
          />
        </motion.div>

        {/* Tagline */}
        <motion.p
          {...fadeInUp(0.6)}
          style={{
            color: 'rgba(255,255,255,0.55)',
            fontSize: 'clamp(0.8rem, 1.6vw, 1.05rem)',
            letterSpacing: '0.12em',
            fontWeight: 400,
            margin: '0 0 36px',
            lineHeight: 1.6,
          }}
        >
          Divine Electric Keys · 8 God Identities · Limitless Sound
        </motion.p>

        {/* ── Floating Plugin Preview ─────────────────────── */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 40, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1.1, delay: 0.9, ease: EASE_OUT_EXPO }}
          className="hero-plugin-preview"
          style={{
            position: 'relative',
            maxWidth: 520,
            width: '100%',
            marginBottom: 36,
            perspective: '1000px',
            pointerEvents: 'auto',
          }}
        >
          <div
            style={{
              background: 'rgba(255,255,255,0.03)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(194,150,35,0.15)',
              borderRadius: 16,
              padding: 6,
              transform: 'perspective(1000px) rotateX(4deg) rotateY(-2deg)',
              transition: 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.6s ease',
              boxShadow: `
                0 0 60px rgba(194,150,35,0.12),
                0 30px 60px -15px rgba(0,0,0,0.5)
              `,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
              e.currentTarget.style.boxShadow = '0 0 80px rgba(194,150,35,0.25), 0 30px 80px -15px rgba(0,0,0,0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'perspective(1000px) rotateX(4deg) rotateY(-2deg)';
              e.currentTarget.style.boxShadow = '0 0 60px rgba(194,150,35,0.12), 0 30px 60px -15px rgba(0,0,0,0.5)';
            }}
          >
            <img
              src="/images/plugin/mastering.png"
              alt="VST GOD AURA Mastering — Sun Disk"
              loading="eager"
              style={{
                width: '100%',
                display: 'block',
                borderRadius: 12,
              }}
            />
          </div>
          {/* Ambient glow behind card */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: -30,
              borderRadius: 30,
              background: 'radial-gradient(ellipse at center, rgba(194,150,35,0.08) 0%, transparent 70%)',
              pointerEvents: 'none',
              zIndex: -1,
            }}
          />
        </motion.div>

        {/* ── CTA Buttons ─────────────────────────────────── */}
        <motion.div
          {...fadeInUp(1.3)}
          style={{
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            justifyContent: 'center',
            pointerEvents: 'auto',
            marginBottom: 8,
          }}
        >
          <a
            href="#gods"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById('gods')?.scrollIntoView({ behavior: 'smooth' });
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '14px 32px',
              background: 'linear-gradient(135deg, #c29623 0%, #e8c547 50%, #c29623 100%)',
              color: '#000',
              fontSize: '0.8rem',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase' as const,
              textDecoration: 'none',
              borderRadius: 12,
              border: 'none',
              cursor: 'pointer',
              transition: 'transform 0.3s ease, box-shadow 0.3s ease',
              boxShadow: '0 0 30px rgba(194,150,35,0.3), 0 4px 20px rgba(0,0,0,0.3)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px) scale(1.03)';
              e.currentTarget.style.boxShadow = '0 0 50px rgba(194,150,35,0.45), 0 8px 30px rgba(0,0,0,0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 0 30px rgba(194,150,35,0.3), 0 4px 20px rgba(0,0,0,0.3)';
            }}
          >
            Enter The Realm
          </a>
          <a
            href="#download"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById('download')?.scrollIntoView({ behavior: 'smooth' });
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '14px 32px',
              background: 'transparent',
              color: '#c29623',
              fontSize: '0.8rem',
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase' as const,
              textDecoration: 'none',
              borderRadius: 12,
              border: '1px solid rgba(194,150,35,0.35)',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(194,150,35,0.08)';
              e.currentTarget.style.borderColor = 'rgba(194,150,35,0.6)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = 'rgba(194,150,35,0.35)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Download
          </a>
        </motion.div>
      </div>

      {/* ── Scroll Indicator ──────────────────────────────── */}
      <motion.div
        initial={prefersReducedMotion ? {} : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 2.2 }}
        style={{
          position: 'absolute',
          bottom: 'clamp(20px, 4vh, 40px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          pointerEvents: 'auto',
          cursor: 'pointer',
        }}
        onClick={() =>
          document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
        }
      >
        <span
          style={{
            fontSize: '0.6rem',
            fontWeight: 500,
            letterSpacing: '0.2em',
            textTransform: 'uppercase' as const,
            color: 'rgba(255,255,255,0.3)',
          }}
        >
          Scroll to Explore
        </span>
        <motion.div
          animate={prefersReducedMotion ? {} : { y: [0, 8, 0] }}
          transition={{
            duration: 1.8,
            repeat: Infinity,
            ease: 'easeInOut' as const,
          }}
        >
          <ChevronDown size={20} color="rgba(194,150,35,0.5)" />
        </motion.div>
      </motion.div>

      {/* ── Responsive CSS ────────────────────────────────── */}
      <style>{`
        @media (max-width: 768px) {
          .hero-god-zeus,
          .hero-god-agni {
            width: 35% !important;
            opacity: 0.5 !important;
          }
          .hero-plugin-preview {
            max-width: 360px !important;
          }
        }
        @media (max-width: 640px) {
          .hero-god-zeus,
          .hero-god-agni {
            display: none !important;
          }
          .hero-plugin-preview {
            max-width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
}
