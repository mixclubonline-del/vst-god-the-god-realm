import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

interface GlassPanelProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  intensity?: 'low' | 'medium' | 'high';
  className?: string;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({ 
  children, 
  intensity = 'medium', 
  className = '',
  ...props 
}) => {
  const blurs = {
    low: 'blur(8px)',
    medium: 'blur(16px)',
    high: 'blur(32px)',
  };

  return (
    <motion.div
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-2xl ${className}`}
      style={{ backdropFilter: blurs[intensity], ...props.style }}
      {...props}
    >
      {/* Subtle Inner Glow */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-white/5 to-transparent" />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
};

interface GlassButtonProps extends HTMLMotionProps<"button"> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const GlassButton: React.FC<GlassButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}) => {
  const variants = {
    primary: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30 hover:border-yellow-500/50',
    secondary: 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10 hover:border-white/20',
    ghost: 'bg-transparent text-white/60 border-transparent hover:text-white hover:bg-white/5',
    danger: 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30 hover:border-red-500/50',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs font-medium',
    md: 'px-5 py-2 text-sm font-semibold',
    lg: 'px-8 py-3 text-base font-bold',
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`rounded-xl border transition-all duration-200 flex items-center justify-center gap-2 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
};

export const GlassInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => {
  return (
    <input
      {...props}
      className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-yellow-500/50 focus:bg-white/10 transition-all ${props.className || ''}`}
    />
  );
};
