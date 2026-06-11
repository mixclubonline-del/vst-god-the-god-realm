import { motion, useInView } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';

/* ── Design tokens ─────────────────────────────────────────────── */
const COLORS = {
  void: 'hsl(240, 30%, 4%)',
  obsidian: 'hsl(0, 0%, 4%)',
  solarFlare: 'hsl(25, 100%, 50%)',
  gold: 'hsl(40, 80%, 45%)',
  ether: 'rgba(255,255,255,0.05)',
  textPrimary: '#ffffff',
  textMuted: 'rgba(255,255,255,0.5)',
  textDim: 'rgba(255,255,255,0.35)',
};

/* ── Control data ──────────────────────────────────────────────── */
interface RangeRow {
  range: string;
  feel: string;
}

interface ControlData {
  name: string;
  description: string;
  defaultValue: number;
  ranges: RangeRow[];
}

const controls: ControlData[] = [
  {
    name: 'ENERGY',
    description: 'Performance intensity. How hard the god is moving.',
    defaultValue: 0.65,
    ranges: [
      { range: '0–25', feel: 'Soft' },
      { range: '26–50', feel: 'Balanced' },
      { range: '51–75', feel: 'Forward' },
      { range: '76–100', feel: 'Aggressive' },
    ],
  },
  {
    name: 'DIVINITY',
    description: 'The supernatural harmonic layer. How godlike it feels.',
    defaultValue: 0.72,
    ranges: [
      { range: '0–25', feel: 'Earthly' },
      { range: '26–50', feel: 'Polished' },
      { range: '51–75', feel: 'Glowing' },
      { range: '76–100', feel: 'Celestial' },
    ],
  },
  {
    name: 'WIDTH',
    description: 'Stereo dimension. How wide the realm feels.',
    defaultValue: 0.58,
    ranges: [
      { range: '0–25', feel: 'Focused' },
      { range: '26–50', feel: 'Natural' },
      { range: '51–75', feel: 'Wide' },
      { range: '76–100', feel: 'Cinematic' },
    ],
  },
  {
    name: 'REALM',
    description: 'Identity morph. How deeply the god takes over.',
    defaultValue: 0.80,
    ranges: [
      { range: '0–25', feel: 'Clean Foundation' },
      { range: '26–50', feel: 'God Active' },
      { range: '51–75', feel: 'Full Personality' },
      { range: '76–100', feel: 'Mythic Transformation' },
    ],
  },
];

/* ── SVG Knob ──────────────────────────────────────────────────── */
const KNOB_SIZE = 120;
const KNOB_CENTER = KNOB_SIZE / 2;
const KNOB_RADIUS = 48;
const KNOB_STROKE = 5;

/** Arc spans 240° starting from 150° (7:30 position) */
const ARC_START_DEG = 150;
const ARC_SPAN_DEG = 240;
const CIRCUMFERENCE = 2 * Math.PI * KNOB_RADIUS;
const ARC_LENGTH = (ARC_SPAN_DEG / 360) * CIRCUMFERENCE;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

interface KnobSVGProps {
  value: number;          // 0..1
  animate: boolean;
}

