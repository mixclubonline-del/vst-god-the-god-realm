/**
 * SessionSealDrawer.tsx — Full Realm Session Persistence UI
 * 
 * Slide-in drawer for saving, loading, importing, and exporting
 * full-realm session snapshots.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  realmSessionManager,
  type SessionMeta,
} from '../services/RealmSessionManager';
import './SessionSealDrawer.css';

interface SessionSealDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeSession: string | null;
  onSave: (name: string) => Promise<void>;
  onLoad: (name: string) => Promise<void>;
}

export const SessionSealDrawer: React.FC<SessionSealDrawerProps> = ({
  isOpen,
  onClose,
  activeSession,
  onSave,
  onLoad,
}) => {
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [saveName, setSaveName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  // Load session list
  const refreshList = useCallback(async () => {
    const list = await realmSessionManager.listSessions();
    setSessions(list);
  }, []);

  useEffect(() => {
    if (isOpen) refreshList();
  }, [isOpen, refreshList]);

  // Save handler
  const handleSave = useCallback(async () => {
    const name = saveName.trim();
    if (!name) return;
    setIsSaving(true);
    try {
      await onSave(name);
      setSaveName('');
      await refreshList();
      setFlash(`🔱 Session "${name}" sealed`);
      setTimeout(() => setFlash(null), 2500);
    } finally {
      setIsSaving(false);
    }
  }, [saveName, onSave, refreshList]);

  // Load handler
  const handleLoad = useCallback(async (name: string) => {
    await onLoad(name);
    await refreshList();
    onClose();
  }, [onLoad, refreshList, onClose]);

  // Delete handler
  const handleDelete = useCallback(async (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete session "${name}"?`)) return;
    await realmSessionManager.deleteSession(name);
    await refreshList();
  }, [refreshList]);

  // Export handler
  const handleExport = useCallback(async (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await realmSessionManager.exportSession(name);
  }, []);

  // Import handler
  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.realm.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const imported = await realmSessionManager.importSession(file);
      if (imported) {
        await refreshList();
        setFlash(`🔱 Imported "${imported}"`);
        setTimeout(() => setFlash(null), 2500);
      }
    };
    input.click();
  }, [refreshList]);

  // Key handler
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter' && saveName.trim()) handleSave();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose, saveName, handleSave]);

  // Format timestamp
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHrs = diffMs / (1000 * 60 * 60);
    if (diffHrs < 1) return 'Just now';
    if (diffHrs < 24) return `${Math.floor(diffHrs)}h ago`;
    if (diffHrs < 48) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className="session-seal-overlay" onClick={onClose} />

      {/* Drawer */}
      <div className="session-seal-drawer">
        {/* Header */}
        <div className="session-seal__header">
          <div className="session-seal__title-group">
            <h2 className="session-seal__title">Session Seal</h2>
            <span className="session-seal__subtitle">Full Realm Persistence</span>
          </div>
          <button className="session-seal__close" onClick={onClose}>✕</button>
        </div>

        {/* Save Section */}
        <div className="session-seal__save">
          <input
            className="session-seal__save-input"
            placeholder="Name this realm session…"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            maxLength={40}
            autoFocus
          />
          <button
            className="session-seal__save-btn"
            onClick={handleSave}
            disabled={!saveName.trim() || isSaving}
          >
            {isSaving ? '⏳' : '🔱'} SEAL
          </button>
        </div>

        {/* Action Buttons */}
        <div className="session-seal__actions">
          <button className="session-seal__action-btn" onClick={handleImport}>
            📥 Import
          </button>
        </div>

        {/* Session List */}
        <div className="session-seal__list">
          <p className="session-seal__list-label">
            Saved Sessions ({sessions.length})
          </p>

          {sessions.length === 0 ? (
            <div className="session-seal__empty">
              <span className="session-seal__empty-icon">🔱</span>
              <span className="session-seal__empty-text">
                No sessions sealed yet
              </span>
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.name}
                className={`session-seal__card ${
                  activeSession === session.name ? 'session-seal__card--active' : ''
                }`}
                onClick={() => handleLoad(session.name)}
              >
                <div className="session-seal__card-icon">🔱</div>
                <div className="session-seal__card-info">
                  <div className="session-seal__card-name">{session.name}</div>
                  <div className="session-seal__card-meta">
                    <span className="session-seal__card-tag">
                      {session.bpm}BPM
                    </span>
                    <span className="session-seal__card-tag">
                      {session.trackCount}T
                    </span>
                    <span className="session-seal__card-tag">
                      {session.padCount}P
                    </span>
                    <span className="session-seal__card-tag">
                      {session.godName}
                    </span>
                  </div>
                  <div className="session-seal__card-date">
                    {formatDate(session.savedAt)}
                  </div>
                </div>
                <div className="session-seal__card-actions">
                  <button
                    className="session-seal__card-btn"
                    onClick={(e) => handleExport(session.name, e)}
                    title="Export"
                  >
                    📤
                  </button>
                  <button
                    className="session-seal__card-btn session-seal__card-btn--danger"
                    onClick={(e) => handleDelete(session.name, e)}
                    title="Delete"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Save Flash */}
      <AnimatePresence>
        {flash && (
          <motion.div
            className="session-seal__flash"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
          >
            {flash}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

/* ═══ Quick Recall Bar (inline component) ═══ */

interface QuickRecallBarProps {
  recentSessions: string[];
  activeSession: string | null;
  onRecall: (name: string) => void;
  onOpenDrawer: () => void;
}

export const QuickRecallBar: React.FC<QuickRecallBarProps> = ({
  recentSessions,
  activeSession,
  onRecall,
  onOpenDrawer,
}) => {
  if (recentSessions.length === 0) return null;

  return (
    <div className="session-recall-bar">
      {recentSessions.map((name) => (
        <button
          key={name}
          className={`session-recall__chip ${
            activeSession === name ? 'session-recall__chip--active' : ''
          }`}
          onClick={() => onRecall(name)}
        >
          <span className="session-recall__chip-icon">🔱</span>
          {name}
        </button>
      ))}
      <button className="session-recall__seal-btn" onClick={onOpenDrawer}>
        ⚙ SEAL
      </button>
    </div>
  );
};
