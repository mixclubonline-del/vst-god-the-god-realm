/**
 * StatsCounter.tsx — Animated counting stats section
 *
 * Displays key product stats with counting animation that
 * triggers when the section scrolls into view.
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { motion, useInView } from 'framer-motion';

type Ease4 = [number, number, number, number];
const EASE_OUT_EXPO: Ease4 = [0.22, 1, 0.36, 1];

interface StatItem {
  value: number;
  suffix: string;
  label: string;
  color: string;
}

const STATS: StatItem[] = [
  { value: 8,    suffix: '',  label: 'God Identities',   color: '#c29623' },
  { value: 5600, suffix: '+', label: 'Core Presets',     color: '#f0d668' },
  { value: 4,    suffix: '',  label: 'Macro Controls',   color: '#ff9f2f' },
  { value: 32,   suffix: '+', label: 'Realm FX',         color: '#4ecbff' },
  { value: 9,    suffix: '',  label: 'Instruments',      color: '#9d65ff' },
  { value: 20,   suffix: '+', label: 'Sound Categories', color: '#7cff9d' },
];

function AnimatedNumber({ value, suffix, isInView }: { value: number; suffix: string; isInView: boolean }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!isInView) return;

    let frame: number;
    const duration = 1800;
    const start = performance.now();

    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));

      if (progress < 1) {
        frame = requestAnimationFrame(step);
      }
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [isInView, value]);

  return (
    <span>{display}{suffix}</span>
  );
}

export default function StatsCounter() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.4 });

  return (
    <section
      ref={ref}
      style={{
        padding: '80px clamp(20px, 5vw, 80px)',
        background: 'hsl(240, 30%, 4%)',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Ambient glow */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 600,
          height: 300,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(194,150,35,0.03) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />

      <div
        className="stats-grid"
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: 'clamp(12px, 3vw, 32px)',
          textAlign: 'center',
        }}
      >
        {STATS.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: i * 0.08, ease: EASE_OUT_EXPO }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 'clamp(1.5rem, 3.5vw, 2.5rem)',
                fontWeight: 800,
                color: stat.color,
                lineHeight: 1,
                filter: `drop-shadow(0 0 12px ${stat.color}33)`,
              }}
            >
              <AnimatedNumber value={stat.value} suffix={stat.suffix} isInView={isInView} />
            </span>
            <span
              style={{
                fontSize: 'clamp(0.5rem, 1vw, 0.65rem)',
                fontWeight: 500,
                letterSpacing: '0.08em',
                textTransform: 'uppercase' as const,
                color: 'rgba(255,255,255,0.35)',
                lineHeight: 1.3,
              }}
            >
              {stat.label}
            </span>
          </motion.div>
        ))}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .stats-grid {
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 24px 16px !important;
          }
        }
        @media (max-width: 480px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>
    </section>
  );
}
