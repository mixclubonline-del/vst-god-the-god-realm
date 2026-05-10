/**
 * VST God Forge — DSP Code Generation Engine
 * Chain-aware DSP code generation for JUCE.
 *
 * Supports two modes:
 * 1. **Modular Chain** — Iterates over a user-defined `routingChain` to generate
 *    multi-stage DSP code (e.g., EQ -> Compressor -> Reverb).
 * 2. **Legacy Single-Category** — Falls back to category-based single-module
 *    generation when no `routingChain` is present.
 */

import type { ControlMap, DetectedControl, DSPChainModule, DSPModuleType } from './types';

// ─── DSP Roles ──────────────────────────────────────────────────────────────

export type DSPRole =
  | 'gain_out' | 'gain_in' | 'pan'
  | 'filter_cutoff' | 'filter_q' | 'filter_res' | 'filter_type'
  | 'comp_thresh' | 'comp_ratio' | 'comp_attack' | 'comp_release' | 'comp_makeup' | 'comp_knee'
  | 'delay_time' | 'delay_feedback' | 'delay_mix'
  | 'reverb_size' | 'reverb_damping' | 'reverb_width' | 'reverb_mix' | 'reverb_predelay'
  | 'dist_drive' | 'dist_mix' | 'dist_type'
  | 'lfo_rate' | 'lfo_depth' | 'lfo_sync'
  | 'unknown';

interface DSPWiring {
  controlId: string;
  role: DSPRole;
}

// ─── Synonym Dictionary ─────────────────────────────────────────────────────

const ROLE_SYNONYMS: Record<Exclude<DSPRole, 'unknown'>, string[]> = {
  gain_out: ['vol', 'volume', 'level', 'out', 'output', 'master', 'gain', 'makeup', 'post'],
  gain_in: ['input', 'in', 'drive', 'pre', 'trim', 'gain'],
  pan: ['pan', 'balance', 'stereo', 'width', 'l/r', 'panning'],
  filter_cutoff: ['cutoff', 'freq', 'frequency', 'cut', 'lp', 'hp', 'bp', 'low', 'mid', 'high', 'f'],
  filter_q: ['q', 'bandwidth', 'width', 'peak', 'resonance', 'res', 'bw'],
  filter_res: ['res', 'resonance', 'emphasis', 'peak'],
  filter_type: ['type', 'mode', 'slope', 'order', 'shape'],
  comp_thresh: ['thresh', 'threshold', 'limit', 'sens', 'sensitivity', 'trsh'],
  comp_ratio: ['ratio', 'slope', 'comp', 'rat'],
  comp_attack: ['attack', 'att', 'fast', 'slow', 'atk'],
  comp_release: ['release', 'rel', 'decay', 'rls'],
  comp_makeup: ['makeup', 'gain', 'output', 'boost', 'mup'],
  comp_knee: ['knee', 'soft', 'hard'],
  delay_time: ['time', 'ms', 'rate', 'length', 'sync', 'echo', 'delay', 't'],
  delay_feedback: ['feedback', 'fbk', 'regen', 'repeat', 'regeneration', 'fb', 'fdbk'],
  delay_mix: ['mix', 'wet', 'dry/wet', 'blend', 'amount', 'wetness'],
  reverb_size: ['size', 'room', 'space', 'length', 'decay', 'time', 'depth'],
  reverb_damping: ['damp', 'damping', 'absorb', 'high cut', 'color', 'hf', 'dmp'],
  reverb_width: ['width', 'stereo', 'diffusion', 'spread'],
  reverb_mix: ['mix', 'wet', 'dry/wet', 'blend', 'amount', 'wetness'],
  reverb_predelay: ['predelay', 'pre-delay', 'pre'],
  dist_drive: ['drive', 'dist', 'gain', 'sat', 'saturation', 'crush', 'overdrive', 'character', 'color', 'warmth'],
  dist_mix: ['mix', 'wet', 'dry/wet', 'blend', 'amount', 'wetness'],
  dist_type: ['type', 'mode', 'algorithm', 'shape'],
  lfo_rate: ['rate', 'speed', 'freq', 'frequency', 'time'],
  lfo_depth: ['depth', 'amount', 'mod', 'intensity', 'width'],
  lfo_sync: ['sync', 'tempo', 'host'],
};

