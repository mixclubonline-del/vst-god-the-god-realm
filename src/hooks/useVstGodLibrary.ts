// src/hooks/useVstGodLibrary.ts
// React hook for wiring the Electric Pantheon preset library into the VST GOD UI.
// Provides god/preset selection, MIDI kit access, and macro state management.

import { useMemo, useState } from "react";
import {
  defaultPresetId,
  getGodProfile,
  getMidiKitForPreset,
  getNextPreset,
  getPresetById,
  getPresetsByGod,
  getPreviousPreset,
  VST_GOD_FACE_CONTROLS,
  type VstGodFaceControl,
} from "@/data/vstGodElectricPantheonLibrary";

export type VstGodMacroState = Record<VstGodFaceControl, number>;

export const defaultMacroState: VstGodMacroState = {
  ENERGY: 0.5,
  DIVINITY: 0.5,
  WIDTH: 0.5,
  REALM: 0.5,
};

export function useVstGodLibrary(initialPresetId = defaultPresetId) {
  const [selectedPresetId, setSelectedPresetId] = useState(initialPresetId);
  const [macros, setMacros] = useState<VstGodMacroState>(defaultMacroState);

  const selectedPreset = useMemo(() => {
    return getPresetById(selectedPresetId) ?? getPresetById(defaultPresetId)!;
  }, [selectedPresetId]);

  const selectedGod = useMemo(() => {
    return getGodProfile(selectedPreset.godId);
  }, [selectedPreset.godId]);

  const godPresets = useMemo(() => {
    return getPresetsByGod(selectedPreset.godId);
  }, [selectedPreset.godId]);

  const midiKit = useMemo(() => {
    return getMidiKitForPreset(selectedPreset);
  }, [selectedPreset]);

  function selectNextPreset() {
    setSelectedPresetId(getNextPreset(selectedPreset.id).id);
  }

  function selectPreviousPreset() {
    setSelectedPresetId(getPreviousPreset(selectedPreset.id).id);
  }

  function selectGod(godId: string) {
    const firstPreset = getPresetsByGod(godId)[0];
    if (firstPreset) setSelectedPresetId(firstPreset.id);
  }

  function setMacro(control: VstGodFaceControl, value: number) {
    setMacros((current) => ({
      ...current,
      [control]: Math.max(0, Math.min(1, value)),
    }));
  }

  return {
    faceControls: VST_GOD_FACE_CONTROLS,
    selectedPreset,
    selectedGod,
    selectedPresetId,
    setSelectedPresetId,
    godPresets,
    midiKit,
    macros,
    setMacro,
    selectGod,
    selectNextPreset,
    selectPreviousPreset,
  };
}
