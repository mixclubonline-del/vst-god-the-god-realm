import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Volume2, VolumeX, Maximize, Sparkles } from 'lucide-react';

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

export default function PromoTrailerSection() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [showMuteHint, setShowMuteHint] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<number | null>(null);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(err => console.error('Play failed:', err));
      setIsPlaying(true);
      setShowMuteHint(false); // Hide hint once they start playing
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
    setShowMuteHint(false);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const time = parseFloat(e.target.value);
    videoRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const handleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen().catch(err => {
        console.error('Fullscreen failed:', err);
      });
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      window.clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 2500);
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        window.clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isPlaying]);

  return (
    <section
      id="trailer"
      style={{
        padding: '100px 24px',
        background: COLORS.void,
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Background radial glows */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 800,
          height: 800,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(194, 150, 35, 0.03) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ maxWidth: 960, width: '100%', position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
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
              Cinematic Preview
            </span>
          </div>

          <h2
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 'clamp(28px, 4vw, 48px)',
              fontWeight: 900,
              letterSpacing: '-0.02em',
              color: '#fff',
              margin: '0 0 16px',
            }}
          >
            Watch the Alchemical Synthesis
          </h2>
          <p
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 'clamp(14px, 1.8vw, 16px)',
              color: COLORS.textMuted,
              maxWidth: 600,
              margin: '0 auto',
              lineHeight: 1.6,
            }}
          >
            Witness the sonic power of the gods. See the WebUI and audio engine working in absolute harmony.
          </p>
        </div>

        {/* Video Player Container */}
        <div
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => isPlaying && setShowControls(false)}
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16/9',
            borderRadius: 20,
            overflow: 'hidden',
            background: '#000',
            border: `1px solid ${COLORS.goldHex}44`,
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 40px rgba(194, 150, 35, 0.08)',
          }}
        >
          {/* HTML5 Video Element */}
          <video
            ref={videoRef}
            src="/videos/promo_trailer.mp4"
            loop
            muted={isMuted}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onClick={togglePlay}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              cursor: 'pointer',
            }}
          />

          {/* Glowing Border overlay (animates slightly when playing) */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              border: isPlaying ? `2px solid ${COLORS.goldHex}44` : `1px solid ${COLORS.goldHex}22`,
              borderRadius: 20,
              pointerEvents: 'none',
              boxShadow: isPlaying ? `inset 0 0 30px rgba(194, 150, 35, 0.15)` : 'none',
              transition: 'all 0.5s ease',
            }}
          />

          {/* Floating Play Overlay when paused */}
          <AnimatePresence>
            {!isPlaying && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={togglePlay}
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(0, 0, 0, 0.4)',
                  backdropFilter: 'blur(4px)',
                  WebkitBackdropFilter: 'blur(4px)',
                  cursor: 'pointer',
                  zIndex: 2,
                }}
              >
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    background: GOLDEN_GRADIENT,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 40px rgba(232, 197, 71, 0.4)',
                    transform: 'scale(1)',
                    transition: 'transform 0.2s ease',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.08)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <Play size={32} color="#000" fill="#000" style={{ marginLeft: 6 }} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Floating Mute Hint (if playing, muted, and showMuteHint is true) */}
          <AnimatePresence>
            {isPlaying && isMuted && showMuteHint && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                onClick={toggleMute}
                style={{
                  position: 'absolute',
                  bottom: 80,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(10, 10, 12, 0.85)',
                  border: `1px solid ${COLORS.goldHex}55`,
                  padding: '10px 18px',
                  borderRadius: 20,
                  color: COLORS.goldLight,
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                  zIndex: 2,
                }}
              >
                <VolumeX size={14} /> Unmute for Cinematic Audio
              </motion.div>
            )}
          </AnimatePresence>

          {/* Controls Bar */}
          <AnimatePresence>
            {showControls && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                transition={{ duration: 0.25 }}
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 70%, transparent 100%)',
                  padding: '24px 20px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  zIndex: 3,
                }}
              >
                {/* Timeline slider row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 11, fontFamily: "'Inter', sans-serif", color: COLORS.textMuted, width: 35 }}>
                    {formatTime(currentTime)}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleSeek}
                    style={{
                      flex: 1,
                      accentColor: COLORS.goldHex,
                      cursor: 'pointer',
                      height: 4,
                      background: 'rgba(255,255,255,0.15)',
                      borderRadius: 2,
                      outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: 11, fontFamily: "'Inter', sans-serif", color: COLORS.textMuted, width: 35, textAlign: 'right' }}>
                    {formatTime(duration)}
                  </span>
                </div>

                {/* Buttons row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <button
                      onClick={togglePlay}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#fff',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'color 0.2s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = COLORS.goldLight}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#fff'}
                    >
                      {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                    </button>

                    <button
                      onClick={toggleMute}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#fff',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'color 0.2s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = COLORS.goldLight}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#fff'}
                    >
                      {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                    </button>
                  </div>

                  <button
                    onClick={handleFullscreen}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#fff',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'color 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = COLORS.goldLight}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#fff'}
                  >
                    <Maximize size={18} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
