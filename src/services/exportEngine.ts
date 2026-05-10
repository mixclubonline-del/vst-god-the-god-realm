/**
 * VST God Forge — Export Engine
 * Converts a ControlMap into multiple export formats:
 * React TSX, VST Spec JSON, JUCE C++ templates, and documentation.
 */

import type {
  ControlMap, DetectedControl, VSTSpec, ExportBundle, ExportFile
} from './types';
import { generateDSPIncludes, generateDSPMembers, generatePrepareToPlay, generateDSPBlock, generateBypassParameters } from './dspCodegen';

// ─── Helpers ────────────────────────────────────────────────────────────────

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '').replace(/^[0-9]/, '_$&');
}

function pascalCase(str: string): string {
  return str.replace(/[^a-zA-Z0-9 ]/g, '').split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
}

function camelCase(str: string): string {
  const p = pascalCase(str);
  return p.charAt(0).toLowerCase() + p.slice(1);
}

function snakeCase(str: string): string {
  return str.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase().replace(/_+/g, '_');
}

// ─── Master Export ──────────────────────────────────────────────────────────

export function exportPluginBundle(controlMap: ControlMap): ExportBundle {
  const projectName = sanitizeName(controlMap.pluginName) || 'CustomPlugin';

  const files: ExportFile[] = [
    generateReactComponent(controlMap, projectName),
    generateVSTSpec(controlMap, projectName),
    generateDocs(controlMap, projectName),
    generateStylesheet(controlMap, projectName),
    ...generateJUCEFiles(controlMap, projectName),
  ];

  if (controlMap.imageData) {
    files.push({
      filename: 'Resources/background.png',
      content: controlMap.imageData,
      language: 'png',
    });
  }


  return {
    projectName,
    files,
    exportedAt: new Date().toISOString(),
  };
}

// ─── 1. React TSX Generator ────────────────────────────────────────────────

