import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { trackDownloadEvent } from '../services/supabase';
import './ReleaseNotesModal.css';

interface ReleaseNotesModalProps {
  release: any;
  onClose: () => void;
  activeSettings: any;
}

export const ReleaseNotesModal: React.FC<ReleaseNotesModalProps> = ({
  release,
  onClose,
  activeSettings,
}) => {
  const [downloadingFormat, setDownloadingFormat] = useState<string | null>(null);

  const version = release?.version || 'v1.0.0';
  const macosVst3Url = release?.macos_vst3_path;
  const macosAuUrl = release?.macos_au_path;
  const macosStandaloneUrl = release?.macos_standalone_path;
  const windowsVst3Url = release?.windows_vst3_path;

  // Safely parse release notes
  let notes: { features?: string[]; fixes?: string[] } = {};
  try {
    if (release?.release_notes) {
      notes = typeof release.release_notes === 'string' 
        ? JSON.parse(release.release_notes) 
        : release.release_notes;
    }
  } catch (e) {
    console.error('Failed to parse release notes:', e);
  }

  const handleDownload = async (
    format: 'vst3' | 'au' | 'standalone',
    platform: 'macos' | 'windows',
    url: string
  ) => {
    if (!url) return;
    setDownloadingFormat(format);
    
    try {
      // Log the download event to Supabase telemetry
      await trackDownloadEvent(version, platform, format, activeSettings?.licenseKey);
      
      // Open the URL in a new window or trigger download
      window.open(url, '_blank');
    } catch (err) {
      console.error('Download tracking failed:', err);
      window.open(url, '_blank');
    } finally {
      setTimeout(() => setDownloadingFormat(null), 1000);
    }
  };

  return (
    <div className="vg-update-overlay">
      <motion.div
        className="vg-update-card vg-glassify"
        initial={{ scale: 0.9, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 30 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        <div className="vg-update-glow" />

        <div className="vg-update-header">
          <div className="vg-update-badge">NEW REVELATION</div>
          <h1 className="vg-update-title">REALM UPGRADE</h1>
          <div className="vg-update-version">{version}</div>
        </div>

        {/* Release Notes List */}
        <div className="vg-update-scrollable">
          {notes.features && notes.features.length > 0 && (
            <div className="vg-update-section">
              <h3 className="section-title">🔮 SACRED FEATURES</h3>
              <ul className="notes-list">
                {notes.features.map((item, idx) => (
                  <li key={idx} className="note-item feature">
                    <span className="bullet">⚡</span>
                    <span className="text">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {notes.fixes && notes.fixes.length > 0 && (
            <div className="vg-update-section">
              <h3 className="section-title">🛡️ RESOLVED ABERRATIONS</h3>
              <ul className="notes-list">
                {notes.fixes.map((item, idx) => (
                  <li key={idx} className="note-item fix">
                    <span className="bullet">🔸</span>
                    <span className="text">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!notes.features && !notes.fixes && (
            <p className="no-notes-text">
              {release?.release_notes || 'No release details provided.'}
            </p>
          )}
        </div>

        {/* Download Actions */}
        <div className="vg-download-actions">
          <h4 className="actions-title">DOWNLOAD INSTALLER</h4>
          
          <div className="download-grid">
            {/* macOS Options */}
            <div className="platform-group">
              <div className="platform-header">🍏 macOS</div>
              <div className="button-group">
                {macosVst3Url && (
                  <button
                    className="vg-download-btn"
                    onClick={() => handleDownload('vst3', 'macos', macosVst3Url)}
                    disabled={downloadingFormat !== null}
                  >
                    VST3
                  </button>
                )}
                {macosAuUrl && (
                  <button
                    className="vg-download-btn"
                    onClick={() => handleDownload('au', 'macos', macosAuUrl)}
                    disabled={downloadingFormat !== null}
                  >
                    AU
                  </button>
                )}
                {macosStandaloneUrl && (
                  <button
                    className="vg-download-btn"
                    onClick={() => handleDownload('standalone', 'macos', macosStandaloneUrl)}
                    disabled={downloadingFormat !== null}
                  >
                    APP
                  </button>
                )}
              </div>
            </div>

            {/* Windows Options */}
            {windowsVst3Url && (
              <div className="platform-group">
                <div className="platform-header">🏁 WINDOWS</div>
                <div className="button-group">
                  <button
                    className="vg-download-btn"
                    onClick={() => handleDownload('vst3', 'windows', windowsVst3Url)}
                    disabled={downloadingFormat !== null}
                  >
                    VST3 (MSI)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Close Button */}
        <button className="vg-update-close-btn" onClick={onClose}>
          RETURN TO REALM
        </button>
      </motion.div>
    </div>
  );
};
