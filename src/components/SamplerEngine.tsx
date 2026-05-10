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
  onNeuralForge: () => void;
  isNeuralPanelOpen: boolean;
  onCloseNeuralPanel: () => void;
  onApplyNeuralSuggestion: (suggestion: any) => void;
  engineRef: any;
}

const SLOT_NAMES = [
  'CELESTIAL PAD',
  'MYTHIC LEAD',
  'UNDERWORLD BASS',
  'ETHEREAL PLUCK',
  'DIVINE TEXTURE',
  'OLYMPUS KEYS'
];

export const SamplerEngine: React.FC<SamplerEngineProps> = ({
  parameterValues,
  update,
  slotLevels,
  arpStep,
  vortexAnchors,
  onNeuralForge,
  isNeuralPanelOpen,
  onCloseNeuralPanel,
  onApplyNeuralSuggestion,
  engineRef
}) => {
  const activePad = parameterValues.activePad || 0;

  return (
    <div className="vg-panel vg-multirealm overflow-y-auto pr-2 h-full flex flex-col">
      {/* ── Cinematic Hero Header ── */}
      <div className="vg-hero-header shrink-0">
        <div className="vg-divine-rays" />
        <div className="vg-light-leak" />
        <img 
          src="https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=2070&auto=format&fit=crop" 
          className="vg-hero-canvas" 
          alt="The God Realm"
        />
        <div className="vg-hero-scrim" />
        <div className="vg-hero-content">
          <div className="flex flex-col">
            <h2 className="text-4xl font-black text-white leading-none">THE FORGE</h2>
            <span className="text-[10px] font-bold text-red-500 tracking-[0.4em] uppercase mt-1">Multi-Layer Synthesis Realm</span>
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col items-end">
              <span className="text-[8px] font-bold text-white/30 uppercase">Active Slots</span>
              <span className="text-xl font-black text-white">6 / 6</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 6-Slot Sound Stack ── */}
      <div className="vg-realm-stack shrink-0">
        {SLOT_NAMES.map((name, i) => (
          <SoundSlot 
            key={i}
            id={i}
            name={name}
            isActive={activePad === i}
            onSelect={() => update('activePad', i)}
            onToggle={(active) => {
              // Logic to enable/disable engine layer
              update(`slotPower_${i}`, active);
            }}
            parameterValues={parameterValues}
            update={update}
            level={slotLevels[i]}
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
          onSaveVortexAnchor={(x, y, name) => engineRef.current?.saveVortexAnchor(x, y, name)}
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
        activeSlots={SLOT_NAMES.map(name => ({ name, enabled: true }))}
        onApplySuggestion={onApplyNeuralSuggestion}
      />
    </div>
  );
};
