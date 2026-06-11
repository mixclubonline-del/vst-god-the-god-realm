/**
 * GodNav.tsx — Floating god section navigator
 *
 * A vertical side-rail of god icons that shows which
 * god section is currently in view. Click to jump.
 * Uses IntersectionObserver for active detection.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type Ease4 = [number, number, number, number];
const EASE_OUT_EXPO: Ease4 = [0.22, 1, 0.36, 1];

interface GodNavItem {
  id: string;
  icon: string;
  name: string;
  color: string;
}

const GOD_NAV: GodNavItem[] = [
  { id: 'olympus', icon: '🏛', name: 'Olympus', color: '#f8c85a' },
  { id: 'hades',   icon: '🔥', name: 'Hades',   color: '#d64b35' },
  { id: 'zeus',    icon: '⚡', name: 'Zeus',    color: '#4ecbff' },
  { id: 'athena',  icon: '🦉', name: 'Athena',  color: '#9d65ff' },
  { id: 'poseidon',icon: '🌊', name: 'Poseidon',color: '#29d7e8' },
  { id: 'titan',   icon: '⛰', name: 'Titan',   color: '#ff9f2f' },
  { id: 'apollo',  icon: '☀', name: 'Apollo',  color: '#ffd45a' },
  { id: 'chronos', icon: '⏳', name: 'Chronos', color: '#7cff9d' },
];

export default function GodNav() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    const godsSectionEl = document.getElementById('gods');
    if (!godsSectionEl) return;

    // Show/hide based on whether we're in the gods section
    const sectionObserver = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.05 },
    );
    sectionObserver.observe(godsSectionEl);

    // Track which god is active
    const godObservers: IntersectionObserver[] = [];
    GOD_NAV.forEach((god) => {
      const el = document.getElementById(god.id);
      if (!el) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveId(god.id);
        },
        { threshold: 0.4 },
      );
      observer.observe(el);
      godObservers.push(observer);
    });

    return () => {
      sectionObserver.disconnect();
      godObservers.forEach((o) => o.disconnect());
    };
  }, []);

  const scrollToGod = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.nav
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 30 }}
          transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
          aria-label="God section navigation"
          className="god-nav-rail"
          style={{
            position: 'fixed',
            right: 'clamp(12px, 2vw, 24px)',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 90,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            padding: '10px 6px',
            background: 'rgba(5,5,7,0.6)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.04)',
            borderRadius: 16,
          }}
        >
          {GOD_NAV.map((god) => {
            const isActive = activeId === god.id;
            const isHovered = hoveredId === god.id;
            return (
              <button
                key={god.id}
                onClick={() => scrollToGod(god.id)}
                onMouseEnter={() => setHoveredId(god.id)}
                onMouseLeave={() => setHoveredId(null)}
                aria-label={`Jump to ${god.name}`}
                aria-current={isActive ? 'true' : undefined}
                style={{
                  position: 'relative',
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: 'none',
                  background: isActive
                    ? `color-mix(in srgb, ${god.color} 20%, transparent)`
                    : 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.85rem',
                  transition: 'all 0.3s ease',
                  boxShadow: isActive
                    ? `0 0 12px ${god.color}33, inset 0 0 8px ${god.color}15`
                    : 'none',
                  transform: isActive ? 'scale(1.15)' : isHovered ? 'scale(1.08)' : 'scale(1)',
                }}
              >
                {god.icon}
                {/* Active dot indicator */}
                {isActive && (
                  <motion.div
                    layoutId="godNavDot"
                    style={{
                      position: 'absolute',
                      left: -3,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 3,
                      height: 14,
                      borderRadius: 2,
                      background: god.color,
                      boxShadow: `0 0 8px ${god.color}`,
                    }}
                    transition={{ type: 'spring' as const, stiffness: 300, damping: 30 }}
                  />
                )}
                {/* Tooltip */}
                <AnimatePresence>
                  {isHovered && (
                    <motion.span
                      initial={{ opacity: 0, x: 5 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 5 }}
                      transition={{ duration: 0.2 }}
                      style={{
                        position: 'absolute',
                        right: 'calc(100% + 10px)',
                        whiteSpace: 'nowrap',
                        fontFamily: "'Inter', system-ui, sans-serif",
                        fontSize: '0.6rem',
                        fontWeight: 600,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase' as const,
                        color: god.color,
                        background: 'rgba(5,5,7,0.85)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: `1px solid ${god.color}22`,
                        pointerEvents: 'none',
                      }}
                    >
                      {god.name}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            );
          })}
        </motion.nav>
      )}
    </AnimatePresence>
  );
}