function generateReactComponent(map: ControlMap, name: string): ExportFile {
  const componentName = pascalCase(name) + 'Plugin';
  const knobs = map.controls.filter(c => c.type === 'knob');
  const sliders = map.controls.filter(c => c.type === 'slider');
  const buttons = map.controls.filter(c => c.type === 'button');
  const toggles = map.controls.filter(c => c.type === 'toggle');
  const dropdowns = map.controls.filter(c => c.type === 'dropdown');
  const displays = map.controls.filter(c => ['display','meter','waveform'].includes(c.type));
  const tabs = map.controls.filter(c => c.type === 'tab');
  const lists = map.controls.filter(c => c.type === 'list');
  const textFields = map.controls.filter(c => c.type === 'text_field');

  const stateLines = map.controls
    .filter(c => ['knob','slider','toggle','dropdown','text_field'].includes(c.type))
    .map(c => `  const [${camelCase(c.id)}, set${pascalCase(c.id)}] = useState(${
      c.type === 'toggle' ? 'false' :
      c.type === 'dropdown' ? `'${c.options?.[0] || ''}'` :
      c.type === 'text_field' ? `''` :
      String(c.parameter.default)
    });`)
    .join('\n');

  const renderControl = (c: DetectedControl): string => {
    const style = `position:'absolute', left:'${c.position.x}%', top:'${c.position.y}%', width:'${c.position.width}%', height:'${c.position.height}%'`;

    switch (c.type) {
      case 'knob':
      case 'slider':
        return `
        {/* ${c.label} (${c.type}) */}
        <div style={{${style}}} className="control-group" title="${c.label}">
          <label className="control-label">${c.label}</label>
          <input
            type="range"
            min={${c.parameter.min}}
            max={${c.parameter.max}}
            value={${camelCase(c.id)}}
            onChange={e => set${pascalCase(c.id)}(Number(e.target.value))}
            className="${c.type === 'knob' ? 'rotary-knob' : 'linear-fader'}"
          />
          <span className="control-value">{${camelCase(c.id)}}${c.parameter.unit ? ` + ' ${c.parameter.unit}'` : ''}</span>
        </div>`;

      case 'button':
        return `
        {/* ${c.label} */}
        <button
          style={{${style}}}
          className="plugin-button"
          onClick={() => console.log('${c.label} clicked')}
        >${c.label}</button>`;

      case 'toggle':
        return `
        {/* ${c.label} */}
        <div style={{${style}}} className="toggle-control">
          <label>
            <input type="checkbox" checked={${camelCase(c.id)}} onChange={e => set${pascalCase(c.id)}(e.target.checked)} />
            <span>${c.label}</span>
          </label>
        </div>`;

      case 'dropdown':
        return `
        {/* ${c.label} */}
        <select
          style={{${style}}}
          className="plugin-dropdown"
          value={${camelCase(c.id)}}
          onChange={e => set${pascalCase(c.id)}(e.target.value)}
        >
          ${(c.options || ['Option 1']).map(o => `<option value="${o}">${o}</option>`).join('\n          ')}
        </select>`;

      case 'tab':
        return `
        {/* Tab: ${c.label} */}
        <button style={{${style}}} className="plugin-tab">${c.label}</button>`;

      default:
        return `
        {/* ${c.label} (${c.type}) */}
        <div style={{${style}}} className="plugin-display">${c.label}</div>`;
    }
  };

  const controlElements = map.controls.map(renderControl).join('\n');

  // Build tab-aware rendering if multi-tab
  const hasMultipleTabs = map.tabs.length > 1;
  let bodyJSX: string;

  if (hasMultipleTabs) {
    const tabButtons = map.tabs.map((t, i) =>
      `          <button
            key="${t.name}"
            onClick={() => setActiveTab('${t.name}')}
            className={\`plugin-tab \${activeTab === '${t.name}' ? 'active' : ''}\`}
          >${t.name}</button>`
    ).join('\n');

    const tabPanels = map.tabs.map(t => {
      const tabControls = map.controls.filter(
        c => c.sourceTab === t.name || c.sourceTab === 'shared'
      );
      return `
        {activeTab === '${t.name}' && (
          <div className="tab-panel">
${tabControls.map(renderControl).join('\n')}
          </div>
        )}`;
    }).join('\n');

    bodyJSX = `
      {/* Tab Navigation */}
      <div className="tab-bar" style={{display:'flex',gap:4,padding:'4px 8px',position:'relative',zIndex:10}}>
${tabButtons}
      </div>

      {/* Tab Panels */}
${tabPanels}`;
  } else {
    bodyJSX = `
      {/* ─── Detected Controls Overlay ─────────────────────────────── */}
${controlElements}`;
  }

  // Extra state for tabs
  const tabState = hasMultipleTabs
    ? `\n  const [activeTab, setActiveTab] = useState('${map.tabs[0]?.name || ''}');`
    : '';

  const tsx = `/**
 * ${componentName} — Generated by VST God Forge
 * Plugin: ${map.pluginName}
 * Category: ${map.category}
 * Controls: ${map.controls.length}
 * Tabs: ${map.tabs.length}
 * Generated: ${new Date().toISOString()}
 */

import React, { useState, useCallback } from 'react';
import './${name}-theme.css';

interface ${componentName}Props {
  width?: number;
  height?: number;
  onParameterChange?: (paramId: string, value: number | string | boolean) => void;
}

export const ${componentName}: React.FC<${componentName}Props> = ({
  width = ${map.dimensions.width},
  height = ${map.dimensions.height},
  onParameterChange,
}) => {
  // ─── Parameter State ──────────────────────────────────────────────
${stateLines}${tabState}

  return (
    <div
      className="plugin-window"
      style={{
        width,
        height,
        position: 'relative',
        backgroundImage: 'url(data:${map.imageMimeType};base64,${map.imageData.substring(0, 50)}...)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        overflow: 'hidden',
        fontFamily: "'Inter', sans-serif",
      }}
    >
${bodyJSX}
    </div>
  );
};

export default ${componentName};
`;

  return { filename: `${componentName}.tsx`, content: tsx, language: 'tsx' };
}

