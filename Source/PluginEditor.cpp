#include "PluginProcessor.h"
#include "PluginEditor.h"

VSTGodTheGodRealmAudioProcessorEditor::VSTGodTheGodRealmAudioProcessorEditor (VSTGodTheGodRealmAudioProcessor& p)
    : AudioProcessorEditor (&p), audioProcessor (p), webComponent(juce::WebBrowserComponent::Options()
        .withBackend(juce::WebBrowserComponent::Options::Backend::webview2))
{
    addAndMakeVisible(webComponent);

    // In a real scenario, you'd point this to localhost during dev or a bundled URL in production
    // For now, assume a dev server is running on port 5173
    webComponent.goToURL("http://localhost:5173");

    setSize (1200, 800);
}

VSTGodTheGodRealmAudioProcessorEditor::~VSTGodTheGodRealmAudioProcessorEditor()
{
}

void VSTGodTheGodRealmAudioProcessorEditor::paint (juce::Graphics& g)
{
    g.fillAll (juce::Colours::black);
}

void VSTGodTheGodRealmAudioProcessorEditor::resized()
{
    webComponent.setBounds(getLocalBounds());
}
