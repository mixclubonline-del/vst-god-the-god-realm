#pragma once

#include <JuceHeader.h>
#include "PluginProcessor.h"

// ═══════════════════════════════════════════════════════════════
// PluginEditor — WebView + Timer-based State Push to React UI
// ═══════════════════════════════════════════════════════════════
class VSTGodTheGodRealmAudioProcessorEditor : public juce::AudioProcessorEditor,
                                               private juce::Timer
{
public:
    VSTGodTheGodRealmAudioProcessorEditor (VSTGodTheGodRealmAudioProcessor&);
    ~VSTGodTheGodRealmAudioProcessorEditor() override;

    void paint (juce::Graphics&) override;
    void resized() override;

private:
    void timerCallback() override;
    juce::String buildMeteringJson();
    juce::String buildTelemetryJson();
    void browseForLibraryPath();
    static juce::WebBrowserComponent::Options createWebBrowserOptions (VSTGodTheGodRealmAudioProcessorEditor* editor);
    void handleWebViewMessage (const juce::Array<juce::var>& args, juce::WebBrowserComponent::NativeFunctionCompletion completion);
    std::optional<juce::WebBrowserComponent::Resource> getEmbeddedUIResource (const juce::String& url);

    VSTGodTheGodRealmAudioProcessor& audioProcessor;
    juce::WebBrowserComponent webComponent;
    std::unique_ptr<juce::FileChooser> fileChooser;

    int frameCounter = 0;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (VSTGodTheGodRealmAudioProcessorEditor)
};
