import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { activateLicense } from '../services/supabase';
import { nativeAudio } from '../native/bridge';
import './LicenseActivationModal.css';

interface LicenseActivationModalProps {
  activeSettings: any;
  onActivationSuccess: (updatedSettings: any) => void;
}

export const LicenseActivationModal: React.FC<LicenseActivationModalProps> = ({
  activeSettings,
  onActivationSuccess,
}) => {
  const [licenseKey, setLicenseKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  const machineId = activeSettings?.machineId || 'UNKNOWN_DEVICE';
  const rawPlatform = activeSettings?.platform || '';
  const platform = (rawPlatform === 'macos' || rawPlatform === 'windows')
    ? rawPlatform
    : (navigator.userAgent.toLowerCase().includes('win') ? 'windows' : 'macos');
  const pluginVersion = activeSettings?.pluginVersion || 'v1.0.0';

  const formatKey = (val: string) => {
    // Automatically convert to uppercase, strip non-alphanumeric, and insert dashes
    const cleaned = val.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    
    // Keep flexible format — convert to uppercase for consistent display.
    // Keys follow format: VSTGOD-XXXX-XXXX-XXXX-XXXX
    return val.toUpperCase();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLicenseKey(formatKey(e.target.value));
    if (errorMsg) setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKey.trim()) {
      setErrorMsg('Please enter a license key.');
      triggerShake();
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const result = await activateLicense(licenseKey, machineId, platform, pluginVersion);

      if (result.success) {
        setIsSuccess(true);
        // Save the updated settings to C++ config via bridge
        const updatedSettings = {
          ...activeSettings,
          licenseActivated: true,
          licenseKey: licenseKey.trim(),
        };
        nativeAudio.saveSettings(updatedSettings);

        // Delay success callback slightly for the animation to complete
        setTimeout(() => {
          onActivationSuccess(updatedSettings);
        }, 1500);
      } else {
        setErrorMsg(result.message || 'Verification failed. Invalid license key.');
        triggerShake();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'A network error occurred. Please try again.');
      triggerShake();
    } finally {
      setIsLoading(false);
    }
  };

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  return (
    <div className="vg-license-overlay">
      <motion.div
        className="vg-license-card vg-glassify"
        initial={{ scale: 0.9, opacity: 0, y: 30 }}
        animate={{ 
          scale: 1, 
          opacity: 1, 
          y: 0,
          x: isShaking ? [0, -10, 10, -10, 10, -5, 5, 0] : 0
        }}
        transition={{ 
          type: 'spring', 
          stiffness: 300, 
          damping: 20,
          x: { duration: 0.5 }
        }}
      >
        {/* Ambient celestial gold orb */}
        <div className="vg-license-glow" />

        {/* Success Overlay */}
        <AnimatePresence>
          {isSuccess && (
            <motion.div 
              className="vg-license-success-screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="vg-success-seal">
                <svg viewBox="0 0 100 100" className="vg-success-svg">
                  <motion.circle 
                    cx="50" cy="50" r="40" 
                    stroke="var(--god-primary)" 
                    strokeWidth="3" 
                    fill="none"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                  <motion.path 
                    d="M30 50 L45 65 L70 35" 
                    stroke="var(--god-primary)" 
                    strokeWidth="4" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    fill="none"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.6, delay: 0.5, ease: 'easeOut' }}
                  />
                </svg>
              </div>
              <h2 className="vg-license-title success-text">REALM UNLOCKED</h2>
              <p className="vg-license-subtitle">Your spirit has been verified. Welcome to the God Realm.</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading Overlay */}
        <AnimatePresence>
          {isLoading && (
            <motion.div 
              className="vg-license-loading-screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="vg-alchemical-spinner">
                <div className="spinner-ring outer"></div>
                <div className="spinner-ring middle"></div>
                <div className="spinner-ring inner"></div>
                <span className="spinner-eye">👁️</span>
              </div>
              <p className="vg-loading-text">COMMUNING WITH THE SOVEREIGN VAULT...</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        <div className="vg-license-header">
          <div className="vg-sacred-seal-icon">🏛️</div>
          <h1 className="vg-license-title">ACTIVATE DIVINE REALM</h1>
          <p className="vg-license-subtitle">
            Enter your sacred license key to authorize this machine and unlock the complete VST synthesizer.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="vg-license-form">
          <div className={`vg-input-wrapper ${errorMsg ? 'has-error' : ''}`}>
            <label htmlFor="license-key-input" className="vg-input-label">SACRED KEY</label>
            <input
              id="license-key-input"
              type="text"
              className="vg-license-input"
              value={licenseKey}
              onChange={handleInputChange}
              placeholder="VSTGOD-XXXX-XXXX-XXXX-XXXX"
              disabled={isLoading || isSuccess}
              autoComplete="off"
              spellCheck="false"
              autoFocus
            />
            {errorMsg && (
              <motion.div 
                className="vg-license-error"
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
              >
                ⚠️ {errorMsg}
              </motion.div>
            )}
          </div>

          <button 
            type="submit" 
            className="vg-license-submit-btn"
            disabled={isLoading || isSuccess || !licenseKey.trim()}
          >
            <span className="btn-glow" />
            <span className="btn-text">CONJURE ACTIVATION</span>
          </button>
        </form>

        <div className="vg-license-footer">
          <div className="vg-license-meta">
            <span>PLATFORM: <strong>{platform.toUpperCase()}</strong></span>
            <span className="separator">•</span>
            <span>DEVICE ID: <strong>{machineId.substring(0, 12)}...</strong></span>
            <span className="separator">•</span>
            <span>VERSION: <strong>{pluginVersion}</strong></span>
          </div>
          <div className="vg-license-demo-note">
            Unactivated plugins run in Demo Mode with a periodic volume dip watermark.
          </div>
        </div>
      </motion.div>
    </div>
  );
};
