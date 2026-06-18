import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Sparkles,
  Music,
  SkipForward,
  SkipBack,
  Zap,
  Flame,
  Sun,
  Sparkle,
  Droplet,
  Layers
} from 'lucide-react';

interface PresetTrack {
  id: string;
  name: string;
  godId: string;
  presetName: string;
  type: string;
  description: string;
  audioUrl: string;
  color: string;
  glowColor: string;
  waveformType: 'lightning' | 'sub-bass' | 'crystal' | 'pad' | 'liquid';
  icon: React.ReactNode;
}

const TRACKS: PresetTrack[] = [
  {
    id: 'zeus',
    name: 'ZEUS',
    godId: 'zeus',
    presetName: 'Zeus Thunder Lead',
    type: 'Mythic Lead',
    description: 'Searing electrical transients with high-tension resonance. Perfect for anthemic beat switches.',
    audioUrl: '/audio/zeus-preview.ogg',
    color: '#4ecbff',
    glowColor: 'rgba(78, 203, 255, 0.35)',
    waveformType: 'lightning',
    icon: <Zap className="w-4 h-4" />
  },
  {
    id: 'hades',
    name: 'HADES',
    godId: 'hades',
    presetName: 'Hades Underworld Bass',
    type: 'Sub-Bass',
    description: 'Deep, saturated volcanic low-end with tape distortion. Rumbles the foundations of the mix.',
    audioUrl: '/audio/hades-preview.ogg',
    color: '#d64b35',
    glowColor: 'rgba(214, 75, 53, 0.35)',
    waveformType: 'sub-bass',
    icon: <Flame className="w-4 h-4" />
  },
  {
    id: 'apollo',
    name: 'APOLLO',
    godId: 'apollo',
    presetName: 'Apollo Sun-Disk Pluck',
    type: 'Ethereal Pluck',
    description: 'Bright solar pluck with crystal-bell harmonics and complex celestial delay structures.',
    audioUrl: '/audio/apollo-preview.wav',
    color: '#ffd45a',
    glowColor: 'rgba(255, 212, 90, 0.35)',
    waveformType: 'crystal',
    icon: <Sun className="w-4 h-4" />
  },
  {
    id: 'athena',
    name: 'ATHENA',
    godId: 'athena',
    presetName: 'Athena Oracle Pad',
    type: 'Celestial Pad',
    description: 'Warm, rich, evolving neo-soul pad that breathes and opens up as keys are held.',
    audioUrl: '/audio/athena-preview.ogg',
    color: '#9d65ff',
    glowColor: 'rgba(157, 101, 255, 0.35)',
    waveformType: 'pad',
    icon: <Sparkle className="w-4 h-4" />
  },
  {
    id: 'poseidon',
    name: 'POSEIDON',
    godId: 'poseidon',
    presetName: 'Poseidon Trench Keys',
    type: 'Liquid Keys',
    description: 'Watery electric keys drenched in liquid tremolo and deep, vast oceanic tails.',
    audioUrl: '/audio/poseidon-preview.wav',
    color: '#29d7e8',
    glowColor: 'rgba(41, 215, 232, 0.35)',
    waveformType: 'liquid',
    icon: <Droplet className="w-4 h-4" />
  }
];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
}

