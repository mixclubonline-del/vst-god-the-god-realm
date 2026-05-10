import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { VSTSpec } from '@/services/types';

/**
 * Plugin Instance represents a running plugin in the DAW rack.
 */
export interface PluginInstance {
  id: string;
  spec: VSTSpec;
  /** Current parameter values mapped by parameter ID */
  parameterValues: Record<string, number | string | boolean>;
  /** Whether the plugin window is open */
  isVisible: boolean;
  /** Whether the plugin is currently focused */
  isActive: boolean;
}

interface PluginState {
  /** All plugins currently loaded in the project rack */
  activePlugins: PluginInstance[];
  /** The ID of the plugin currently being edited/focused */
  activePluginId: string | null;
  
  // Actions
  /** Adds a new plugin instance to the rack from a spec */
  addPlugin: (spec: VSTSpec) => string;
  /** Removes a plugin instance from the rack */
  removePlugin: (id: string) => void;
  /** Toggles the UI window for a plugin */
  togglePluginVisibility: (id: string, force?: boolean) => void;
  /** Updates a specific parameter for a plugin instance */
  setPluginParameter: (pluginId: string, paramId: string, value: number | string | boolean) => void;
  /** Focuses a plugin instance */
  setActivePlugin: (id: string | null) => void;
  /** Clears all plugins */
  clearRack: () => void;
}

export const usePluginStore = create<PluginState>()(
  persist(
    (set) => ({
      activePlugins: [],
      activePluginId: null,

  addPlugin: (spec) => {
    const id = `${spec.plugin.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
    
    // Initialize parameter values from defaults
    const parameterValues: Record<string, number | string | boolean> = {};
    spec.parameters.forEach(param => {
      parameterValues[param.id] = param.default;
    });

    const newPlugin: PluginInstance = {
      id,
      spec,
      parameterValues,
      isVisible: true,
      isActive: true,
    };

    set((state) => ({
      activePlugins: [...state.activePlugins, newPlugin],
      activePluginId: id,
    }));

    return id;
  },

  removePlugin: (id) => set((state) => ({
    activePlugins: state.activePlugins.filter(p => p.id !== id),
    activePluginId: state.activePluginId === id ? null : state.activePluginId
  })),

  togglePluginVisibility: (id, force) => set((state) => ({
    activePlugins: state.activePlugins.map(p => 
      p.id === id ? { ...p, isVisible: force !== undefined ? force : !p.isVisible } : p
    )
  })),

  setPluginParameter: (pluginId, paramId, value) => set((state) => ({
    activePlugins: state.activePlugins.map(p => 
      p.id === pluginId 
        ? { ...p, parameterValues: { ...p.parameterValues, [paramId]: value } }
        : p
    )
  })),

  setActivePlugin: (id) => set({ activePluginId: id }),

  clearRack: () => set({ activePlugins: [], activePluginId: null }),
    }),
    {
      name: 'vst-plugin-rack',
    }
  )
);