function KnobSVG({ value, animate }: KnobSVGProps) {
  const [animatedValue, setAnimatedValue] = useState(0);

  useEffect(() => {
    if (!animate) return;
    let start: number | null = null;
    const duration = 1200;
    const target = value;

    function step(timestamp: number) {
      if (start === null) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedValue(eased * target);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, [animate, value]);

  const fillLength = animatedValue * ARC_LENGTH;
  const gapLength = ARC_LENGTH - fillLength;

  // Tick mark position
  const tickAngle = ARC_START_DEG + animatedValue * ARC_SPAN_DEG;
  const tickInner = polarToCartesian(KNOB_CENTER, KNOB_CENTER, KNOB_RADIUS - 10, tickAngle);
  const tickOuter = polarToCartesian(KNOB_CENTER, KNOB_CENTER, KNOB_RADIUS - 2, tickAngle);

  const arcPath = describeArc(KNOB_CENTER, KNOB_CENTER, KNOB_RADIUS, ARC_START_DEG, ARC_START_DEG + ARC_SPAN_DEG);

  return (
    <svg width={KNOB_SIZE} height={KNOB_SIZE} viewBox={`0 0 ${KNOB_SIZE} ${KNOB_SIZE}`} style={{ display: 'block', margin: '0 auto' }}>
      <defs>
        <radialGradient id="knobGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={COLORS.gold} stopOpacity="0.15" />
          <stop offset="70%" stopColor={COLORS.gold} stopOpacity="0.05" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="knobFace" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor="hsl(0,0%,12%)" />
          <stop offset="100%" stopColor="hsl(0,0%,5%)" />
        </radialGradient>
      </defs>

      {/* Glow */}
      <circle cx={KNOB_CENTER} cy={KNOB_CENTER} r={KNOB_RADIUS + 4} fill="url(#knobGlow)" />

      {/* Inner face */}
      <circle cx={KNOB_CENTER} cy={KNOB_CENTER} r={KNOB_RADIUS - 8} fill="url(#knobFace)" />
      <circle cx={KNOB_CENTER} cy={KNOB_CENTER} r={KNOB_RADIUS - 8} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

      {/* Track (background arc) */}
      <path
        d={arcPath}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={KNOB_STROKE}
        strokeLinecap="round"
      />

      {/* Filled arc */}
      <path
        d={arcPath}
        fill="none"
        stroke={COLORS.gold}
        strokeWidth={KNOB_STROKE}
        strokeLinecap="round"
        strokeDasharray={`${fillLength} ${gapLength}`}
        style={{
          filter: `drop-shadow(0 0 6px ${COLORS.gold})`,
        }}
      />

      {/* Tick mark */}
      <line
        x1={tickInner.x}
        y1={tickInner.y}
        x2={tickOuter.x}
        y2={tickOuter.y}
        stroke={COLORS.gold}
        strokeWidth="2.5"
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 3px ${COLORS.gold})` }}
      />

      {/* Center dot */}
      <circle cx={KNOB_CENTER} cy={KNOB_CENTER} r="3" fill={COLORS.gold} opacity="0.6" />
    </svg>
  );
}

/* ── Knob Card ─────────────────────────────────────────────────── */
interface KnobCardProps {
  control: ControlData;
  index: number;
}

function KnobCard({ control, index }: KnobCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{
        duration: 0.7,
        delay: index * 0.15,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      style={{
        width: 280,
        maxWidth: '100%',
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid ${COLORS.ether}`,
        borderRadius: 16,
        padding: '32px 24px 28px',
        cursor: 'default',
        transition: 'transform 0.35s cubic-bezier(0.25,0.46,0.45,0.94), box-shadow 0.35s ease',
        boxSizing: 'border-box',
      }}
      whileHover={{
        y: -8,
        boxShadow: `0 20px 60px rgba(194, 150, 35, 0.12), 0 0 40px rgba(194, 150, 35, 0.06)`,
      }}
    >
      {/* SVG Knob */}
      <KnobSVG value={control.defaultValue} animate={isInView} />

      {/* Name */}
      <h3
        style={{
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: '0.12em',
          color: COLORS.gold,
          textAlign: 'center',
          margin: '20px 0 8px',
          textTransform: 'uppercase',
        }}
      >
        {control.name}
      </h3>

      {/* Description */}
      <p
        style={{
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: 13,
          lineHeight: 1.55,
          color: COLORS.textMuted,
          textAlign: 'center',
          margin: '0 0 20px',
          minHeight: 40,
        }}
      >
        {control.description}
      </p>

      {/* Range Behavior Table */}
      <div
        style={{
          borderTop: `1px solid ${COLORS.ether}`,
          paddingTop: 14,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '56px 1fr',
            gap: '6px 12px',
            fontSize: 11,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          }}
        >
          {/* Header */}
          <span style={{ color: COLORS.textDim, fontWeight: 600, letterSpacing: '0.05em' }}>
            RANGE
          </span>
          <span style={{ color: COLORS.textDim, fontWeight: 600, letterSpacing: '0.05em' }}>
            FEEL
          </span>

          {control.ranges.map((row, i) => (
            <div key={i} style={{ display: 'contents' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>{row.range}</span>
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>{row.feel}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ── FeatureShowcase Section ───────────────────────────────────── */
export default function FeatureShowcase() {
  const sectionRef = useRef<HTMLElement>(null);
  const headingInView = useInView(sectionRef, { once: true, amount: 0.15 });

  return (
    <section
      id="features"
      ref={sectionRef}
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '100px 24px',
        background: COLORS.void,
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle radial ambience */}
      <div
        style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 800,
          height: 800,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(194,150,35,0.04) 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      <div style={{ maxWidth: 1200, width: '100%', position: 'relative', zIndex: 1 }}>
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={headingInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{ textAlign: 'center', marginBottom: 64 }}
        >
          <h2
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 'clamp(32px, 5vw, 56px)',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: COLORS.textPrimary,
              margin: '0 0 16px',
              lineHeight: 1.1,
            }}
          >
            THE DIVINE CONTROLS
          </h2>
          <p
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 'clamp(14px, 2vw, 18px)',
              color: COLORS.textMuted,
              margin: 0,
              letterSpacing: '0.02em',
            }}
          >
            Four locked face macros. One shared performance language.
          </p>
        </motion.div>

        {/* Cards Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 24,
            justifyItems: 'center',
            maxWidth: 1200,
            margin: '0 auto',
          }}
        >
          {controls.map((control, i) => (
            <KnobCard key={control.name} control={control} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
