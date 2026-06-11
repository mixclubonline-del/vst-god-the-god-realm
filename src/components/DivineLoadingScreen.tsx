/**
 * DivineLoadingScreen — The Portal of Awakening
 * ─────────────────────────────────────────────
 * Cinematic loading screen with sacred geometry animation,
 * divine progress tracking, and portal transition.
 *
 * "Before the God Realm, there is the Threshold."
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import '@/styles/DivineLoadingScreen.css';

// ═══════════════════════════════════════════════════════
// Loading Stages
// ═══════════════════════════════════════════════════════

export interface LoadingStage {
  id: string;
  label: string;
  weight: number; // relative weight for progress calculation
}

export const DIVINE_STAGES: LoadingStage[] = [
  { id: 'awaken',     label: 'Awakening the God Engine',        weight: 15 },
  { id: 'bridge',     label: 'Establishing Divine Connection',  weight: 10 },
  { id: 'samples',    label: 'Channeling Sacred Samples',       weight: 40 },
  { id: 'mastering',  label: 'Calibrating the Celestial Forge', weight: 20 },
  { id: 'ui',         label: 'Manifesting the God Realm',       weight: 10 },
  { id: 'ready',      label: 'The God Realm Awaits',            weight: 5  },
];

// ═══════════════════════════════════════════════════════
// Sacred Geometry Canvas
// ═══════════════════════════════════════════════════════

function drawSacredGeometry(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number
) {
  ctx.clearRect(0, 0, width, height);

  const cx = width / 2;
  const cy = height / 2;
  const baseRadius = Math.min(width, height) * 0.28;

  // ── Metatron's Cube outer shell ──
  const rotation = time * 0.0003;
  const breathe = 1 + Math.sin(time * 0.001) * 0.03;

  // Flower of Life circles
  const petalCount = 6;
  const flowerRadius = baseRadius * 0.55 * breathe;

  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 0.5;

  // Central circle
  ctx.beginPath();
  ctx.arc(cx, cy, flowerRadius, 0, Math.PI * 2);
  ctx.stroke();

  // Six surrounding petals
  for (let i = 0; i < petalCount; i++) {
    const angle = (i / petalCount) * Math.PI * 2 + rotation;
    const px = cx + Math.cos(angle) * flowerRadius;
    const py = cy + Math.sin(angle) * flowerRadius;
    ctx.beginPath();
    ctx.arc(px, py, flowerRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ── Outer hexagonal grid ──
  ctx.globalAlpha = 0.06;
  ctx.lineWidth = 0.4;
  const hexRadius = baseRadius * 1.1 * breathe;

  for (let ring = 1; ring <= 3; ring++) {
    const r = hexRadius * (ring * 0.4);
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + rotation * 0.5;
      const hx = cx + Math.cos(angle) * r;
      const hy = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.stroke();
  }

  // ── Metatron's Cube connecting lines ──
  ctx.globalAlpha = 0.08;
  ctx.lineWidth = 0.3;
  ctx.strokeStyle = '#B388FF';

  const cubePoints: [number, number][] = [];
  // Inner hexagon
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + rotation;
    cubePoints.push([
      cx + Math.cos(angle) * flowerRadius * 0.6,
      cy + Math.sin(angle) * flowerRadius * 0.6,
    ]);
  }
  // Outer hexagon
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + rotation;
    cubePoints.push([
      cx + Math.cos(angle) * flowerRadius * 1.15,
      cy + Math.sin(angle) * flowerRadius * 1.15,
    ]);
  }
  // Center
  cubePoints.push([cx, cy]);

  // Connect all points
  for (let i = 0; i < cubePoints.length; i++) {
    for (let j = i + 1; j < cubePoints.length; j++) {
      ctx.beginPath();
      ctx.moveTo(cubePoints[i][0], cubePoints[i][1]);
      ctx.lineTo(cubePoints[j][0], cubePoints[j][1]);
      ctx.stroke();
    }
  }

  // ── Radial pulse rings ──
  const pulseCount = 4;
  for (let i = 0; i < pulseCount; i++) {
    const phase = ((time * 0.0005 + i / pulseCount) % 1);
    const r = baseRadius * 0.3 + phase * baseRadius * 1.2;
    const alpha = (1 - phase) * 0.12;

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 1 - phase * 0.8;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ── Orbiting particles ──
  ctx.globalAlpha = 0.7;
  const particleOrbitCount = 12;
  for (let i = 0; i < particleOrbitCount; i++) {
    const orbitR = baseRadius * (0.4 + (i % 3) * 0.25);
    const speed = 0.0004 + (i % 4) * 0.0001;
    const angle = time * speed + (i / particleOrbitCount) * Math.PI * 2;
    const px = cx + Math.cos(angle) * orbitR * breathe;
    const py = cy + Math.sin(angle) * orbitR * breathe;
    const size = 1 + (i % 3) * 0.5;

    const particleAlpha = 0.3 + Math.sin(time * 0.003 + i) * 0.2;
    ctx.globalAlpha = particleAlpha;

    // Gold or violet particles
    ctx.fillStyle = i % 3 === 0 ? '#FFD700' : i % 3 === 1 ? '#B388FF' : '#80DEEA';
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();

    // Glow
    ctx.globalAlpha = particleAlpha * 0.3;
    ctx.beginPath();
    ctx.arc(px, py, size * 4, 0, Math.PI * 2);
    ctx.fillStyle = i % 3 === 0 ? 'rgba(255,215,0,0.15)' : 'rgba(179,136,255,0.1)';
    ctx.fill();
  }

  // ── Sacred triangle at center ──
  ctx.globalAlpha = 0.15;
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 0.8;
  const triR = baseRadius * 0.2 * breathe;
  const triRotation = -rotation * 1.5;

  ctx.beginPath();
  for (let i = 0; i <= 3; i++) {
    const angle = (i / 3) * Math.PI * 2 + triRotation - Math.PI / 2;
    const tx = cx + Math.cos(angle) * triR;
    const ty = cy + Math.sin(angle) * triR;
    if (i === 0) ctx.moveTo(tx, ty);
    else ctx.lineTo(tx, ty);
  }
  ctx.stroke();

  // Inverted triangle
  ctx.globalAlpha = 0.1;
  ctx.beginPath();
  for (let i = 0; i <= 3; i++) {
    const angle = (i / 3) * Math.PI * 2 - triRotation + Math.PI / 2;
    const tx = cx + Math.cos(angle) * triR * 0.8;
    const ty = cy + Math.sin(angle) * triR * 0.8;
    if (i === 0) ctx.moveTo(tx, ty);
    else ctx.lineTo(tx, ty);
  }
  ctx.stroke();

  ctx.globalAlpha = 1;
}

// ═══════════════════════════════════════════════════════
// Floating Particles Data
// ═══════════════════════════════════════════════════════

const PARTICLES = Array.from({ length: 24 }, (_, i) => ({
  left: `${5 + Math.random() * 90}%`,
  top: `${10 + Math.random() * 80}%`,
  dx: `${-30 + Math.random() * 60}px`,
  dy: `${-60 - Math.random() * 40}px`,
  dur: `${4 + Math.random() * 5}s`,
  delay: `${Math.random() * 6}s`,
  size: 1 + Math.random() * 2,
  color: i % 5 === 0 ? 'rgba(179,136,255,0.6)' : i % 7 === 0 ? 'rgba(128,222,234,0.5)' : '#FFD700',
}));

// ═══════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════

interface DivineLoadingScreenProps {
  currentStage: string;
  onTransitionComplete?: () => void;
  isReady?: boolean;
}

export const DivineLoadingScreen: React.FC<DivineLoadingScreenProps> = ({
  currentStage,
  onTransitionComplete,
  isReady = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const animFrameRef = useRef<number>(0);
  const [exiting, setExiting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoEnded, setVideoEnded] = useState(false);
  const [showVideo, setShowVideo] = useState(true);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);

  // Load video via Blob URL to bypass WKWebView custom scheme range request limitation
  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    const loadVideo = async () => {
      try {
        console.log("[LoadingScreen] Fetching video asset as blob...");
        const response = await fetch("/images/loading/intro-animation.mp4");
        if (!response.ok) throw new Error("Failed to fetch video resource");
        const blob = await response.blob();
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setVideoSrc(objectUrl);
        console.log("[LoadingScreen] Video blob URL created successfully");
      } catch (err) {
        console.error("[LoadingScreen] Failed to load video blob:", err);
        if (active) {
          setShowVideo(false);
          setVideoEnded(true);
        }
      }
    };

    loadVideo();

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, []);

  // Calculate progress from current stage
  useEffect(() => {
    const stageIdx = DIVINE_STAGES.findIndex(s => s.id === currentStage);
    if (stageIdx === -1) return;

    let totalWeight = 0;
    for (let i = 0; i <= stageIdx; i++) {
      totalWeight += DIVINE_STAGES[i].weight;
    }
    const totalPossible = DIVINE_STAGES.reduce((a, s) => a + s.weight, 0);
    setProgress(Math.round((totalWeight / totalPossible) * 100));
  }, [currentStage]);

  // Fallback timeout to ensure loading screen can dismiss even if video fails/loops
  useEffect(() => {
    const fallback = setTimeout(() => {
      console.log("[LoadingScreen] Fallback timeout triggered");
      setVideoEnded(true);
      setShowVideo(false);
    }, 8000);
    return () => clearTimeout(fallback);
  }, []);

  // Start exit animation when BOTH video ended AND engine ready
  useEffect(() => {
    if (isReady && videoEnded && !exiting) {
      const timer = setTimeout(() => {
        setExiting(true);
      }, 400);
      return () => clearTimeout(timer);
    }
    // If engine is ready but video still playing, let video finish
    // If video ended but engine not ready, wait for engine
  }, [isReady, videoEnded, exiting]);

  // Handle exit animation end
  const handleAnimationEnd = useCallback(() => {
    if (exiting) {
      onTransitionComplete?.();
    }
  }, [exiting, onTransitionComplete]);

  // Handle video end
  const handleVideoEnded = useCallback(() => {
    setVideoEnded(true);
  }, []);

  // Sacred geometry animation loop (plays behind/over the video for extra depth)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const startTime = performance.now();

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const rect = canvas.getBoundingClientRect();
      drawSacredGeometry(ctx, rect.width, rect.height, elapsed);
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Current stage label
  const stageLabel = DIVINE_STAGES.find(s => s.id === currentStage)?.label || 'Initializing';

  return (
    <div
      className={`divine-loading ${exiting ? 'divine-loading--exiting' : ''}`}
      onAnimationEnd={handleAnimationEnd}
    >
      {/* ═══ Intro Animation Video ═══ */}
      {showVideo && videoSrc && (
        <video
          ref={videoRef}
          className="divine-loading__video"
          src={videoSrc}
          autoPlay
          muted
          playsInline
          onEnded={handleVideoEnded}
          onError={() => {
            console.log("[LoadingScreen] Video failed to load, hiding");
            setShowVideo(false);
            setVideoEnded(true);
          }}
        />
      )}

      {/* Sacred Geometry Canvas — layered on top of the video for depth */}
      <canvas ref={canvasRef} className="divine-loading__canvas" />

      {/* Floating Particles */}
      <div className="divine-loading__particles">
        {PARTICLES.map((p, i) => (
          <div
            key={i}
            className="divine-loading__particle"
            style={{
              left: p.left,
              top: p.top,
              width: p.size,
              height: p.size,
              background: p.color,
              '--dx': p.dx,
              '--dy': p.dy,
              '--dur': p.dur,
              '--delay': p.delay,
              animationDuration: p.dur,
              animationDelay: p.delay,
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* Bottom Progress Overlay */}
      <div className="divine-loading__overlay">
        {/* Logo */}
        <div className="divine-loading__logo">
          <span className="divine-loading__logo-vst">VST</span>
          <span className="divine-loading__logo-god">GOD</span>
        </div>

        {/* Progress */}
        <div className="divine-loading__progress-section">
          <div className="divine-loading__progress-track">
            <div
              className="divine-loading__progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="divine-loading__status">
            {stageLabel}...
          </div>
          <div className="divine-loading__version">
            v1.0.0 — Forged by MixxTech
          </div>
        </div>
      </div>
    </div>
  );
};

export default DivineLoadingScreen;

