/**
 * useMidiMapping — React hook for MIDI controller mapping.
 *
 * Provides reactive state for:
 *  - Current mappings list
 *  - Learn mode status
 *  - Connected MIDI devices
 *  - CC activity (last values)
 *
 * Also provides methods to register/unregister mappable parameters.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { midiMappingService } from '../../services/midiMappingService';
import { neuralInputBus } from '../../services/neuralInputBus';
import type { MidiMapping, MidiMappableTarget, MidiCCKey } from '../../services/types';

export interface UseMidiMappingResult {
  /** All active mappings */
  mappings: MidiMapping[];
  /** Whether Learn mode is active */
  isLearning: boolean;
  /** Which target ID is armed for learning */
  learningTargetId: string | null;
  /** Connected MIDI device names */
  connectedDevices: string[];
  /** Last CC values for activity meters */
  ccActivity: Map<MidiCCKey, number>;
  /** All registered mappable targets */
  targets: MidiMappableTarget[];

  /** Start Learn mode for a target parameter */
  startLearn: (targetId: string) => void;
  /** Cancel Learn mode */
  cancelLearn: () => void;
  /** Remove a mapping by CC key */
  removeMapping: (ccKey: MidiCCKey) => void;
  /** Remove a mapping by target ID */
  removeMappingForTarget: (targetId: string) => void;
  /** Clear all mappings */
  clearAll: () => void;
  /** Register a mappable parameter */
  registerTarget: (target: MidiMappableTarget) => void;
  /** Unregister a mappable parameter */
  unregisterTarget: (id: string) => void;
}

export function useMidiMapping(): UseMidiMappingResult {
  const [mappings, setMappings] = useState<MidiMapping[]>(midiMappingService.getMappings());
  const [isLearning, setIsLearning] = useState(midiMappingService.isLearning);
  const [learningTargetId, setLearningTargetId] = useState<string | null>(midiMappingService.learningTargetId);
  const [connectedDevices, setConnectedDevices] = useState<string[]>(neuralInputBus.connectedDevices);
  const [ccActivity, setCCActivity] = useState<Map<MidiCCKey, number>>(new Map());
  const [targets, setTargets] = useState<MidiMappableTarget[]>(midiMappingService.getTargets());

  // Throttle activity updates to 10fps to avoid render thrash
  const activityBuffer = useRef<Map<MidiCCKey, number>>(new Map());
  const rafId = useRef(0);

  useEffect(() => {
    // Subscribe to mapping changes
    const unsubMap = midiMappingService.onMappingChange(() => {
      setMappings(midiMappingService.getMappings());
      setTargets(midiMappingService.getTargets());
    });

    // Subscribe to Learn mode changes
    const unsubLearn = midiMappingService.onLearnChange(() => {
      setIsLearning(midiMappingService.isLearning);
      setLearningTargetId(midiMappingService.learningTargetId);
    });

    // Subscribe to device changes
    const unsubDevice = neuralInputBus.onDeviceChange(() => {
      setConnectedDevices(neuralInputBus.connectedDevices);
    });

    // Subscribe to CC activity (throttled)
    const unsubActivity = midiMappingService.onActivity((ccKey, value) => {
      activityBuffer.current.set(ccKey, value);
      if (!rafId.current) {
        rafId.current = requestAnimationFrame(() => {
          rafId.current = 0;
          setCCActivity(new Map(activityBuffer.current));
        });
      }
    });

    return () => {
      unsubMap();
      unsubLearn();
      unsubDevice();
      unsubActivity();
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  const startLearn = useCallback((targetId: string) => {
    midiMappingService.startLearn(targetId).catch(() => {
      // Target not registered — ignore
    });
  }, []);

  const cancelLearn = useCallback(() => {
    midiMappingService.cancelLearn();
  }, []);

  const removeMapping = useCallback((ccKey: MidiCCKey) => {
    midiMappingService.removeMapping(ccKey);
  }, []);

  const removeMappingForTarget = useCallback((targetId: string) => {
    midiMappingService.removeMappingForTarget(targetId);
  }, []);

  const clearAll = useCallback(() => {
    midiMappingService.clearAll();
  }, []);

  const registerTarget = useCallback((target: MidiMappableTarget) => {
    midiMappingService.registerTarget(target);
    setTargets(midiMappingService.getTargets());
  }, []);

  const unregisterTarget = useCallback((id: string) => {
    midiMappingService.unregisterTarget(id);
    setTargets(midiMappingService.getTargets());
  }, []);

  return {
    mappings,
    isLearning,
    learningTargetId,
    connectedDevices,
    ccActivity,
    targets,
    startLearn,
    cancelLearn,
    removeMapping,
    removeMappingForTarget,
    clearAll,
    registerTarget,
    unregisterTarget,
  };
}
