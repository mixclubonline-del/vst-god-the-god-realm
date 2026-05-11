#pragma once

#include <JuceHeader.h>
#include "PluginProcessor.h"

class VSTGodTheGodRealmAudioProcessorEditor : public juce::AudioProcessorEditor
{
public:
    VSTGodTheGodRealmAudioProcessorEditor (VSTGodTheGodRealmAudioProcessor&);
    ~VSTGodTheGodRealmAudioProcessorEditor() override;

    void paint (juce::Graphics&) override;
    void resized() override;

private:
    VSTGodTheGodRealmAudioProcessor& audioProcessor;
    juce::WebBrowserComponent webComponent;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (VSTGodTheGodRealmAudioProcessorEditor)
};
