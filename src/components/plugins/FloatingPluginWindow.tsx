/**
 * FloatingPluginWindow.tsx — Draggable Plugin Shell
 * Uses framer-motion `drag` with Forged Obsidian machined surfaces + themed accent glow.
 */

import React, { useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence, useDragControls, useMotionValue } from 'framer-motion';
import { usePluginWindows } from '@/contexts/PluginWindowContext';
import { PLUGIN_REGISTRY } from '@/data/pluginRegistry';
import type { PluginId } from '@/data/pluginRegistry';

/* ── Instrument imports ─────────────────────────── */
import { EtherealPluck } from './instruments/EtherealPluck';
import { DivineTexture } from './instruments/DivineTexture';
import { UnderworldBass } from './instruments/UnderworldBass';
import { CelestialPad } from './instruments/CelestialPad';
import { MythicLead } from './instruments/MythicLead';

const INSTRUMENT_MAP: Record<PluginId, React.FC> = {
  'ethereal-pluck': EtherealPluck,
  'divine-texture': DivineTexture,
  'underworld-bass': UnderworldBass,
  'celestial-pad': CelestialPad,
  'mythic-lead': MythicLead,
};

interface FloatingPluginWindowProps {
  instanceId: string;
  pluginId: PluginId;
  position: { x: number; y: number };
  zIndex: number;
}

export const FloatingPluginWindow: React.FC<FloatingPluginWindowProps> = ({
  instanceId,
  pluginId,
  position,
  zIndex,
}) => {
  const { windows, closePlugin, bringToFront, minimizePlugin, updatePosition } = usePluginWindows();
  const plugin = PLUGIN_REGISTRY[pluginId];
  const Instrument = INSTRUMENT_MAP[pluginId];

  // Motion values for relative drag tracking
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const dragControls = useDragControls();

  // Determine if this window is currently focused (top-most in z-index)
  const isFocused = useMemo(() => {
    const visibleWindows = windows.filter(w => !w.minimized);
    if (visibleWindows.length <= 1) return true;
    const maxZ = Math.max(...visibleWindows.map(w => w.zIndex));
    return zIndex === maxZ;
  }, [windows, zIndex]);

  const handleDragEnd = useCallback(() => {
    const deltaX = x.get();
    const deltaY = y.get();
    updatePosition(instanceId, position.x + deltaX, position.y + deltaY);
    // Reset transient motion offsets after updating absolute left/top
    x.set(0);
    y.set(0);
  }, [instanceId, position, updatePosition, x, y]);

  const handleTitleBarDoubleClick = useCallback(() => {
    minimizePlugin(instanceId);
  }, [instanceId, minimizePlugin]);

  if (!plugin || !Instrument) return null;

  return (
    <motion.div
      className={`fp-window ${isFocused ? 'fp-window--active' : 'fp-window--inactive'}`}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        width: plugin.defaultSize.w,
        zIndex,
        x,
        y,
        '--fp-accent': plugin.theme.primary,
        '--fp-accent-secondary': plugin.theme.secondary,
        '--fp-glow': plugin.theme.glowHsl,
      } as any}
      initial={{ opacity: 0, scale: 0.85, y: 30 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: 30 }}
      transition={{ type: 'spring', bounce: 0.12, duration: 0.4 }}
      drag
      dragControls={dragControls}
      dragMomentum={false}
      dragListener={false}
      onDragEnd={handleDragEnd}
      onPointerDown={() => bringToFront(instanceId)}
    >
      {/* ── Title Bar (Drag Handle) ────────────────── */}
      <motion.div 
        className="fp-titlebar" 
        style={{ cursor: 'grab' }}
        onPointerDown={(e) => {
          dragControls.start(e);
          bringToFront(instanceId);
        }}
        onDoubleClick={handleTitleBarDoubleClick}
      >
        <div className="fp-titlebar__dots" onPointerDown={(e) => e.stopPropagation()}>
          <button
            className="fp-titlebar__dot fp-titlebar__dot--close"
            onClick={() => closePlugin(instanceId)}
            title="Close"
          />
          <button
            className="fp-titlebar__dot fp-titlebar__dot--min"
            onClick={() => minimizePlugin(instanceId)}
            title="Minimize"
          />
          <span className="fp-titlebar__dot fp-titlebar__dot--max" />
        </div>

        <div className="fp-titlebar__name">
          <span className="fp-titlebar__icon">{plugin.icon}</span>
          <span className="fp-titlebar__text">{plugin.name.toUpperCase()}</span>
        </div>

        <span className="fp-titlebar__category">{plugin.category}</span>
      </motion.div>

      {/* ── Plugin Body ────────────────────────────── */}
      <div className="fp-body">
        {/* Bespoke texture overlay */}
        <div
          className="fp-body__texture"
          style={{ backgroundImage: `url(${plugin.texture})` }}
        />
        <Instrument />
      </div>
    </motion.div>
  );
};

/* ── Window Layer (renders all open windows) ────── */
export const PluginWindowLayer: React.FC = () => {
  const { windows, closePlugin } = usePluginWindows();

  // Escape key to close the topmost active window
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const visibleWindows = windows.filter(w => !w.minimized);
        if (visibleWindows.length > 0) {
          // Find topmost (max zIndex) window
          const topWindow = visibleWindows.reduce((prev, current) => 
            (prev.zIndex > current.zIndex) ? prev : current
          );
          closePlugin(topWindow.instanceId);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [windows, closePlugin]);

  return (
    <AnimatePresence>
      {windows
        .filter(w => !w.minimized)
        .map(w => (
          <FloatingPluginWindow
            key={w.instanceId}
            instanceId={w.instanceId}
            pluginId={w.pluginId}
            position={w.position}
            zIndex={w.zIndex}
          />
        ))}
    </AnimatePresence>
  );
};
