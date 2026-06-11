/**
 * SacredMidiMapper — MIDI Controller Mapping Panel
 *
 * Features:
 *  - Connected device list with status indicators
 *  - MIDI Learn toggle (pulses when active)
 *  - Mapping table: CC# → Parameter with remove buttons
 *  - Mappable target list (click to start Learn)
 *  - Live CC activity meters
 */
import React, { useState } from 'react';
import type { MidiMapping, MidiMappableTarget, MidiCCKey } from '../../services/types';
import './SacredMidiMapper.css';

interface SacredMidiMapperProps {
  mappings: MidiMapping[];
  targets: MidiMappableTarget[];
  isLearning: boolean;
  learningTargetId: string | null;
  connectedDevices: string[];
  ccActivity: Map<MidiCCKey, number>;
  onStartLearn: (targetId: string) => void;
  onCancelLearn: () => void;
  onRemoveMapping: (ccKey: MidiCCKey) => void;
  onClearAll: () => void;
  onClose: () => void;
}

export const SacredMidiMapper: React.FC<SacredMidiMapperProps> = ({
  mappings,
  targets,
  isLearning,
  learningTargetId,
  connectedDevices,
  ccActivity,
  onStartLearn,
  onCancelLearn,
  onRemoveMapping,
  onClearAll,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'mappings' | 'targets'>('targets');

  // Group targets by group field
  const targetGroups = new Map<string, MidiMappableTarget[]>();
  for (const t of targets) {
    const list = targetGroups.get(t.group) ?? [];
    list.push(t);
    targetGroups.set(t.group, list);
  }

  // Find mapping for a target
  const getMappingForTarget = (targetId: string): MidiMapping | undefined => {
    return mappings.find(m => m.targetId === targetId);
  };

  return (
    <div className={`midi-mapper ${isLearning ? 'midi-mapper--learning' : ''}`}>
      {/* Header */}
      <div className="midi-mapper__header">
        <div className="midi-mapper__title">
          <span className="midi-mapper__icon">🎛️</span>
          <span>MIDI MAPPING</span>
          {isLearning && (
            <span className="midi-mapper__learn-badge">LEARN</span>
          )}
        </div>
        <div className="midi-mapper__header-actions">
          {isLearning && (
            <button
              className="midi-mapper__btn midi-mapper__btn--cancel"
              onClick={onCancelLearn}
            >
              Cancel
            </button>
          )}
          <button
            className="midi-mapper__btn midi-mapper__btn--clear"
            onClick={onClearAll}
            title="Clear all mappings"
          >
            Clear All
          </button>
          <button
            className="midi-mapper__close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Devices */}
      <div className="midi-mapper__devices">
        {connectedDevices.length === 0 ? (
          <div className="midi-mapper__no-devices">
            <span className="midi-mapper__no-devices-icon">⚡</span>
            No MIDI devices connected
          </div>
        ) : (
          connectedDevices.map((name, i) => (
            <div key={i} className="midi-mapper__device">
              <span className="midi-mapper__device-dot" />
              <span className="midi-mapper__device-name">{name}</span>
            </div>
          ))
        )}
      </div>

      {/* Tabs */}
      <div className="midi-mapper__tabs">
        <button
          className={`midi-mapper__tab ${activeTab === 'targets' ? 'midi-mapper__tab--active' : ''}`}
          onClick={() => setActiveTab('targets')}
        >
          Parameters ({targets.length})
        </button>
        <button
          className={`midi-mapper__tab ${activeTab === 'mappings' ? 'midi-mapper__tab--active' : ''}`}
          onClick={() => setActiveTab('mappings')}
        >
          Mappings ({mappings.length})
        </button>
      </div>

      {/* Content */}
      <div className="midi-mapper__content">
        {activeTab === 'targets' ? (
          /* ─── Targets Tab ─── */
          <div className="midi-mapper__targets">
            {isLearning && (
              <div className="midi-mapper__learn-hint">
                ⚡ Move a knob/fader on your MIDI controller to map it to <strong>{targets.find(t => t.id === learningTargetId)?.label ?? learningTargetId}</strong>
              </div>
            )}
            {Array.from(targetGroups.entries()).map(([group, groupTargets]) => (
              <div key={group} className="midi-mapper__group">
                <div className="midi-mapper__group-label">{group}</div>
                {groupTargets.map(target => {
                  const mapping = getMappingForTarget(target.id);
                  const isLearningThis = learningTargetId === target.id;
                  return (
                    <div
                      key={target.id}
                      className={`midi-mapper__target ${mapping ? 'midi-mapper__target--mapped' : ''} ${isLearningThis ? 'midi-mapper__target--learning' : ''}`}
                      onClick={() => {
                        if (isLearning && isLearningThis) {
                          onCancelLearn();
                        } else {
                          onStartLearn(target.id);
                        }
                      }}
                    >
                      <span className="midi-mapper__target-label">{target.label}</span>
                      {mapping ? (
                        <span className="midi-mapper__target-cc">
                          CC{mapping.cc}
                          <span className="midi-mapper__target-cc-activity">
                            <span
                              className="midi-mapper__target-cc-bar"
                              style={{ width: `${((ccActivity.get(mapping.ccKey) ?? 0) / 127) * 100}%` }}
                            />
                          </span>
                        </span>
                      ) : (
                        <span className="midi-mapper__target-unassigned">
                          {isLearningThis ? '⏳ Waiting…' : 'Click to map'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          /* ─── Mappings Tab ─── */
          <div className="midi-mapper__mapping-list">
            {mappings.length === 0 ? (
              <div className="midi-mapper__empty">
                No mappings yet. Click a parameter in the Parameters tab to start mapping.
              </div>
            ) : (
              mappings.map(mapping => (
                <div key={mapping.ccKey} className="midi-mapper__mapping-row">
                  <div className="midi-mapper__mapping-source">
                    <span className="midi-mapper__mapping-cc">CC {mapping.cc}</span>
                    <span className="midi-mapper__mapping-channel">Ch {mapping.channel + 1}</span>
                  </div>
                  <span className="midi-mapper__mapping-arrow">→</span>
                  <div className="midi-mapper__mapping-target">
                    <span className="midi-mapper__mapping-target-label">{mapping.targetLabel}</span>
                    {mapping.deviceName && (
                      <span className="midi-mapper__mapping-device">{mapping.deviceName}</span>
                    )}
                  </div>
                  {/* Activity meter */}
                  <div className="midi-mapper__mapping-activity">
                    <div
                      className="midi-mapper__mapping-activity-bar"
                      style={{ width: `${((ccActivity.get(mapping.ccKey) ?? 0) / 127) * 100}%` }}
                    />
                  </div>
                  <button
                    className="midi-mapper__mapping-remove"
                    onClick={() => onRemoveMapping(mapping.ccKey)}
                    title="Remove mapping"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