// ─── 2. VST Spec JSON Generator ────────────────────────────────────────────

function generateVSTSpec(map: ControlMap, name: string): ExportFile {
  const spec: VSTSpec = {
    plugin: {
      name: map.pluginName,
      manufacturer: map.manufacturer,
      category: map.category,
      version: map.version,
    },
    parameters: map.controls
      .filter(c => ['knob','slider','toggle','dropdown'].includes(c.type))
      .map(c => ({
        id: c.id,
        name: c.parameter.name,
        label: c.label,
        group: c.group,
        min: c.parameter.min,
        max: c.parameter.max,
        default: c.parameter.default,
        unit: c.parameter.unit,
        curve: c.parameter.curve,
        automatable: c.parameter.automatable,
      })),
    audioProcessing: {
      inputChannels: 2,
      outputChannels: 2,
      algorithm: `${map.category.toLowerCase()}_processor`,
      routingChain: map.routingChain,
    },
    ui: {
      width: map.dimensions.width,
      height: map.dimensions.height,
      tabs: map.tabs,
      controls: map.controls.map(c => ({
        id: c.id,
        type: c.type,
        label: c.label,
        group: c.group,
        parameterId: c.id,
        position: c.position,
        variant: c.variant,
        options: c.options,
      })),
    },
  };

  return {
    filename: `${name}.vst-spec.json`,
    content: JSON.stringify(spec, null, 2),
    language: 'json',
  };
}

// ─── 3. JUCE C++ Template Generator (Option B) ─────────────────────────────

