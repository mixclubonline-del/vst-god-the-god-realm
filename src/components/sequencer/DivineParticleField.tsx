/**
 * DivineParticleField — Ambient floating particles that create a
 * celestial atmosphere behind the sequencer. Pure CSS animation,
 * no canvas overhead. Particles drift upward like ascending souls.
 */
import React, { useMemo } from 'react';

interface DivineParticleFieldProps {
  /** Number of particles (default 20) */
  count?: number;
  /** Whether the sequencer is playing (intensifies particles) */
  isPlaying?: boolean;
}

interface ParticleConfig {
  id: number;
  left: string;
  size: number;
  duration: number;
  delay: number;
  hue: number;
  opacity: number;
}

export const DivineParticleField: React.FC<DivineParticleFieldProps> = ({
  count = 20,
  isPlaying = false,
}) => {
  const particles = useMemo<ParticleConfig[]>(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      size: 1 + Math.random() * 3,
      duration: 8 + Math.random() * 16,
      delay: Math.random() * 12,
      hue: [45, 270, 200, 320, 30][Math.floor(Math.random() * 5)], // gold, purple, cyan, magenta, amber
      opacity: 0.1 + Math.random() * 0.25,
    }));
  }, [count]);

  return (
    <div className={`divine-particles ${isPlaying ? 'divine-particles--active' : ''}`}>
      {particles.map(p => (
        <div
          key={p.id}
          className="divine-particles__orb"
          style={{
            left: p.left,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            backgroundColor: `hsla(${p.hue}, 80%, 70%, ${p.opacity})`,
            boxShadow: `0 0 ${p.size * 3}px hsla(${p.hue}, 80%, 60%, ${p.opacity * 0.5})`,
          }}
        />
      ))}
    </div>
  );
};
