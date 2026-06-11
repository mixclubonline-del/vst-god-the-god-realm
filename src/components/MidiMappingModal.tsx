/**
 * MidiMappingModal.tsx — Configurable MIDI CC/Note Mapping
 * Full-screen modal for assigning MIDI notes to pads + CC controls to parameters.
 *
 * Features:
 * - Visual pad grid with current MIDI note assignments
 * - Click-to-learn: click a pad then hit a key on your MIDI controller
 * - CC mapping table: assign CC numbers to any parameter
 * - Device selector from detected Web MIDI devices
 * - Preset save/load for different controllers
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface MidiNoteMapping {
  padIndex: number;
  midiNote: number;
}

export interface MidiCCMapping {
  ccNumber: number;
  targetParam: string;
  targetLabel: string;
  min: number;
  max: number;
}

export interface MidiMappingPreset {
  name: string;
  notes: MidiNoteMapping[];
  ccs: MidiCCMapping[];
}

interface MidiMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  noteMap: number[];                  // 16-element array: padIndex → MIDI note
  onNoteMapChange: (map: number[]) => void;
  ccMappings: MidiCCMapping[];
  onCCMappingsChange: (mappings: MidiCCMapping[]) => void;
  padCount?: number;
  padNames?: string[];
  midiDevices?: { id: string; name: string }[];
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function midiNoteName(n: number): string {
  return `${NOTE_NAMES[n % 12]}${Math.floor(n / 12) - 1}`;
}

/** Available parameters for CC mapping */
const CC_TARGETS = [
  { id: 'masterVol', label: 'Master Volume' },
  { id: 'bpm', label: 'BPM' },
  { id: 'swing', label: 'Swing' },
  { id: 'filterFreq', label: 'Filter Frequency' },
  { id: 'filterQ', label: 'Filter Resonance' },
  { id: 'reverbMix', label: 'Reverb Send' },
  { id: 'delayMix', label: 'Delay Send' },
  { id: 'chorusMix', label: 'Chorus Send' },
  { id: 'satDrive', label: 'Saturation' },
  { id: 'energy', label: 'Macro: Energy' },
  { id: 'divinity', label: 'Macro: Divinity' },
  { id: 'width', label: 'Macro: Width' },
  { id: 'realm', label: 'Macro: Realm' },
  { id: 'morphBlend', label: 'Morph Blend' },
  { id: 'pitchBend', label: 'Pitch Bend' },
  { id: 'modWheel', label: 'Mod Wheel' },
];

