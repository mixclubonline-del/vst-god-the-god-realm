import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X, Sparkles, AlertCircle } from 'lucide-react';
import PreOrderModal from './PreOrderModal';

interface FeatureItem {
  name: string;
  description: string;
  freeVal: string;
  freeStatus: 'limited' | 'none' | 'basic';
  goldVal: string;
  goldStatus: 'premium' | 'complete';
}

const comparisonFeatures: FeatureItem[] = [
  {
    name: 'Plugin Engine',
    description: 'The core digital signal processing synthesis and wavefolding system.',
    freeVal: 'Basic Trial (Limited polyphony, standard oscillators)',
    freeStatus: 'limited',
    goldVal: 'Unlocked DSP (Unlimited voices, alchemical wavefolder, 3D audio space)',
    goldStatus: 'premium',
  },
  {
    name: 'Activations',
    description: 'System authorization count allowed per license key.',
    freeVal: 'None (Runs in trial mode, custom presets do not persist)',
    freeStatus: 'none',
    goldVal: 'Up to 2 machines (macOS/Windows, lifetime license key)',
    goldStatus: 'complete',
  },
  {
    name: 'Updates',
    description: 'Software version updates, performance patches, and compatibility.',
    freeVal: 'Trial version updates only (Access locks post-beta)',
    freeStatus: 'none',
    goldVal: 'Lifetime v1.x Updates (All feature additions & optimizations)',
    goldStatus: 'complete',
  },
  {
    name: 'Divine Presets Expansion',
    description: 'Exclusive patches crafted by industry sound designers.',
    freeVal: '15 stock presets (standard patches)',
    freeStatus: 'basic',
    goldVal: '50 exclusive Divine presets + all future expansion vaults in v1',
    goldStatus: 'premium',
  },
  {
    name: 'Custom Gold UI Skin',
    description: 'Visual skin customization panel within the plugin shell.',
    freeVal: 'Classic Obsidian skin only',
    freeStatus: 'none',
    goldVal: 'Exclusive "Celestial Gold-Ember" premium skin + theme switcher',
    goldStatus: 'premium',
  },
  {
    name: 'Priority Support',
    description: 'Support ticket queue and direct developer support access.',
    freeVal: 'Community-based Discord channel',
    freeStatus: 'basic',
    goldVal: '24/7 Priority developer ticket queue (12-hour response guarantee)',
    goldStatus: 'premium',
  },
];

const COLORS = {
  void: 'hsl(240, 30%, 4%)',
  obsidian: 'hsl(0, 0%, 4%)',
  goldHex: '#c29623',
  goldLight: '#e8c547',
  goldDark: '#8c6613',
  goldGlow: 'rgba(194, 150, 35, 0.12)',
  goldGlowMuted: 'rgba(194, 150, 35, 0.03)',
  ether: 'rgba(255, 255, 255, 0.05)',
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255, 255, 255, 0.7)',
  textMuted: 'rgba(255, 255, 255, 0.5)',
  textDim: 'rgba(255, 255, 255, 0.35)',
  amber: '#d97706',
};

const GOLDEN_GRADIENT = `linear-gradient(135deg, ${COLORS.goldHex} 0%, ${COLORS.goldLight} 50%, ${COLORS.goldHex} 100%)`;

