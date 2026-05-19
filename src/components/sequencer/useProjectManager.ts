/**
 * useProjectManager — Named project save/load slots for the Sacred Sequencer.
 *
 * Provides CRUD operations for named project slots stored in localStorage.
 * Supports import/export as JSON files for project sharing.
 * Max 20 named project slots.
 */
import { useState, useCallback, useEffect } from 'react';
import type { SequencerState } from './useSequencerEngine';

/* ═══ Types ═══ */
export interface ProjectMeta {
  name: string;
  savedAt: string;       // ISO timestamp
  bpm: number;
  trackCount: number;
  stepCount: number;
  version: number;
}

export interface SavedProject {
  meta: ProjectMeta;
  state: Omit<SequencerState, 'isPlaying' | 'currentStep' | 'cycleCount' | 'clipboardPattern'>;
}

interface ProjectStore {
  [name: string]: SavedProject;
}

/* ═══ Constants ═══ */
const PROJECTS_KEY = 'sacred_sequencer_projects';
const ACTIVE_PROJECT_KEY = 'sacred_sequencer_active_project';
const MAX_PROJECTS = 20;
const CURRENT_VERSION = 1;

/* ═══ Helpers ═══ */
function loadProjectStore(): ProjectStore {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveProjectStore(store: ProjectStore): void {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(store));
}

function stripTransientState(state: SequencerState): SavedProject['state'] {
  const { isPlaying, currentStep, cycleCount, clipboardPattern, ...persistable } = state;
  return persistable;
}

/* ═══ Hook ═══ */
export function useProjectManager(
  currentState: SequencerState,
  dispatch: (action: { type: 'LOAD_PROJECT_STATE'; payload: Partial<SequencerState> }) => void,
  clearHistory: () => void
) {
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Load project list on mount
  useEffect(() => {
    refreshList();
    const saved = localStorage.getItem(ACTIVE_PROJECT_KEY);
    if (saved) setActiveProject(saved);
  }, []);

  // Track dirty state (any dispatch after save marks dirty)
  const lastSaveRef = useState('')[1]; // trigger re-render
  useEffect(() => {
    if (activeProject) setIsDirty(true);
  }, [currentState.tracks, currentState.bpm, currentState.songArrangement]);

  const refreshList = useCallback(() => {
    const store = loadProjectStore();
    const metas = Object.values(store)
      .map(p => p.meta)
      .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
    setProjects(metas);
  }, []);

  /* ─── Save ─── */
  const saveProject = useCallback((name: string): boolean => {
    const store = loadProjectStore();

    // Enforce slot limit (only if new project)
    if (!store[name] && Object.keys(store).length >= MAX_PROJECTS) {
      console.warn(`Max ${MAX_PROJECTS} projects reached`);
      return false;
    }

    const project: SavedProject = {
      meta: {
        name,
        savedAt: new Date().toISOString(),
        bpm: currentState.bpm,
        trackCount: currentState.tracks.length,
        stepCount: currentState.stepCount,
        version: CURRENT_VERSION,
      },
      state: stripTransientState(currentState),
    };

    store[name] = project;
    saveProjectStore(store);
    setActiveProject(name);
    localStorage.setItem(ACTIVE_PROJECT_KEY, name);
    setIsDirty(false);
    refreshList();
    return true;
  }, [currentState, refreshList]);

  /* ─── Load ─── */
  const loadProject = useCallback((name: string): boolean => {
    const store = loadProjectStore();
    const project = store[name];
    if (!project) return false;

    dispatch({
      type: 'LOAD_PROJECT_STATE',
      payload: {
        ...project.state,
        isPlaying: false,
        currentStep: -1,
        cycleCount: 0,
        clipboardPattern: null,
      },
    });
    clearHistory();
    setActiveProject(name);
    localStorage.setItem(ACTIVE_PROJECT_KEY, name);
    setIsDirty(false);
    return true;
  }, [dispatch, clearHistory]);

  /* ─── Delete ─── */
  const deleteProject = useCallback((name: string): void => {
    const store = loadProjectStore();
    delete store[name];
    saveProjectStore(store);
    if (activeProject === name) {
      setActiveProject(null);
      localStorage.removeItem(ACTIVE_PROJECT_KEY);
    }
    refreshList();
  }, [activeProject, refreshList]);

  /* ─── Rename ─── */
  const renameProject = useCallback((oldName: string, newName: string): boolean => {
    if (oldName === newName) return true;
    const store = loadProjectStore();
    if (!store[oldName] || store[newName]) return false;

    store[newName] = {
      ...store[oldName],
      meta: { ...store[oldName].meta, name: newName },
    };
    delete store[oldName];
    saveProjectStore(store);

    if (activeProject === oldName) {
      setActiveProject(newName);
      localStorage.setItem(ACTIVE_PROJECT_KEY, newName);
    }
    refreshList();
    return true;
  }, [activeProject, refreshList]);

  /* ─── New Project ─── */
  const newProject = useCallback((): void => {
    // Reset to defaults by clearing the auto-save key
    localStorage.removeItem('sacred_sequencer_state');
    localStorage.removeItem(ACTIVE_PROJECT_KEY);
    setActiveProject(null);
    setIsDirty(false);
    // Reload the page to get fresh state
    window.location.reload();
  }, []);

  /* ─── Export JSON ─── */
  const exportProject = useCallback((name: string): void => {
    const store = loadProjectStore();
    const project = store[name];
    if (!project) return;

    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/[^a-zA-Z0-9_-]/g, '_')}.sacred.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  /* ─── Import JSON ─── */
  const importProject = useCallback((): void => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.sacred.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const project: SavedProject = JSON.parse(reader.result as string);
          if (!project.meta?.name || !project.state) {
            console.error('Invalid project file');
            return;
          }

          const store = loadProjectStore();
          // Avoid name collision
          let name = project.meta.name;
          let counter = 1;
          while (store[name]) {
            name = `${project.meta.name} (${counter++})`;
          }
          project.meta.name = name;
          project.meta.savedAt = new Date().toISOString();

          store[name] = project;
          saveProjectStore(store);
          refreshList();
        } catch (err) {
          console.error('Failed to import project:', err);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [refreshList]);

  /* ─── Quick Save (Cmd+S) ─── */
  const quickSave = useCallback((): boolean => {
    if (activeProject) {
      return saveProject(activeProject);
    }
    return false;
  }, [activeProject, saveProject]);

  return {
    projects,
    activeProject,
    isDirty,
    saveProject,
    loadProject,
    deleteProject,
    renameProject,
    newProject,
    exportProject,
    importProject,
    quickSave,
  };
}
