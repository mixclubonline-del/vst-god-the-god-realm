/**
 * SacredProjectDrawer — Slide-out panel for project save/load management.
 *
 * Features:
 *  - Save current project with name
 *  - Project list with load/delete/export
 *  - Import JSON projects
 *  - New Project (reset)
 */
import React, { useState, useRef, useEffect } from 'react';
import type { ProjectMeta } from './useProjectManager';

interface SacredProjectDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  projects: ProjectMeta[];
  activeProject: string | null;
  isDirty: boolean;
  onSave: (name: string) => boolean;
  onLoad: (name: string) => boolean;
  onDelete: (name: string) => void;
  onRename: (oldName: string, newName: string) => boolean;
  onNew: () => void;
  onExport: (name: string) => void;
  onImport: () => void;
}

export const SacredProjectDrawer: React.FC<SacredProjectDrawerProps> = ({
  isOpen,
  onClose,
  projects,
  activeProject,
  isDirty,
  onSave,
  onLoad,
  onDelete,
  onRename,
  onNew,
  onExport,
  onImport,
}) => {
  const [saveName, setSaveName] = useState('');
  const [renamingProject, setRenamingProject] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus save input when drawer opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleSave = () => {
    const name = saveName.trim();
    if (!name) return;
    if (onSave(name)) {
      setSaveName('');
    }
  };

  const handleRename = (oldName: string) => {
    const newName = renameValue.trim();
    if (!newName || newName === oldName) {
      setRenamingProject(null);
      return;
    }
    if (onRename(oldName, newName)) {
      setRenamingProject(null);
    }
  };

  const formatDate = (iso: string): string => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div className={`sacred-project-drawer-overlay ${isOpen ? 'open' : ''}`} onClick={onClose}>
      <div
        className={`sacred-project-drawer ${isOpen ? 'open' : ''}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sacred-project-drawer-header">
          <h3>📁 Projects</h3>
          <button className="sacred-project-drawer-close" onClick={onClose}>✕</button>
        </div>

        {/* Save Section */}
        <div className="sacred-project-save-section">
          <div className="sacred-project-save-row">
            <input
              ref={inputRef}
              type="text"
              className="sacred-project-name-input"
              placeholder="Project name..."
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              maxLength={40}
            />
            <button
              className="sacred-project-save-btn"
              onClick={handleSave}
              disabled={!saveName.trim()}
            >
              💾 Save
            </button>
          </div>
          {activeProject && (
            <div className="sacred-project-active-label">
              Active: <strong>{activeProject}</strong>
              {isDirty && <span className="sacred-project-dirty"> • unsaved</span>}
            </div>
          )}
        </div>

        {/* Actions Bar */}
        <div className="sacred-project-actions-bar">
          <button className="sacred-project-action-btn" onClick={onNew}>
            ✨ New
          </button>
          <button className="sacred-project-action-btn" onClick={onImport}>
            📥 Import
          </button>
        </div>

        {/* Project List */}
        <div className="sacred-project-list">
          {projects.length === 0 ? (
            <div className="sacred-project-empty">
              No saved projects yet.<br />
              <span>Save your first project above.</span>
            </div>
          ) : (
            projects.map(p => (
              <div
                key={p.name}
                className={`sacred-project-card ${activeProject === p.name ? 'active' : ''}`}
              >
                {renamingProject === p.name ? (
                  <div className="sacred-project-rename-row">
                    <input
                      type="text"
                      className="sacred-project-name-input compact"
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRename(p.name);
                        if (e.key === 'Escape') setRenamingProject(null);
                      }}
                      autoFocus
                      maxLength={40}
                    />
                    <button className="sacred-project-icon-btn" onClick={() => handleRename(p.name)}>✓</button>
                    <button className="sacred-project-icon-btn" onClick={() => setRenamingProject(null)}>✕</button>
                  </div>
                ) : (
                  <>
                    <div className="sacred-project-card-info">
                      <div className="sacred-project-card-name">{p.name}</div>
                      <div className="sacred-project-card-meta">
                        {p.bpm} BPM • {p.trackCount} tracks • {p.stepCount} steps • {formatDate(p.savedAt)}
                      </div>
                    </div>
                    <div className="sacred-project-card-actions">
                      <button
                        className="sacred-project-icon-btn load"
                        onClick={() => onLoad(p.name)}
                        title="Load project"
                      >
                        ▶
                      </button>
                      <button
                        className="sacred-project-icon-btn"
                        onClick={() => {
                          setRenamingProject(p.name);
                          setRenameValue(p.name);
                        }}
                        title="Rename"
                      >
                        ✏️
                      </button>
                      <button
                        className="sacred-project-icon-btn"
                        onClick={() => onExport(p.name)}
                        title="Export JSON"
                      >
                        📤
                      </button>
                      {confirmDelete === p.name ? (
                        <>
                          <button
                            className="sacred-project-icon-btn danger"
                            style={{ width: 'auto', padding: '0 8px' }}
                            onClick={() => { onDelete(p.name); setConfirmDelete(null); }}
                          >
                            Confirm
                          </button>
                          <button
                            className="sacred-project-icon-btn"
                            style={{ width: 'auto', padding: '0 8px' }}
                            onClick={() => setConfirmDelete(null)}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          className="sacred-project-icon-btn danger"
                          onClick={() => setConfirmDelete(p.name)}
                          title="Delete"
                        >
                          🗑
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="sacred-project-footer">
          {projects.length} / 20 slots
        </div>
      </div>
    </div>
  );
};
