/**
 * RealmPortalTransition — Phase 4: Realm Transition Rituals
 * 
 * A portal vortex overlay that fires during tab switches.
 * Renders a radial spiral collapse → expand sequence with
 * realm-specific color theming and divine rune flash.
 */
import React, { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './RealmPortalTransition.css';

/* ─── Realm Color Map ─── */
const REALM_COLORS: Record<string, { primary: string; secondary: string; glyph: string }> = {
  'Multi-Realm':    { primary: '#FFD700', secondary: '#ff9944', glyph: '⚒' },
  'Effects':        { primary: '#a855f7', secondary: '#c084fc', glyph: '⚡' },
  'Sample Chopper': { primary: '#ef4444', secondary: '#f97316', glyph: '🗡' },
  'Divine Archive': { primary: '#eab308', secondary: '#fbbf24', glyph: '📜' },
  'Mastering':      { primary: '#3b82f6', secondary: '#60a5fa', glyph: '🔱' },
  'Performance':    { primary: '#06b6d4', secondary: '#22d3ee', glyph: '✦' },
  'Preset Vault':   { primary: '#a855f7', secondary: '#d946ef', glyph: '🏛' },
};

interface RealmPortalTransitionProps {
  isTransitioning: boolean;
  targetRealm: string;
  onTransitionComplete: () => void;
}

export const RealmPortalTransition: React.FC<RealmPortalTransitionProps> = ({
  isTransitioning,
  targetRealm,
  onTransitionComplete,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const startTime = useRef(0);
  const DURATION = 600; // ms total

  const colors = REALM_COLORS[targetRealm] || REALM_COLORS['Multi-Realm'];

  const drawVortex = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, progress: number) => {
    ctx.clearRect(0, 0, w, h);
    
    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.sqrt(cx * cx + cy * cy);
    
    // Phase 1 (0→0.5): Collapse inward — rings shrink
    // Phase 2 (0.5→1): Expand outward — new realm reveals
    const phase = progress < 0.5 ? 'collapse' : 'expand';
    const phaseProgress = phase === 'collapse' 
      ? progress / 0.5 
      : (progress - 0.5) / 0.5;
    
    // Easing
    const eased = phase === 'collapse'
      ? phaseProgress * phaseProgress * phaseProgress // cubic ease-in
      : 1 - Math.pow(1 - phaseProgress, 3); // cubic ease-out

    // ── Background blackout ──
    if (phase === 'collapse') {
      ctx.globalAlpha = eased * 0.85;
    } else {
      ctx.globalAlpha = (1 - eased) * 0.85;
    }
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    // ── Vortex spiral rings ──
    const ringCount = 8;
    const rotation = progress * Math.PI * 4; // 2 full rotations during transition
    
    for (let i = 0; i < ringCount; i++) {
      const ringProgress = i / ringCount;
      let ringRadius: number;
      
      if (phase === 'collapse') {
        // Rings spiral inward
        ringRadius = maxR * (1 - eased) * (1 - ringProgress * 0.7);
      } else {
        // Rings spiral outward from center
        ringRadius = maxR * eased * ringProgress;
      }
      
      const angle = rotation + (ringProgress * Math.PI * 2);
      const offsetX = Math.cos(angle) * ringRadius * 0.05;
      const offsetY = Math.sin(angle) * ringRadius * 0.05;
      
      ctx.beginPath();
      ctx.arc(cx + offsetX, cy + offsetY, Math.max(0, ringRadius), 0, Math.PI * 2);
      ctx.closePath();
      
      ctx.strokeStyle = colors.primary;
      ctx.lineWidth = 2 + (1 - ringProgress) * 3;
      ctx.globalAlpha = (1 - ringProgress) * 0.4 * (phase === 'collapse' ? eased : (1 - eased));
      ctx.stroke();
    }

    // ── Central vortex core ──
    let coreSizeRaw = phase === 'collapse' 
      ? 5 + eased * 60 
      : 65 - eased * 60;
    
    if (!isFinite(coreSizeRaw)) coreSizeRaw = 1;
    const coreSize = Math.max(1, coreSizeRaw);
    
    const coreGlow = ctx.createRadialGradient(cx, cy, 0.0001, cx, cy, coreSize);
    coreGlow.addColorStop(0, colors.secondary);
    coreGlow.addColorStop(0.4, colors.primary);
    coreGlow.addColorStop(1, 'transparent');
    
    ctx.globalAlpha = phase === 'collapse' ? eased : (1 - eased);
    ctx.fillStyle = coreGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, coreSize, 0, Math.PI * 2);
    ctx.fill();

    // ── Energy particles streaming toward/from center ──
    const particleCount = 24;
    for (let i = 0; i < particleCount; i++) {
      const pAngle = (i / particleCount) * Math.PI * 2 + rotation * 0.5;
      let pDist: number;
      
      if (phase === 'collapse') {
        pDist = maxR * 0.8 * (1 - eased) + Math.sin(pAngle * 3 + progress * 20) * 20;
      } else {
        pDist = maxR * 0.8 * eased + Math.sin(pAngle * 3 + progress * 20) * 20;
      }
      
      const px = cx + Math.cos(pAngle) * pDist;
      const py = cy + Math.sin(pAngle) * pDist;
      const pSize = 1.5 + Math.sin(i + progress * 10) * 1;
      
      ctx.globalAlpha = 0.6 * (phase === 'collapse' ? eased : (1 - eased));
      ctx.fillStyle = i % 2 === 0 ? colors.primary : colors.secondary;
      ctx.beginPath();
      ctx.arc(px, py, pSize, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }, [colors]);

  useEffect(() => {
    if (!isTransitioning || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Match canvas to display size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    startTime.current = performance.now();
    
    const animate = (now: number) => {
      const elapsed = now - startTime.current;
      const progress = Math.min(1, elapsed / DURATION);
      
      drawVortex(ctx, rect.width, rect.height, progress);
      
      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        onTransitionComplete();
      }
    };
    
    animRef.current = requestAnimationFrame(animate);
    
    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, [isTransitioning, drawVortex, onTransitionComplete]);

  return (
    <AnimatePresence>
      {isTransitioning && (
        <motion.div
          className="realm-portal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
        >
          <canvas 
            ref={canvasRef} 
            className="realm-portal-canvas"
          />
          
          {/* Central Glyph Flash */}
          <motion.div 
            className="realm-portal-glyph"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ 
              scale: [0, 1.5, 1.2],
              opacity: [0, 1, 0],
            }}
            transition={{ 
              duration: DURATION / 1000,
              times: [0, 0.4, 1],
              ease: 'easeOut'
            }}
            style={{ color: colors.primary }}
          >
            {colors.glyph}
          </motion.div>

          {/* Realm Name Flash */}
          <motion.div
            className="realm-portal-name"
            initial={{ opacity: 0, y: 20 }}
            animate={{ 
              opacity: [0, 1, 1, 0],
              y: [20, 0, 0, -10],
            }}
            transition={{ 
              duration: DURATION / 1000,
              times: [0, 0.3, 0.7, 1],
            }}
            style={{ 
              color: colors.primary,
              textShadow: `0 0 30px ${colors.primary}, 0 0 60px ${colors.secondary}`
            }}
          >
            {targetRealm.toUpperCase().replace('SAMPLE CHOPPER', 'CHOPPER').replace('EFFECTS', 'THE PANTHEON').replace('MASTERING', 'CELESTIAL FORGE').replace('PERFORMANCE', 'SEQUENCER').replace('DIVINE ARCHIVE', 'ARCHIVE')}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
