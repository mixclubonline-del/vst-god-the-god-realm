import React from 'react';
import { SoundSlot } from './SoundSlot';
import { MultiControlPanel } from './MultiControlPanel';
import { RealmDashboard } from './RealmDashboard';
import { NeuralSuggestPanel } from './NeuralSuggestPanel';

interface SamplerEngineProps {
  parameterValues: Record<string, any>;
  update: (id: string, val: any) => void;
  slotLevels: number[];
  arpStep: number;
  vortexAnchors: any[];
  midiActivity?: boolean[];
  onNeuralForge: () => void;
  isNeuralPanelOpen: boolean;
  onCloseNeuralPanel: () => void;
  onApplyNeuralSuggestion: (suggestion: any) => void;
}

const SLOT_NAMES = [
  'CELESTIAL PAD',
  'MYTHIC LEAD',
  'UNDERWORLD BASS',
  'ETHEREAL PLUCK',
  'DIVINE TEXTURE',
  'OLYMPUS KEYS'
];

const SLOT_REALMS = [
  { realm: 'celestial', icon: '☁️', color: '#00d4ff', knobVariant: 'celestial-blue' as const },
  { realm: 'olympus',   icon: '⚡', color: '#ffd700', knobVariant: 'celestial' as const },
  { realm: 'inferno',   icon: '🔥', color: '#ff3322', knobVariant: 'infernal' as const },
  { realm: 'starfield', icon: '✨', color: '#b366ff', knobVariant: 'mystical' as const },
  { realm: 'eden',      icon: '🌿', color: '#33ff88', knobVariant: 'eden-green' as const },
  { realm: 'aether',    icon: '🌊', color: '#ff8844', knobVariant: 'marble-gold' as const },
];

export const SamplerEngine: React.FC<SamplerEngineProps> = ({
  parameterValues,
  update,
  slotLevels,
  arpStep,
  vortexAnchors,
  midiActivity = [],
  onNeuralForge,
  isNeuralPanelOpen,
  onCloseNeuralPanel,
  onApplyNeuralSuggestion
}) => {
  const activePad = parameterValues.activePad || 0;
  const activeSlots = SLOT_NAMES.map((fallbackName, i) => ({
    name: parameterValues[`slotName_${i}`] || fallbackName,
    room: parameterValues[`slotRoom_${i}`],
    category: parameterValues[`slotCategory_${i}`],
  }));

  return (
    <div className="vg-panel vg-multirealm overflow-y-auto pr-2 h-full flex flex-col">
      {/* ── Cinematic Hero Header ── */}
      <div className="vg-hero-header shrink-0">
        <div className="vg-divine-rays" />
        <div className="vg-light-leak" />
        <img 
          src="/images/archive/hero_forge.png" 
          className="vg-hero-canvas" 
          alt="The God Realm"
        />
        <div className="vg-hero-scrim" />
        <div className="vg-hero-content">
          <div className="flex flex-col">
            <h2 className="text-4xl font-black text-white leading-none">THE FORGE</h2>
            <span className="text-[10px] font-bold text-red-500 tracking-[0.4em] uppercase mt-1">Multi-Layer Synthesis Realm</span>
          </div>
          <div className="flex gap-4 items-center">
            {/* Play Mode Selector */}
            <div className="flex flex-col items-start mr-2">
              <span className="text-[8px] font-bold text-white/30 uppercase mb-1">Play Mode</span>
              <div className="flex bg-black/40 p-0.5 rounded-md border border-white/5 gap-0.5">
                {['Layer', 'RR', 'Rnd'].map((mode, idx) => {
                  const active = (parameterValues.slotPlayMode || 0) === idx;
                  return (
                    <button
                      key={mode}
                      onClick={() => update('slotPlayMode', idx)}
                      className={`px-2 py-0.5 text-[9px] font-bold rounded uppercase transition-all ${
                        active 
                          ? 'bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]' 
                          : 'text-white/40 hover:text-white/80 hover:bg-white/5'
                      }`}
                    >
                      {mode}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col items-end border-l border-white/10 pl-4">
              <span className="text-[8px] font-bold text-white/30 uppercase">Active Slots</span>
              <span className="text-xl font-black text-white">
                {activeSlots.filter((_, i) => parameterValues[`slotPower_${i}`] !== false).length} / 6
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 6-Slot Sound Stack ── */}
      <div className="vg-realm-stack shrink-0">
        {activeSlots.map((slot, i) => (
          <SoundSlot 
            key={i}
            id={i}
            name={slot.name}
            room={slot.room}
            category={slot.category}
            realm={SLOT_REALMS[i].realm}
            realmIcon={SLOT_REALMS[i].icon}
            realmColor={SLOT_REALMS[i].color}
            realmKnobVariant={SLOT_REALMS[i].knobVariant}
            isActive={activePad === i}
            onSelect={() => update('activePad', i)}
            onToggle={(active) => {
              update(`slotPower_${i}`, active);
            }}
            parameterValues={parameterValues}
            update={update}
            level={slotLevels[i]}
            midiActivity={midiActivity[i] || false}
          />
        ))}
      </div>

      {/* ── Multi Control Center ── */}
      <div className="mt-4 shrink-0">
        <MultiControlPanel 
          parameterValues={parameterValues}
          update={update}
          currentStep={arpStep}
          vortexAnchors={vortexAnchors}
          onSaveVortexAnchor={(x, y, name) => { /* TODO: Implement Native Backend Vortex Save */ }}
        />
      </div>

      {/* ── Realm FX & Master Stage ── */}
      <div className="mt-4 shrink-0 pb-8">
        <RealmDashboard 
          parameterValues={parameterValues}
          update={update}
          onNeuralForge={onNeuralForge}
        />
      </div>

      <NeuralSuggestPanel 
        isOpen={isNeuralPanelOpen}
        onClose={onCloseNeuralPanel}
        activeSlots={activeSlots.map(slot => ({ name: slot.name, enabled: true }))}
        onApplySuggestion={onApplyNeuralSuggestion}
      />
    </div>
  );
};