const GROUP_BOOSTS: Record<string, Partial<Record<DSPRole, number>>> = {
  'filter': { filter_cutoff: 35, filter_q: 35, filter_type: 35, filter_res: 35 },
  'equalizer': { filter_cutoff: 35, filter_q: 35, filter_type: 35 },
  'eq': { filter_cutoff: 35, filter_q: 35, filter_type: 35 },
  'compressor': { comp_thresh: 35, comp_ratio: 35, comp_attack: 35, comp_release: 35, comp_makeup: 35, comp_knee: 35 },
  'dynamics': { comp_thresh: 35, comp_ratio: 35, comp_attack: 35, comp_release: 35 },
  'gate': { comp_thresh: 35, comp_attack: 35, comp_release: 35 },
  'delay': { delay_time: 35, delay_feedback: 35, delay_mix: 35 },
  'echo': { delay_time: 35, delay_feedback: 35, delay_mix: 35 },
  'reverb': { reverb_size: 35, reverb_mix: 35, reverb_damping: 35, reverb_width: 35, reverb_predelay: 35 },
  'distortion': { dist_drive: 35, dist_mix: 35, dist_type: 35 },
  'saturation': { dist_drive: 35, dist_mix: 35 },
  'drive': { dist_drive: 35 },
  'master': { gain_out: 35, pan: 35 },
  'output': { gain_out: 35 },
  'input': { gain_in: 35 },
  'lfo': { lfo_rate: 35, lfo_depth: 35, lfo_sync: 35 },
  'modulation': { lfo_rate: 35, lfo_depth: 35, lfo_sync: 35 },
  'mod': { lfo_rate: 35, lfo_depth: 35, lfo_sync: 35 },
  'chorus': { lfo_rate: 35, lfo_depth: 35 },
  'phaser': { lfo_rate: 35, lfo_depth: 35, delay_feedback: 30 },
  'limiter': { comp_thresh: 45, gain_out: 20 },
  'env': { comp_attack: 35, comp_release: 35 },
};

// ─── Role Inference ─────────────────────────────────────────────────────────