function generateJUCEFiles(map: ControlMap, name: string): ExportFile[] {
  const className = pascalCase(name);
  const params = map.controls.filter(c => ['knob','slider','toggle','dropdown'].includes(c.type));

  // ── PluginProcessor.h ──
  const processorH = `#pragma once
#include <JuceHeader.h>
${generateDSPIncludes(map.category)}

class ${className}Processor : public juce::AudioProcessor
{
public:
    ${className}Processor();
    ~${className}Processor() override;

    void prepareToPlay(double sampleRate, int samplesPerBlock) override;
    void releaseResources() override;
    void processBlock(juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    const juce::String getName() const override { return "${map.pluginName}"; }
    bool acceptsMidi() const override { return true; }
    bool producesMidi() const override { return false; }
    double getTailLengthSeconds() const override { return 0.0; }

    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram(int) override {}
    const juce::String getProgramName(int) override { return {}; }
    void changeProgramName(int, const juce::String&) override {}

    void getStateInformation(juce::MemoryBlock& destData) override;
    void setStateInformation(const void* data, int sizeInBytes) override;

    juce::AudioProcessorValueTreeState& getAPVTS() { return apvts; }

private:
    juce::AudioProcessorValueTreeState apvts;
    juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout();

${generateDSPMembers(map.category, map)}

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(${className}Processor)
};
`;

  // ── PluginProcessor.cpp ──
  const paramLayout = params.map(p => {
    if (p.type === 'toggle') {
      return `        layout.add(std::make_unique<juce::AudioParameterBool>(
            "${p.id}", "${p.label}", false));`;
    }
    if (p.type === 'dropdown' && p.options?.length) {
      return `        layout.add(std::make_unique<juce::AudioParameterChoice>(
            "${p.id}", "${p.label}",
            juce::StringArray{${p.options.map(o => `"${o}"`).join(', ')}}, 0));`;
    }
    const range = p.parameter.curve === 'logarithmic'
      ? `juce::NormalisableRange<float>(${p.parameter.min}f, ${p.parameter.max}f, 0.01f, 0.3f)`
      : `juce::NormalisableRange<float>(${p.parameter.min}f, ${p.parameter.max}f, 0.01f)`;
    return `        layout.add(std::make_unique<juce::AudioParameterFloat>(
            "${p.id}", "${p.label}",
            ${range}, ${p.parameter.default}f));`;
  }).join('\n\n');

  const processorCpp = `#include "PluginProcessor.h"
#include "PluginEditor.h"

${className}Processor::${className}Processor()
    : AudioProcessor(BusesProperties()
          .withInput("Input", juce::AudioChannelSet::stereo(), true)
          .withOutput("Output", juce::AudioChannelSet::stereo(), true)),
      apvts(*this, nullptr, "PARAMETERS", createParameterLayout())
{
}

${className}Processor::~${className}Processor() {}

juce::AudioProcessorValueTreeState::ParameterLayout
${className}Processor::createParameterLayout()
{
    juce::AudioProcessorValueTreeState::ParameterLayout layout;

${paramLayout}
${generateBypassParameters(map)}


    return layout;
}

void ${className}Processor::prepareToPlay(double sampleRate, int samplesPerBlock)
{
${generatePrepareToPlay(map.category, map)}
}

void ${className}Processor::releaseResources() {}

void ${className}Processor::processBlock(juce::AudioBuffer<float>& buffer,
                                         juce::MidiBuffer& midiMessages)
{
${generateDSPBlock(map.category, map)}
}

void ${className}Processor::getStateInformation(juce::MemoryBlock& destData)
{
    auto state = apvts.copyState();
    std::unique_ptr<juce::XmlElement> xml(state.createXml());
    copyXmlToBinary(*xml, destData);
}

void ${className}Processor::setStateInformation(const void* data, int sizeInBytes)
{
    std::unique_ptr<juce::XmlElement> xml(getXmlFromBinary(data, sizeInBytes));
    if (xml != nullptr && xml->hasTagName(apvts.state.getType()))
        apvts.replaceState(juce::ValueTree::fromXml(*xml));
}

juce::AudioProcessorEditor* ${className}Processor::createEditor()
{
    return new ${className}Editor(*this);
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new ${className}Processor();
}
`;

  // ── PluginEditor.h ──
  const editorH = `#pragma once
#include <JuceHeader.h>
#include "PluginProcessor.h"

class ${className}Editor : public juce::AudioProcessorEditor
{
public:
    explicit ${className}Editor(${className}Processor&);
    ~${className}Editor() override;

    void paint(juce::Graphics&) override;
    void resized() override;

    // Helper to get image from binary data
    static juce::Image getBackgroundImage();


private:
    ${className}Processor& processorRef;

    // UI Controls
${params.map(p => {
    if (p.type === 'toggle')
      return `    juce::ToggleButton ${camelCase(p.id)}Button;\n    std::unique_ptr<juce::AudioProcessorValueTreeState::ButtonAttachment> ${camelCase(p.id)}Attachment;`;
    if (p.type === 'dropdown')
      return `    juce::ComboBox ${camelCase(p.id)}Box;\n    std::unique_ptr<juce::AudioProcessorValueTreeState::ComboBoxAttachment> ${camelCase(p.id)}Attachment;`;
    return `    juce::Slider ${camelCase(p.id)}Slider;\n    juce::Label ${camelCase(p.id)}Label;\n    std::unique_ptr<juce::AudioProcessorValueTreeState::SliderAttachment> ${camelCase(p.id)}Attachment;`;
  }).join('\n')}

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(${className}Editor)
};
`;

  // ── PluginEditor.cpp ──
  const sliderInits = params.filter(p => p.type === 'knob' || p.type === 'slider').map(p => {
    const style = p.type === 'knob' ? 'juce::Slider::RotaryHorizontalVerticalDrag' : 'juce::Slider::LinearVertical';
    return `    // ${p.label}
    ${camelCase(p.id)}Slider.setSliderStyle(${style});
    ${camelCase(p.id)}Slider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 60, 18);
    addAndMakeVisible(${camelCase(p.id)}Slider);
    ${camelCase(p.id)}Label.setText("${p.label}", juce::dontSendNotification);
    ${camelCase(p.id)}Label.attachToComponent(&${camelCase(p.id)}Slider, false);
    addAndMakeVisible(${camelCase(p.id)}Label);
    ${camelCase(p.id)}Attachment = std::make_unique<juce::AudioProcessorValueTreeState::SliderAttachment>(
        processorRef.getAPVTS(), "${p.id}", ${camelCase(p.id)}Slider);`;
  }).join('\n\n');

  const toggleInits = params.filter(p => p.type === 'toggle').map(p => `    // ${p.label}
    ${camelCase(p.id)}Button.setButtonText("${p.label}");
    addAndMakeVisible(${camelCase(p.id)}Button);
    ${camelCase(p.id)}Attachment = std::make_unique<juce::AudioProcessorValueTreeState::ButtonAttachment>(
        processorRef.getAPVTS(), "${p.id}", ${camelCase(p.id)}Button);`).join('\n\n');

  const resizedLines = params.map((p, i) => {
    const x = Math.round((p.position.x / 100) * map.dimensions.width);
    const y = Math.round((p.position.y / 100) * map.dimensions.height);
    const w = Math.max(Math.round((p.position.width / 100) * map.dimensions.width), 40);
    const h = Math.max(Math.round((p.position.height / 100) * map.dimensions.height), 40);
    if (p.type === 'toggle') return `    ${camelCase(p.id)}Button.setBounds(${x}, ${y}, ${w}, ${h});`;
    if (p.type === 'dropdown') return `    ${camelCase(p.id)}Box.setBounds(${x}, ${y}, ${w}, ${h});`;
    return `    ${camelCase(p.id)}Slider.setBounds(${x}, ${y}, ${w}, ${h});`;
  }).join('\n');

  const editorCpp = `#include "PluginEditor.h"

${className}Editor::${className}Editor(${className}Processor& p)
    : AudioProcessorEditor(&p), processorRef(p)
{
    setSize(${map.dimensions.width}, ${map.dimensions.height});

${sliderInits}

${toggleInits}
}

${className}Editor::~${className}Editor() {}

void ${className}Editor::paint(juce::Graphics& g)
{
    g.fillAll(juce::Colour::fromString("${map.colorScheme.background}"));

    auto bgImage = getBackgroundImage();
    if (bgImage.isValid())
        g.drawImageWithin(bgImage, 0, 0, getWidth(), getHeight(), juce::RectanglePlacement::fillDestination);
}

juce::Image ${className}Editor::getBackgroundImage()
{
    return juce::ImageCache::getFromMemory(BinaryData::background_png, BinaryData::background_pngSize);
}


void ${className}Editor::resized()
{
${resizedLines}
}
`;

  // ── Tab Component Helper (only for multi-tab projects) ──
  let tabFiles: ExportFile[] = [];
  if (map.tabs.length > 1) {
    // Generate a TabbedComponent subclass that creates pages per tab
    const tabPages = map.tabs.map(tab => {
      const tabControls = params.filter(
        p => p.sourceTab === tab.name || p.sourceTab === 'shared'
      );
      return `        // Tab: ${tab.name}
        {
            auto* page = new juce::Component();
${tabControls.map(p => {
  const x = Math.round((p.position.x / 100) * map.dimensions.width);
  const y = Math.round((p.position.y / 100) * map.dimensions.height);
  const w = Math.max(Math.round((p.position.width / 100) * map.dimensions.width), 40);
  const h = Math.max(Math.round((p.position.height / 100) * map.dimensions.height), 40);
  return `            // ${p.label}\n            // TODO: Create and position ${camelCase(p.id)} at (${x}, ${y}, ${w}, ${h})`;
}).join('\n')}
            tabbedComponent.addTab("${tab.name}", juce::Colours::transparentBlack, page, true);
        }`;
    }).join('\n\n');

    const tabbedSetupH = `#pragma once
