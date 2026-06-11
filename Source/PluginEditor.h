#pragma once

#include <JuceHeader.h>
#include "PluginProcessor.h"

// ═══════════════════════════════════════════════════════════════
// PluginEditor — WebView + Timer-based State Push to React UI
// ═══════════════════════════════════════════════════════════════
class VSTGodTheGodRealmAudioProcessorEditor : public juce::AudioProcessorEditor,
                                               private juce::Timer,
                                               public juce::AudioProcessorValueTreeState::Listener
{
public:
    VSTGodTheGodRealmAudioProcessorEditor (VSTGodTheGodRealmAudioProcessor&);
    ~VSTGodTheGodRealmAudioProcessorEditor() override;

    void paint (juce::Graphics&) override;
    void resized() override;

private:
    void timerCallback() override;
    void parameterChanged (const juce::String& parameterID, float newValue) override;
    juce::String buildMeteringJson();
    juce::String buildTelemetryJson();
    void browseForLibraryPath();
    void handleNeuralOrchestration (const juce::String& prompt, const juce::var& activeSlotsVar);
    static juce::WebBrowserComponent::Options createWebBrowserOptions (VSTGodTheGodRealmAudioProcessorEditor* editor);
    void handleWebViewMessage (const juce::Array<juce::var>& args, juce::WebBrowserComponent::NativeFunctionCompletion completion);
    std::optional<juce::WebBrowserComponent::Resource> getEmbeddedUIResource (const juce::String& url);

    VSTGodTheGodRealmAudioProcessor& audioProcessor;
    juce::WebBrowserComponent webComponent;
    std::unique_ptr<juce::FileChooser> fileChooser;
    std::unique_ptr<juce::dsp::FFT> fft;

    int frameCounter = 0;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (VSTGodTheGodRealmAudioProcessorEditor)
};
