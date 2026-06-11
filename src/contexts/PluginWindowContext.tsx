/**
 * PluginWindowContext.tsx — Floating Window State Manager
 * Manages open/close, z-order stacking, minimize, and position for all plugin windows.
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { PluginId } from '@/data/pluginRegistry';

export interface WindowState {
  instanceId: string;
  pluginId: PluginId;
  position: { x: number; y: number };
  zIndex: number;
  minimized: boolean;
}

interface PluginWindowContextValue {
  windows: WindowState[];
  openPlugin: (pluginId: PluginId) => string;
  closePlugin: (instanceId: string) => void;
  bringToFront: (instanceId: string) => void;
  minimizePlugin: (instanceId: string) => void;
  restorePlugin: (instanceId: string) => void;
  updatePosition: (instanceId: string, x: number, y: number) => void;
}

const PluginWindowContext = createContext<PluginWindowContextValue | null>(null);

export const usePluginWindows = (): PluginWindowContextValue => {
  const ctx = useContext(PluginWindowContext);
  if (!ctx) throw new Error('usePluginWindows must be used within PluginWindowProvider');
  return ctx;
};

let instanceCounter = 0;

export const PluginWindowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [windows, setWindows] = useState<WindowState[]>([]);
  const zCounter = useRef(100);

  const openPlugin = useCallback((pluginId: PluginId): string => {
    const instanceId = `plugin-${pluginId}-${++instanceCounter}`;
    zCounter.current += 1;

    // Cascade position based on how many windows are open
    const offset = (windows.length % 8) * 30;
    const newWindow: WindowState = {
      instanceId,
      pluginId,
      position: { x: 120 + offset, y: 80 + offset },
      zIndex: zCounter.current,
      minimized: false,
    };

    setWindows(prev => [...prev, newWindow]);
    return instanceId;
  }, [windows.length]);

  const closePlugin = useCallback((instanceId: string) => {
    setWindows(prev => prev.filter(w => w.instanceId !== instanceId));
  }, []);

  const bringToFront = useCallback((instanceId: string) => {
    zCounter.current += 1;
    setWindows(prev =>
      prev.map(w =>
        w.instanceId === instanceId
          ? { ...w, zIndex: zCounter.current }
          : w
      )
    );
  }, []);

  const minimizePlugin = useCallback((instanceId: string) => {
    setWindows(prev =>
      prev.map(w =>
        w.instanceId === instanceId
          ? { ...w, minimized: true }
          : w
      )
    );
  }, []);

  const restorePlugin = useCallback((instanceId: string) => {
    zCounter.current += 1;
    setWindows(prev =>
      prev.map(w =>
        w.instanceId === instanceId
          ? { ...w, minimized: false, zIndex: zCounter.current }
          : w
      )
    );
  }, []);

  const updatePosition = useCallback((instanceId: string, x: number, y: number) => {
    setWindows(prev =>
      prev.map(w =>
        w.instanceId === instanceId
          ? { ...w, position: { x, y } }
          : w
      )
    );
  }, []);

  return (
    <PluginWindowContext.Provider
      value={{ windows, openPlugin, closePlugin, bringToFront, minimizePlugin, restorePlugin, updatePosition }}
    >
      {children}
    </PluginWindowContext.Provider>
  );
};