// ${className} Tab Setup — Generated by VST God Forge
// Defines the TabbedComponent layout with ${map.tabs.length} tabs.
//
// Integration:
//   In ${className}Editor constructor, call setupTabs(tabbedComponent);
//   In resized(), add: tabbedComponent.setBounds(getLocalBounds());

#include <JuceHeader.h>

inline void setup${className}Tabs(juce::TabbedComponent& tabbedComponent)
{
${tabPages}
}
`;
    tabFiles.push({
      filename: 'juce-project/Source/TabSetup.h',
      content: tabbedSetupH,
      language: 'h',
    });
  }

  // ── CMakeLists.txt ──
  const cmake = `cmake_minimum_required(VERSION 3.21)
project(${className} VERSION 1.0.0)

# If you've installed JUCE globally or via CPM/FetchContent, adjust this path:
# find_package(JUCE CONFIG REQUIRED)
# OR use add_subdirectory if JUCE is local:
# add_subdirectory(path/to/JUCE)

juce_add_plugin(${className}
    COMPANY_NAME "${map.manufacturer}"
    PLUGIN_MANUFACTURER_CODE Mixx
    PLUGIN_CODE VstG
    FORMATS VST3 AU Standalone
    PRODUCT_NAME "${map.pluginName}"
    IS_SYNTH TRUE
    NEEDS_MIDI_INPUT TRUE
)