/** Analyzes a control's label and context to guess its DSP role using a scoring system */
export function inferDSPRole(control: DetectedControl): DSPRole {
  const lbl = control.label.toLowerCase().trim();
  const group = control.group.toLowerCase();
  const roles = Object.keys(ROLE_SYNONYMS) as Exclude<DSPRole, 'unknown'>[];

  let bestRole: DSPRole = 'unknown';
  let bestScore = 0;

  for (const role of roles) {
    let score = 0;
    const synonyms = ROLE_SYNONYMS[role];

    // 1. Exact Match (High Score)
    if (synonyms.some(s => lbl === s)) {
      score += 100;
    }
    // 2. Inclusion Match (Medium Score)
    else if (synonyms.some(s => lbl.includes(s))) {
      score += 50;
    }

    // 3. Group Context Boost
    for (const [groupKey, boosts] of Object.entries(GROUP_BOOSTS)) {
      if (group.includes(groupKey)) {
        if (boosts[role]) {
          score += boosts[role]!;
        }
      }
    }

    // 4. Parameter Metadata Hints
    const param = control.parameter;
    const min = param.min;
    const max = param.max;

    if (param.unit) {
      const unit = param.unit.toLowerCase();
      if (role === 'filter_cutoff' && (unit === 'hz' || unit === 'khz')) score += 40;
      if (role === 'delay_time' && (unit === 'ms' || unit === 's')) score += 40;
      if (role === 'gain_out' && unit === 'db') score += 20;
      if (role.endsWith('_mix') && (unit === '%' || unit === 'wet')) score += 30;
      if (role === 'comp_ratio' && unit === ':1') score += 50;
    }

    // 5. Range Analysis
    if (role === 'filter_cutoff' && max > 5000) score += 30;
    if (role === 'delay_time' && max > 10 && max < 10000) score += 20;
    if (role === 'comp_ratio' && max > 1 && max <= 64) score += 20;
    if (role === 'comp_thresh' && min < -30 && max <= 10) score += 20;

    // 6. Label Regex Units
    if (role === 'filter_cutoff' && /[0-9]+(hz|khz)/i.test(lbl)) score += 60;
    if (role === 'delay_time' && /[0-9]+(ms|s)/i.test(lbl)) score += 60;

    // 7. Special Conflicts / Negative Boosts
    // Attack/Release are likely NOT delay/reverb parameters if not explicitly labeled so
    if ((role === 'delay_time' || role === 'reverb_size') && (lbl.includes('attack') || lbl.includes('release'))) {
      score -= 120;
    }
    // If we're in a non-dynamics group, don't guess compressor roles
    if (role.startsWith('comp_') && !group.includes('comp') && !group.includes('dyn') && !group.includes('gate') && !group.includes('limit')) {
      score -= 80;
    }
    // If we're in a compressor group, "Gain" is likely makeup gain, not master output
    if (role === 'gain_out' && group.includes('comp') && (lbl.includes('gain') || lbl.includes('makeup'))) {
      score -= 60;
    }
    if (role === 'comp_makeup' && group.includes('comp') && (lbl.includes('gain') || lbl.includes('makeup'))) {
      score += 40;
    }

    if (score > bestScore && score >= 40) {
      bestScore = score;
      bestRole = role;
    }
  }

  return bestRole;
}

// ─── Legacy Helpers ─────────────────────────────────────────────────────────

function getWiring(map: ControlMap): DSPWiring[] {
  return map.controls.map(c => ({
    controlId: c.id,
    role: inferDSPRole(c)
  }));
}

/** Maps a category string to a single DSPModuleType for backwards compatibility */
function categoryToModuleType(category: string): DSPModuleType {
  const cat = category.toLowerCase();
  if (cat.includes('eq') || cat.includes('filter')) return 'eq';
  if (cat.includes('comp') || cat.includes('dynamic')) return 'compressor';
  if (cat.includes('reverb') || cat.includes('spatial')) return 'reverb';
  if (cat.includes('delay') || cat.includes('echo')) return 'delay';
  if (cat.includes('dist') || cat.includes('sat')) return 'distortion';
  if (cat.includes('limit')) return 'limiter';
  if (cat.includes('chorus')) return 'chorus';
  if (cat.includes('phaser')) return 'phaser';
  return 'gain'; // Safe fallback
}

/** Infers a single-module chain from the legacy category string */
export function inferChainFromCategory(category: string): DSPChainModule[] {
  const modType = categoryToModuleType(category);
  return [{
    instanceId: `${modType}_1`,
    type: modType,
    index: 1,
    bypassed: false,
  }];
}

/** Resolves the chain: explicit routingChain wins, falls back to legacy inference */
function resolveChain(map: ControlMap): DSPChainModule[] {
  if (map.routingChain && map.routingChain.length > 0) {
    return map.routingChain;
  }
  return inferChainFromCategory(map.category);
}

// ─── Per-Module Code Generation ─────────────────────────────────────────────

