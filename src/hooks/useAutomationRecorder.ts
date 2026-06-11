import { useCallback, useRef } from 'react';
import type { AutomationParam } from '../components/sequencer/useSequencerEngine';

interface UseAutomationRecorderProps {
  isRecording: boolean;
  isPlaying: boolean;
  currentStep: number;
  dispatch: React.Dispatch<any>;
}

export function useAutomationRecorder({
  isRecording,
  isPlaying,
  currentStep,
  dispatch,
}: UseAutomationRecorderProps) {
  const lastRecordTimeRef = useRef<Record<string, number>>({});
  
  // Throttle recording to ~30Hz to avoid flooding state
  const RECORD_THROTTLE_MS = 33; 

  const recordAutomation = useCallback((
    trackIndex: number,
    param: AutomationParam,
    value: number,
    force: boolean = false
  ) => {
    // Only record if the engine is running and record is enabled
    if (!isRecording || !isPlaying || currentStep < 0) return;

    const now = Date.now();
    const key = `${trackIndex}-${param}`;
    const lastTime = lastRecordTimeRef.current[key] || 0;

    if (force || now - lastTime >= RECORD_THROTTLE_MS) {
      lastRecordTimeRef.current[key] = now;
      
      // We automatically dispatch RECORD_AUTOMATION_SNAPSHOT.
      // The reducer handles inserting the AutomationLane if needed,
      // merging nearby points, and keeping them sorted.
      dispatch({
        type: 'RECORD_AUTOMATION_SNAPSHOT',
        trackIndex,
        param,
        step: currentStep, // Note: integer approximation of the exact playhead
        value,
      });
    }
  }, [isRecording, isPlaying, currentStep, dispatch]);

  return { recordAutomation };
}
