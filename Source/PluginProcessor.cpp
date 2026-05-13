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
    formatManager.registerBasicFormats();
    
    // Initialize 8 tracks with 64 steps each for both patterns
    for (int i = 0; i < 8; ++i)
    {
        Track t;
        for (int s = 0; s < 64; ++s)
        {
            t.patternA.push_back(Step());
            t.patternB.push_back(Step());
        }
        tracks.push_back(t);
    }
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
    spec.sampleRate = sampleRate;
    spec.maximumBlockSize = samplesPerBlock;
    spec.numChannels = getTotalNumOutputChannels();

    velvetChain.prepare(spec);
    sampler.prepare(sampleRate);
    
    // Peak decay coefficient: ~300ms decay at the current sample rate
    // exp(-1 / (tau * sr)) where tau = 0.3s
    peakDecayCoeff = std::exp(-1.0f / (0.3f * static_cast<float>(sampleRate)));
}

void VSTGodTheGodRealmAudioProcessor::releaseResources()
{
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

    // ═══════════════════════════════════════════════════════════
    // MIDI 2.0 Note Event Capture
    // ═══════════════════════════════════════════════════════════
    for (const auto metadata : midiMessages)
    {
        const auto msg = metadata.getMessage();
        if (msg.isNoteOn())
        {
            int wp = midiEventWritePos.load(std::memory_order_relaxed);
            int nextWp = (wp + 1) % kMaxMidiEvents;
            
            // Only write if buffer isn't full
            if (nextWp != midiEventReadPos.load(std::memory_order_acquire))
            {
                auto& evt = midiEventBuffer[wp];
                evt.noteNumber = msg.getNoteNumber();
                evt.channel = msg.getChannel() - 1; // JUCE uses 1-based channels
                // Scale MIDI 1.0 velocity (0-127) to MIDI 2.0 (0-65535)
                evt.velocity16 = static_cast<uint32_t>(msg.getVelocity()) * 516; // 127*516 ≈ 65532
                evt.pitchBend = 0.0f;
                evt.pressure = msg.getAfterTouchValue() / 127.0f;
                evt.timestampSamples = metadata.samplePosition;
                
                midiEventWritePos.store(nextWp, std::memory_order_release);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    // Transport Synchronization
    // ═══════════════════════════════════════════════════════════
    auto* playHead = getPlayHead();
    if (playHead != nullptr)
    {
        auto position = playHead->getPosition();
        if (position.hasValue() && position->getIsPlaying())
        {
            transport.isPlaying.store(true, std::memory_order_relaxed);
            
            auto ppq = position->getPpqPosition();
            if (ppq.hasValue())
            {
                transport.ppqPosition.store(*ppq, std::memory_order_relaxed);
                double currentSixteenth = std::floor(*ppq * 4.0);
                transport.currentStep.store(static_cast<int>(currentSixteenth) % 64, std::memory_order_relaxed);
                
                if (currentSixteenth != lastSixteenthNote)
                {
                    int activePatternIdx = static_cast<int>(*apvts.getRawParameterValue("activePattern"));
                    bool isFillMode = *apvts.getRawParameterValue("isFillMode") > 0.5f;
                    float bpm = *apvts.getRawParameterValue("globalBpm");
                    transport.bpm.store(static_cast<double>(bpm), std::memory_order_relaxed);
                    int samplesPer16th = static_cast<int>((60.0 / bpm / 4.0) * getSampleRate());
                    
                    // Increment cycle counter every 16 steps
                    if (static_cast<int>(currentSixteenth) % 16 == 0)
                        sequencerCycleCount++;

                    // Trigger enabled steps
                    {
                        const juce::ScopedLock sl(stepLock);
                        for (int t = 0; t < 8; ++t)
                        {
                            auto& track = tracks[t];
                            int polyStep = static_cast<int>(currentSixteenth) % track.polymetricLength;
                            auto& pattern = (activePatternIdx == 0) ? track.patternA : track.patternB;
                            auto& step = pattern[polyStep];
                            
                            if (step.enabled && !track.muted)
                            {
                                // 1. Probability
                                if (juce::Random::getSystemRandom().nextFloat() * 100.0f > step.probability)
                                    continue;
                                    
                                // 2. Trig Condition
                                bool shouldTrigger = true;
                                if (step.trigCondition == "fill") shouldTrigger = isFillMode;
                                else if (step.trigCondition == "notFill") shouldTrigger = !isFillMode;
                                else if (step.trigCondition == "1:2") shouldTrigger = (sequencerCycleCount % 2 == 1);
                                else if (step.trigCondition == "1:4") shouldTrigger = (sequencerCycleCount % 4 == 1);
                                else if (step.trigCondition == "1:8") shouldTrigger = (sequencerCycleCount % 8 == 1);
                                
                                if (!shouldTrigger) continue;

                                // 3. Slices
                                float start = step.start;
                                float end = step.end;
                                if (step.sliceIndex > 0 && step.sliceIndex <= static_cast<int>(track.slices.size()))
                                {
                                    start = track.slices[step.sliceIndex - 1].start;
                                    end = track.slices[step.sliceIndex - 1].end;
                                }

                                // 4. Micro Timing (simplistic for now - just trigger)
                                sampler.trigger(t, step.velocity / 127.0f, step.pitch, step.pan, step.decay, start, end, step.reverse, step.retrigRate, samplesPer16th);
                            }
                        }
                    }
                    
                    lastSixteenthNote = currentSixteenth;
                }
            }
            
            // Also try to get BPM from host tempo
            auto tempo = position->getBpm();
            if (tempo.hasValue())
                transport.bpm.store(*tempo, std::memory_order_relaxed);
        }
        else
        {
            transport.isPlaying.store(false, std::memory_order_relaxed);
            lastSixteenthNote = -1.0;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // Sampler Processing
    // ═══════════════════════════════════════════════════════════
    sampler.process(buffer);

    // ─── Per-Track Peak Metering (post-sampler, pre-master) ───
    // We approximate per-track peaks from the sampler voices.
    // Since voices mix into the main buffer, we use voice activity 
    // to decay idle tracks and boost active ones.
    for (int t = 0; t < kNumTracks; ++t)
    {
        float currentPeak = trackPeaks[t].load(std::memory_order_relaxed);
        if (sampler.isTrackActive(t))
        {
            // Active voice: estimate peak from overall buffer contribution
            // In a real per-track mix scenario we'd have separate buffers.
            // For now, track activity drives a synthetic level.
            currentPeak = std::max(currentPeak, sampler.getTrackVelocity(t));
        }
        // Exponential decay
        currentPeak *= peakDecayCoeff;
        trackPeaks[t].store(currentPeak, std::memory_order_relaxed);
    }

    // ═══════════════════════════════════════════════════════════
    // Parameter Bridging (Mastering Chain)
    // ═══════════════════════════════════════════════════════════
    velvetChain.setInputGain(*apvts.getRawParameterValue("masterInputGain"));
    velvetChain.setDrive(*apvts.getRawParameterValue("masterDrive"));
    
    float colorTilt = *apvts.getRawParameterValue("masterColorTilt");
    velvetChain.setSilk(colorTilt); 
    
    float bodyGain = 0.0f;
    float airGain = 0.0f;
    if (colorTilt < 50.0f) {
        bodyGain = (50.0f - colorTilt) * 0.12f;
    } else {
        airGain = (colorTilt - 50.0f) * 0.12f;
    }
    velvetChain.updateEQ(bodyGain, 0.0f, airGain);

    velvetChain.setLimiterThreshold(*apvts.getRawParameterValue("masterDynamicsThreshold"));
    velvetChain.setLimiterAttack(*apvts.getRawParameterValue("masterAttack"));
    velvetChain.setLimiterRelease(*apvts.getRawParameterValue("masterRelease"));
    velvetChain.setLimiterRatio(*apvts.getRawParameterValue("masterDynamicsRatio"));
    velvetChain.setOutputGain(*apvts.getRawParameterValue("masterVolume"));

    // ═══════════════════════════════════════════════════════════
    // Mastering DSP Processing
    // ═══════════════════════════════════════════════════════════
    juce::dsp::AudioBlock<float> block(buffer);
    juce::dsp::ProcessContextReplacing<float> context(block);
    velvetChain.process(context);

    // ─── Master Bus Peak Metering (post-master chain) ───
    {
        float peakL = 0.0f, peakR = 0.0f;
        const int numSamples = buffer.getNumSamples();
        
        if (buffer.getNumChannels() >= 1)
        {
            const float* dataL = buffer.getReadPointer(0);
            for (int i = 0; i < numSamples; ++i)
                peakL = std::max(peakL, std::abs(dataL[i]));
        }
        if (buffer.getNumChannels() >= 2)
        {
            const float* dataR = buffer.getReadPointer(1);
            for (int i = 0; i < numSamples; ++i)
                peakR = std::max(peakR, std::abs(dataR[i]));
        }
        
        // Peak-hold with decay
        float prevL = masterPeakL.load(std::memory_order_relaxed);
        float prevR = masterPeakR.load(std::memory_order_relaxed);
        masterPeakL.store(std::max(peakL, prevL * peakDecayCoeff), std::memory_order_relaxed);
        masterPeakR.store(std::max(peakR, prevR * peakDecayCoeff), std::memory_order_relaxed);
    }
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
    
    // Add sequencer data
    auto* tracksXml = serializeTracks().release();
    xml->addChildElement(tracksXml);
    
    copyXmlToBinary (*xml, destData);
}

void VSTGodTheGodRealmAudioProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    std::unique_ptr<juce::XmlElement> xmlState (getXmlFromBinary (data, sizeInBytes));
    if (xmlState.get() != nullptr)
    {
        if (xmlState->hasTagName (apvts.state.getType()))
            apvts.replaceState (juce::ValueTree::fromXml (*xmlState));
            
        // Load sequencer data
        if (auto* tracksXml = xmlState->getChildByName("SEQUENCER_STATE"))
            deserializeTracks(tracksXml);
    }
}

void VSTGodTheGodRealmAudioProcessor::loadSampleForTrack(int trackIdx, const juce::String& path)
{
    if (trackIdx < 0 || trackIdx >= 8) return;
    
    juce::File file(path);
    if (file.existsAsFile())
    {
        auto* reader = formatManager.createReaderFor(file);
        if (reader != nullptr)
        {
            auto buffer = std::make_shared<juce::AudioBuffer<float>>(static_cast<int>(reader->numChannels), static_cast<int>(reader->lengthInSamples));
            reader->read(buffer.get(), 0, static_cast<int>(reader->lengthInSamples), 0, true, true);
            
            sampler.setSample(trackIdx, buffer, reader->sampleRate);
            tracks[trackIdx].samplePath = path;
            
            delete reader;
        }
    }
}

void VSTGodTheGodRealmAudioProcessor::updateStep(int trackIdx, const juce::String& patternName, int stepIdx, const juce::var& stepData)
{
    if (trackIdx < 0 || trackIdx >= 8 || stepIdx < 0 || stepIdx >= 64) return;
    
    const juce::ScopedLock sl(stepLock);
    
    auto& pattern = (patternName == "B") ? tracks[trackIdx].patternB : tracks[trackIdx].patternA;
    auto& step = pattern[stepIdx];
    
    if (stepData.hasProperty("enabled")) step.enabled = (bool)stepData["enabled"];
    if (stepData.hasProperty("velocity")) step.velocity = (float)stepData["velocity"];
    if (stepData.hasProperty("pitch")) step.pitch = (float)stepData["pitch"];
    if (stepData.hasProperty("pan")) step.pan = (float)stepData["pan"];
    if (stepData.hasProperty("decay")) step.decay = (float)stepData["decay"];
    if (stepData.hasProperty("start")) step.start = (float)stepData["start"];
    if (stepData.hasProperty("end")) step.end = (float)stepData["end"];
    if (stepData.hasProperty("reverse")) step.reverse = (bool)stepData["reverse"];
    if (stepData.hasProperty("sliceIndex")) step.sliceIndex = (int)stepData["sliceIndex"];
    if (stepData.hasProperty("probability")) step.probability = (float)stepData["probability"];
    if (stepData.hasProperty("microTiming")) step.microTiming = (int)stepData["microTiming"];
    if (stepData.hasProperty("trigCondition")) step.trigCondition = stepData["trigCondition"].toString();
    
    if (stepData.hasProperty("retrigRate")) {
        juce::String rateStr = stepData["retrigRate"].toString();
        if (rateStr == "1/2") step.retrigRate = 2;
        else if (rateStr == "1/4") step.retrigRate = 4;
        else if (rateStr == "1/8") step.retrigRate = 8;
        else if (rateStr == "1/16") step.retrigRate = 16;
        else if (rateStr == "1/32") step.retrigRate = 32;
        else step.retrigRate = 0;
    }
}

void VSTGodTheGodRealmAudioProcessor::updateTrackSlices(int trackIdx, const juce::var& sliceData)
{
    if (trackIdx < 0 || trackIdx >= 8) return;
    if (!sliceData.isArray()) return;
    
    const juce::ScopedLock sl(stepLock);
    auto& track = tracks[trackIdx];
    track.slices.clear();
    
    auto* array = sliceData.getArray();
    for (int i = 0; i < array->size(); ++i)
    {
        auto sData = array->getReference(i);
        Slice s;
        s.start = (float)sData.getProperty("start", 0.0);
        s.end = (float)sData.getProperty("end", 1.0);
        track.slices.push_back(s);
    }
}

// ═══════════════════════════════════════════════════════════════
// Thread-safe accessors for Editor state push
// ═══════════════════════════════════════════════════════════════

float VSTGodTheGodRealmAudioProcessor::getTrackPeakLevel(int trackIdx) const
{
    if (trackIdx < 0 || trackIdx >= kNumTracks) return 0.0f;
    return trackPeaks[trackIdx].load(std::memory_order_relaxed);
}

std::vector<Midi2NoteEvent> VSTGodTheGodRealmAudioProcessor::drainMidiEvents()
{
    std::vector<Midi2NoteEvent> events;
    
    int rp = midiEventReadPos.load(std::memory_order_acquire);
    int wp = midiEventWritePos.load(std::memory_order_acquire);
    
    while (rp != wp)
    {
        events.push_back(midiEventBuffer[rp]);
        rp = (rp + 1) % kMaxMidiEvents;
    }
    
    midiEventReadPos.store(rp, std::memory_order_release);
    return events;
}

std::unique_ptr<juce::XmlElement> VSTGodTheGodRealmAudioProcessor::serializeTracks()
{
    const juce::ScopedLock sl(stepLock);
    auto xml = std::make_unique<juce::XmlElement>("SEQUENCER_STATE");
    
    for (int t = 0; t < 8; ++t)
    {
        auto* trackXml = xml->createNewChildElement("TRACK");
        trackXml->setAttribute("id", t);
        trackXml->setAttribute("polymetricLength", tracks[t].polymetricLength);
        trackXml->setAttribute("muted", tracks[t].muted);
        trackXml->setAttribute("samplePath", tracks[t].samplePath);
        trackXml->setAttribute("volume", (double)tracks[t].volume);
        
        auto serializePattern = [&](const std::vector<Step>& pattern, const juce::String& name)
        {
            auto* patternXml = trackXml->createNewChildElement(name);
            for (int s = 0; s < pattern.size(); ++s)
            {
                auto& step = pattern[s];
                if (step.enabled || step.velocity != 1.0f || step.pitch != 0.0f) 
                {
                    auto* stepXml = patternXml->createNewChildElement("STEP");
                    stepXml->setAttribute("index", s);
                    stepXml->setAttribute("enabled", step.enabled);
                    stepXml->setAttribute("velocity", (double)step.velocity);
                    stepXml->setAttribute("pitch", (double)step.pitch);
                    stepXml->setAttribute("pan", (double)step.pan);
                    stepXml->setAttribute("decay", (double)step.decay);
                    stepXml->setAttribute("start", (double)step.start);
                    stepXml->setAttribute("end", (double)step.end);
                    stepXml->setAttribute("reverse", step.reverse);
                    stepXml->setAttribute("sliceIndex", step.sliceIndex);
                    stepXml->setAttribute("retrigRate", step.retrigRate);
                    stepXml->setAttribute("probability", (double)step.probability);
                    stepXml->setAttribute("microTiming", step.microTiming);
                    stepXml->setAttribute("trigCondition", step.trigCondition);
                }
            }
        };

        serializePattern(tracks[t].patternA, "PATTERN_A");
        serializePattern(tracks[t].patternB, "PATTERN_B");
    }
    
    return xml;
}

void VSTGodTheGodRealmAudioProcessor::deserializeTracks(juce::XmlElement* xml)
{
    if (xml == nullptr) return;
    
    const juce::ScopedLock sl(stepLock);
    auto* trackXml = xml->getChildByName("TRACK");
    while (trackXml != nullptr)
    {
        int t = trackXml->getIntAttribute("id");
        if (t >= 0 && t < 8)
        {
            tracks[t].polymetricLength = trackXml->getIntAttribute("polymetricLength", 16);
            tracks[t].muted = trackXml->getBoolAttribute("muted", false);
            tracks[t].volume = (float)trackXml->getDoubleAttribute("volume", 1.0);
            juce::String path = trackXml->getStringAttribute("samplePath");
            
            if (path.isNotEmpty() && path != tracks[t].samplePath)
                loadSampleForTrack(t, path);
                
            auto deserializePattern = [&](juce::XmlElement* patternXml, std::vector<Step>& pattern)
            {
                if (patternXml == nullptr) return;
                
                // Reset pattern
                for (auto& s : pattern) s = Step();
                
                auto* stepXml = patternXml->getChildByName("STEP");
                while (stepXml != nullptr)
                {
                    int sIdx = stepXml->getIntAttribute("index");
                    if (sIdx >= 0 && sIdx < pattern.size())
                    {
                        auto& step = pattern[sIdx];
                        step.enabled = stepXml->getBoolAttribute("enabled");
                        step.velocity = (float)stepXml->getDoubleAttribute("velocity", 1.0);
                        step.pitch = (float)stepXml->getDoubleAttribute("pitch", 0.0);
                        step.pan = (float)stepXml->getDoubleAttribute("pan", 0.0);
                        step.decay = (float)stepXml->getDoubleAttribute("decay", 0.5);
                        step.start = (float)stepXml->getDoubleAttribute("start", 0.0);
                        step.end = (float)stepXml->getDoubleAttribute("end", 1.0);
                        step.reverse = stepXml->getBoolAttribute("reverse", false);
                        step.sliceIndex = stepXml->getIntAttribute("sliceIndex", 0);
                        step.retrigRate = stepXml->getIntAttribute("retrigRate", 0);
                        step.probability = (float)stepXml->getDoubleAttribute("probability", 100.0);
                        step.microTiming = stepXml->getIntAttribute("microTiming", 0);
                        step.trigCondition = stepXml->getStringAttribute("trigCondition", "always");
                    }
                    stepXml = stepXml->getNextElementWithTagName("STEP");
                }
            };

            deserializePattern(trackXml->getChildByName("PATTERN_A"), tracks[t].patternA);
            deserializePattern(trackXml->getChildByName("PATTERN_B"), tracks[t].patternB);
        }
        trackXml = trackXml->getNextElementWithTagName("TRACK");
    }
}

juce::AudioProcessorValueTreeState::ParameterLayout VSTGodTheGodRealmAudioProcessor::createParameterLayout()
{
    juce::AudioProcessorValueTreeState::ParameterLayout layout;

    // --- Master Section ---
    layout.add(std::make_unique<juce::AudioParameterFloat>("tuneSemitones", "Tune", -24.0f, 24.0f, 0.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>("masterVolume", "Volume", -60.0f, 6.0f, 0.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>("globalBpm", "BPM", 20.0f, 300.0f, 140.0f));

    // --- Celestial Forge (Mastering) ---
    layout.add(std::make_unique<juce::AudioParameterFloat>("masterInputGain", "Input Gain", -12.0f, 12.0f, 0.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>("masterDrive", "Drive", 0.0f, 100.0f, 20.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>("masterColorTilt", "Color Tilt", 0.0f, 100.0f, 50.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>("masterDynamicsThreshold", "Threshold", -60.0f, 0.0f, -12.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>("masterDynamicsRatio", "Ratio", 1.0f, 10.0f, 2.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>("masterAttack", "Attack", 1.0f, 100.0f, 30.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>("masterRelease", "Release", 10.0f, 1000.0f, 100.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>("masterColdExtension", "Cold Extension", 0.0f, 100.0f, 0.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>("masterCeiling", "Ceiling", -12.0f, 12.0f, -0.1f));
    layout.add(std::make_unique<juce::AudioParameterFloat>("masterWidth", "Width", 0.0f, 200.0f, 100.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>("masterImager", "Imager", -1.0f, 1.0f, 0.0f));

    // --- Navigation & State ---
    layout.add(std::make_unique<juce::AudioParameterInt>("activeTab", "Active Tab", 0, 7, 0));
    layout.add(std::make_unique<juce::AudioParameterInt>("selectedPreset", "Selected Preset", 0, 511, 0));
    layout.add(std::make_unique<juce::AudioParameterInt>("activePattern", "Active Pattern", 0, 1, 0));
    layout.add(std::make_unique<juce::AudioParameterBool>("isFillMode", "Fill Mode", false));

    // --- Sample Chopper / Sequencer (Stubs for now) ---
    layout.add(std::make_unique<juce::AudioParameterFloat>("morphFactor", "Morph Factor", 0.0f, 1.0f, 0.0f));

    return layout;
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new VSTGodTheGodRealmAudioProcessor();
}
