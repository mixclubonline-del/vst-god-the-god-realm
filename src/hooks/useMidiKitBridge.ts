/**
 * useMidiKitBridge.ts — MIDI Kit → Sacred Sequencer Bridge
 * Converts the Electric Pantheon library's MIDI kit data (note name strings)
 * into sequencer-compatible note maps and pattern data.
 *
 * This hook provides a `loadKit` function that, when called, populates
 * the sequencer's synth tracks with notes from the active preset's MIDI kit.
 */

import { useCallback, useMemo } from 'react';
import { noteNameToMidi } from '@/utils/noteUtils';
import type { VstGodMidiKit, VstGodPreset } from '@/data/vstGodElectricPantheonLibrary';
import type { SequencerState, TrackState } from '@/components/sequencer/useSequencerEngine';

/** Dispatch type — matches the return of useSequencerEngine().dispatch */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SeqDispatch = React.Dispatch<any>;

/** Track mapping rules: which sequencer tracks receive which kit data */
interface TrackMidiMapping {
  trackIndex: number;
  trackName: string;
  sourceType: 'chords' | 'bass' | 'melody';
  /** Whether to use voicings (chord stacks) instead of single notes */
  useVoicings?: boolean;
  /** Octave transposition offset */
  octaveOffset?: number;
}

/**
 * Scans the sequencer state for synth tracks and maps them to MIDI kit sources
 * by track name convention.
 */
function resolveTrackMappings(tracks: SequencerState['tracks']): TrackMidiMapping[] {
  const mappings: TrackMidiMapping[] = [];

  tracks.forEach((track, index) => {
    if (track.sourceType !== 'synth') return;

    const name = track.name.toUpperCase();

    if (name.includes('CHORD') || name.includes('PAD')) {
      mappings.push({
        trackIndex: index,
        trackName: track.name,
        sourceType: 'chords',
        useVoicings: true,
      });
    } else if (name.includes('BASS') || name.includes('808')) {
      mappings.push({
        trackIndex: index,
        trackName: track.name,
        sourceType: 'bass',
      });
    } else if (name.includes('MELODY') || name.includes('LEAD')) {
      mappings.push({
        trackIndex: index,
        trackName: track.name,
        sourceType: 'melody',
        // Lead gets +1 octave transposition for brightness
        octaveOffset: name.includes('LEAD') ? 12 : 0,
      });
    }
  });

  return mappings;
}

/**
 * Distributes a note array across the sequencer's step count.
 * If the note array is shorter than stepCount, it repeats.
 * Each step gets one MIDI note number.
 */
function distributeNotesToSteps(
  noteNames: string[],
  stepCount: number,
  octaveOffset = 0
): number[] {
  if (!noteNames.length) return Array(stepCount).fill(60);

  return Array.from({ length: stepCount }, (_, i) => {
    const noteName = noteNames[i % noteNames.length];
    return noteNameToMidi(noteName) + octaveOffset;
  });
}

/**
 * For chord voicings, picks the root note of each voicing for the noteMap,
 * and distributes across steps. The full voicing data is preserved in the
 * kit reference for future polyphonic playback.
 */
function distributeVoicingsToSteps(
  voicings: string[][],
  stepCount: number
): number[] {
  if (!voicings.length) return Array(stepCount).fill(60);

  // Use the lowest note in each voicing as the representative MIDI note
  return Array.from({ length: stepCount }, (_, i) => {
    const voicing = voicings[i % voicings.length];
    if (!voicing.length) return 60;
    // Root is typically the first (lowest) note in the voicing
    return noteNameToMidi(voicing[0]);
  });
}

/**
 * Generates an enabled step pattern based on musical convention:
 * - Chords: every 4 steps (whole notes in 16th grid)
 * - Bass: every 2 steps (8th notes)
 * - Melody: every step (16th notes)
 */
function generateStepPattern(
  sourceType: 'chords' | 'bass' | 'melody',
  noteCount: number,
  stepCount: number
): boolean[] {
  const pattern = Array(stepCount).fill(false);

  switch (sourceType) {
    case 'chords': {
      // Enable steps at chord change points (spread across bar)
      const interval = Math.max(1, Math.floor(stepCount / noteCount));
      for (let i = 0; i < noteCount && i * interval < stepCount; i++) {
        pattern[i * interval] = true;
      }
      break;
    }
    case 'bass': {
      // Bass: enable every other step where there's a note
      for (let i = 0; i < stepCount; i++) {
        if (i < noteCount || i % 2 === 0) {
          pattern[i] = true;
        }
      }
      break;
    }
    case 'melody': {
      // Melody: enable all steps that have distinct note data
      const uniqueNotes = Math.min(noteCount, stepCount);
      for (let i = 0; i < uniqueNotes; i++) {
        pattern[i] = true;
      }
      break;
    }
  }

  return pattern;
}