export default function FeatureComparisonMatrix() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  const renderFreeValue = (item: FeatureItem) => {
    switch (item.freeStatus) {
      case 'limited':
        return (
          <span className="fcm-val-free fcm-val-limited-text">
            <AlertCircle className="fcm-icon-alert" size={16} />
            <span>{item.freeVal}</span>
          </span>
        );
      case 'none':
        return (
          <span className="fcm-val-free fcm-val-muted-text">
            <X className="fcm-icon-cross" size={16} />
            <span>{item.freeVal}</span>
          </span>
        );
      case 'basic':
        return (
          <span className="fcm-val-free">
            <Check className="fcm-icon-check-muted" size={16} />
            <span>{item.freeVal}</span>
          </span>
        );
    }
  };

  const renderGoldValue = (item: FeatureItem) => {
    if (item.goldStatus === 'premium') {
      return (
        <span className="fcm-val-gold fcm-val-gold-premium">
          <Sparkles className="fcm-icon-sparkle" size={16} />
          <span className="fcm-highlight-text">{item.goldVal}</span>
        </span>
      );
    } else {
      return (
        <span className="fcm-val-gold">
          <Check className="fcm-icon-check-gold" size={16} />
          <span>{item.goldVal}</span>
        </span>
      );
    }
  };

  return (
    <section className="fcm-section" id="feature-comparison">
      {/* Scope-contained style sheet */}
      <style dangerouslySetInnerHTML={{ __html: `
        .fcm-section {
          padding: 120px 24px;
          background-color: ${COLORS.obsidian};
          position: relative;
          overflow: hidden;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          color: ${COLORS.textPrimary};
          display: flex;
          flex-direction: column;
          align-items: center;
          z-index: 1;
        }

        .fcm-glow-gold {
          position: absolute;
          top: 20%;
          left: 50%;
          transform: translateX(-50%);
          width: 700px;
          height: 700px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(194, 150, 35, 0.05) 0%, rgba(255, 102, 0, 0.01) 60%, transparent 100%);
          pointer-events: none;
          z-index: -1;
          filter: blur(60px);
        }

        .fcm-glow-ember {
          position: absolute;
          bottom: -10%;
          right: 5%;
          width: 500px;
          height: 500px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255, 68, 0, 0.02) 0%, transparent 75%);
          pointer-events: none;
          z-index: -1;
          filter: blur(80px);
        }

        .fcm-container {
          max-width: 1100px;
          width: 100%;
          position: relative;
          z-index: 2;
        }

        .fcm-header {
          text-align: center;
          margin-bottom: 64px;
        }

        .fcm-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          border-radius: 20px;
          background: rgba(194, 150, 35, 0.1);
          border: 1px solid rgba(194, 150, 35, 0.2);
          margin-bottom: 16px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
        }

        .fcm-badge-text {
          font-size: 11px;
          font-weight: 700;
          color: ${COLORS.goldLight};
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .fcm-title {
          font-size: clamp(32px, 5vw, 48px);
          font-weight: 900;
          letter-spacing: -0.02em;
          color: #ffffff;
          margin: 0 0 16px;
          line-height: 1.15;
        }

        .fcm-subtitle {
          font-size: clamp(15px, 2vw, 17px);
          color: ${COLORS.textMuted};
          max-width: 600px;
          margin: 0 auto;
          line-height: 1.6;
        }

        /* Desktop Table Grid */
        .fcm-desktop-table {
          display: block;
          width: 100%;
          background: linear-gradient(180deg, rgba(13, 13, 16, 0.9) 0%, rgba(8, 8, 10, 0.95) 100%);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 30px 60px rgba(0, 0, 0, 0.7), inset 0 0 40px rgba(255, 255, 255, 0.01);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }

        .fcm-table-header {
          display: grid;
          grid-template-columns: 1.3fr 1fr 1.1fr;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(0, 0, 0, 0.25);
        }

        .fcm-header-cell {
          padding: 36px 32px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          position: relative;
        }

        .fcm-header-gold {
          background: linear-gradient(180deg, rgba(194, 150, 35, 0.04) 0%, rgba(194, 150, 35, 0.01) 100%);
          border-left: 1px solid rgba(194, 150, 35, 0.15);
        }

        .fcm-header-gold::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: ${GOLDEN_GRADIENT};
        }

        .fcm-tier-label-free {
          font-size: 11px;
          font-weight: 700;
          color: ${COLORS.textDim};
          letter-spacing: 0.15em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }

        .fcm-tier-label-gold {
          font-size: 11px;
          font-weight: 800;
          color: ${COLORS.goldLight};
          letter-spacing: 0.15em;
          text-transform: uppercase;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 8px;
        }

        .fcm-price-free {
          font-size: 26px;
          font-weight: 800;
          color: ${COLORS.textSecondary};
        }

        .fcm-price-gold {
          font-size: 28px;
          font-weight: 900;
          color: #ffffff;
          display: flex;
          align-items: baseline;
          gap: 6px;
        }

        .fcm-price-slash {
          font-size: 15px;
          color: ${COLORS.textDim};
          text-decoration: line-through;
          font-weight: 500;
        }

        .fcm-price-currency {
          font-size: 13px;
          color: ${COLORS.textMuted};
          font-weight: 600;
        }

        /* Rows */
        .fcm-row {
          display: grid;
          grid-template-columns: 1.3fr 1fr 1.1fr;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          transition: background-color 0.2s ease, border-color 0.2s ease;
        }

        .fcm-row:last-child {
          border-bottom: none;
        }

        .fcm-row-hovered {
          background-color: rgba(255, 255, 255, 0.015);
          border-color: rgba(255, 255, 255, 0.08);
        }

        .fcm-cell {
          padding: 24px 32px;
          display: flex;
          align-items: center;
        }

        .fcm-cell-gold {
          background: rgba(194, 150, 35, 0.01);
          border-left: 1px solid rgba(194, 150, 35, 0.12);
        }

        .fcm-row-hovered .fcm-cell-gold {
          background: rgba(194, 150, 35, 0.02);
          border-left-color: rgba(194, 150, 35, 0.25);
        }

        .fcm-feature-info {
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
        }

        .fcm-feature-name {
          font-size: 15px;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 4px;
        }

        .fcm-feature-desc {
          font-size: 12px;
          color: ${COLORS.textDim};
          line-height: 1.4;
        }

        /* Values */
        .fcm-val-free {
          font-size: 13px;
          color: ${COLORS.textSecondary};
          line-height: 1.5;
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }

        .fcm-val-muted-text {
          color: ${COLORS.textDim};
        }

        .fcm-val-limited-text {
          color: rgba(255, 255, 255, 0.65);
        }

        .fcm-val-gold {
          font-size: 13px;
          color: #ffffff;
          line-height: 1.5;
          font-weight: 500;
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }

        .fcm-highlight-text {
          color: ${COLORS.goldLight};
          text-shadow: 0 0 12px rgba(232, 197, 71, 0.15);
          font-weight: 600;
        }

        /* Icons scoped */
        .fcm-icon-alert {
          color: ${COLORS.goldLight};
          margin-top: 2px;
          flex-shrink: 0;
        }

        .fcm-icon-cross {
          color: rgba(255, 255, 255, 0.15);
          margin-top: 2px;
          flex-shrink: 0;
        }

        .fcm-icon-check-muted {
          color: rgba(255, 255, 255, 0.35);
          margin-top: 2px;
          flex-shrink: 0;
        }

        .fcm-icon-sparkle {
          color: ${COLORS.goldLight};
          margin-top: 2px;
          flex-shrink: 0;
          filter: drop-shadow(0 0 5px rgba(232, 197, 71, 0.4));
        }

        .fcm-icon-check-gold {
          color: ${COLORS.goldLight};
          margin-top: 2px;
          flex-shrink: 0;
          filter: drop-shadow(0 0 3px rgba(232, 197, 71, 0.2));
        }

        /* Footer Row */
        .fcm-table-footer {
          display: grid;
          grid-template-columns: 1.3fr 1fr 1.1fr;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(0, 0, 0, 0.15);
        }

        .fcm-footer-cell {
          padding: 36px 32px;
          display: flex;
          align-items: center;
        }

        .fcm-footer-gold {
          background: rgba(194, 150, 35, 0.02);
          border-left: 1px solid rgba(194, 150, 35, 0.15);
        }

        .fcm-footer-callout {
          font-size: 14px;
          color: ${COLORS.textMuted};
          line-height: 1.5;
        }

        .fcm-btn-secondary {
          width: 100%;
          padding: 16px 20px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          color: ${COLORS.textMuted};
          font-family: inherit;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          text-align: center;
          cursor: not-allowed;
          transition: all 0.2s ease;
        }

        .fcm-btn-gold {
          width: 100%;
          padding: 16px 20px;
          background: ${GOLDEN_GRADIENT};
          border: none;
          border-radius: 12px;
          color: #000000;
          font-family: inherit;
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          text-align: center;
          cursor: pointer;
          box-shadow: 0 6px 22px rgba(194, 150, 35, 0.25);
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .fcm-btn-gold:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 30px rgba(194, 150, 35, 0.45);
        }

        .fcm-btn-gold:active {
          transform: translateY(0);
        }

        /* Mobile Layout Stack */
        .fcm-mobile-view {
          display: none;
          width: 100%;
          flex-direction: column;
          gap: 36px;
        }

        .fcm-mobile-card {
          background: linear-gradient(180deg, rgba(13, 13, 16, 0.9) 0%, rgba(8, 8, 10, 0.95) 100%);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 20px;
          padding: 32px 24px;
          box-shadow: 0 20px 45px rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }

        .fcm-mobile-gold-card {
          border: 1px solid rgba(194, 150, 35, 0.35);
          box-shadow: 0 20px 50px rgba(194, 150, 35, 0.08), 0 0 25px rgba(194, 150, 35, 0.02) inset;
          position: relative;
        }

        .fcm-mobile-gold-card::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: ${GOLDEN_GRADIENT};
          border-radius: 20px 20px 0 0;
        }

        .fcm-mobile-card-header {
          text-align: center;
          margin-bottom: 28px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          padding-bottom: 24px;
        }

        .fcm-mobile-gold-card .fcm-mobile-card-header {
          border-bottom: 1px solid rgba(194, 150, 35, 0.15);
        }

        .fcm-mobile-card-title-free {
          font-size: 12px;
          font-weight: 700;
          color: ${COLORS.textDim};
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-bottom: 6px;
        }

        .fcm-mobile-card-title-gold {
          font-size: 12px;
          font-weight: 800;
          color: ${COLORS.goldLight};
          letter-spacing: 0.12em;
          text-transform: uppercase;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 6px;
        }

        .fcm-mobile-card-price {
          margin-top: 8px;
        }

        .fcm-mobile-feature-list {
          display: flex;
          flex-direction: column;
          gap: 24px;
          margin-bottom: 32px;
        }

        .fcm-mobile-feature-item {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .fcm-mobile-feature-header {
          display: flex;
          flex-direction: column;
        }

        .fcm-mobile-feature-name {
          font-size: 14px;
          font-weight: 700;
          color: #ffffff;
        }

        .fcm-mobile-feature-desc {
          font-size: 11px;
          color: ${COLORS.textDim};
          margin-top: 2px;
        }

        .fcm-mobile-feature-value {
          padding-left: 2px;
        }

        @media (max-width: 768px) {
          .fcm-desktop-table {
            display: none;
          }
          .fcm-mobile-view {
            display: flex;
          }
        }
      ` }} />

      <div className="fcm-glow-gold" />
      <div className="fcm-glow-ember" />

      <div className="fcm-container">
        {/* Header Block */}
        <div className="fcm-header">
          <div className="fcm-badge">
            <Sparkles size={12} color={COLORS.goldLight} style={{ filter: 'drop-shadow(0 0 3px rgba(232, 197, 71, 0.4))' }} />
            <span className="fcm-badge-text">Synthesizer Tiers Comparison</span>
          </div>
          <h2 className="fcm-title">Compare Synthesis Realms</h2>
          <p className="fcm-subtitle">
            Evaluate the mortal trial limits against the eternal audio capabilities of the Gold Pre-Order tier.
          </p>
        </div>

        {/* Desktop Comparison Table */}
        <div className="fcm-desktop-table">
          <div className="fcm-table-header">
            {/* Feature Header Cell */}
            <div className="fcm-header-cell">
              <span className="fcm-feature-name" style={{ fontSize: 16, marginBottom: 0 }}>Available Features</span>
              <span className="fcm-feature-desc">All patches and engine options</span>
            </div>
            {/* Free Tier Header Cell */}
            <div className="fcm-header-cell">
              <span className="fcm-tier-label-free">Free / Beta Tier</span>
              <div className="fcm-price-free">Beta Access</div>
            </div>
            {/* Gold Tier Header Cell */}
            <div className="fcm-header-cell fcm-header-gold">
              <span className="fcm-tier-label-gold">
                <Sparkles size={12} />
                Gold Pre-Order
              </span>
              <div className="fcm-price-gold">
                <span className="fcm-price-slash">$149</span>
                <span>$49</span>
                <span className="fcm-price-currency">USD</span>
              </div>
            </div>
          </div>

          {/* Table Body */}
          <div>
            {comparisonFeatures.map((item, idx) => (
              <div
                key={idx}
                className={`fcm-row ${hoveredRow === idx ? 'fcm-row-hovered' : ''}`}
                onMouseEnter={() => setHoveredRow(idx)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                {/* Feature Column */}
                <div className="fcm-cell fcm-feature-info">
                  <span className="fcm-feature-name">{item.name}</span>
                  <span className="fcm-feature-desc">{item.description}</span>
                </div>
                {/* Free Value Column */}
                <div className="fcm-cell">
                  {renderFreeValue(item)}
                </div>
                {/* Gold Value Column */}
                <div className="fcm-cell fcm-cell-gold">
                  {renderGoldValue(item)}
                </div>
              </div>
            ))}
          </div>

          {/* Table Footer */}
          <div className="fcm-table-footer">
            <div className="fcm-footer-cell">
              <div className="fcm-footer-callout">
                Ready to harness the complete VST GOD synthesizer architecture?
              </div>
            </div>
            <div className="fcm-footer-cell">
              <button className="fcm-btn-secondary" disabled>
                Active Beta
              </button>
            </div>
            <div className="fcm-footer-cell fcm-footer-gold">
              <button
                className="fcm-btn-gold"
                onClick={() => setIsModalOpen(true)}
              >
                Claim Gold Access
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Grid/Cards Stack */}
        <div className="fcm-mobile-view">
          {/* Free Tier Card */}
          <div className="fcm-mobile-card">
            <div className="fcm-mobile-card-header">
              <span className="fcm-mobile-card-title-free">Trial Edition</span>
              <h3 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Free Beta</h3>
              <div className="fcm-mobile-card-price" style={{ color: COLORS.textMuted, fontSize: 14 }}>
                Active Session License
              </div>
            </div>
            
            <div className="fcm-mobile-feature-list">
              {comparisonFeatures.map((item, idx) => (
                <div key={idx} className="fcm-mobile-feature-item">
                  <div className="fcm-mobile-feature-header">
                    <span className="fcm-mobile-feature-name">{item.name}</span>
                  </div>
                  <div className="fcm-mobile-feature-value">
                    {renderFreeValue(item)}
                  </div>
                </div>
              ))}
            </div>

            <button className="fcm-btn-secondary" style={{ width: '100%' }} disabled>
              Beta Installed
            </button>
          </div>

          {/* Gold Tier Card */}
          <div className="fcm-mobile-card fcm-mobile-gold-card">
            <div className="fcm-mobile-card-header">
              <span className="fcm-mobile-card-title-gold">
                <Sparkles size={12} /> Recommended Tier
              </span>
              <h3 style={{ fontSize: 24, fontWeight: 900, margin: 0, color: '#ffffff' }}>Gold Pre-Order</h3>
              <div className="fcm-mobile-card-price" style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                <span className="fcm-price-slash" style={{ fontSize: 14 }}>$149</span>
                <span style={{ fontSize: 28, fontWeight: 900, color: '#ffffff' }}>$49</span>
                <span className="fcm-price-currency" style={{ fontSize: 12 }}>USD</span>
              </div>
            </div>

            <div className="fcm-mobile-feature-list">
              {comparisonFeatures.map((item, idx) => (
                <div key={idx} className="fcm-mobile-feature-item">
                  <div className="fcm-mobile-feature-header">
                    <span className="fcm-mobile-feature-name" style={{ color: COLORS.goldLight }}>{item.name}</span>
                  </div>
                  <div className="fcm-mobile-feature-value">
                    {renderGoldValue(item)}
                  </div>
                </div>
              ))}
            </div>

            <button
              className="fcm-btn-gold"
              style={{ width: '100%' }}
              onClick={() => setIsModalOpen(true)}
            >
              Unlock Deity Access
            </button>
          </div>
        </div>
      </div>

      {/* Shared Pre-Order Checkout Modal */}
      <PreOrderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        price={49}
      />
    </section>
  );
}
