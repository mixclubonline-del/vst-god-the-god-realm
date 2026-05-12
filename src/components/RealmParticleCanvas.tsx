/**
 * RealmParticleCanvas — Living Atmosphere System
 * Canvas2D particle engine with realm-specific behaviors.
 * Renders between background image layer and UI controls.
 */
import React, { useRef, useEffect, useCallback } from 'react';

type RealmType = 
  | 'Multi-Realm' 
  | 'Effects' 
  | 'Sample Chopper' 
  | 'Divine Archive' 
  | 'Mastering' 
  | 'Performance' 
  | 'Preset Vault';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  life: number;
  maxLife: number;
  rotation: number;
  rotationSpeed: number;
  type: number; // sub-type within a realm
  color: string;
  /** Extra per-particle data */
  meta?: number;
}

interface RealmParticleCanvasProps {
  realm: RealmType;
  mouseX?: number;
  mouseY?: number;
}

/* ═══ Realm Color Palettes ═══ */
const REALM_COLORS: Record<string, string[]> = {
  'Multi-Realm':    ['#ff6600', '#ff8800', '#ffaa33', '#ff4400', '#cc3300'],
  'Effects':        ['#60A5FA', '#BB8FCE', '#9B59B6', '#1ABC9C', '#F5B041'],
  'Sample Chopper': ['#9B59B6', '#BB8FCE', '#6C3483', '#D2B4DE', '#8E44AD'],
  'Divine Archive': ['#c29623', '#F5B041', '#d4a017', '#e6c200', '#b8860b'],
  'Mastering':      ['#ff6600', '#ff8800', '#c29623', '#ffaa33', '#e65100'],
  'Performance':    ['#1ABC9C', '#60A5FA', '#27AE60', '#3498DB', '#48C9B0'],
  'Preset Vault':   ['#c29623', '#F5B041', '#8B7355', '#d4a017', '#DAA520'],
};

const MAX_PARTICLES = 60;

function createParticle(w: number, h: number, realm: RealmType): Particle {
  const colors = REALM_COLORS[realm] || REALM_COLORS['Multi-Realm'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const maxLife = 200 + Math.random() * 300;

  switch (realm) {
    /* ── Forge Sparks: rise from bottom with heat drift ── */
    case 'Multi-Realm':
      return {
        x: Math.random() * w,
        y: h + 10,
        vx: (Math.random() - 0.5) * 0.8,
        vy: -(0.5 + Math.random() * 1.5),
        size: 1 + Math.random() * 3,
        opacity: 0.6 + Math.random() * 0.4,
        life: 0, maxLife, rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 0.1,
        type: Math.random() > 0.7 ? 1 : 0,
        color,
      };

    /* ── Stardust: gentle drift in all directions ── */
    case 'Effects':
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: 0.5 + Math.random() * 2,
        opacity: 0.3 + Math.random() * 0.5,
        life: 0, maxLife: maxLife * 1.5, rotation: 0,
        rotationSpeed: 0,
        type: Math.random() > 0.8 ? 1 : 0,
        color,
      };

    /* ── Blade Shards: fall with slight tumble ── */
    case 'Sample Chopper':
      return {
        x: Math.random() * w,
        y: -10,
        vx: (Math.random() - 0.5) * 0.5,
        vy: 0.3 + Math.random() * 0.8,
        size: 2 + Math.random() * 4,
        opacity: 0.3 + Math.random() * 0.4,
        life: 0, maxLife,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.05,
        type: 0, color,
      };

    /* ── Gold Dust + Rune Glyphs: float upward gently ── */
    case 'Divine Archive':
      return {
        x: Math.random() * w,
        y: h * 0.3 + Math.random() * h * 0.7,
        vx: (Math.random() - 0.5) * 0.2,
        vy: -(0.1 + Math.random() * 0.4),
        size: 1 + Math.random() * 2.5,
        opacity: 0.4 + Math.random() * 0.4,
        life: 0, maxLife: maxLife * 1.3,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.02,
        type: Math.random() > 0.85 ? 1 : 0,
        color,
      };

    /* ── Ember Rain: diagonal fall with glow ── */
    case 'Mastering':
      return {
        x: Math.random() * w * 1.2,
        y: -10,
        vx: -0.2 - Math.random() * 0.3,
        vy: 0.4 + Math.random() * 1.0,
        size: 1 + Math.random() * 2,
        opacity: 0.5 + Math.random() * 0.5,
        life: 0, maxLife,
        rotation: 0, rotationSpeed: 0,
        type: 0, color,
      };

    /* ── Orbital Debris: circular motion ── */
    case 'Performance':
      return {
        x: w / 2 + (Math.random() - 0.5) * w * 0.6,
        y: h / 2 + (Math.random() - 0.5) * h * 0.6,
        vx: 0, vy: 0,
        size: 1 + Math.random() * 3,
        opacity: 0.3 + Math.random() * 0.4,
        life: 0, maxLife: maxLife * 1.5,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() > 0.5 ? 1 : -1) * (0.002 + Math.random() * 0.005),
        type: Math.random() > 0.7 ? 1 : 0,
        color,
        meta: 80 + Math.random() * 150, // orbit radius
      };

    /* ── Sacred Geometry: slow rotating shapes ── */
    case 'Preset Vault':
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.15,
        vy: -(0.05 + Math.random() * 0.2),
        size: 8 + Math.random() * 15,
        opacity: 0.08 + Math.random() * 0.12,
        life: 0, maxLife: maxLife * 2,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.008,
        type: Math.floor(Math.random() * 3),
        color,
      };

    default:
      return {
        x: Math.random() * w, y: Math.random() * h,
        vx: 0, vy: -0.3, size: 2, opacity: 0.3,
        life: 0, maxLife, rotation: 0, rotationSpeed: 0,
        type: 0, color,
      };
  }
}