target_sources(${className}
    PRIVATE
        Source/PluginProcessor.cpp
        Source/PluginEditor.cpp
)

target_compile_features(${className} PRIVATE cxx_std_17)

target_link_libraries(${className}
    PRIVATE
        juce::juce_audio_utils
        juce::juce_dsp
    PUBLIC
        juce::juce_recommended_config_flags
        juce::juce_recommended_lto_flags
        juce::juce_recommended_warning_flags
)

# Binary Data (Background Image)
juce_add_binary_data(${className}Data
    SOURCES
        Resources/background.png
)

target_link_libraries(${className} PRIVATE ${className}Data)

`;

  return [
    { filename: 'juce-project/Source/PluginProcessor.h', content: processorH, language: 'h' },
    { filename: 'juce-project/Source/PluginProcessor.cpp', content: processorCpp, language: 'cpp' },
    { filename: 'juce-project/Source/PluginEditor.h', content: editorH, language: 'h' },
    { filename: 'juce-project/Source/PluginEditor.cpp', content: editorCpp, language: 'cpp' },
    { filename: 'juce-project/CMakeLists.txt', content: cmake, language: 'cmake' },
    ...tabFiles,
  ];
}

// ─── 4. Documentation Generator ────────────────────────────────────────────

function generateDocs(map: ControlMap, name: string): ExportFile {
  const paramControls = map.controls.filter(c =>
    ['knob','slider','toggle','dropdown'].includes(c.type));
  const uiControls = map.controls.filter(c =>
    !['knob','slider','toggle','dropdown'].includes(c.type));

  const paramTable = paramControls.length > 0
    ? `| ID | Label | Type | Group | Range | Default | Unit |
|-----|-------|------|-------|-------|---------|------|
${paramControls.map(c =>
  `| ${c.id} | ${c.label} | ${c.type} | ${c.group} | ${c.parameter.min}–${c.parameter.max} | ${c.parameter.default} | ${c.parameter.unit || '—'} |`
).join('\n')}`
    : 'No audio parameters detected.';

  const uiTable = uiControls.length > 0
    ? `| ID | Label | Type | Group |
|-----|-------|------|-------|
${uiControls.map(c =>
  `| ${c.id} | ${c.label} | ${c.type} | ${c.group} |`
).join('\n')}`
    : 'No additional UI controls detected.';

  const groupSection = map.groups.map(g =>
    `### ${g.name}\n- Controls: ${g.controls.join(', ')}`
  ).join('\n\n');

  const md = `# ${map.pluginName}

> ${map.description}

## Overview

- **Manufacturer:** ${map.manufacturer}
- **Category:** ${map.category}
- **Version:** ${map.version}
- **Dimensions:** ${map.dimensions.width}×${map.dimensions.height}px
- **Total Controls:** ${map.controls.length}
- **Audio Parameters:** ${paramControls.length}
- **UI Controls:** ${uiControls.length}
- **Groups:** ${map.groups.length}
- **Tabs:** ${map.tabs.length}

---

## Audio Parameters

${paramTable}

---

## UI Controls

${uiTable}

---

## Control Groups

${groupSection}

---

## Tabs

${map.tabs.map(t => `- **${t.name}**: ${t.groups.join(', ')}`).join('\n')}

---

## Color Scheme

| Role | Color |
|------|-------|
| Primary | ${map.colorScheme.primary} |
| Secondary | ${map.colorScheme.secondary} |
| Accent | ${map.colorScheme.accent} |
| Background | ${map.colorScheme.background} |
| Text | ${map.colorScheme.text} |

---

## Implementation Notes

### Audio Processing
- Sample rate: 44100Hz (standard)
- Buffer size: 512 samples (recommended)
- Latency: ~12ms at 44.1kHz

### Parameter Automation
- All continuous controls support DAW automation
- Smoothing: 10ms (recommended)
- Update rate: 60Hz (UI) / Audio rate (DSP)

### JUCE Integration
- Build system: CMake (JUCE 7+)
- Formats: VST3, AU, Standalone
- C++ Standard: C++17

---

*Generated by VST God Forge — ${new Date().toISOString()}*
`;

  return { filename: `${name}-docs.md`, content: md, language: 'md' };
}

