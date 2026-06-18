import React, { useState } from 'react';
import type { ScaleConfig } from '../../audio/MusicTheoryEngine';
import { getScaleNotes, ROOT_NOTE_NAMES } from '../../audio/MusicTheoryEngine';
import type { StepState, SequencerState, TrackState, PianoRollNote } from './useSequencerEngine';
import { generatePianoNoteId } from './useSequencerEngine';
import { nativeAudio } from '../../native/bridge';
import './DivineOraclePanel.css';

interface DivineOraclePanelProps {
  state: SequencerState;
  scaleConfig: ScaleConfig;
  onClose: () => void;
  dispatch: React.Dispatch<any>;
}

export const DivineOraclePanel: React.FC<DivineOraclePanelProps> = ({
  state,
  scaleConfig,
  onClose,
  dispatch,
}) => {
  const [targetTrackIdx, setTargetTrackIdx] = useState<number>(
    state.selectedTrack >= 0 ? state.selectedTrack : 0
  );
  const [oracleMode, setOracleMode] = useState<'apollo' | 'poseidon' | 'hades'>('apollo');
  const [density, setDensity] = useState<'low' | 'medium' | 'high'>('medium');

  const selectedTrack = state.tracks[targetTrackIdx];

  const generatePattern = () => {
    if (!selectedTrack) return;

    const stepCount = state.stepCount;
    const isSynth = selectedTrack.sourceType === 'synth';

    // 1. Generate local steps using Oracle math
    const result = generateOraclePattern(
      isSynth ? 'synth' : 'sample',
      oracleMode,
      density,
      stepCount,
      scaleConfig
    );

    // 2. Dispatch to React reducer
    dispatch({
      type: 'LOAD_ORACLE_PATTERN',
      trackIndex: targetTrackIdx,
      steps: result.steps,
      noteMap: result.noteMap,
      pianoNotes: result.pianoNotes,
      usePianoRoll: isSynth, // Enable piano roll mode for synth tracks
    });

    // 3. Sync all generated steps to C++ backend
    result.steps.forEach((step, idx) => {
      let finalStep = { ...step };
      if (isSynth && result.noteMap) {
        finalStep.sliceIndex = idx; 
      }
      nativeAudio.updateSequencerStep(targetTrackIdx, state.activePattern, idx, finalStep);
    });

    // 4. Force Piano Roll view open if generating a synth melody
    if (isSynth) {
      dispatch({ type: 'SELECT_TRACK', index: targetTrackIdx });
    }
  };

  const handleClear = () => {
    dispatch({ type: 'CLEAR_TRACK', trackIndex: targetTrackIdx });
    // Sync clear steps to C++
    for (let i = 0; i < state.stepCount; i++) {
      nativeAudio.updateSequencerStep(
        targetTrackIdx,
        state.activePattern,
        i,
        { enabled: false, velocity: 100, pitch: 0, pan: 0, decay: 0.5, probability: 100, trigCondition: 'always', microTiming: 0, retrigRate: null, retrigVelocityCurve: 'flat', sliceIndex: 0 }
      );
    }
  };

  return (
    <div className="oracle-panel">
      {/* Header */}
      <div className="oracle-panel__header">
        <div className="oracle-panel__title-bar">
          <span className="oracle-panel__icon">👁️</span>
          <span className="oracle-panel__title">DIVINE ORACLE</span>
          <span className="oracle-panel__subtitle">Generative Pattern Engine</span>
        </div>
        <button className="oracle-panel__close" onClick={onClose} title="Close Panel">
          &times;
        </button>
      </div>

      <div className="oracle-panel__body">
        {/* Current scale indicator */}
        <div className="oracle-panel__scale-badge">
          <span className="oracle-panel__badge-label">Active Scale Snap</span>
          <span className="oracle-panel__badge-value">
            {scaleConfig.enabled
              ? `${ROOT_NOTE_NAMES[scaleConfig.root]} ${scaleConfig.type.toUpperCase()}`
              : 'OFF (Snapping to C minor)'}
          </span>
        </div>

        {/* Target Track Selection */}
        <div className="oracle-panel__section">
          <label className="oracle-panel__label">TARGET TRACK</label>
          <div className="oracle-panel__track-select-container">
            <select
              className="oracle-panel__select"
              value={targetTrackIdx}
              onChange={(e) => setTargetTrackIdx(parseInt(e.target.value))}
            >
              {state.tracks.map((track, idx) => (
                <option key={track.id} value={idx}>
                  {track.icon} {track.name} ({track.sourceType.toUpperCase()})
                </option>
              ))}
            </select>
            <div className="oracle-panel__track-indicator" style={{ backgroundColor: selectedTrack?.color }} />
          </div>
        </div>

        {/* Deity Modes */}
        <div className="oracle-panel__section">
          <label className="oracle-panel__label font-golden">DIVINE PROFILE</label>
          <div className="oracle-panel__mode-grid">
            <button
              className={`oracle-panel__mode-card ${oracleMode === 'apollo' ? 'oracle-panel__mode-card--active apollo-glow' : ''}`}
              onClick={() => setOracleMode('apollo')}
            >
              <div className="oracle-panel__mode-icon">☀️</div>
              <div className="oracle-panel__mode-name">APOLLO</div>
              <div className="oracle-panel__mode-desc">
                Symmetrical order. Generates structured, clean arpeggios and even beats.
              </div>
            </button>

            <button
              className={`oracle-panel__mode-card ${oracleMode === 'poseidon' ? 'oracle-panel__mode-card--active poseidon-glow' : ''}`}
              onClick={() => setOracleMode('poseidon')}
            >
              <div className="oracle-panel__mode-icon">🌊</div>
              <div className="oracle-panel__mode-name">POSEIDON</div>
              <div className="oracle-panel__mode-desc">
                Tidal flow. Generates fluid polyrhythms with wave-like velocities and probabilities.
              </div>
            </button>

            <button
              className={`oracle-panel__mode-card ${oracleMode === 'hades' ? 'oracle-panel__mode-card--active hades-glow' : ''}`}
              onClick={() => setOracleMode('hades')}
            >
              <div className="oracle-panel__mode-icon">💀</div>
              <div className="oracle-panel__mode-name">HADES</div>
              <div className="oracle-panel__mode-desc">
                Underworld syncopation. Generates dark, sparse trap placements with retriggers and micro-timing.
              </div>
            </button>
          </div>
        </div>

        {/* Density selection */}
        <div className="oracle-panel__section">
          <label className="oracle-panel__label">PATTERN DENSITY</label>
          <div className="oracle-panel__density-buttons">
            {(['low', 'medium', 'high'] as const).map((d) => (
              <button
                key={d}
                className={`oracle-panel__density-btn ${density === d ? 'oracle-panel__density-btn--active' : ''}`}
                onClick={() => setDensity(d)}
              >
                {d.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="oracle-panel__footer">
        <button className="oracle-panel__btn-clear" onClick={handleClear}>
          CLEAR TRACK
        </button>
        <button className="oracle-panel__btn-generate" onClick={generatePattern}>
          ASCEND PATTERN
        </button>
      </div>
    </div>
  );
};

// ─── GENERATION LOGIC ───

function generateOraclePattern(
  trackType: 'synth' | 'sample',
  mode: 'apollo' | 'poseidon' | 'hades',
  density: 'low' | 'medium' | 'high',
  stepCount: number,
  scaleConfig: ScaleConfig
): { steps: StepState[]; noteMap?: number[]; pianoNotes?: PianoRollNote[] } {
  const steps: StepState[] = Array.from({ length: stepCount }, () => ({
    enabled: false,
    velocity: 100,
    pitch: 0,
    pan: 0,
    decay: 0.5,
    probability: 100,
    trigCondition: 'always',
    microTiming: 0,
    retrigRate: null,
    retrigVelocityCurve: 'flat',
    sliceIndex: 0,
  }));

  const noteMap = Array.from({ length: stepCount }, () => 60); // default C4
  const pianoNotes: PianoRollNote[] = [];

  const activeRoot = scaleConfig.enabled ? scaleConfig.root : 0; 
  const activeType = scaleConfig.enabled ? scaleConfig.type : 'minor';
  
  const scaleIntervals: Record<string, number[]> = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
    melodicMinor: [0, 2, 3, 5, 7, 9, 11],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    locrian: [0, 1, 3, 5, 6, 8, 10],
    pentatonicMajor: [0, 2, 4, 7, 9],
    pentatonicMinor: [0, 3, 5, 7, 10],
    blues: [0, 3, 5, 6, 7, 10],
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  };

  const intervals = scaleIntervals[activeType] || scaleIntervals.minor;
  const scaleNotes = intervals.map(i => (activeRoot + i) % 12);

  const getNoteInScale = (scaleDegreeIndex: number, octave: number) => {
    const pc = scaleNotes[scaleDegreeIndex % scaleNotes.length];
    const octOffset = (octave + 1) * 12;
    const extraOctave = Math.floor(scaleDegreeIndex / scaleNotes.length);
    return activeRoot + pc + octOffset + (extraOctave * 12);
  };

  const getDensityProb = () => {
    if (density === 'low') return 0.25;
    if (density === 'medium') return 0.5;
    return 0.75;
  };

  const prob = getDensityProb();

  if (mode === 'apollo') {
    const stepInterval = density === 'low' ? 4 : density === 'medium' ? 2 : 1;
    
    for (let i = 0; i < stepCount; i++) {
      if (i % stepInterval === 0) {
        steps[i].enabled = true;
        steps[i].velocity = Math.floor(90 + Math.random() * 20); 
        steps[i].decay = 0.45;
        
        if (trackType === 'synth') {
          const degrees = [0, 2, 4, 6, 7, 6, 4, 2];
          const cycleIdx = Math.floor(i / stepInterval) % degrees.length;
          const scaleDegree = degrees[cycleIdx];
          const midiNote = getNoteInScale(scaleDegree, 4); 
          
          noteMap[i] = midiNote;
          
          pianoNotes.push({
            id: generatePianoNoteId(),
            note: midiNote,
            startStep: i,
            duration: stepInterval,
            velocity: steps[i].velocity,
          });
        }
      }
    }
  } else if (mode === 'poseidon') {
    for (let i = 0; i < stepCount; i++) {
      const angle = (i / stepCount) * Math.PI * 2 * 1.5; 
      const lfoVal = (Math.sin(angle) + 1) / 2; 
      const stepProb = 0.25 + lfoVal * 0.65;
      
      if (Math.random() < stepProb * prob) {
        steps[i].enabled = true;
        steps[i].velocity = Math.floor(65 + lfoVal * 50);
        steps[i].probability = Math.floor(50 + lfoVal * 50);
        steps[i].decay = 0.3 + lfoVal * 0.5;
        steps[i].pan = parseFloat((Math.sin(i * 0.4) * 0.5).toFixed(2));
        
        if (trackType === 'synth') {
          const degrees = [0, 2, 3, 4, 5, 4, 3, 2];
          const degreeOffset = Math.floor(lfoVal * 4);
          const cycleIdx = (i + degreeOffset) % degrees.length;
          const midiNote = getNoteInScale(degrees[cycleIdx], 3); 
          
          noteMap[i] = midiNote;
          
          pianoNotes.push({
            id: generatePianoNoteId(),
            note: midiNote,
            startStep: i,
            duration: 2,
            velocity: steps[i].velocity,
          });
        }
      }
    }
  } else if (mode === 'hades') {
    for (let i = 0; i < stepCount; i++) {
      if (trackType === 'synth') {
        const syncopatedPlacements = [0, 3, 6, 8, 10, 14];
        const isPlacement = syncopatedPlacements.includes(i % 16);
        
        if (isPlacement && Math.random() < prob * 1.1) {
          steps[i].enabled = true;
          steps[i].velocity = Math.floor(85 + Math.random() * 30);
          steps[i].decay = 0.22;
          steps[i].microTiming = Math.floor((Math.random() - 0.5) * 26); 
          
          const darkDegrees = [0, 1, 3, 4, 0, 1, 6, 0];
          const scaleDegree = darkDegrees[Math.floor(Math.random() * darkDegrees.length)];
          const midiNote = getNoteInScale(scaleDegree, 2); 
          
          noteMap[i] = midiNote;
          
          pianoNotes.push({
            id: generatePianoNoteId(),
            note: midiNote,
            startStep: i,
            duration: 1,
            velocity: steps[i].velocity,
          });
        }
      } else {
        let shouldTrigger = false;
        let isRoll = false;
        
        if (i % 8 === 0) {
          shouldTrigger = Math.random() < 0.85;
        } else if (i % 2 === 1) {
          shouldTrigger = Math.random() < prob * 0.35;
          if (shouldTrigger && Math.random() < 0.6) {
            isRoll = true;
          }
        } else {
          shouldTrigger = Math.random() < prob * 0.55;
        }
        
        if (shouldTrigger) {
          steps[i].enabled = true;
          steps[i].velocity = Math.floor(75 + Math.random() * 45);
          steps[i].decay = 0.25;
          steps[i].microTiming = Math.floor((Math.random() - 0.4) * 20); 
          
          if (isRoll) {
            steps[i].retrigRate = (['1/2', '1/4', '1/8', '1/16'] as const)[Math.floor(Math.random() * 4)];
            steps[i].retrigVelocityCurve = Math.random() > 0.5 ? 'rampDown' : 'flat';
          }
        }
      }
    }
  }

  return { steps, noteMap, pianoNotes };
}
