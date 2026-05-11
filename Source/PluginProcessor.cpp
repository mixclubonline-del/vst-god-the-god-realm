#include "PluginProcessor.h"
#include "PluginEditor.h"

VSTGodTheGodRealmAudioProcessor::VSTGodTheGodRealmAudioProcessor()
#ifndef JucePlugin_PreferredChannelConfigurations
     : AudioProcessor (BusesProperties()
                     #if ! JucePlugin_IsMidiEffect
                      #if ! JucePlugin_IsSynth
                       .withInput  ("Input",  juce::AudioChannelSet::stereo(), true)
                      #endif
                       .withOutput ("Output", juce::AudioChannelSet::stereo(), true)
                     #endif
                       ),
       apvts(*this, nullptr, "Parameters", createParameterLayout())
#endif
{
}

VSTGodTheGodRealmAudioProcessor::~VSTGodTheGodRealmAudioProcessor()
{
}

const juce::String VSTGodTheGodRealmAudioProcessor::getName() const
{
    return JucePlugin_Name;
}

bool VSTGodTheGodRealmAudioProcessor::acceptsMidi() const
{
   #if JucePlugin_WantsMidiInput
    return true;
   #else
    return false;
   #endif
}

bool VSTGodTheGodRealmAudioProcessor::producesMidi() const
{
   #if JucePlugin_ProducesMidiOutput
    return true;
   #else
    return false;
   #endif
}

bool VSTGodTheGodRealmAudioProcessor::isMidiEffect() const
{
   #if JucePlugin_IsMidiEffect
    return true;
   #else
    return false;
   #endif
}

double VSTGodTheGodRealmAudioProcessor::getTailLengthSeconds() const
{
    return 0.0;
}

int VSTGodTheGodRealmAudioProcessor::getNumPrograms()
{
    return 1;
}

int VSTGodTheGodRealmAudioProcessor::getCurrentProgram()
{
    return 0;
}

void VSTGodTheGodRealmAudioProcessor::setCurrentProgram (int index)
{
}

const juce::String VSTGodTheGodRealmAudioProcessor::getProgramName (int index)
{
    return {};
}

void VSTGodTheGodRealmAudioProcessor::changeProgramName (int index, const juce::String& newName)
{
}

void VSTGodTheGodRealmAudioProcessor::prepareToPlay (double sampleRate, int samplesPerBlock)
{
    // Use this method as the place to do any pre-playback
    // initialisation that you need..
}

void VSTGodTheGodRealmAudioProcessor::releaseResources()
{
    // When playback stops, you can use this as an opportunity to free up any
    // spare memory, etc.
}

#ifndef JucePlugin_PreferredChannelConfigurations
bool VSTGodTheGodRealmAudioProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
  #if JucePlugin_IsMidiEffect
    juce::ignoreUnused (layouts);
    return true;
  #else
    if (layouts.getMainOutputChannelSet() != juce::AudioChannelSet::mono()
     && layouts.getMainOutputChannelSet() != juce::AudioChannelSet::stereo())
        return false;

   #if ! JucePlugin_IsSynth
    if (layouts.getMainOutputChannelSet() != layouts.getMainInputChannelSet())
        return false;
   #endif

    return true;
  #endif
}
#endif

void VSTGodTheGodRealmAudioProcessor::processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages)
{
    juce::ScopedNoDenormals noDenormals;
    auto totalNumInputChannels  = getTotalNumInputChannels();
    auto totalNumOutputChannels = getTotalNumOutputChannels();

    for (auto i = totalNumInputChannels; i < totalNumOutputChannels; ++i)
        buffer.clear (i, 0, buffer.getNumSamples());

    // DSP processing goes here
}

bool VSTGodTheGodRealmAudioProcessor::hasEditor() const
{
    return true;
}

juce::AudioProcessorEditor* VSTGodTheGodRealmAudioProcessor::createEditor()
{
    return new VSTGodTheGodRealmAudioProcessorEditor (*this);
}

void VSTGodTheGodRealmAudioProcessor::getStateInformation (juce::MemoryBlock& destData)
{
    auto state = apvts.copyState();
    std::unique_ptr<juce::XmlElement> xml (state.createXml());
    copyXmlToBinary (*xml, destData);
}

void VSTGodTheGodRealmAudioProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    std::unique_ptr<juce::XmlElement> xmlState (getXmlFromBinary (data, sizeInBytes));
    if (xmlState.get() != nullptr)
        if (xmlState->hasTagName (apvts.state.getType()))
            apvts.replaceState (juce::ValueTree::fromXml (*xmlState));
}

juce::AudioProcessorValueTreeState::ParameterLayout VSTGodTheGodRealmAudioProcessor::createParameterLayout()
{
    juce::AudioProcessorValueTreeState::ParameterLayout layout;

    // Define parameters here
    // Example:
    // layout.add(std::make_unique<juce::AudioParameterFloat>("cutoff", "Filter Cutoff", 20.0f, 20000.0f, 1000.0f));

    return layout;
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new VSTGodTheGodRealmAudioProcessor();
}