// ─── 5. CSS Stylesheet Generator ───────────────────────────────────────────

function generateStylesheet(map: ControlMap, name: string): ExportFile {
  const css = `/**
 * ${name} Stylesheet
 * Generated by VST God Forge
 */

.plugin-window {
  background-color: ${map.colorScheme.background};
  color: ${map.colorScheme.text};
  font-family: 'Inter', sans-serif;
  user-select: none;
}

.control-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.control-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
  color: ${map.colorScheme.text};
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
}

.control-value {
  font-size: 9px;
  font-family: monospace;
  margin-top: 4px;
  color: ${map.colorScheme.primary};
  background: rgba(0,0,0,0.3);
  padding: 2px 4px;
  border-radius: 3px;
}

.rotary-knob, .linear-fader {
  cursor: pointer;
  accent-color: ${map.colorScheme.primary};
}

.plugin-button {
  background: ${map.colorScheme.primary};
  color: ${map.colorScheme.background};
  border: none;
  border-radius: 4px;
  font-size: 11px;
  font-weight: bold;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  transition: transform 0.1s;
}

.plugin-button:active {
  transform: scale(0.95);
}

.plugin-tab {
  background: rgba(0,0,0,0.4);
  color: ${map.colorScheme.text};
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 4px;
  padding: 4px 12px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}

.plugin-tab.active {
  background: ${map.colorScheme.primary};
  color: ${map.colorScheme.background};
  border-color: ${map.colorScheme.primary};
}

.tab-panel {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.toggle-control label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  cursor: pointer;
}

.plugin-dropdown {
  background: rgba(0,0,0,0.5);
  color: ${map.colorScheme.primary};
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 4px;
  font-size: 11px;
  padding: 2px 4px;
}
`;
  return { filename: `${name}-theme.css`, content: css, language: 'css' };
}

// ─── 6. ZIP Archive Export ──────────────────────────────────────────────────

/**
 * Packages the complete export bundle into a ZIP archive using JSZip.
 * Downloads the ZIP directly in the browser.
 */
export async function exportAsZip(controlMap: ControlMap): Promise<void> {
  const { default: JSZip } = await import('jszip');
  const bundle = exportPluginBundle(controlMap);
  const zip = new JSZip();
  const rootFolder = zip.folder(bundle.projectName)!;

  for (const file of bundle.files) {
    rootFolder.file(file.filename, file.content);
  }

  // Add manifest metadata
  rootFolder.file('vstgod-manifest.json', JSON.stringify({
    generator: 'VST God Forge',
    version: '1.0.0',
    projectName: bundle.projectName,
    pluginName: controlMap.pluginName,
    manufacturer: controlMap.manufacturer,
    category: controlMap.category,
    files: bundle.files.map(f => f.filename),
    exportedAt: bundle.exportedAt,
    routingChain: controlMap.routingChain?.map(m => ({
      id: m.instanceId,
      type: m.type,
      bypassed: m.bypassed,
    })),
  }, null, 2));

  // Generate and trigger download
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${bundle.projectName}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
