import { motion, useInView, AnimatePresence } from 'framer-motion';
import { useRef, useState, type FormEvent } from 'react';
import { Mail, Check, Download, ExternalLink, Globe, Music2, Sparkles, AlertCircle } from 'lucide-react';
import { submitBetaSignup, APP_URL, type BetaSignupResult } from '../lib/supabase';

/* ── Design tokens ─────────────────────────────────────────────── */
const COLORS = {
  void: 'hsl(240, 30%, 4%)',
  obsidian: 'hsl(0, 0%, 4%)',
  solarFlare: 'hsl(25, 100%, 50%)',
  gold: 'hsl(40, 80%, 45%)',
  goldHex: '#c29623',
  goldLight: '#e8c547',
  ether: 'rgba(255,255,255,0.05)',
  textPrimary: '#ffffff',
  textMuted: 'rgba(255,255,255,0.5)',
  textDim: 'rgba(255,255,255,0.35)',
};

const GOLDEN_GRADIENT = `linear-gradient(135deg, ${COLORS.goldHex} 0%, ${COLORS.goldLight} 50%, ${COLORS.goldHex} 100%)`;

/* ── Form States ───────────────────────────────────────────────── */
type FormStatus = 'idle' | 'submitting' | 'success' | 'duplicate' | 'error';

/* ── Stat cards data ───────────────────────────────────────────── */
const stats = [
  { number: '8', label: 'God Identities' },
  { number: '4', label: 'Divine Controls' },
  { number: '32', label: 'Realm FX' },
];

/* ── Social links ──────────────────────────────────────────────── */
const socials = [
  { icon: ExternalLink, label: 'Twitter', href: '#twitter' },
  { icon: Globe, label: 'Instagram', href: '#instagram' },
  { icon: Music2, label: 'YouTube', href: '#youtube' },
];

/* ── Animated checkmark ────────────────────────────────────────── */
function AnimatedCheck() {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      style={{
        width: 48,
        height: 48,
        borderRadius: '50%',
        background: GOLDEN_GRADIENT,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 16px',
        boxShadow: `0 0 30px rgba(194, 150, 35, 0.4)`,
      }}
    >
      <Check size={24} color="#000" strokeWidth={3} />
    </motion.div>
  );
}

