import React from 'react';
import { motion, useTransform, useSpring, useMotionTemplate } from 'framer-motion';

interface SacredGeometryBackgroundProps {
  energy?: number; // 0 to 1
  activeTab: string;
}

/**
 * SacredGeometryBackground — A dynamic, mathematical background layer.
 * Changes complexity and rotation based on the current tab and audio energy.
 */
export const SacredGeometryBackground: React.FC<SacredGeometryBackgroundProps> = ({
  energy,
  activeTab
}) => {
  const safeEnergy = energy === undefined || isNaN(energy) ? 0 : energy;
  const springEnergy = useSpring(safeEnergy, { stiffness: 100, damping: 30 });
  
  // Transform energy into visual parameters
  const opacity = useTransform(springEnergy, [0, 1], [0.03, 0.15]);
  const scale = useTransform(springEnergy, [0, 1], [1, 1.05]);
  const blur = useTransform(springEnergy, [0, 1], [2, 0]);
  const filterTemplate = useMotionTemplate`blur(${blur}px)`;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
      {/* Metatron's Cube Style Pattern */}
      <motion.svg
        viewBox="0 0 100 100"
        style={{
          width: '100vw',
          height: '100vh',
          opacity,
          scale,
          filter: filterTemplate,
        }}
        initial={false}
      >
        <defs>
          <radialGradient id="sacred-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--god-primary)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>

        <motion.g
          animate={{ 
            rotate: activeTab === 'Performance' ? 360 : -360 
          }}
          transition={{ 
            duration: activeTab === 'Performance' ? 40 : 120, 
            repeat: Infinity, 
            ease: "linear" 
          }}
          style={{ originX: '50px', originY: '50px' }}
        >
          {/* Hexagonal Grid */}
          {[0, 60, 120, 180, 240, 300].map((angle, i) => (
            <motion.circle
              key={i}
              cx={50 + Math.cos((angle * Math.PI) / 180) * 20}
              cy={50 + Math.sin((angle * Math.PI) / 180) * 20}
              r="20"
              fill="none"
              stroke="var(--god-primary)"
              strokeWidth="0.1"
            />
          ))}
          <circle cx="50" cy="50" r="20" fill="none" stroke="var(--god-primary)" strokeWidth="0.2" />
          
          {/* Inner Connecting Lines */}
          <path
            d="M 50 10 L 84.6 30 L 84.6 70 L 50 90 L 15.4 70 L 15.4 30 Z"
            fill="none"
            stroke="var(--god-secondary)"
            strokeWidth="0.15"
            strokeDasharray="2 2"
          />
        </motion.g>
      </motion.svg>

      {/* Environmental Particles */}
      <div 
        className="absolute inset-0"
        style={{
            backgroundImage: 'radial-gradient(circle at 50% 50%, transparent 0%, rgba(0,0,0,0.4) 100%)',
            mixBlendMode: 'multiply'
        }}
      />
    </div>
  );
};
