/**
 * PluginShowcase.tsx — Cinematic plugin module gallery
 *
 * Showcases all 9 VST GOD plugin modules with interactive
 * glass cards, 3D tilt hover effects, and scroll-triggered
 * staggered entrance animations.
 */

import { useCallback, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';

/* ── Ease Tuple ─────────────────────────────────────────────── */
type Ease4 = [number, number, number, number];
const EASE_OUT_EXPO: Ease4 = [0.22, 1, 0.36, 1];

/* ── Plugin Data ────────────────────────────────────────────── */
const plugins = [
  {
    name: 'Olympus Keys',
    image: '/images/plugin/olympus-keys.png',
    desc: 'Divine keys & harps from Mount Olympus',
    color: '#c29623',
  },
  {
    name: 'Celestial Pad',
    image: '/images/plugin/celestial-pad.png',
    desc: 'Aurora-washed atmospheric pads',
    color: '#29d7e8',
  },
  {
    name: 'Divine Texture',
    image: '/images/plugin/divine-texture.png',
    desc: 'Organic evolving textures from sacred forests',
    color: '#4ade80',
  },
  {
    name: 'Underworld Bass',
    image: '/images/plugin/underworld-bass.png',
    desc: 'Volcanic sub-bass from the depths',
    color: '#ff4500',
  },
  {
    name: 'Mythic Lead',
    image: '/images/plugin/mythic-lead.png',
    desc: 'Lightning-forged leads with divine power',
    color: '#f8c85a',
  },
  {
    name: 'Ethereal Pluck',
    image: '/images/plugin/ethereal-pluck.png',
    desc: 'Crystal plucks from the astral plane',
    color: '#9d65ff',
  },
  {
    name: 'Sample Chopper',
    image: '/images/plugin/sample-chopper.png',
    desc: 'Slice, dice & reshape any audio',
    color: '#c29623',
  },
  {
    name: 'AURA Mastering',
    image: '/images/plugin/mastering.png',
    desc: 'Sun Disk mastering with Aether Saturation',
    color: '#ff8c00',
  },
  {
    name: 'Preset Vault',
    image: '/images/plugin/vst-vault.png',
    desc: 'Export, share & cloud sync your presets',
    color: '#ff6600',
  },
];

/* ── Tilt Card Sub-component ────────────────────────────────── */
function PluginCard({
  plugin,
  index,
}: {
  plugin: (typeof plugins)[number];
  index: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 });
  const [isHovering, setIsHovering] = useState(false);

  const isTouchDevice =
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isTouchDevice || !cardRef.current) return;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const rect = cardRef.current!.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const px = (e.clientX - cx) / (rect.width / 2);
        const py = (e.clientY - cy) / (rect.height / 2);
        setTilt({ rotateX: -py * 8, rotateY: px * 8 });
      });
    },
    [isTouchDevice],
  );

  const handleMouseLeave = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setTilt({ rotateX: 0, rotateY: 0 });
    setIsHovering(false);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{
        duration: 0.7,
        delay: (index % 3) * 0.12,
        ease: EASE_OUT_EXPO,
      }}
      style={{ perspective: '800px' }}
    >
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={handleMouseLeave}
        style={{
          background: 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: `1px solid ${
            isHovering
              ? `color-mix(in srgb, ${plugin.color} 40%, transparent)`
              : 'rgba(255,255,255,0.06)'
          }`,
          borderRadius: 16,
          padding: 10,
          cursor: 'default',
          transform: `rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg) translateY(${isHovering ? -8 : 0}px)`,
          transition: isTouchDevice
            ? 'none'
            : 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.4s ease, box-shadow 0.4s ease',
          willChange: 'transform',
          boxShadow: isHovering
            ? `0 0 40px ${plugin.color}22, 0 20px 60px -15px rgba(0,0,0,0.5)`
            : '0 8px 40px -10px rgba(0,0,0,0.4)',
        }}
      >
        {/* Plugin Image */}
        <div
          style={{
            borderRadius: 12,
            overflow: 'hidden',
            marginBottom: 14,
          }}
        >
          <img
            src={plugin.image}
            alt={`${plugin.name} — VST GOD plugin interface`}
            loading="lazy"
            style={{
              width: '100%',
              aspectRatio: '1 / 1',
              objectFit: 'cover',
              display: 'block',
              transition: 'filter 0.4s ease, transform 0.6s ease',
              filter: isHovering ? 'brightness(1.1) contrast(1.05)' : 'brightness(0.85)',
              transform: isHovering ? 'scale(1.03)' : 'scale(1)',
            }}
          />
        </div>

        {/* Plugin Name */}
        <h3
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: 'clamp(0.9rem, 1.5vw, 1.1rem)',
            fontWeight: 700,
            color: plugin.color,
            margin: '0 6px 4px',
            letterSpacing: '0.02em',
            lineHeight: 1.3,
          }}
        >
          {plugin.name}
        </h3>

        {/* Description */}
        <p
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: '0.78rem',
            color: 'rgba(255,255,255,0.45)',
            margin: '0 6px 8px',
            lineHeight: 1.5,
            letterSpacing: '0.01em',
          }}
        >
          {plugin.desc}
        </p>
      </div>
    </motion.div>
  );
}

/* ── Main Component ─────────────────────────────────────────── */
export default function PluginShowcase() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.1 });

  return (
    <section
      id="sounds"
      ref={sectionRef}
      style={{
        position: 'relative',
        minHeight: '100vh',
        padding: '120px clamp(20px, 5vw, 80px)',
        background: 'hsl(240, 30%, 4%)',
        overflow: 'hidden',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Ambient glow */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '10%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 800,
          height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(194,150,35,0.04) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />

      {/* Section Header */}
      <div style={{ maxWidth: 1200, margin: '0 auto', textAlign: 'center', marginBottom: 64 }}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: EASE_OUT_EXPO }}
        >
          {/* Decorative line */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              marginBottom: 20,
            }}
          >
            <span
              style={{ height: 1, width: 50, background: 'linear-gradient(90deg, transparent, rgba(194,150,35,0.4))' }}
              aria-hidden="true"
            />
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.65rem',
                letterSpacing: '0.2em',
                textTransform: 'uppercase' as const,
                color: 'rgba(194,150,35,0.6)',
              }}
            >
              The Arsenal
            </span>
            <span
              style={{ height: 1, width: 50, background: 'linear-gradient(90deg, rgba(194,150,35,0.4), transparent)' }}
              aria-hidden="true"
            />
          </div>

          <h2
            style={{
              fontSize: 'clamp(1.8rem, 4.5vw, 3.2rem)',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: '#ffffff',
              margin: '0 0 16px',
              lineHeight: 1.1,
            }}
          >
            The Instruments of the Gods
          </h2>
          <p
            style={{
              fontSize: 'clamp(0.9rem, 1.6vw, 1.1rem)',
              color: 'rgba(255,255,255,0.5)',
              margin: 0,
              lineHeight: 1.6,
              maxWidth: 600,
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            Every realm has its own instrument. Every instrument has its own soul.
          </p>
        </motion.div>
      </div>

      {/* Plugin Grid */}
      <div
        className="plugin-grid"
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 24,
        }}
      >
        {plugins.map((plugin, i) => (
          <PluginCard key={plugin.name} plugin={plugin} index={i} />
        ))}
      </div>

      {/* Responsive grid */}
      <style>{`
        @media (max-width: 1024px) {
          .plugin-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 640px) {
          .plugin-grid {
            grid-template-columns: 1fr !important;
            max-width: 480px !important;
          }
        }
      `}</style>
    </section>
  );
}
