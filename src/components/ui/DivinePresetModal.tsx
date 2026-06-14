import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, User, Tag, ChevronDown } from 'lucide-react';
import { DivineSlider } from './DivineSlider';
import './DivinePresetModal.css';

interface DivinePresetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, type: string, tags: string[], energyLevel: number) => void;
  defaultName?: string;
  defaultAuthor?: string;
}

const CATEGORIES = ['BASS', 'LEAD', 'PAD', 'KEYS', 'FX', 'ARP', 'TEXTURE', 'DRUMS'];

export const DivinePresetModal: React.FC<DivinePresetModalProps> = ({
  isOpen,
  onClose,
  onSave,
  defaultName = '',
  defaultAuthor = 'User'
}) => {
  const [name, setName] = useState(defaultName);
  const [author, setAuthor] = useState(defaultAuthor);
  const [type, setType] = useState('LEAD');
  const [tagsInput, setTagsInput] = useState('User, Custom');
  const [energyLevel, setEnergyLevel] = useState(60);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    onSave(name.trim(), type, tags, energyLevel);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="divine-modal-overlay">
          {/* Backdrop Blur */}
          <motion.div
            className="divine-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal Container */}
          <motion.div
            className="divine-modal-container glass-panel"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 350, damping: 26 }}
          >
            <div className="divine-modal-glow" />

            {/* Header */}
            <div className="divine-modal-header">
              <div className="flex items-center gap-2">
                <Sparkles className="text-yellow-500 w-4 h-4 animate-pulse" />
                <span className="divine-modal-badge">SACRED ARCHIVE</span>
              </div>
              <button className="divine-modal-close" onClick={onClose} aria-label="Close">
                <X size={16} />
              </button>
            </div>

            <div className="divine-modal-title-wrap">
              <h2 className="divine-modal-title">ASCEND NEW PRESET</h2>
              <p className="divine-modal-subtitle">Encode current sonic settings into the eternal preset vault</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="divine-modal-form">
              {/* Preset Name */}
              <div className="divine-form-group">
                <label className="divine-form-label">PRESET NAME</label>
                <div className="divine-input-wrapper">
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="E.g., Zeus' Fury"
                    className="divine-input"
                    maxLength={32}
                  />
                  <div className="divine-input-border" />
                </div>
              </div>

              <div className="divine-form-grid">
                {/* Author */}
                <div className="divine-form-group">
                  <label className="divine-form-label">AUTHOR</label>
                  <div className="divine-input-wrapper">
                    <User className="divine-input-icon text-white/30" size={12} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="text"
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      placeholder="User"
                      className="divine-input divine-input--icon"
                      maxLength={20}
                      style={{ paddingLeft: '32px' }}
                    />
                    <div className="divine-input-border" />
                  </div>
                </div>

                {/* Category Dropdown */}
                <div className="divine-form-group relative">
                  <label className="divine-form-label">CATEGORY</label>
                  <button
                    type="button"
                    className="divine-select-trigger divine-input flex justify-between items-center text-left"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                  >
                    <span>{type}</span>
                    <span className="text-white/30 text-xs">▼</span>
                  </button>
                  <div className="divine-input-border" />

                  {/* Dropdown Options */}
                  <AnimatePresence>
                    {dropdownOpen && (
                      <>
                        <div className="divine-select-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={() => setDropdownOpen(false)} />
                        <motion.div
                          className="divine-select-dropdown glass-panel"
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.15 }}
                        >
                          {CATEGORIES.map((cat) => (
                            <button
                              key={cat}
                              type="button"
                              className={`divine-select-option ${type === cat ? 'active' : ''}`}
                              onClick={() => {
                                setType(cat);
                                setDropdownOpen(false);
                              }}
                            >
                              {cat}
                            </button>
                          ))}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Tags */}
              <div className="divine-form-group">
                <label className="divine-form-label">TAGS (COMMA SEPARATED)</label>
                <div className="divine-input-wrapper">
                  <Tag className="divine-input-icon text-white/30" size={12} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="User, Custom"
                    className="divine-input divine-input--icon"
                    style={{ paddingLeft: '32px' }}
                  />
                  <div className="divine-input-border" />
                </div>
              </div>

              {/* Energy Level (DivineSlider) */}
              <div className="divine-form-group divine-slider-row">
                <div className="flex justify-between items-center mb-2">
                  <label className="divine-form-label mb-0">ENERGY LEVEL (RESONANCE)</label>
                  <span className="divine-slider-value">{energyLevel}%</span>
                </div>
                <div className="divine-modal-slider-wrap">
                  <DivineSlider
                    min={0}
                    max={100}
                    value={energyLevel}
                    onChange={setEnergyLevel}
                    color="#FFD700"
                    size="sm"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="divine-modal-actions">
                <button type="button" className="divine-btn divine-btn--cancel" onClick={onClose}>
                  CANCEL
                </button>
                <button type="submit" className="divine-btn divine-btn--submit" disabled={!name.trim()}>
                  ASCEND PRESET
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