function membersForModule(mod: DSPChainModule): string {
  const id = mod.instanceId;
  switch (mod.type) {
    case 'eq':
      return `    juce::dsp::ProcessorDuplicator<juce::dsp::IIR::Filter<float>, juce::dsp::IIR::Coefficients<float>> ${id}_filter;\n`;
    case 'compressor':
      return `    juce::dsp::Compressor<float> ${id}_comp;\n`;
    case 'reverb':
      return `    juce::dsp::Reverb ${id}_reverb;\n    juce::Reverb::Parameters ${id}_reverbParams;\n`;
    case 'delay':
      return `    juce::dsp::DelayLine<float, juce::dsp::DelayLineInterpolationTypes::Linear> ${id}_delay { 44100 };\n    float ${id}_feedback { 0.0f };\n    float ${id}_mix { 0.5f };\n`;
    case 'distortion':
      return `    juce::dsp::WaveShaper<float> ${id}_waveshaper;\n    juce::dsp::Gain<float> ${id}_driveGain;\n    float ${id}_mix { 1.0f };\n`;
    case 'gain':
      return `    juce::dsp::Gain<float> ${id}_gain;\n`;
    case 'chorus':
      return `    juce::dsp::Chorus<float> ${id}_chorus;\n`;
    case 'phaser':
      return `    juce::dsp::Phaser<float> ${id}_phaser;\n`;
    case 'limiter':
      return `    juce::dsp::Limiter<float> ${id}_limiter;\n`;
    default:
      return '';
  }
}

function prepareForModule(mod: DSPChainModule): string {
  const id = mod.instanceId;
  switch (mod.type) {
    case 'eq':
      return `    ${id}_filter.prepare(spec);\n    *${id}_filter.state = *juce::dsp::IIR::Coefficients<float>::makeLowPass(sampleRate, 1000.0f, 0.707f);\n`;
    case 'compressor':
      return `    ${id}_comp.prepare(spec);\n`;
    case 'reverb':
      return `    ${id}_reverb.prepare(spec);\n`;
    case 'delay':
      return `    ${id}_delay.prepare(spec);\n`;
    case 'distortion':
      return `    ${id}_driveGain.prepare(spec);\n    ${id}_waveshaper.prepare(spec);\n    ${id}_waveshaper.functionToUse = [](float x) { return std::tanh(x); };\n`;
    case 'gain':
      return `    ${id}_gain.prepare(spec);\n`;
    case 'chorus':
      return `    ${id}_chorus.prepare(spec);\n`;
    case 'phaser':
      return `    ${id}_phaser.prepare(spec);\n`;
    case 'limiter':
      return `    ${id}_limiter.prepare(spec);\n`;
    default:
      return '';
  }
}

