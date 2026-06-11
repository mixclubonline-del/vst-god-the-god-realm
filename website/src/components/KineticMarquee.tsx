/**
 * KineticMarquee.tsx — Infinite scrolling god name ticker
 *
 * Creates a cinematic horizontal marquee that scrolls infinitely.
 * Uses pure CSS animation for 60fps performance.
 */

interface KineticMarqueeProps {
  /** Items to scroll */
  items?: string[];
  /** Scroll speed in seconds for one full cycle */
  speed?: number;
  /** Separator character between items */
  separator?: string;
  /** Direction: 'left' | 'right' */
  direction?: 'left' | 'right';
  /** God color accent override */
  accentColor?: string;
}

const DEFAULT_ITEMS = [
  'OLYMPUS',
  'HADES',
  'ZEUS',
  'ATHENA',
  'POSEIDON',
  'TITAN',
  'APOLLO',
  'CHRONOS',
  'DIVINE KEYS',
  'GOD REALM',
  'ELECTRIC PANTHEON',
  'LIMITLESS SOUND',
];

export default function KineticMarquee({
  items = DEFAULT_ITEMS,
  speed = 30,
  separator = '✦',
  direction = 'left',
  accentColor = '#c29623',
}: KineticMarqueeProps) {
  // Duplicate content for seamless loop
  const content = [...items, ...items, ...items];

  return (
    <div
      style={{
        width: '100%',
        overflow: 'hidden',
        padding: '20px 0',
        position: 'relative',
        background: 'linear-gradient(180deg, rgba(194,150,35,0.03) 0%, transparent 30%, transparent 70%, rgba(194,150,35,0.03) 100%)',
        borderTop: '1px solid rgba(194,150,35,0.06)',
        borderBottom: '1px solid rgba(194,150,35,0.06)',
      }}
    >
      {/* Edge fades */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 120,
          height: '100%',
          background: 'linear-gradient(90deg, hsl(240, 30%, 4%) 0%, transparent 100%)',
          zIndex: 2,
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 120,
          height: '100%',
          background: 'linear-gradient(270deg, hsl(240, 30%, 4%) 0%, transparent 100%)',
          zIndex: 2,
          pointerEvents: 'none',
        }}
      />

      {/* Scrolling track */}
      <div
        className={direction === 'left' ? 'marquee-track-left' : 'marquee-track-right'}
        style={{
          display: 'flex',
          gap: 0,
          whiteSpace: 'nowrap',
          width: 'max-content',
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        {content.map((item, i) => (
          <span
            key={`${item}-${i}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 24,
              paddingRight: 24,
            }}
          >
            <span
              style={{
                fontSize: 'clamp(0.65rem, 1.2vw, 0.8rem)',
                fontWeight: 700,
                letterSpacing: '0.2em',
                color: 'rgba(255,255,255,0.15)',
                textTransform: 'uppercase' as const,
                transition: 'color 0.3s',
              }}
            >
              {item}
            </span>
            <span
              style={{
                fontSize: '0.5rem',
                color: `color-mix(in srgb, ${accentColor} 30%, transparent)`,
              }}
              aria-hidden="true"
            >
              {separator}
            </span>
          </span>
        ))}
      </div>

      <style>{`
        .marquee-track-left {
          animation: marqueeLeft ${speed}s linear infinite;
        }
        .marquee-track-right {
          animation: marqueeRight ${speed}s linear infinite;
        }
        @keyframes marqueeLeft {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
        @keyframes marqueeRight {
          0% { transform: translateX(-33.333%); }
          100% { transform: translateX(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .marquee-track-left,
          .marquee-track-right {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
