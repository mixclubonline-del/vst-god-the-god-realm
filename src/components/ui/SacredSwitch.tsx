import React from 'react';
import { motion } from 'framer-motion';
import './SacredSwitch.css';

interface SacredSwitchProps {
  isOn: boolean;
  onToggle: () => void;
  label?: string;
  size?: 'sm' | 'md';
  color?: string;
  variant?: 'power' | 'solo' | 'mute' | 'gem';
}

export const SacredSwitch: React.FC<SacredSwitchProps> = ({
  isOn,
  onToggle,
  label,
  size = 'md',
  color = 'var(--mixx-accent)',
  variant = 'gem'
}) => {
  return (
    <div className={`sacred-switch-container size-${size} variant-${variant}`}>
      {label && <span className="sacred-switch-label">{label}</span>}
      
      <motion.button
        className={`sacred-switch-housing ${isOn ? 'is-on' : 'is-off'}`}
        onClick={onToggle}
        whileTap={{ scale: 0.95 }}
        whileHover={{ scale: 1.05 }}
      >
        <div className="sacred-switch-machined-texture" />
        
        {/* The Gem / Light */}
        <motion.div 
          className="sacred-switch-indicator"
          animate={{ 
            backgroundColor: isOn ? color : '#1a1a1a',
            boxShadow: isOn 
              ? `0 0 15px ${color}, inset 0 0 5px rgba(255,255,255,0.5)` 
              : '0 0 0px transparent, inset 0 0 5px rgba(0,0,0,0.5)',
            scale: isOn ? 1 : 0.9
          }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        >
          {isOn && (
            <motion.div 
              className="sacred-switch-glow-core"
              animate={{ opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
        </motion.div>
        
        {/* Bezel */}
        <div className="sacred-switch-bezel" />
      </motion.button>
    </div>
  );
};
