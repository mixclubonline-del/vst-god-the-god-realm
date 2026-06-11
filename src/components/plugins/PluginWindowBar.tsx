/**
 * PluginWindowBar.tsx — Bottom Dock for Minimized Plugins
 * Shows minimized plugin pills + "Open Plugin" browser button.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePluginWindows } from '@/contexts/PluginWindowContext';
import { PLUGIN_REGISTRY, PLUGIN_LIST } from '@/data/pluginRegistry';
import type { PluginId } from '@/data/pluginRegistry';

export const PluginWindowBar: React.FC = () => {
  const { windows, restorePlugin, openPlugin, closePlugin } = usePluginWindows();
  const [browserOpen, setBrowserOpen] = useState(false);

  const minimized = windows.filter(w => w.minimized);

  return (
    <>
      <div className="fp-dock">
        {/* Minimized pills */}
        <AnimatePresence>
          {minimized.map(w => {
            const plugin = PLUGIN_REGISTRY[w.pluginId];
            return (
              <motion.button
                key={w.instanceId}
                className="fp-dock__pill"
                style={{ '--fp-accent': plugin.theme.primary } as React.CSSProperties}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => restorePlugin(w.instanceId)}
                onContextMenu={(e) => { e.preventDefault(); closePlugin(w.instanceId); }}
                title={`${plugin.name} — Click to restore, right-click to close`}
              >
                <span className="fp-dock__pill-icon">{plugin.icon}</span>
                <span className="fp-dock__pill-name">{plugin.name}</span>
              </motion.button>
            );
          })}
        </AnimatePresence>

        {/* Open Plugin Browser button */}
        <button
          className="fp-dock__add"
          onClick={() => setBrowserOpen(!browserOpen)}
          title="Open Plugin"
        >
          +
        </button>
      </div>

      {/* Plugin Browser Popover */}
      <AnimatePresence>
        {browserOpen && (
          <motion.div
            className="fp-browser"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            <div className="fp-browser__header">
              <span className="fp-browser__title">PLUGIN INSTRUMENTS</span>
              <button className="fp-browser__close" onClick={() => setBrowserOpen(false)}>✕</button>
            </div>
            <div className="fp-browser__grid">
              {PLUGIN_LIST.map(plugin => (
                <button
                  key={plugin.id}
                  className="fp-browser__item"
                  style={{ '--fp-accent': plugin.theme.primary } as React.CSSProperties}
                  onClick={() => {
                    openPlugin(plugin.id as PluginId);
                    setBrowserOpen(false);
                  }}
                >
                  <span className="fp-browser__item-icon">{plugin.icon}</span>
                  <span className="fp-browser__item-name">{plugin.name}</span>
                  <span className="fp-browser__item-desc">{plugin.description}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