/* ═══ Drawing Functions ═══ */

function drawSpark(ctx: CanvasRenderingContext2D, p: Particle) {
  const fade = 1 - p.life / p.maxLife;
  ctx.globalAlpha = p.opacity * fade;
  ctx.fillStyle = p.color;
  ctx.shadowColor = p.color;
  ctx.shadowBlur = p.size * 3;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawShard(ctx: CanvasRenderingContext2D, p: Particle) {
  const fade = 1 - p.life / p.maxLife;
  ctx.globalAlpha = p.opacity * fade;
  ctx.fillStyle = p.color;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rotation);
  ctx.beginPath();
  ctx.moveTo(0, -p.size);
  ctx.lineTo(p.size * 0.4, p.size * 0.5);
  ctx.lineTo(-p.size * 0.4, p.size * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawRuneGlyph(ctx: CanvasRenderingContext2D, p: Particle) {
  const fade = 1 - p.life / p.maxLife;
  ctx.globalAlpha = p.opacity * fade * 0.6;
  ctx.strokeStyle = p.color;
  ctx.lineWidth = 0.5;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rotation);
  const s = p.size * 2;
  // Simple rune cross shape
  ctx.beginPath();
  ctx.moveTo(0, -s); ctx.lineTo(0, s);
  ctx.moveTo(-s * 0.6, -s * 0.3); ctx.lineTo(s * 0.6, -s * 0.3);
  ctx.moveTo(-s * 0.4, s * 0.4); ctx.lineTo(s * 0.4, s * 0.4);
  ctx.stroke();
  ctx.restore();
}

function drawSacredGeometry(ctx: CanvasRenderingContext2D, p: Particle) {
  const fade = 1 - p.life / p.maxLife;
  ctx.globalAlpha = p.opacity * fade;
  ctx.strokeStyle = p.color;
  ctx.lineWidth = 0.5;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rotation);
  const s = p.size;
  const sides = 6;
  // Hexagon wireframe
  ctx.beginPath();
  for (let i = 0; i <= sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    const px = Math.cos(a) * s;
    const py = Math.sin(a) * s;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  // Inner triangle
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
    const px = Math.cos(a) * s * 0.6;
    const py = Math.sin(a) * s * 0.6;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawStarCross(ctx: CanvasRenderingContext2D, p: Particle) {
  const fade = 1 - p.life / p.maxLife;
  ctx.globalAlpha = p.opacity * fade;
  ctx.fillStyle = p.color;
  ctx.shadowColor = p.color;
  ctx.shadowBlur = p.size * 5;
  // 4-point star
  const s = p.size;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.beginPath();
  ctx.moveTo(0, -s * 2); ctx.lineTo(s * 0.3, -s * 0.3);
  ctx.lineTo(s * 2, 0); ctx.lineTo(s * 0.3, s * 0.3);
  ctx.lineTo(0, s * 2); ctx.lineTo(-s * 0.3, s * 0.3);
  ctx.lineTo(-s * 2, 0); ctx.lineTo(-s * 0.3, -s * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.shadowBlur = 0;
}

/* ═══ Main Component ═══ */

export const RealmParticleCanvas: React.FC<RealmParticleCanvasProps> = ({ realm, mouseX, mouseY }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);
  const frameRef = useRef(0);
  const prevRealmRef = useRef(realm);

  // When realm changes, flush particles
  useEffect(() => {
    if (prevRealmRef.current !== realm) {
      particlesRef.current = [];
      prevRealmRef.current = realm;
    }
  }, [realm]);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    frameRef.current++;

    // Spawn particles
    const particles = particlesRef.current;
    const spawnRate = realm === 'Preset Vault' ? 0.15 : 0.4;
    if (particles.length < MAX_PARTICLES && Math.random() < spawnRate) {
      particles.push(createParticle(w, h, realm));
    }

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Update & draw
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life++;

      // Orbital motion for Performance/Sequencer realm
      if (realm === 'Performance' && p.meta) {
        const cx = w / 2;
        const cy = h / 2;
        p.rotation += p.rotationSpeed;
        p.x = cx + Math.cos(p.rotation) * p.meta;
        p.y = cy + Math.sin(p.rotation) * p.meta * 0.5; // elliptical
      } else {
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;

        // Heat drift for forge sparks
        if (realm === 'Multi-Realm') {
          p.vx += (Math.random() - 0.5) * 0.05;
        }
      }

      // Remove dead particles
      if (p.life > p.maxLife || p.y < -20 || p.y > h + 20 || p.x < -30 || p.x > w + 30) {
        particles.splice(i, 1);
        continue;
      }

      // Draw based on realm
      switch (realm) {
        case 'Multi-Realm':
        case 'Mastering':
          drawSpark(ctx, p);
          break;
        case 'Effects':
          p.type === 1 ? drawStarCross(ctx, p) : drawSpark(ctx, p);
          break;
        case 'Sample Chopper':
          drawShard(ctx, p);
          break;
        case 'Divine Archive':
          p.type === 1 ? drawRuneGlyph(ctx, p) : drawSpark(ctx, p);
          break;
        case 'Performance':
          p.type === 1 ? drawShard(ctx, p) : drawSpark(ctx, p);
          break;
        case 'Preset Vault':
          drawSacredGeometry(ctx, p);
          break;
        default:
          drawSpark(ctx, p);
      }
    }

    ctx.globalAlpha = 1;
    rafRef.current = requestAnimationFrame(animate);
  }, [realm]);

  // Setup canvas & animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
    };

    resize();
    window.addEventListener('resize', resize);

    // Visibility API — pause when hidden
    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(rafRef.current);
      } else {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [animate]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        opacity: 0.8,
      }}
    />
  );
};
