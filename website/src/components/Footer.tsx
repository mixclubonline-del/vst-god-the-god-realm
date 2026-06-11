import { ExternalLink, Globe, Music2 } from 'lucide-react';

/* ── Design tokens ─────────────────────────────────────────────── */
const COLORS = {
  footerBg: 'hsl(240, 20%, 6%)',
  gold: '#c29623',
  goldLight: '#e8c547',
  ether: 'rgba(255,255,255,0.05)',
  textMuted: 'rgba(255,255,255,0.5)',
  textDim: 'rgba(255,255,255,0.3)',
  textPrimary: '#ffffff',
};

/* ── Social links ──────────────────────────────────────────────── */
const socials = [
  { icon: ExternalLink, label: 'Twitter', href: '#twitter' },
  { icon: Globe, label: 'Instagram', href: '#instagram' },
  { icon: Music2, label: 'YouTube', href: '#youtube' },
];

/* ── Footer Component ──────────────────────────────────────────── */
export default function Footer() {
  return (
    <footer
      style={{
        background: COLORS.footerBg,
        borderTop: `1px solid ${COLORS.gold}`,
        padding: '0 24px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          height: 80,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        {/* Left — Wordmark + Copyright */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: '0.08em',
              color: COLORS.textPrimary,
            }}
          >
            VST GOD
          </span>
          <span
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 11,
              color: COLORS.textDim,
              letterSpacing: '0.03em',
            }}
          >
            © 2025 MixxTech
          </span>
        </div>

        {/* Center — Link */}
        <a
          href="https://vstgod.com"
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: 12,
            color: COLORS.textMuted,
            textDecoration: 'none',
            letterSpacing: '0.04em',
            transition: 'color 0.3s ease',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = COLORS.goldLight;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = COLORS.textMuted;
          }}
        >
          vstgod.com
        </a>

        {/* Right — Social Icons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
          }}
        >
          {socials.map((social) => (
            <a
              key={social.label}
              href={social.href}
              aria-label={social.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: 8,
                color: COLORS.textDim,
                transition: 'color 0.3s ease, background 0.3s ease',
                textDecoration: 'none',
                background: 'transparent',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = COLORS.goldLight;
                e.currentTarget.style.background = 'rgba(194,150,35,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = COLORS.textDim;
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <social.icon size={16} />
            </a>
          ))}
        </div>
      </div>

      {/* Mobile responsive styles */}
      <style>{`
        @media (max-width: 600px) {
          footer > div {
            height: auto !important;
            padding: 20px 0 !important;
            flex-direction: column !important;
            gap: 12px !important;
            text-align: center;
          }
        }
      `}</style>
    </footer>
  );
}
