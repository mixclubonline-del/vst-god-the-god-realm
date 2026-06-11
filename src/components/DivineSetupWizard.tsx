/**
 * DivineSetupWizard — The Threshold of Ascension
 * ─────────────────────────────────────────────
 * First-run interactive setup wizard that configures:
 * 1. Sample library path (via native JUCE directory chooser)
 * 2. Performance & Audio Preferences
 * 3. Theme aesthetics
 *
 * "Every temple requires a foundation."
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { nativeAudio } from '../native/bridge';
import '../styles/DivineSetupWizard.css';

interface DivineSetupWizardProps {
  onComplete: (settings: any) => void;
  initialSettings?: any;
}

export const DivineSetupWizard: React.FC<DivineSetupWizardProps> = ({ onComplete, initialSettings }) => {
  const [step, setStep] = useState(0);
  const [libraryPath, setLibraryPath] = useState(initialSettings?.sampleLibraryPath || '');
  const [oversampling, setOversampling] = useState<'1x' | '2x' | '4x'>(initialSettings?.oversampling || '1x');
  const [animationsEnabled, setAnimationsEnabled] = useState<boolean>(initialSettings?.animationsEnabled !== false);
  const [theme, setTheme] = useState<'divine-gold' | 'midnight-violet' | 'obsidian'>(initialSettings?.theme || 'divine-gold');
  const [browseError, setBrowseError] = useState('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Subscribe to native folder selection updates
  useEffect(() => {
    const unsubscribe = nativeAudio.subscribePath((path) => {
      if (path) {
        setLibraryPath(path);
        setBrowseError('');
      }
    });
    return unsubscribe;
  }, []);

  // Sacred geometry background animation
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const handleResize = () => {
      if (!canvasRef.current) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', handleResize);

    const draw = (time: number) => {
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const baseRadius = Math.min(width, height) * 0.35;
      const rotation = time * 0.00015;
      const breathe = 1 + Math.sin(time * 0.0008) * 0.02;

      ctx.strokeStyle = 'rgba(255, 215, 0, 0.08)';
      ctx.lineWidth = 0.5;

      // Draw central Seed of Life pattern
      const petalCount = 6;
      const flowerRadius = baseRadius * 0.5 * breathe;
      
      ctx.beginPath();
      ctx.arc(cx, cy, flowerRadius, 0, Math.PI * 2);
      ctx.stroke();

      for (let i = 0; i < petalCount; i++) {
        const angle = (i / petalCount) * Math.PI * 2 + rotation;
        const px = cx + Math.cos(angle) * flowerRadius;
        const py = cy + Math.sin(angle) * flowerRadius;
        ctx.beginPath();
        ctx.arc(px, py, flowerRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw outer Hexagram
      ctx.strokeStyle = 'rgba(179, 136, 255, 0.05)';
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + rotation * 0.5;
        const hx = cx + Math.cos(angle) * baseRadius * breathe;
        const hy = cy + Math.sin(angle) * baseRadius * breathe;
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.stroke();

      // Pulsing outer orbit ring
      const pulseRadius = baseRadius * (0.8 + ((time * 0.0003) % 0.4));
      ctx.strokeStyle = `rgba(255, 215, 0, ${0.1 * (1 - ((time * 0.0003) % 0.4))})`;
      ctx.beginPath();
      ctx.arc(cx, cy, pulseRadius, 0, Math.PI * 2);
      ctx.stroke();

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleBrowse = () => {
    nativeAudio.browseLibraryPath();
  };

  const handleNext = () => {
    if (step === 1 && !libraryPath) {
      setBrowseError('You must select a library path to proceed.');
      return;
    }
    setStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setStep((prev) => Math.max(0, prev - 1));
  };

  const handleFinish = () => {
    // Compile settings payload
    const settingsPayload = {
      ...initialSettings,
      sampleLibraryPath: libraryPath,
      oversampling,
      animationsEnabled,
      theme,
    };

    // Save to native configuration
    nativeAudio.saveSettings(settingsPayload);
    
    // Complete wizard callback
    onComplete(settingsPayload);
  };

  const slideVariants = {
    initial: { opacity: 0, x: 50 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -50 }
  };

  return (
    <div className="divine-wizard-overlay">
      <canvas ref={canvasRef} className="divine-wizard-canvas" />

      <div className="divine-wizard-container">
        <div className="divine-wizard-header">
          <div className="divine-wizard-logo">
            <span className="divine-wizard-logo-vst">VST</span>
            <span className="divine-wizard-logo-god">GOD</span>
          </div>

          <div className="divine-wizard-steps">
            {[0, 1, 2, 3].map((s) => (
              <div
                key={s}
                className={`divine-wizard-step-dot ${step === s ? 'active' : ''} ${
                  step > s ? 'completed' : ''
                }`}
              />
            ))}
          </div>
        </div>

        <div className="divine-wizard-content">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="welcome"
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.3 }}
                className="divine-wizard-slide"
              >
                <h2 className="divine-wizard-title">Welcome to the God Realm</h2>
                <p className="divine-wizard-desc">
                  You are about to enter the celestial forge of VST GOD. Before the divine synthesizer can manifest its full glory, we must configure a few vital parameters of your sonic temple.
                </p>
                <p className="divine-wizard-desc">
                  This short guide will assist you in mapping your high-performance sample library path and customizing your interface defaults.
                </p>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="path"
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.3 }}
                className="divine-wizard-slide"
              >
                <h2 className="divine-wizard-title">Locate Sample Library</h2>
                <p className="divine-wizard-desc">
                  Select the directory where your VST GOD multisampled relics and celestial loops will be stored. A high-speed SSD is recommended for latency-free sample streaming.
                </p>
                
                <div className="divine-wizard-input-container">
                  <div className="divine-wizard-path-display">
                    {libraryPath || 'No folder selected'}
                  </div>
                  
                  {browseError && (
                    <span style={{ color: 'var(--god-danger)', fontSize: '12px' }}>
                      {browseError}
                    </span>
                  )}
                  
                  <button 
                    className="divine-wizard-browse-btn" 
                    onClick={handleBrowse}
                    type="button"
                  >
                    Browse Folder...
                  </button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="config"
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.3 }}
                className="divine-wizard-slide"
              >
                <h2 className="divine-wizard-title">Celestial Preferences</h2>
                <p className="divine-wizard-desc">
                  Calibrate your default engine and visual aesthetics. These preferences can be adjusted at any time in the settings menu.
                </p>

                <div className="divine-wizard-options-grid">
                  <div className="divine-wizard-option-row">
                    <div className="divine-wizard-option-info">
                      <span className="divine-wizard-option-label">Audio Oversampling</span>
                      <span className="divine-wizard-option-desc">Anti-aliasing quality for high-frequency transients</span>
                    </div>
                    <select
                      className="divine-wizard-select"
                      value={oversampling}
                      onChange={(e) => setOversampling(e.target.value as any)}
                    >
                      <option value="1x">1x (Standard)</option>
                      <option value="2x">2x (High Definition)</option>
                      <option value="4x">4x (Supreme Divine)</option>
                    </select>
                  </div>

                  <div className="divine-wizard-option-row">
                    <div className="divine-wizard-option-info">
                      <span className="divine-wizard-option-label">Aesthetic Animations</span>
                      <span className="divine-wizard-option-desc">Enable GPU-accelerated particle systems & glows</span>
                    </div>
                    <label className="divine-wizard-toggle">
                      <input
                        type="checkbox"
                        checked={animationsEnabled}
                        onChange={(e) => setAnimationsEnabled(e.target.checked)}
                      />
                      <span className="divine-wizard-toggle-slider" />
                    </label>
                  </div>

                  <div className="divine-wizard-option-row">
                    <div className="divine-wizard-option-info">
                      <span className="divine-wizard-option-label">Visual Theme</span>
                      <span className="divine-wizard-option-desc">Choose your cosmic aura</span>
                    </div>
                    <select
                      className="divine-wizard-select"
                      value={theme}
                      onChange={(e) => setTheme(e.target.value as any)}
                    >
                      <option value="divine-gold">Celestial Gold</option>
                      <option value="midnight-violet">Midnight Violet</option>
                      <option value="obsidian">Obsidian Abyss</option>
                    </select>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="complete"
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.3 }}
                className="divine-wizard-slide divine-wizard-celebration"
              >
                <div className="divine-wizard-sigil">🔱</div>
                <h2 className="divine-wizard-title">The Portal is Formed</h2>
                <p className="divine-wizard-desc">
                  Your temple is configured. The sacred connection with your C++ engine has been established, and your preferences have been written to config.json.
                </p>
                <p className="divine-wizard-desc" style={{ fontStyle: 'italic', color: 'var(--god-primary)' }}>
                  "Let the celestial forging begin."
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="divine-wizard-footer">
          <button
            className="divine-wizard-btn"
            onClick={handleBack}
            disabled={step === 0}
            type="button"
          >
            Back
          </button>

          {step < 3 ? (
            <button
              className="divine-wizard-btn divine-wizard-btn-primary"
              onClick={handleNext}
              type="button"
            >
              Continue
            </button>
          ) : (
            <button
              className="divine-wizard-btn divine-wizard-btn-primary"
              onClick={handleFinish}
              type="button"
            >
              Enter the Portal
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