function processBlockForModule(mod: DSPChainModule, wiring: DSPWiring[]): string {
  const id = mod.instanceId;
  let code = `\n    // ── ${mod.instanceId} (${mod.type}) ──\n`;

  // Runtime bypass guard — reads atomic bool from APVTS parameter
  code += `    bypass_${id}.store(apvts.getRawParameterValue("bypass_${id}") != nullptr\n`;
  code += `        ? apvts.getRawParameterValue("bypass_${id}")->load() > 0.5f : ${mod.bypassed ? 'true' : 'false'});\n`;
  code += `    if (!bypass_${id}.load()) {\n`;

  switch (mod.type) {
    case 'eq': {
      const cutoff = wiring.find(w => w.role === 'filter_cutoff');
      const res = wiring.find(w => w.role === 'filter_q' || w.role === 'filter_res');
      const type = wiring.find(w => w.role === 'filter_type');
      code += `    {\n`;
      code += `        float freq = ${cutoff ? `smoothed_${cutoff.controlId}.getNextValue()` : '1000.0f'};\n`;
      code += `        float q    = ${res ? `smoothed_${res.controlId}.getNextValue()` : '0.707f'};\n`;
      code += `        int typeIndex = ${type ? `static_cast<int>(smoothed_${type.controlId}.getNextValue())` : '0'};\n`;
      code += `\n`;
      code += `        if (typeIndex == 1) // HighPass\n`;
      code += `            *${id}_filter.state = *juce::dsp::IIR::Coefficients<float>::makeHighPass(getSampleRate(), freq, q);\n`;
      code += `        else if (typeIndex == 2) // BandPass\n`;
      code += `            *${id}_filter.state = *juce::dsp::IIR::Coefficients<float>::makeBandPass(getSampleRate(), freq, q);\n`;
      code += `        else // LowPass (Default)\n`;
      code += `            *${id}_filter.state = *juce::dsp::IIR::Coefficients<float>::makeLowPass(getSampleRate(), freq, q);\n`;
      code += `\n`;
      code += `        ${id}_filter.process(context);\n`;
      code += `    }\n`;
      break;
    }

    case 'compressor': {
      const thresh = wiring.find(w => w.role === 'comp_thresh');
      const ratio = wiring.find(w => w.role === 'comp_ratio');
      const att = wiring.find(w => w.role === 'comp_attack');
      const rel = wiring.find(w => w.role === 'comp_release');
      const knee = wiring.find(w => w.role === 'comp_knee');
      const makeup = wiring.find(w => w.role === 'comp_makeup');
      code += `    ${id}_comp.setThreshold(${thresh ? `smoothed_${thresh.controlId}.getNextValue()` : '-20.0f'});\n`;
      code += `    ${id}_comp.setRatio(${ratio ? `smoothed_${ratio.controlId}.getNextValue()` : '4.0f'});\n`;
      code += `    ${id}_comp.setAttack(${att ? `smoothed_${att.controlId}.getNextValue()` : '5.0f'});\n`;
      code += `    ${id}_comp.setRelease(${rel ? `smoothed_${rel.controlId}.getNextValue()` : '50.0f'});\n`;
      if (knee) code += `    ${id}_comp.setKnee(smoothed_${knee.controlId}.getNextValue());\n`;
      if (makeup) code += `    ${id}_comp.setMakeupGain(smoothed_${makeup.controlId}.getNextValue());\n`;
      code += `    ${id}_comp.process(context);\n`;
      break;
    }

    case 'reverb': {
      const size = wiring.find(w => w.role === 'reverb_size');
      const damp = wiring.find(w => w.role === 'reverb_damping');
      const width = wiring.find(w => w.role === 'reverb_width');
      const mix = wiring.find(w => w.role === 'reverb_mix');
      code += `    ${id}_reverbParams.roomSize = ${size ? `smoothed_${size.controlId}.getNextValue()` : '0.5f'};\n`;
      code += `    ${id}_reverbParams.damping  = ${damp ? `smoothed_${damp.controlId}.getNextValue()` : '0.5f'};\n`;
      code += `    ${id}_reverbParams.width    = ${width ? `smoothed_${width.controlId}.getNextValue()` : '1.0f'};\n`;
      code += `    ${id}_reverbParams.wetLevel = ${mix ? `smoothed_${mix.controlId}.getNextValue()` : '0.33f'};\n`;
      code += `    ${id}_reverbParams.dryLevel = 1.0f - ${id}_reverbParams.wetLevel;\n`;
      code += `    ${id}_reverb.setParameters(${id}_reverbParams);\n`;
      code += `    ${id}_reverb.process(context);\n`;
      break;
    }

    case 'delay': {
      const time = wiring.find(w => w.role === 'delay_time');
      const fbk = wiring.find(w => w.role === 'delay_feedback');
      const mix = wiring.find(w => w.role === 'delay_mix');
      code += `    {\n`;
      code += `        float currentMix = ${mix ? `smoothed_${mix.controlId}.getNextValue()` : '0.5f'};\n`;
      code += `        ${id}_delay.setDelay(${time ? `smoothed_${time.controlId}.getNextValue()` : '500.0f'} * getSampleRate() / 1000.0f);\n`;
      code += `\n`;
      code += `        for (int channel = 0; channel < totalNumInputChannels; ++channel) {\n`;
      code += `            auto* channelData = buffer.getWritePointer(channel);\n`;
      code += `            for (int sample = 0; sample < buffer.getNumSamples(); ++sample) {\n`;
      code += `                float in = channelData[sample];\n`;
      code += `                float delayed = ${id}_delay.popSample(channel);\n`;
      code += `                ${id}_delay.pushSample(channel, in + delayed * ${fbk ? `smoothed_${fbk.controlId}.getNextValue()` : '0.3f'});\n`;
      code += `                channelData[sample] = in * (1.0f - currentMix) + delayed * currentMix;\n`;
      code += `            }\n`;
      code += `        }\n`;
      code += `    }\n`;
      break;
    }

    case 'distortion': {
      const drive = wiring.find(w => w.role === 'dist_drive');
      const mix = wiring.find(w => w.role === 'dist_mix');
      const type = wiring.find(w => w.role === 'dist_type');
      code += `    {\n`;
      code += `        float currentMix = ${mix ? `smoothed_${mix.controlId}.getNextValue() / 100.0f` : '1.0f'};\n`;
      if (type) {
        code += `        int distType = static_cast<int>(smoothed_${type.controlId}.getNextValue());\n`;
        code += `        if (distType == 1) ${id}_waveshaper.functionToUse = [](float x) { return std::atan(x); };\n`;
        code += `        else if (distType == 2) ${id}_waveshaper.functionToUse = [](float x) { return x / (1.0f + std::abs(x)); };\n`;
        code += `        else ${id}_waveshaper.functionToUse = [](float x) { return std::tanh(x); };\n`;
      }
      code += `\n`;
      code += `        for (int channel = 0; channel < totalNumInputChannels; ++channel) {\n`;
      code += `            auto* channelData = buffer.getWritePointer(channel);\n`;
      code += `            for (int sample = 0; sample < buffer.getNumSamples(); ++sample) {\n`;
      code += `                float in = channelData[sample];\n`;
      code += `                float driven = in * juce::Decibels::decibelsToGain(${drive ? `smoothed_${drive.controlId}.getNextValue()` : '0.0f'});\n`;
      code += `                float saturated = ${id}_waveshaper.processSample(driven);\n`;
      code += `                channelData[sample] = in * (1.0f - currentMix) + saturated * currentMix;\n`;
      code += `            }\n`;
      code += `        }\n`;
      code += `    }\n`;
      break;
    }

    case 'gain': {
      const outGain = wiring.find(w => w.role === 'gain_out' || w.role === 'gain_in' || w.role === 'comp_makeup');
      code += `    ${id}_gain.setGainLinear(${outGain ? `juce::Decibels::decibelsToGain(smoothed_${outGain.controlId}.getNextValue())` : '1.0f'});\n`;
      code += `    ${id}_gain.process(context);\n`;
      break;
    }

    case 'chorus': {
      const rate = wiring.find(w => w.role === 'lfo_rate');
      const depth = wiring.find(w => w.role === 'lfo_depth');
      code += `    ${id}_chorus.setRate(${rate ? `smoothed_${rate.controlId}.getNextValue()` : '1.0f'});\n`;
      code += `    ${id}_chorus.setDepth(${depth ? `smoothed_${depth.controlId}.getNextValue()` : '0.5f'});\n`;
      code += `    ${id}_chorus.process(context);\n`;
      break;
    }

    case 'phaser': {
      const rate = wiring.find(w => w.role === 'lfo_rate');
      const depth = wiring.find(w => w.role === 'lfo_depth');
      code += `    ${id}_phaser.setRate(${rate ? `smoothed_${rate.controlId}.getNextValue()` : '1.0f'});\n`;
      code += `    ${id}_phaser.setDepth(${depth ? `smoothed_${depth.controlId}.getNextValue()` : '0.5f'});\n`;
      code += `    ${id}_phaser.process(context);\n`;
      break;
    }

    case 'limiter': {
      const thresh = wiring.find(w => w.role === 'comp_thresh');
      code += `    ${id}_limiter.setThreshold(${thresh ? `smoothed_${thresh.controlId}.getNextValue()` : '-1.0f'});\n`;
      code += `    ${id}_limiter.setRelease(100.0f);\n`;
      code += `    ${id}_limiter.process(context);\n`;
      break;
    }
  }

  // Close the bypass guard
  code += `    } // end bypass_${id}\n`;

  return code;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function generateDSPIncludes(_category: string): string {
  return `#include <juce_dsp/juce_dsp.h>\n`;
}

export function generateDSPMembers(category: string, map: ControlMap): string {
  const chain = resolveChain(map);
  const wiring = getWiring(map);

  let members = `\n    // ── DSP Modules (Signal Chain: ${chain.map(m => m.instanceId).join(' → ')}) ──\n`;

  for (const mod of chain) {
    members += membersForModule(mod);
  }

  // Per-Module Bypass Flags
  members += `\n    // ── Per-Module Bypass Flags ──\n`;
  for (const mod of chain) {
    members += `    std::atomic<bool> bypass_${mod.instanceId} { ${mod.bypassed ? 'true' : 'false'} };\n`;
  }

  // Parameter Smoothing
  members += `\n    // ── Parameter Smoothing ──\n`;
  for (const w of wiring) {
    if (w.role !== 'unknown') {
      members += `    juce::SmoothedValue<float> smoothed_${w.controlId} { 0.0f };\n`;
    }
  }

  return members;
}

export function generatePrepareToPlay(category: string, map: ControlMap): string {
  const chain = resolveChain(map);
  const wiring = getWiring(map);

  let code = `
    juce::dsp::ProcessSpec spec;
    spec.sampleRate = sampleRate;
    spec.maximumBlockSize = samplesPerBlock;
    spec.numChannels = getTotalNumOutputChannels();
`;

  // Prepare each module in chain order
  for (const mod of chain) {
    code += prepareForModule(mod);
  }

  // Reset smoothers
  for (const w of wiring) {
    if (w.role !== 'unknown') {
      code += `    smoothed_${w.controlId}.reset(sampleRate, 0.05); // 50ms smoothing\n`;
    }
  }

  return code;
}

export function generateDSPBlock(category: string, map: ControlMap): string {
  const chain = resolveChain(map);
  const wiring = getWiring(map);

  let code = `
    juce::ScopedNoDenormals noDenormals;
    auto totalNumInputChannels  = getTotalNumInputChannels();
    auto totalNumOutputChannels = getTotalNumOutputChannels();

    for (auto i = totalNumInputChannels; i < totalNumOutputChannels; ++i)
        buffer.clear (i, 0, buffer.getNumSamples());

    // 1. Update Smoothed Parameters
`;

  for (const w of wiring) {
    if (w.role !== 'unknown') {
      code += `    if (auto* param = apvts.getRawParameterValue("${w.controlId}"))\n`;
      code += `        smoothed_${w.controlId}.setTargetValue(param->load());\n`;
    }
  }

  code += `
    // 2. Process Signal Chain (${chain.length} module${chain.length !== 1 ? 's' : ''})
    juce::dsp::AudioBlock<float> block(buffer);
    juce::dsp::ProcessContextReplacing<float> context(block);
`;

  // Process each module in chain order (with runtime bypass guards)
  for (const mod of chain) {
    code += processBlockForModule(mod, wiring);
  }

  code += `\n`;
  return code;
}

// ─── Bypass Parameter Generation ────────────────────────────────────────────

/**
 * Generates APVTS parameter definitions for per-module bypass toggles.
 * Call this when building the AudioProcessorValueTreeState layout.
 */
export function generateBypassParameters(map: ControlMap): string {
  const chain = resolveChain(map);
  let code = `\n    // ── Per-Module Bypass Parameters ──\n`;

  for (const mod of chain) {
    code += `    params.push_back(std::make_unique<juce::AudioParameterBool>(\n`;
    code += `        "bypass_${mod.instanceId}", "Bypass ${mod.instanceId}", ${mod.bypassed ? 'true' : 'false'}));\n`;
  }

  return code;
}
