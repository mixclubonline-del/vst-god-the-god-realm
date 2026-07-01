import { useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Sparkles, ShieldCheck, Layers, Zap, Gift, HelpCircle, CheckCircle2 } from 'lucide-react';
import PreOrderModal from './PreOrderModal';

const COLORS = {
  void: 'hsl(240, 30%, 4%)',
  obsidian: 'hsl(0, 0%, 4%)',
  goldHex: '#c29623',
  goldLight: '#e8c547',
  goldDark: '#8c6613',
  ether: 'rgba(255,255,255,0.05)',
  textPrimary: '#ffffff',
  textMuted: 'rgba(255,255,255,0.6)',
  textDim: 'rgba(255,255,255,0.35)',
};

const GOLDEN_GRADIENT = `linear-gradient(135deg, ${COLORS.goldHex} 0%, ${COLORS.goldLight} 50%, ${COLORS.goldHex} 100%)`;

export default function PreOrderSection() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPrice, setSelectedPrice] = useState(199);
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.15 });

  const preOrderFeatures = [
    {
      icon: ShieldCheck,
      title: 'Lifetime Plugin License',
      desc: 'Permanent authorization key for your machines (macOS and Windows formats).',
    },
    {
      icon: Zap,
      title: 'Early Adopter Beta Access',
      desc: 'Gain instant access to current beta builds and participate in shaping development.',
    },
    {
      icon: Gift,
      title: 'Exclusive "Divine Presets"',
      desc: 'Receive alchemical preset kits designed by industry-leading sound designers.',
    },
    {
      icon: Layers,
      title: 'Continuous Updates',
      desc: 'Free performance optimization patches, expansions, and platform support updates.',
    },
  ];

  const handlePreOrderClick = (price: number) => {
    setSelectedPrice(price);
    setIsModalOpen(true);
  };

  return (
    <section
      id="pre-order"
      ref={sectionRef}
      style={{
        padding: '120px 24px',
        background: COLORS.obsidian,
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Background Glows */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '20%',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(194, 150, 35, 0.04) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '10%',
          right: '10%',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255, 102, 0, 0.02) 0%, transparent 75%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ maxWidth: 1100, width: '100%', position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px',
                borderRadius: 20,
                background: 'rgba(194, 150, 35, 0.1)',
                border: `1px solid ${COLORS.goldHex}33`,
                marginBottom: 16,
              }}
            >
              <Sparkles size={14} color={COLORS.goldLight} />
              <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.goldLight, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif" }}>
                Limited Early Ascension Offer
              </span>
            </div>
            
            <h2
              style={{
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: 'clamp(32px, 5vw, 54px)',
                fontWeight: 900,
                letterSpacing: '-0.02em',
                color: '#fff',
                margin: '0 0 16px',
                lineHeight: 1.1,
              }}
            >
              Secure Your License Key
            </h2>
            
            <p
              style={{
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: 'clamp(15px, 2vw, 18px)',
                color: COLORS.textMuted,
                maxWidth: 600,
                margin: '0 auto',
                lineHeight: 1.6,
              }}
            >
              Gain permanent access to the VST GOD synthesizer engine. Claim early-bird pricing and shape the future of alchemical sound design.
            </p>
          </motion.div>
        </div>

        {/* Pricing Cards Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 32,
            alignItems: 'stretch',
            marginBottom: 64,
          }}
        >
          {/* Card 1: Gold Edition */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.2 }}
            style={{
              background: 'linear-gradient(180deg, rgba(13,13,16,0.85) 0%, rgba(20,20,27,0.85) 100%)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: `1px solid rgba(255, 255, 255, 0.08)`,
              borderRadius: 24,
              padding: '48px 40px',
              textAlign: 'center',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>
                GOLD EDITION
              </h3>
              <span style={{ fontSize: 12, color: COLORS.textMuted, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Standard Pre-Order
              </span>

              {/* Price section */}
              <div style={{ margin: '32px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 24, color: COLORS.textDim, textDecoration: 'line-through', fontWeight: 500 }}>
                    $299.00
                  </span>
                  <span style={{ fontSize: 64, fontWeight: 900, color: '#fff', fontFamily: "'Inter', sans-serif" }}>
                    $199
                  </span>
                  <span style={{ fontSize: 16, color: COLORS.textMuted, fontWeight: 600 }}>
                    USD
                  </span>
                </div>
                <p style={{ fontSize: 12, color: COLORS.textDim, marginTop: 8, letterSpacing: '0.02em' }}>
                  One-time payment. Lifetime engine license.
                </p>
              </div>

              {/* Features bullets */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left', marginBottom: 40, borderTop: `1px solid ${COLORS.ether}`, paddingTop: 24 }}>
                <div style={{ fontSize: 13, color: COLORS.textMuted, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <CheckCircle2 size={16} color={COLORS.goldLight} style={{ flexShrink: 0 }} />
                  <span>2-Machine Lifetime License Keys</span>
                </div>
                <div style={{ fontSize: 13, color: COLORS.textMuted, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <CheckCircle2 size={16} color={COLORS.goldLight} style={{ flexShrink: 0 }} />
                  <span>Unlocked DSP Engine (Unlimited voices)</span>
                </div>
                <div style={{ fontSize: 13, color: COLORS.textMuted, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <CheckCircle2 size={16} color={COLORS.goldLight} style={{ flexShrink: 0 }} />
                  <span>50 Exclusive Divine Presets</span>
                </div>
                <div style={{ fontSize: 13, color: COLORS.textMuted, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <CheckCircle2 size={16} color={COLORS.goldLight} style={{ flexShrink: 0 }} />
                  <span>All Future v1.x Updates Included</span>
                </div>
                <div style={{ fontSize: 13, color: COLORS.textMuted, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <CheckCircle2 size={16} color={COLORS.goldLight} style={{ flexShrink: 0 }} />
                  <span>Standard Support Queue</span>
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <button
              onClick={() => handlePreOrderClick(199)}
              style={{
                width: '100%',
                padding: '18px 24px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 14,
                color: '#fff',
                fontFamily: "'Inter', sans-serif",
                fontSize: 15,
                fontWeight: 800,
                letterSpacing: '0.05em',
                cursor: 'pointer',
                transition: 'all 0.25s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              }}
            >
              UNLOCK GOLD ACCESS
            </button>
          </motion.div>

          {/* Card 2: Deity Edition */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.3 }}
            style={{
              background: 'linear-gradient(135deg, rgba(13,13,16,0.95) 0%, rgba(25,25,32,0.95) 100%)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: `1px solid ${COLORS.goldHex}`,
              borderRadius: 24,
              padding: '48px 40px',
              textAlign: 'center',
              boxShadow: '0 25px 50px rgba(194, 150, 35, 0.08), inset 0 0 30px rgba(194,150,35,0.03)',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            {/* Glowing Accent Border */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                width: '80%',
                height: 1,
                background: `linear-gradient(90deg, transparent, ${COLORS.goldLight}, transparent)`,
              }}
            />

            {/* Most Popular/Ultimate Tag */}
            <div
              style={{
                position: 'absolute',
                top: -14,
                left: '50%',
                transform: 'translateX(-50%)',
                background: GOLDEN_GRADIENT,
                padding: '4px 14px',
                borderRadius: 20,
                fontSize: 10,
                fontWeight: 900,
                color: '#000',
                letterSpacing: '0.08em',
                boxShadow: '0 4px 12px rgba(194, 150, 35, 0.3)',
              }}
            >
              ULTIMATE DEITY TIER
            </div>

            <div>
              <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>
                DEITY CREATOR
              </h3>
              <span style={{ fontSize: 12, color: COLORS.goldLight, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Premium Pre-Order
              </span>

              {/* Price section */}
              <div style={{ margin: '32px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 24, color: COLORS.textDim, textDecoration: 'line-through', fontWeight: 500 }}>
                    $599.00
                  </span>
                  <span style={{ fontSize: 64, fontWeight: 900, color: '#fff', fontFamily: "'Inter', sans-serif", textShadow: '0 0 20px rgba(194,150,35,0.15)' }}>
                    $399
                  </span>
                  <span style={{ fontSize: 16, color: COLORS.textMuted, fontWeight: 600 }}>
                    USD
                  </span>
                </div>
                <p style={{ fontSize: 12, color: COLORS.goldLight, marginTop: 8, letterSpacing: '0.02em', fontWeight: 600 }}>
                  One-time payment. Maximum power & upgrades.
                </p>
              </div>

              {/* Features bullets */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left', marginBottom: 40, borderTop: `1px solid ${COLORS.goldHex}33`, paddingTop: 24 }}>
                <div style={{ fontSize: 13, color: '#fff', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <CheckCircle2 size={16} color={COLORS.goldLight} style={{ flexShrink: 0 }} />
                  <span>Up to 5-Machine Lifetime License Keys</span>
                </div>
                <div style={{ fontSize: 13, color: '#fff', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <CheckCircle2 size={16} color={COLORS.goldLight} style={{ flexShrink: 0 }} />
                  <span style={{ fontWeight: 600 }}>DSP Engine + 3D Spatial Audio Module</span>
                </div>
                <div style={{ fontSize: 13, color: '#fff', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <CheckCircle2 size={16} color={COLORS.goldLight} style={{ flexShrink: 0 }} />
                  <span>50 Patches + All Future expansion vaults</span>
                </div>
                <div style={{ fontSize: 13, color: '#fff', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <CheckCircle2 size={16} color={COLORS.goldLight} style={{ flexShrink: 0 }} />
                  <span style={{ fontWeight: 600 }}>Lifetime Updates (v1.x & v2.x Upgrades)</span>
                </div>
                <div style={{ fontSize: 13, color: '#fff', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <CheckCircle2 size={16} color={COLORS.goldLight} style={{ flexShrink: 0 }} />
                  <span>Exclusive UI theme creator skin switcher</span>
                </div>
                <div style={{ fontSize: 13, color: '#fff', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <CheckCircle2 size={16} color={COLORS.goldLight} style={{ flexShrink: 0 }} />
                  <span>24/7 Priority Support (12-hour response SLA)</span>
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <button
              onClick={() => handlePreOrderClick(399)}
              style={{
                width: '100%',
                padding: '18px 24px',
                background: GOLDEN_GRADIENT,
                border: 'none',
                borderRadius: 14,
                color: '#000',
                fontFamily: "'Inter', sans-serif",
                fontSize: 15,
                fontWeight: 800,
                letterSpacing: '0.05em',
                cursor: 'pointer',
                boxShadow: `0 8px 30px rgba(194, 150, 35, 0.25)`,
                transition: 'transform 0.25s, box-shadow 0.25s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = `0 15px 40px rgba(194, 150, 35, 0.45)`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = `0 8px 30px rgba(194, 150, 35, 0.25)`;
              }}
            >
              UNLOCK DEITY ACCESS
            </button>
          </motion.div>
        </div>

        {/* Features Row Underlying */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 24,
            borderTop: `1px solid ${COLORS.ether}`,
            paddingTop: 48,
            marginTop: 32,
          }}
        >
          {preOrderFeatures.map((feat, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div
                style={{
                  flexShrink: 0,
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.02)',
                  border: `1px solid ${COLORS.ether}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: COLORS.goldLight,
                }}
              >
                <feat.icon size={18} />
              </div>
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: '0 0 4px', fontFamily: "'Inter', sans-serif" }}>
                  {feat.title}
                </h4>
                <p style={{ fontSize: 12, color: COLORS.textMuted, margin: 0, lineHeight: 1.4, fontFamily: "'Inter', sans-serif" }}>
                  {feat.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Checkout Modal */}
      <PreOrderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        price={selectedPrice}
      />
    </section>
  );
}