export default function PresetPreviewPlayer() {
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const volumeBarRef = useRef<HTMLDivElement>(null);

  // Refs for animation loop to avoid stale react state closures
  const isPlayingRef = useRef(false);
  const volumeRef = useRef(0.85);
  const activeTrackRef = useRef<PresetTrack>(TRACKS[0]);
  const tRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);

  const activeTrack = TRACKS[currentTrackIndex];

  // Sync references for animation loop
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    volumeRef.current = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  useEffect(() => {
    activeTrackRef.current = activeTrack;
    // Clear particles on track swap to avoid color bleeding
    particlesRef.current = [];
  }, [activeTrack]);

  // Set up Audio instance
  useEffect(() => {
    const audio = new Audio();
    audio.src = activeTrack.audioUrl;
    audio.volume = volume;
    audio.preload = 'metadata';
    audioRef.current = audio;

    const onTimeUpdate = () => {
      if (!isScrubbing) {
        setCurrentTime(audio.currentTime);
      }
    };

    const onDurationChange = () => {
      setDuration(audio.duration || 0);
    };

    const onEnded = () => {
      handleNext();
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('ended', onEnded);
      audioRef.current = null;
    };
  }, []);

  // Handle track source swap
  useEffect(() => {
    if (audioRef.current) {
      const wasPlaying = isPlaying;
      audioRef.current.src = activeTrack.audioUrl;
      audioRef.current.load();
      setCurrentTime(0);
      setDuration(0);

      if (wasPlaying) {
        audioRef.current.play().catch((err) => {
          console.warn('Audio play failed: ', err);
          setIsPlaying(false);
        });
      }
    }
  }, [currentTrackIndex]);

  // Volume control sync
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Play/Pause Action
  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.warn('Playback blocked by browser policy:', err);
        setIsPlaying(false);
      });
    }
  };

  const handleNext = () => {
    setCurrentTrackIndex((prev) => (prev + 1) % TRACKS.length);
    setIsPlaying(true);
  };

  const handlePrev = () => {
    setCurrentTrackIndex((prev) => (prev - 1 + TRACKS.length) % TRACKS.length);
    setIsPlaying(true);
  };

  const handleTrackSelect = (index: number) => {
    if (index === currentTrackIndex) {
      togglePlay();
    } else {
      setCurrentTrackIndex(index);
      setIsPlaying(true);
    }
  };

  // Timeline Scrubbing Logic
  const handleScrubberMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || duration === 0) return;
    setIsScrubbing(true);

    const updateScrubber = (clientX: number) => {
      const rect = progressBarRef.current!.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, clickX / rect.width));
      const newTime = percentage * duration;

      setCurrentTime(newTime);
      if (audioRef.current) {
        audioRef.current.currentTime = newTime;
      }
    };

    updateScrubber(e.clientX);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      updateScrubber(moveEvent.clientX);
    };

    const handleMouseUp = () => {
      setIsScrubbing(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Volume Bar Logic
  const handleVolumeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!volumeBarRef.current) return;

    const updateVolume = (clientX: number) => {
      const rect = volumeBarRef.current!.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, clickX / rect.width));
      setVolume(percentage);
      setIsMuted(percentage === 0);
    };

    updateVolume(e.clientX);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      updateVolume(moveEvent.clientX);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Format Seconds to MM:SS
  const formatTime = (time: number) => {
    if (isNaN(time) || time === 0) return '00:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Canvas Drawing Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animationFrameId: number;

    const render = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = rect.width;
      const height = rect.height;

      // Adjust buffer size to high DPI
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // 1. Dark Screen Background Gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#040406');
      bgGrad.addColorStop(1, '#08080c');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Audio Interface Grid lines
      ctx.strokeStyle = 'rgba(194, 150, 35, 0.03)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 24) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Horizontal Center Reference Line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      const track = activeTrackRef.current;
      const isPlay = isPlayingRef.current;
      const vol = volumeRef.current;

      // Increment wave progression phase
      // Zeus lightning is fast, Athena pad is slow
      let speedMultiplier = 0.05;
      if (track.waveformType === 'lightning') speedMultiplier = 0.12;
      if (track.waveformType === 'crystal') speedMultiplier = 0.08;
      if (track.waveformType === 'pad') speedMultiplier = 0.03;
      if (track.waveformType === 'liquid') speedMultiplier = 0.055;

      tRef.current += isPlay ? speedMultiplier : 0.01;

      // 3. Render Waveform Layers
      const drawWaveLayer = (
        ampScale: number,
        freqScale: number,
        phaseOffset: number,
        lineWidth: number,
        opacity: string,
        glow: boolean
      ) => {
        ctx.beginPath();
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = track.color + opacity;

        if (glow) {
          ctx.shadowBlur = isPlay ? 14 : 5;
          ctx.shadowColor = track.color;
        } else {
          ctx.shadowBlur = 0;
        }

        const t = tRef.current + phaseOffset;
        const waveAmp = isPlay ? 36 * ampScale * (0.6 + vol * 0.4) : 4 * ampScale;

        for (let x = 0; x <= width; x += 1.5) {
          const normX = x / width;
          const envelope = Math.sin(normX * Math.PI); // Envelope tapers to 0 at edges

          let yOffset = 0;

          if (track.waveformType === 'lightning') {
            // Jagged, electrical peaks
            const base =
              Math.sin(normX * 10 * freqScale - t * 2) * 0.65 +
              Math.cos(normX * 24 * freqScale + t * 3) * 0.35;
            
            yOffset = base * waveAmp * envelope;

            // Introduce high-frequency electric jitters if playing
            if (isPlay) {
              yOffset += (Math.random() - 0.5) * 5 * envelope;
              if (Math.random() < 0.005) {
                // Occasional thunder surge
                yOffset *= 1.4;
              }
            }
          } else if (track.waveformType === 'sub-bass') {
            // Massive rolling sub waves
            const base =
              Math.sin(normX * 3.5 * freqScale - t) * 0.85 +
              Math.sin(normX * 7 * freqScale + t * 0.5) * 0.15;
            yOffset = base * (waveAmp * 1.15) * envelope;
          } else if (track.waveformType === 'crystal') {
            // Fine sharp harmonic bell reflections
            const base =
              Math.sin(normX * 14 * freqScale - t * 2.5) * 0.6 * Math.sin(normX * 2.5) +
              Math.cos(normX * 28 * freqScale + t * 1.8) * 0.4;
            yOffset = base * waveAmp * envelope;
          } else if (track.waveformType === 'pad') {
            // Soft atmospheric waves
            const base =
              Math.sin(normX * 3 * freqScale - t * 0.5) * 0.7 +
              Math.sin(normX * 6.5 * freqScale + t * 0.2) * 0.3;
            yOffset = base * waveAmp * envelope;
          } else {
            // Liquid ripple
            const base = Math.sin(normX * 5.5 * freqScale - t + Math.sin(normX * 8 + t)) * 0.8;
            yOffset = base * waveAmp * envelope;
          }

          const y = height / 2 + yOffset;

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
        ctx.shadowBlur = 0; // Reset
      };

      // Layer 1: Ambient background ribbon (Wide, light, no glow)
      drawWaveLayer(0.65, 0.75, Math.PI / 3, 1.5, '25', false);
      // Layer 2: Secondary phase ribbon (Slightly narrower, mid-strength)
      drawWaveLayer(0.85, 1.2, -Math.PI / 4, 2, '55', false);
      // Layer 3: Foreground Main Beam (Full size, high glow)
      drawWaveLayer(1.0, 1.0, 0, 3, 'ff', true);

      // 4. Update and Draw Particles (Embers/Sparks)
      const particles = particlesRef.current;

      // Spawn particles when playing
      if (isPlay && Math.random() < 0.45) {
        const spawnX = Math.random() * width;
        const normX = spawnX / width;
        const envelope = Math.sin(normX * Math.PI);
        const t = tRef.current;
        let spawnY = height / 2;

        // Approximate local y position of waveform to spawn particles on top
        if (track.waveformType === 'lightning') {
          const base = Math.sin(normX * 10 - t * 2) * 0.65 + Math.cos(normX * 24 + t * 3) * 0.35;
          spawnY = height / 2 + base * 36 * (0.6 + vol * 0.4) * envelope;
        } else if (track.waveformType === 'sub-bass') {
          const base = Math.sin(normX * 3.5 - t) * 0.85 + Math.sin(normX * 7 + t * 0.5) * 0.15;
          spawnY = height / 2 + base * 41.4 * (0.6 + vol * 0.4) * envelope;
        } else if (track.waveformType === 'crystal') {
          const base = Math.sin(normX * 14 - t * 2.5) * 0.6 * Math.sin(normX * 2.5) + Math.cos(normX * 28 + t * 1.8) * 0.4;
          spawnY = height / 2 + base * 36 * (0.6 + vol * 0.4) * envelope;
        } else if (track.waveformType === 'pad') {
          const base = Math.sin(normX * 3 - t * 0.5) * 0.7 + Math.sin(normX * 6.5 + t * 0.2) * 0.3;
          spawnY = height / 2 + base * 36 * (0.6 + vol * 0.4) * envelope;
        } else {
          const base = Math.sin(normX * 5.5 - t + Math.sin(normX * 8 + t)) * 0.8;
          spawnY = height / 2 + base * 36 * (0.6 + vol * 0.4) * envelope;
        }

        particles.push({
          x: spawnX,
          y: spawnY,
          vx: (Math.random() - 0.5) * 0.6,
          vy: track.waveformType === 'sub-bass' ? -0.3 - Math.random() * 0.5 : -0.6 - Math.random() * 1.4,
          size: track.waveformType === 'crystal' ? Math.random() * 3 + 1.5 : Math.random() * 2.5 + 1.0,
          alpha: 1.0,
          life: 0,
          maxLife: Math.random() * 30 + 35
        });
      }

      // Render & cycle particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life += 1;
        p.alpha = 1.0 - p.life / p.maxLife;

        if (p.life >= p.maxLife) {
          particles.splice(i, 1);
          continue;
        }

        ctx.fillStyle = track.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();

        if (track.waveformType === 'crystal') {
          // Draw tiny square/diamond sparkles
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.life * 0.08);
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
        } else if (track.waveformType === 'lightning') {
          // Sharp rectangular sparks
          ctx.fillRect(p.x - 0.5, p.y, 1.2, p.size * 1.8);
        } else if (track.waveformType === 'liquid') {
          // Bubble outlines
          ctx.strokeStyle = track.color;
          ctx.lineWidth = 0.8;
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          // Standard glowing circles (pads & sub-bass)
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1.0;
      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <section
      style={{
        padding: '100px 24px',
        background: 'hsl(0, 0%, 4%)', // obsidian background
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
      }}
      className="border-y border-white/[0.04]"
      id="preset-player-section"
    >
      {/* Alchemical background ambient flows */}
      <div
        style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 800,
          height: 400,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${activeTrack.glowColor} 0%, transparent 70%)`,
          pointerEvents: 'none',
          transition: 'background 0.8s ease',
          zIndex: 0
        }}
      />

      <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        {/* Section Header */}
        <div style={{ textAlign: 'center', marginBottom: 50 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              borderRadius: '9999px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(194, 150, 35, 0.25)',
              marginBottom: 16
            }}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#c29623]" />
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.7rem',
                letterSpacing: '0.15em',
                color: '#e8c547',
                textTransform: 'uppercase'
              }}
            >
              Exclusive Pre-Order Expansion
            </span>
          </div>

          <h2
            style={{
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: '#ffffff',
              margin: '0 0 12px',
              textTransform: 'uppercase'
            }}
          >
            'Divine Presets' Preview
          </h2>
          <p
            style={{
              fontSize: '1rem',
              color: 'rgba(255, 255, 255, 0.5)',
              maxWidth: 550,
              margin: '0 auto',
              lineHeight: 1.5
            }}
          >
            Interact with the alchemical preset catalog of VST GOD. Preview the raw power of the deity sound library.
          </p>
        </div>

        {/* Modular Player Deck */}
        <div
          style={{
            background: 'rgba(12, 12, 16, 0.8)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            boxShadow: `0 30px 60px -20px rgba(0,0,0,0.8), 0 0 50px ${activeTrack.glowColor}`,
            padding: '24px',
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 1fr)',
            gap: '30px',
            transition: 'box-shadow 0.8s ease'
          }}
          className="preset-player-deck"
        >
          {/* LEFT SIDE: Synthesizer Screen and Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Screen Enclosure */}
            <div
              style={{
                background: '#040406',
                border: '1px solid rgba(255, 255, 255, 0.03)',
                borderRadius: '12px',
                padding: '16px',
                boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.9)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* LED Overlay glow */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))',
                  backgroundSize: '100% 4px, 6px 100%',
                  pointerEvents: 'none',
                  zIndex: 2
                }}
              />

              {/* LCD Display Metadata Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.04)', paddingBottom: '8px', zIndex: 10, position: 'relative' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '0.625rem',
                      letterSpacing: '0.08em',
                      color: 'rgba(255,255,255,0.4)',
                      textTransform: 'uppercase'
                    }}
                  >
                    PRESET SLOT // 0{currentTrackIndex + 1}
                  </span>
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: activeTrack.color,
                      textShadow: `0 0 10px ${activeTrack.color}55`,
                      transition: 'color 0.5s ease'
                    }}
                  >
                    {activeTrack.presetName}
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.65rem',
                    background: 'rgba(255, 255, 255, 0.04)',
                    color: '#c29623',
                    border: '1px solid rgba(194, 150, 35, 0.2)',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <div
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: isPlaying ? activeTrack.color : 'rgba(255,255,255,0.2)',
                      boxShadow: isPlaying ? `0 0 6px ${activeTrack.color}` : 'none'
                    }}
                  />
                  {activeTrack.type.toUpperCase()}
                </div>
              </div>

              {/* Waveform Canvas */}
              <div style={{ position: 'relative', height: 160, width: '100%', borderRadius: 8, overflow: 'hidden' }}>
                <canvas
                  ref={canvasRef}
                  style={{ width: '100%', height: '100%', display: 'block' }}
                />
              </div>

              {/* LCD Bottom Status (Time & Parameters) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.04)', paddingTop: '8px' }}>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', fontFamily: "'JetBrains Mono', monospace" }}>OSC</span>
                    <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.8)', fontFamily: "'JetBrains Mono', monospace" }}>REALM ENGINE</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', fontFamily: "'JetBrains Mono', monospace" }}>RATE</span>
                    <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.8)', fontFamily: "'JetBrains Mono', monospace" }}>48.0 KHZ</span>
                  </div>
                </div>

                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.8rem',
                    color: 'rgba(255, 255, 255, 0.85)',
                    letterSpacing: '0.05em'
                  }}
                >
                  <span style={{ color: activeTrack.color }}>{formatTime(currentTime)}</span>
                  <span style={{ color: 'rgba(255,255,255,0.25)' }}> / </span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
            </div>

            {/* PHYSICAL DECK CONTROLS PANEL */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Scrub timeline */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div
                  ref={progressBarRef}
                  onMouseDown={handleScrubberMouseDown}
                  style={{
                    height: 6,
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: 9999,
                    position: 'relative',
                    cursor: duration > 0 ? 'pointer' : 'not-allowed',
                    overflow: 'visible'
                  }}
                  className="group"
                >
                  {/* Fill progress */}
                  <div
                    style={{
                      height: '100%',
                      width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%',
                      background: `linear-gradient(90deg, ${activeTrack.color}88 0%, ${activeTrack.color} 100%)`,
                      borderRadius: 9999,
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      boxShadow: `0 0 10px ${activeTrack.color}bb`
                    }}
                  />
                  {/* Scrubber handle knob */}
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      background: '#ffffff',
                      border: `2.5px solid ${activeTrack.color}`,
                      borderRadius: '50%',
                      position: 'absolute',
                      top: -3,
                      left: duration > 0 ? `calc(${(currentTime / duration) * 100}% - 6px)` : '-6px',
                      opacity: duration > 0 ? 1 : 0,
                      transform: isScrubbing ? 'scale(1.25)' : 'scale(1)',
                      transition: 'transform 0.15s ease, border-color 0.4s ease',
                      boxShadow: `0 0 8px ${activeTrack.color}`
                    }}
                    className="group-hover:scale-125 pointer-events-none"
                  />
                </div>
              </div>

              {/* Buttons and Volume Slider block */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                {/* Back / Play / Forward buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    onClick={handlePrev}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      color: 'rgba(255, 255, 255, 0.7)',
                      width: 38,
                      height: 38,
                      borderRadius: '50%',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      outline: 'none',
                      transition: 'all 0.2s ease'
                    }}
                    className="hover:bg-white/[0.08] hover:text-white hover:border-white/[0.15] active:scale-95 flex items-center justify-center"
                    aria-label="Previous Track"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>

                  <button
                    onClick={togglePlay}
                    style={{
                      background: isPlaying ? '#ffffff' : `linear-gradient(135deg, ${activeTrack.color} 0%, #ffffff 130%)`,
                      color: '#060608',
                      width: 50,
                      height: 50,
                      borderRadius: '50%',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      outline: 'none',
                      boxShadow: isPlaying
                        ? '0 0 15px rgba(255,255,255,0.2)'
                        : `0 0 25px ${activeTrack.color}66`,
                      border: 'none',
                      transition: 'all 0.3s cubic-bezier(0.22, 1, 0.36, 1)'
                    }}
                    className="hover:scale-105 active:scale-95 flex items-center justify-center"
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5 fill-current" />
                    ) : (
                      <Play className="w-5 h-5 fill-current translate-x-0.5" />
                    )}
                  </button>

                  <button
                    onClick={handleNext}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      color: 'rgba(255, 255, 255, 0.7)',
                      width: 38,
                      height: 38,
                      borderRadius: '50%',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      outline: 'none',
                      transition: 'all 0.2s ease'
                    }}
                    className="hover:bg-white/[0.08] hover:text-white hover:border-white/[0.15] active:scale-95 flex items-center justify-center"
                    aria-label="Next Track"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>

                {/* Volume Controller */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: isMuted ? '#d64b35' : 'rgba(255, 255, 255, 0.5)',
                      cursor: 'pointer',
                      padding: 4,
                      outline: 'none',
                      transition: 'color 0.2s ease'
                    }}
                    className="hover:text-white"
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4.5 h-4.5" />
                    ) : (
                      <Volume2 className="w-4.5 h-4.5" />
                    )}
                  </button>

                  <div
                    ref={volumeBarRef}
                    onMouseDown={handleVolumeMouseDown}
                    style={{
                      width: 80,
                      height: 5,
                      background: 'rgba(255, 255, 255, 0.06)',
                      borderRadius: 9999,
                      position: 'relative',
                      cursor: 'pointer'
                    }}
                    className="group"
                  >
                    <div
                      style={{
                        height: '100%',
                        width: isMuted ? '0%' : `${volume * 100}%`,
                        background: activeTrack.color,
                        borderRadius: 9999,
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        transition: 'background 0.4s ease'
                      }}
                    />
                    <div
                      style={{
                        width: 9,
                        height: 9,
                        background: '#ffffff',
                        borderRadius: '50%',
                        position: 'absolute',
                        top: -2,
                        left: isMuted ? '-4px' : `calc(${volume * 100}% - 4px)`,
                        boxShadow: `0 0 5px ${activeTrack.color}`,
                        transition: 'left 0.05s linear, border-color 0.4s ease'
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE: The Preset Bank Cartridges (Tracklist) */}
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', gap: '16px' }}>
            <div>
              {/* Bank Header */}
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.75rem',
                  letterSpacing: '0.12em',
                  color: 'rgba(255, 255, 255, 0.35)',
                  marginBottom: '14px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                  paddingBottom: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span>PRESET BANK [01-05]</span>
                <span className="text-xs" style={{ color: '#c29623' }}>SYS ACTIVE</span>
              </div>

              {/* Track list container */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {TRACKS.map((track, index) => {
                  const isActive = index === currentTrackIndex;
                  return (
                    <div
                      key={track.id}
                      onClick={() => handleTrackSelect(index)}
                      style={{
                        background: isActive ? 'rgba(255, 255, 255, 0.025)' : 'rgba(255, 255, 255, 0.01)',
                        border: isActive
                          ? `1px solid ${track.color}aa`
                          : '1px solid rgba(255, 255, 255, 0.03)',
                        boxShadow: isActive ? `0 0 15px ${track.color}15` : 'none',
                        borderRadius: '10px',
                        padding: '12px 16px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.3s cubic-bezier(0.22, 1, 0.36, 1)'
                      }}
                      className="group hover:bg-white/[0.02] hover:border-white/[0.08]"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* Status cartridge circle */}
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '6px',
                            background: isActive ? `${track.color}18` : 'rgba(255, 255, 255, 0.02)',
                            border: `1px solid ${isActive ? track.color : 'rgba(255, 255, 255, 0.04)'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: isActive ? track.color : 'rgba(255, 255, 255, 0.4)',
                            transition: 'all 0.3s ease'
                          }}
                        >
                          {track.icon}
                        </div>

                        {/* Title and category */}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span
                            style={{
                              fontSize: '0.85rem',
                              fontWeight: isActive ? 600 : 500,
                              color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.75)',
                              transition: 'color 0.2s ease'
                            }}
                          >
                            {track.presetName}
                          </span>
                          <span
                            style={{
                              fontSize: '0.675rem',
                              color: isActive ? track.color : 'rgba(255, 255, 255, 0.35)',
                              fontFamily: "'JetBrains Mono', monospace",
                              transition: 'color 0.2s ease'
                            }}
                          >
                            {track.type}
                          </span>
                        </div>
                      </div>

                      {/* Equalizer Wave Bar or Play Indicator */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {isActive ? (
                          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '12px', width: '16px' }}>
                            <motion.span
                              animate={{ height: isPlaying ? ['4px', '12px', '4px'] : '4px' }}
                              transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
                              style={{ backgroundColor: track.color }}
                              className="w-[2.5px] rounded-full"
                            />
                            <motion.span
                              animate={{ height: isPlaying ? ['4px', '16px', '4px'] : '4px' }}
                              transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut', delay: 0.15 }}
                              style={{ backgroundColor: track.color }}
                              className="w-[2.5px] rounded-full"
                            />
                            <motion.span
                              animate={{ height: isPlaying ? ['4px', '9px', '4px'] : '4px' }}
                              transition={{ duration: 0.5, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                              style={{ backgroundColor: track.color }}
                              className="w-[2.5px] rounded-full"
                            />
                          </div>
                        ) : (
                          <Play
                            style={{
                              width: 12,
                              height: 12,
                              color: 'rgba(255, 255, 255, 0.25)',
                              transition: 'all 0.2s ease'
                            }}
                            className="group-hover:text-white group-hover:scale-110"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected Preset Info Description Block */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.01)',
                border: '1px solid rgba(255, 255, 255, 0.03)',
                borderRadius: '10px',
                padding: '12px 16px',
                fontSize: '0.75rem',
                lineHeight: 1.5,
                color: 'rgba(255,255,255,0.45)',
                transition: 'border 0.4s ease, box-shadow 0.4s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <div 
                style={{ 
                  color: activeTrack.color, 
                  fontSize: '0.675rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '4px'
                }}
              >
                <Layers style={{ width: '14px', height: '14px' }} />
                <span>SOUND PROPERTIES</span>
              </div>
              <p style={{ margin: 0 }}>
                {activeTrack.description}
              </p>
            </div>
          </div>
        </div>

        {/* Responsive Grid layout stylesheet */}
        <style>{`
          @media (max-width: 868px) {
            .preset-player-deck {
              grid-template-columns: 1fr !important;
              gap: 24px !important;
            }
          }
        `}</style>
      </div>
    </section>
  );
}