/* ── CTA Section ───────────────────────────────────────────────── */
export default function CTASection() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.15 });
  const [formStatus, setFormStatus] = useState<FormStatus>('idle');
  const [email, setEmail] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || formStatus === 'submitting') return;

    setFormStatus('submitting');

    const result: BetaSignupResult = await submitBetaSignup(email);

    if (result.success) {
      setStatusMessage(result.message);
      setFormStatus(result.alreadySignedUp ? 'duplicate' : 'success');
    } else {
      setStatusMessage(result.message);
      setFormStatus('error');
      // Reset to idle after 3 seconds on error
      setTimeout(() => setFormStatus('idle'), 3000);
    }
  };

  return (
    <section
      id="download"
      ref={sectionRef}
      style={{
        minHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '100px 24px 80px',
        background: COLORS.void,
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Ambient glow */}
      <div
        style={{
          position: 'absolute',
          top: '15%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(194,150,35,0.06) 0%, transparent 65%)`,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '10%',
          left: '50%',
          transform: 'translate(-50%, 50%)',
          width: 900,
          height: 400,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, rgba(255,102,0,0.03) 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      <div style={{ maxWidth: 700, width: '100%', position: 'relative', zIndex: 1, textAlign: 'center' }}>

        {/* ── Main Heading ────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <Sparkles
            size={28}
            color={COLORS.goldHex}
            style={{ marginBottom: 16, filter: `drop-shadow(0 0 10px ${COLORS.goldHex})` }}
          />
          <h2
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 'clamp(36px, 6vw, 64px)',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: COLORS.textPrimary,
              margin: '0 0 16px',
              lineHeight: 1.05,
              textShadow: `0 0 40px rgba(194,150,35,0.35), 0 0 80px rgba(194,150,35,0.15)`,
            }}
          >
            Enter The God Realm
          </h2>
          <p
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 'clamp(15px, 2vw, 18px)',
              color: 'rgba(255,255,255,0.6)',
              margin: '0 0 48px',
              lineHeight: 1.6,
            }}
          >
            Download the Electric Pantheon and transform your production.
          </p>
        </motion.div>

        {/* ── Email Signup Form ───────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{
            maxWidth: 500,
            width: '100%',
            margin: '0 auto 40px',
            background: 'rgba(255,255,255,0.03)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: `1px solid ${COLORS.ether}`,
            borderRadius: 16,
            padding: '32px 28px',
            boxSizing: 'border-box',
          }}
        >
          <AnimatePresence mode="wait">
            {(formStatus === 'success' || formStatus === 'duplicate') ? (
              <motion.div
                key="success"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
              >
                <AnimatedCheck />
                <p
                  style={{
                    fontFamily: "'Inter', system-ui, sans-serif",
                    fontSize: 16,
                    fontWeight: 600,
                    color: COLORS.goldLight,
                    margin: '0 0 6px',
                  }}
                >
                  {formStatus === 'duplicate' ? 'Already on the list!' : 'You\'re on the list!'}
                </p>
                <p
                  style={{
                    fontFamily: "'Inter', system-ui, sans-serif",
                    fontSize: 13,
                    color: COLORS.textMuted,
                    margin: 0,
                  }}
                >
                  {statusMessage}
                </p>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                onSubmit={handleSubmit}
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
              >
                <div style={{ position: 'relative' }}>
                  <Mail
                    size={16}
                    color={COLORS.textDim}
                    style={{
                      position: 'absolute',
                      left: 14,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      pointerEvents: 'none',
                    }}
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    disabled={formStatus === 'submitting'}
                    style={{
                      width: '100%',
                      padding: '14px 16px 14px 40px',
                      background: 'rgba(0,0,0,0.4)',
                      border: `1px solid rgba(255,255,255,0.08)`,
                      borderRadius: 10,
                      color: COLORS.textPrimary,
                      fontFamily: "'Inter', system-ui, sans-serif",
                      fontSize: 15,
                      outline: 'none',
                      transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = COLORS.goldHex;
                      e.currentTarget.style.boxShadow = `0 0 0 3px rgba(194,150,35,0.15)`;
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={formStatus === 'submitting'}
                  style={{
                    width: '100%',
                    padding: '14px 24px',
                    background: GOLDEN_GRADIENT,
                    border: 'none',
                    borderRadius: 10,
                    color: '#000',
                    fontFamily: "'Inter', system-ui, sans-serif",
                    fontSize: 15,
                    fontWeight: 700,
                    letterSpacing: '0.03em',
                    cursor: formStatus === 'submitting' ? 'wait' : 'pointer',
                    opacity: formStatus === 'submitting' ? 0.7 : 1,
                    transition: 'opacity 0.3s ease, box-shadow 0.3s ease, transform 0.2s ease',
                    boxShadow: `0 0 20px rgba(194,150,35,0.2)`,
                  }}
                  onMouseEnter={(e) => {
                    if (formStatus !== 'submitting') {
                      e.currentTarget.style.boxShadow = `0 0 40px rgba(194,150,35,0.4)`;
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = `0 0 20px rgba(194,150,35,0.2)`;
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  {formStatus === 'submitting' ? 'Submitting...' : formStatus === 'error' ? 'Try Again' : 'Request Beta Access'}
                </button>

                <p
                  style={{
                    fontFamily: "'Inter', system-ui, sans-serif",
                    fontSize: 11,
                    color: COLORS.textDim,
                    margin: '4px 0 0',
                    letterSpacing: '0.02em',
                  }}
                >
                  {formStatus === 'error'
                    ? <span style={{ color: '#d64b35' }}><AlertCircle size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />{statusMessage}</span>
                    : 'Invite-only beta. Request your spot now.'
                  }
                </p>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Download Button ─────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.4 }}
          style={{ marginBottom: 56 }}
        >
          <a
            href={APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '18px 40px',
              background: GOLDEN_GRADIENT,
              border: 'none',
              borderRadius: 14,
              color: '#000',
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: '0.02em',
              cursor: 'pointer',
              overflow: 'hidden',
              transition: 'box-shadow 0.4s ease, transform 0.25s ease',
              boxShadow: `0 4px 30px rgba(194,150,35,0.25)`,
              textDecoration: 'none',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = `0 8px 50px rgba(194,150,35,0.45), 0 0 80px rgba(194,150,35,0.2)`;
              e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = `0 4px 30px rgba(194,150,35,0.25)`;
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
            }}
          >
            {/* Particle burst pseudo-element via inner span */}
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                background: `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.3) 0%, transparent 70%)`,
                opacity: 0,
                transition: 'opacity 0.4s ease',
                pointerEvents: 'none',
              }}
              className="cta-burst"
            />
            <Download size={20} strokeWidth={2.5} />
            Download VST GOD
          </a>

          {/* CSS for particle hover effect */}
          <style>{`
            button:hover .cta-burst {
              opacity: 1 !important;
              animation: particlePulse 0.6s ease-out;
            }
            @keyframes particlePulse {
              0% { transform: scale(0.5); opacity: 0; }
              50% { opacity: 0.4; }
              100% { transform: scale(1.5); opacity: 0; }
            }
          `}</style>
        </motion.div>

        {/* ── Stats Row ───────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.55 }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
            maxWidth: 600,
            margin: '0 auto 64px',
          }}
        >
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={isInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.5, delay: 0.6 + i * 0.1 }}
              style={{
                background: 'rgba(255,255,255,0.03)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: `1px solid ${COLORS.ether}`,
                borderRadius: 12,
                padding: '24px 16px',
              }}
            >
              <div
                style={{
                  fontFamily: "'Inter', system-ui, sans-serif",
                  fontSize: 'clamp(28px, 4vw, 36px)',
                  fontWeight: 800,
                  background: GOLDEN_GRADIENT,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  lineHeight: 1,
                  marginBottom: 8,
                }}
              >
                {stat.number}
              </div>
              <div
                style={{
                  fontFamily: "'Inter', system-ui, sans-serif",
                  fontSize: 12,
                  fontWeight: 500,
                  color: COLORS.textMuted,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                {stat.label}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Social & Branding Footer ────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.7 }}
          style={{
            borderTop: `1px solid ${COLORS.ether}`,
            paddingTop: 32,
          }}
        >
          <p
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 13,
              color: COLORS.textDim,
              letterSpacing: '0.08em',
              marginBottom: 20,
            }}
          >
            Built by{' '}
            <span style={{ color: COLORS.textMuted, fontWeight: 600 }}>MixxTech</span>
          </p>

          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 16,
              marginBottom: 20,
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
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${COLORS.ether}`,
                  color: COLORS.textMuted,
                  transition: 'background 0.3s ease, color 0.3s ease, border-color 0.3s ease',
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(194,150,35,0.12)';
                  e.currentTarget.style.color = COLORS.goldLight;
                  e.currentTarget.style.borderColor = 'rgba(194,150,35,0.25)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                  e.currentTarget.style.color = COLORS.textMuted;
                  e.currentTarget.style.borderColor = COLORS.ether;
                }}
              >
                <social.icon size={18} />
              </a>
            ))}
          </div>

          <p
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 11,
              color: 'rgba(255,255,255,0.2)',
              letterSpacing: '0.04em',
              margin: 0,
            }}
          >
            © 2025 MixxTech. All rights reserved.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