export interface MidiKitBridgeResult {
  /** Loads the current MIDI kit into the sequencer */
  loadKit: () => void;
  /** Preview of what will be loaded (for UI display) */
  kitSummary: {
    trackCount: number;
    mappings: { trackName: string; source: string; noteCount: number }[];
  } | null;
  /** Whether the kit can be loaded (has valid data + dispatch) */
  canLoadKit: boolean;
}

export function useMidiKitBridge(
  midiKit: VstGodMidiKit | undefined,
  preset: VstGodPreset | undefined,
  sequencerState: SequencerState | undefined,
  dispatch: SeqDispatch | undefined
): MidiKitBridgeResult {
  // Resolve which tracks will receive data
  const mappings = useMemo(() => {
    if (!sequencerState) return [];
    return resolveTrackMappings(sequencerState.tracks);
  }, [sequencerState?.tracks]);

  const canLoadKit = !!(midiKit && dispatch && sequencerState && mappings.length > 0);

  // Summary for UI preview
  const kitSummary = useMemo(() => {
    if (!midiKit || !mappings.length) return null;

    return {
      trackCount: mappings.length,
      mappings: mappings.map((m) => {
        const noteCount =
          m.sourceType === 'chords'
            ? midiKit.voicings?.length || midiKit.chords.length
            : midiKit[m.sourceType]?.length || 0;
        return {
          trackName: m.trackName,
          source: m.sourceType.toUpperCase(),
          noteCount,
        };
      }),
    };
  }, [midiKit, mappings]);

  const loadKit = useCallback(() => {
    if (!canLoadKit || !midiKit || !dispatch || !sequencerState) return;

    const stepCount = sequencerState.stepCount;

    console.log(
      `[MIDI Kit Bridge] Loading "${midiKit.name}" → ${mappings.length} tracks, ${stepCount} steps`
    );

    // 1. Set BPM to kit's recommended BPM
    dispatch({ type: 'SET_BPM', bpm: midiKit.bpm });

    // 2. Set swing from preset export data
    if (preset?.export?.swing) {
      const swingPercent = Math.round(preset.export.swing * 100);
      dispatch({ type: 'SET_SWING', swing: swingPercent });
    }

    // 3. Apply MIDI data to each mapped track
    for (const mapping of mappings) {
      const { trackIndex, sourceType, useVoicings, octaveOffset } = mapping;

      // Clear existing pattern first
      dispatch({ type: 'CLEAR_TRACK', trackIndex });

      // Determine the note distribution
      let noteMap: number[];
      let sourceNoteCount: number;

      if (sourceType === 'chords' && useVoicings && midiKit.voicings?.length) {
        noteMap = distributeVoicingsToSteps(midiKit.voicings, stepCount);
        sourceNoteCount = midiKit.voicings.length;
      } else {
        const noteNames = midiKit[sourceType] || [];
        noteMap = distributeNotesToSteps(noteNames, stepCount, octaveOffset || 0);
        sourceNoteCount = noteNames.length;
      }

      // Set note map for each step
      for (let step = 0; step < stepCount; step++) {
        dispatch({
          type: 'SET_NOTE_MAP',
          trackIndex,
          stepIndex: step,
          note: noteMap[step],
        });
      }

      // Enable steps based on musical pattern
      const stepPattern = generateStepPattern(sourceType, sourceNoteCount, stepCount);
      for (let step = 0; step < stepCount; step++) {
        if (stepPattern[step]) {
          // Set enabled + velocity in one dispatch
          dispatch({
            type: 'SET_STEP_PROP',
            trackIndex,
            stepIndex: step,
            prop: 'enabled',
            value: true,
          });

          // Apply recommended velocity from preset
          if (preset?.export?.recommendedVelocity) {
            const [minVel, maxVel] = preset.export.recommendedVelocity;
            // Vary velocity slightly across steps for humanization
            const baseVel = minVel + (maxVel - minVel) * (0.7 + Math.random() * 0.3);
            dispatch({
              type: 'SET_STEP_VELOCITY',
              trackIndex,
              stepIndex: step,
              velocity: Math.round(baseVel),
            });
          }
        }
      }

      // Set the god for this synth track to match the kit's godId
      dispatch({
        type: 'SET_SYNTH_GOD',
        trackIndex,
        godId: midiKit.godId,
      });

      console.log(
        `  → Track ${trackIndex} "${mapping.trackName}": ${sourceType} (${sourceNoteCount} notes)`
      );
    }

    console.log('[MIDI Kit Bridge] Kit loaded successfully');
  }, [canLoadKit, midiKit, preset, dispatch, sequencerState, mappings]);

  return { loadKit, kitSummary, canLoadKit };
}