export const MidiMappingModal: React.FC<MidiMappingModalProps> = ({
  isOpen,
  onClose,
  noteMap,
  onNoteMapChange,
  ccMappings,
  onCCMappingsChange,
  padCount = 16,
  padNames,
  midiDevices = [],
}) => {
  const [learningPad, setLearningPad] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'notes' | 'cc'>('notes');
  const [editingCC, setEditingCC] = useState<number | null>(null);
  const listenerRef = useRef<((e: MIDIMessageEvent) => void) | null>(null);

  // Listen for incoming MIDI when learning
  useEffect(() => {
    if (learningPad === null || !isOpen) return;

    const handleMidi = (e: Event) => {
      const midiEvent = e as MIDIMessageEvent;
      const data = midiEvent.data;
      if (!data || data.length < 3) return;

      const status = data[0] & 0xf0;
      const note = data[1];

      if (status === 0x90 && data[2] > 0) {
        // Note On — assign to pad
        const newMap = [...noteMap];
        newMap[learningPad] = note;
        onNoteMapChange(newMap);
        setLearningPad(null);
      }
    };

    // Attach to all MIDI inputs
    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess({ sysex: false }).then(access => {
        access.inputs.forEach(input => {
          input.addEventListener('midimessage', handleMidi);
        });
        listenerRef.current = handleMidi as any;
      });
    }

    return () => {
      if (navigator.requestMIDIAccess && listenerRef.current) {
        navigator.requestMIDIAccess({ sysex: false }).then(access => {
          access.inputs.forEach(input => {
            input.removeEventListener('midimessage', listenerRef.current as any);
          });
        });
      }
    };
  }, [learningPad, isOpen, noteMap, onNoteMapChange]);

  const handlePadClick = useCallback((idx: number) => {
    setLearningPad(prev => prev === idx ? null : idx);
  }, []);

  const handleNoteManualChange = useCallback((idx: number, note: number) => {
    const newMap = [...noteMap];
    newMap[idx] = note;
    onNoteMapChange(newMap);
  }, [noteMap, onNoteMapChange]);

  const addCCMapping = useCallback(() => {
    const newCC: MidiCCMapping = {
      ccNumber: 1,
      targetParam: CC_TARGETS[0].id,
      targetLabel: CC_TARGETS[0].label,
      min: 0,
      max: 127,
    };
    onCCMappingsChange([...ccMappings, newCC]);
  }, [ccMappings, onCCMappingsChange]);

  const removeCCMapping = useCallback((idx: number) => {
    onCCMappingsChange(ccMappings.filter((_, i) => i !== idx));
  }, [ccMappings, onCCMappingsChange]);

  const updateCCMapping = useCallback((idx: number, field: keyof MidiCCMapping, value: any) => {
    const updated = ccMappings.map((cc, i) => {
      if (i !== idx) return cc;
      const newCC = { ...cc, [field]: value };
      if (field === 'targetParam') {
        const target = CC_TARGETS.find(t => t.id === value);
        if (target) newCC.targetLabel = target.label;
      }
      return newCC;
    });
    onCCMappingsChange(updated);
  }, [ccMappings, onCCMappingsChange]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="midi-modal__overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="midi-modal"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', bounce: 0.1, duration: 0.35 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="midi-modal__header">
            <div className="midi-modal__title">
              <span className="midi-modal__title-icon">🎹</span>
              <span>MIDI MAPPING</span>
            </div>
            <div className="midi-modal__tabs">
              <button
                className={`midi-modal__tab ${activeTab === 'notes' ? 'midi-modal__tab--active' : ''}`}
                onClick={() => setActiveTab('notes')}
              >
                NOTE MAP
              </button>
              <button
                className={`midi-modal__tab ${activeTab === 'cc' ? 'midi-modal__tab--active' : ''}`}
                onClick={() => setActiveTab('cc')}
              >
                CC ASSIGN
              </button>
            </div>
            <button className="midi-modal__close" onClick={onClose}>✕</button>
          </div>

          {/* Device Bar */}
          {midiDevices.length > 0 && (
            <div className="midi-modal__device-bar">
              <span className="midi-modal__device-label">DEVICES:</span>
              {midiDevices.map(d => (
                <span key={d.id} className="midi-modal__device-pill">{d.name}</span>
              ))}
            </div>
          )}

          {/* Note Map Tab */}
          {activeTab === 'notes' && (
            <div className="midi-modal__notes">
              <div className="midi-modal__info">
                Click a pad to enter <strong>MIDI Learn</strong> mode, then press a key on your controller.
              </div>

              <div className="midi-modal__pad-grid">
                {Array.from({ length: padCount }).map((_, idx) => (
                  <button
                    key={idx}
                    className={`midi-modal__pad ${learningPad === idx ? 'midi-modal__pad--learning' : ''}`}
                    onClick={() => handlePadClick(idx)}
                  >
                    <span className="midi-modal__pad-num">{String(idx + 1).padStart(2, '0')}</span>
                    <span className="midi-modal__pad-name">
                      {padNames?.[idx] || `Pad ${idx + 1}`}
                    </span>
                    <span className="midi-modal__pad-note">
                      {midiNoteName(noteMap[idx] ?? 36 + idx)}
                    </span>
                    {learningPad === idx && (
                      <span className="midi-modal__pad-learn">LISTENING…</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Manual note input */}
              <div className="midi-modal__manual">
                <span className="midi-modal__manual-label">MANUAL:</span>
                <select
                  className="midi-modal__manual-select"
                  value={learningPad ?? ''}
                  onChange={e => setLearningPad(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Select pad…</option>
                  {Array.from({ length: padCount }).map((_, i) => (
                    <option key={i} value={i}>Pad {i + 1}</option>
                  ))}
                </select>
                <input
                  className="midi-modal__manual-input"
                  type="number"
                  min={0}
                  max={127}
                  placeholder="Note #"
                  value={learningPad !== null ? noteMap[learningPad] ?? '' : ''}
                  onChange={e => {
                    if (learningPad !== null) {
                      handleNoteManualChange(learningPad, Number(e.target.value));
                    }
                  }}
                />
              </div>
            </div>
          )}

          {/* CC Mapping Tab */}
          {activeTab === 'cc' && (
            <div className="midi-modal__cc">
              <div className="midi-modal__cc-header">
                <span>CC #</span>
                <span>TARGET PARAMETER</span>
                <span>RANGE</span>
                <span></span>
              </div>

              {ccMappings.map((cc, idx) => (
                <div key={idx} className="midi-modal__cc-row">
                  <input
                    className="midi-modal__cc-num"
                    type="number"
                    min={0}
                    max={127}
                    value={cc.ccNumber}
                    onChange={e => updateCCMapping(idx, 'ccNumber', Number(e.target.value))}
                  />
                  <select
                    className="midi-modal__cc-target"
                    value={cc.targetParam}
                    onChange={e => updateCCMapping(idx, 'targetParam', e.target.value)}
                  >
                    {CC_TARGETS.map(t => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                  <span className="midi-modal__cc-range">
                    {cc.min}–{cc.max}
                  </span>
                  <button
                    className="midi-modal__cc-remove"
                    onClick={() => removeCCMapping(idx)}
                    title="Remove mapping"
                  >
                    ✕
                  </button>
                </div>
              ))}

              <button className="midi-modal__cc-add" onClick={addCCMapping}>
                + Add CC Mapping
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
