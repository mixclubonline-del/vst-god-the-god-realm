import React from 'react';
import { motion } from 'framer-motion';
import './CelestialTabs.css';

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface CelestialTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  color?: string;
}

export const CelestialTabs: React.FC<CelestialTabsProps> = ({
  tabs,
  activeTab,
  onTabChange,
  color = 'var(--mixx-accent)'
}) => {
  return (
    <div className="celestial-tabs-container">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            className={`celestial-tab ${isActive ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.icon && <span className="tab-icon">{tab.icon}</span>}
            <span className="tab-label">{tab.label}</span>
            
            {isActive && (
              <motion.div
                layoutId="celestial-active-glow"
                className="active-glow-underline"
                style={{ backgroundColor: color, boxShadow: `0 0 15px ${color}` }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            
            {/* Background Hover Aura */}
            <div className="tab-hover-aura" />
          </button>
        );
      })}
    </div>
  );
};
