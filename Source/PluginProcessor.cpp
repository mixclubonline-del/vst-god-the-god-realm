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

    // Load persisted settings
    auto settings = loadSettingsFromDisk();
    if (settings.isNotEmpty())
    {
        auto json = juce::JSON::parse(settings);
        if (json.hasProperty("sampleLibraryPath"))
        {
            sampleLibraryPath = json.getProperty("sampleLibraryPath", "").toString();
        }
        if (json.hasProperty("licenseActivated"))
        {
            licenseActivated.store((bool)json.getProperty("licenseActivated", false), std::memory_order_relaxed);
        }
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
    pantheonSynth.prepare(sampleRate);
    
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
    auto startTime = juce::Time::getHighResolutionTicks();
    juce::ScopedNoDenormals noDenormals;
    auto totalNumInputChannels  = getTotalNumInputChannels();
    auto totalNumOutputChannels = getTotalNumOutputChannels();

    for (auto i = totalNumInputChannels; i < totalNumOutputChannels; ++i)
        buffer.clear (i, 0, buffer.getNumSamples());

    // ═══════════════════════════════════════════════════════════
    // MIDI 2.0 Note Event Capture & Routing
    // ═══════════════════════════════════════════════════════════
    int activeTab = static_cast<int>(*apvts.getRawParameterValue("activeTab"));

    for (const auto metadata : midiMessages)
    {
        const auto msg = metadata.getMessage();
        
        if (activeTab == 8) // Electric Pantheon tab
        {
            if (msg.isNoteOn())
            {
                pantheonSynth.noteOn(msg.getNoteNumber(), static_cast<float>(msg.getVelocity()) / 127.0f);
                
                // Write note-on to the queue for UI note visualization
                int wp = midiEventWritePos.load(std::memory_order_relaxed);
                int nextWp = (wp + 1) % kMaxMidiEvents;
                if (nextWp != midiEventReadPos.load(std::memory_order_acquire))
                {
                    auto& evt = midiEventBuffer[wp];
                    evt.noteNumber = msg.getNoteNumber();
                    evt.channel = msg.getChannel() - 1; // JUCE uses 1-based channels
                    evt.velocity16 = static_cast<uint32_t>(msg.getVelocity()) * 516;
                    evt.pitchBend = 0.0f;
                    evt.pressure = msg.getAfterTouchValue() / 127.0f;
                    evt.timestampSamples = metadata.samplePosition;
                    
                    midiEventWritePos.store(nextWp, std::memory_order_release);
                }
            }
            else if (msg.isNoteOff())
            {
                pantheonSynth.noteOff(msg.getNoteNumber());
            }
            else if (msg.isPitchWheel())
            {
                float pbVal = (static_cast<float>(msg.getPitchWheelValue()) - 8192.0f) / 8192.0f;
                pantheonSynth.setPitchBend(pbVal);
            }
        }
        else // Other tabs trigger the sampler
        {
            if (msg.isNoteOn())
            {
                // 1. Gather active slots (loaded and powered)
                std::vector<int> activeSlots;
                for (int i = 0; i < 6; ++i)
                {
                    bool isPowered = true;
                    if (auto* param = apvts.getParameter("slotPower_" + juce::String(i)))
                    {
                        isPowered = param->getValue() > 0.5f;
                    }
                    // Check if sampler voice has sample loaded
                    if (isPowered && sampler.hasSample(i))
                    {
                        activeSlots.push_back(i);
                    }
                }

                if (!activeSlots.empty())
                {
                    // 2. Select slot(s) to play based on slotPlayMode
                    int playMode = 0;
                    if (auto* param = apvts.getParameter("slotPlayMode"))
                    {
                        playMode = static_cast<int>(param->getNormalisableRange().convertFrom0to1(param->getValue()));
                    }

                    std::vector<int> slotsToTrigger;
                    if (playMode == 0) // Layer Mode
                    {
                        slotsToTrigger = activeSlots;
                    }
                    else if (playMode == 1) // Round Robin
                    {
                        int rrIdx = currentRoundRobinSlot.load(std::memory_order_relaxed);
                        int slotIdx = activeSlots[rrIdx % activeSlots.size()];
                        slotsToTrigger.push_back(slotIdx);
                        currentRoundRobinSlot.store((rrIdx + 1) % activeSlots.size(), std::memory_order_relaxed);
                    }
                    else if (playMode == 2) // Random
                    {
                        int randIdx = randomGen.nextInt(static_cast<int>(activeSlots.size()));
                        slotsToTrigger.push_back(activeSlots[randIdx]);
                    }

                    // 3. Trigger each selected slot
                    float velocity = static_cast<float>(msg.getVelocity()) / 127.0f;
                    float pitchOffset = static_cast<float>(msg.getNoteNumber() - 60);
                    float globalTune = *apvts.getRawParameterValue("tuneSemitones");

                    for (int slotIdx : slotsToTrigger)
                    {
                        float tuneVal = 50.0f;
                        float fineVal = 50.0f;
                        float panVal = 50.0f;
                        float volVal = 75.0f;
                        float textureVal = 40.0f;

                        if (auto* param = apvts.getParameter("slotTune_" + juce::String(slotIdx)))
                            tuneVal = param->getNormalisableRange().convertFrom0to1(param->getValue());
                        if (auto* param = apvts.getParameter("slotFine_" + juce::String(slotIdx)))
                            fineVal = param->getNormalisableRange().convertFrom0to1(param->getValue());
                        if (auto* param = apvts.getParameter("slotPan_" + juce::String(slotIdx)))
                            panVal = param->getNormalisableRange().convertFrom0to1(param->getValue());
                        if (auto* param = apvts.getParameter("slotVol_" + juce::String(slotIdx)))
                            volVal = param->getNormalisableRange().convertFrom0to1(param->getValue());
                        if (auto* param = apvts.getParameter("slotTexture_" + juce::String(slotIdx)))
                            textureVal = param->getNormalisableRange().convertFrom0to1(param->getValue());

                        float slotTuneSemitones = (tuneVal - 50.0f) * 0.48f + (fineVal - 50.0f) * 0.02f;
                        float finalPitch = pitchOffset + slotTuneSemitones + globalTune;
                        float finalPan = (panVal - 50.0f) / 50.0f;

                        // Per-slot volume: 0→silence, 75→unity (0dB), 100→+8dB
                        float slotGain = (volVal <= 0.0f) ? 0.0f
                                         : juce::Decibels::decibelsToGain((volVal - 75.0f) * 0.32f);
                        float finalVelocity = velocity * slotGain;

                        // Apply texture (per-voice LPF cutoff)
                        sampler.setTexture(slotIdx, textureVal);

                        // Trigger the voice
                        sampler.trigger(slotIdx, finalVelocity, finalPitch, finalPan, 0.5f, 0.0f, 1.0f, false);
                    }
                }

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

                                // 4. Micro Timing — nudge trigger by sample offset
                                int microOffsetSamples = 0;
                                if (step.microTiming != 0)
                                {
                                    // microTiming: -50..+50 → fraction of a 16th note
                                    // Positive = late (human feel), negative = rushed
                                    float fraction = static_cast<float>(step.microTiming) / 100.0f;
                                    microOffsetSamples = static_cast<int>(fraction * samplesPer16th);
                                }
                                sampler.trigger(t, step.velocity / 127.0f, step.pitch, step.pan, step.decay, start, end, step.reverse, step.retrigRate, samplesPer16th, microOffsetSamples);
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

    // ═══════════════════════════════════════════════════════════
    // Electric Pantheon Synth Parameters & Processing
    // ═══════════════════════════════════════════════════════════
    int godIdx = static_cast<int>(*apvts.getRawParameterValue("pantheonGod"));
    float energy = *apvts.getRawParameterValue("pantheonMacro_energy");
    float divinity = *apvts.getRawParameterValue("pantheonMacro_divinity");
    float width = *apvts.getRawParameterValue("pantheonMacro_width");
    float realm = *apvts.getRawParameterValue("pantheonMacro_realm");
    float aura = *apvts.getRawParameterValue("pantheonMacro_aura");
    float age = *apvts.getRawParameterValue("pantheonMacro_age");

    pantheonSynth.setGod(godIdx);
    pantheonSynth.setMacros(energy, divinity, width, realm, aura, age);
    pantheonSynth.process(buffer);

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
    // ─── Mastering DSP Parameters ───
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

    // Cold Extension (sub-bass thickener)
    velvetChain.setColdExtension(*apvts.getRawParameterValue("masterColdExtension"));

    // Compressor (dynamics shaping — attack, ratio, threshold, release)
    velvetChain.setCompressorThreshold(*apvts.getRawParameterValue("masterDynamicsThreshold"));
    velvetChain.setCompressorAttack(*apvts.getRawParameterValue("masterAttack"));
    velvetChain.setCompressorRelease(*apvts.getRawParameterValue("masterRelease"));
    velvetChain.setCompressorRatio(*apvts.getRawParameterValue("masterDynamicsRatio"));

    // Limiter (ceiling protector — uses masterCeiling as threshold)
    float ceilingDb = *apvts.getRawParameterValue("masterCeiling");
    velvetChain.setLimiterThreshold(ceilingDb);

    // Output volume
    velvetChain.setOutputGain(*apvts.getRawParameterValue("masterVolume"));

    // Stereo Width & Imager
    velvetChain.setWidth(*apvts.getRawParameterValue("masterWidth"));
    velvetChain.setImager(*apvts.getRawParameterValue("masterImager"));

    // ═══════════════════════════════════════════════════════════
    // Mastering DSP Processing
    // ═══════════════════════════════════════════════════════════
    juce::dsp::AudioBlock<float> block(buffer);
    juce::dsp::ProcessContextReplacing<float> context(block);
    velvetChain.process(context);

    // ═══════════════════════════════════════════════════════════
    // Demo Watermark (Periodic Volume Dip)
    // ═══════════════════════════════════════════════════════════
    if (!licenseActivated.load(std::memory_order_relaxed))
    {
        double sr = getSampleRate();
        int watermarkPeriodSamples = static_cast<int>(45.0 * sr);
        int watermarkDipSamples = static_cast<int>(4.5 * sr);
        int fadeSamples = static_cast<int>(1.5 * sr);

        const int numSamples = buffer.getNumSamples();
        const int numChannels = buffer.getNumChannels();

        for (int i = 0; i < numSamples; ++i)
        {
            watermarkSampleCounter++;
            if (watermarkSampleCounter >= watermarkPeriodSamples)
            {
                watermarkSampleCounter = 0;
            }

            int dipStart = watermarkPeriodSamples - watermarkDipSamples;
            if (watermarkSampleCounter >= dipStart)
            {
                int relativePos = watermarkSampleCounter - dipStart;
                if (relativePos < fadeSamples)
                {
                    float t = static_cast<float>(relativePos) / static_cast<float>(fadeSamples);
                    currentWatermarkGain = 1.0f - t * (1.0f - 0.15f);
                }
                else if (relativePos >= watermarkDipSamples - fadeSamples)
                {
                    int fadeInStart = watermarkDipSamples - fadeSamples;
                    float t = static_cast<float>(relativePos - fadeInStart) / static_cast<float>(fadeSamples);
                    currentWatermarkGain = 0.15f + t * (1.0f - 0.15f);
                }
                else
                {
                    currentWatermarkGain = 0.15f;
                }
            }
            else
            {
                currentWatermarkGain = 1.0f;
            }

            for (int channel = 0; channel < numChannels; ++channel)
            {
                float* channelData = buffer.getWritePointer(channel);
                channelData[i] *= currentWatermarkGain;
            }
        }
    }
    else
    {
        currentWatermarkGain = 1.0f;
        watermarkSampleCounter = 0;
    }

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

        // Push master output to FFT ring buffer
        if (buffer.getNumChannels() >= 1)
        {
            const float* left = buffer.getReadPointer(0);
            if (buffer.getNumChannels() >= 2)
            {
                const float* right = buffer.getReadPointer(1);
                std::vector<float> mono (static_cast<size_t>(numSamples));
                for (int i = 0; i < numSamples; ++i)
                    mono[static_cast<size_t>(i)] = (left[i] + right[i]) * 0.5f;
                pushToFftBuffer (mono.data(), numSamples);
            }
            else
            {
                pushToFftBuffer (left, numSamples);
            }
        }
    }

    auto endTime = juce::Time::getHighResolutionTicks();
    double elapsedSeconds = static_cast<double>(endTime - startTime) / juce::Time::getHighResolutionTicksPerSecond();
    double blockSeconds = static_cast<double>(buffer.getNumSamples()) / getSampleRate();
    if (blockSeconds > 0.0)
    {
        double currentUsage = (elapsedSeconds / blockSeconds) * 100.0;
        double prevUsage = cpuUsage.load(std::memory_order_relaxed);
        cpuUsage.store(prevUsage + 0.1 * (currentUsage - prevUsage), std::memory_order_relaxed);
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
            
            analyzeSample(trackIdx, *buffer, reader->sampleRate);
            
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

void VSTGodTheGodRealmAudioProcessor::triggerStep(int trackIdx, float velocity, float pitch, float pan, float decay, float startNorm, float endNorm, bool reverse, int sliceIndex)
{
    float start = startNorm;
    float end = endNorm;
    
    const juce::ScopedLock sl(stepLock);
    if (trackIdx >= 0 && trackIdx < 8)
    {
        auto& track = tracks[trackIdx];
        if (sliceIndex > 0 && sliceIndex <= static_cast<int>(track.slices.size()))
        {
            start = track.slices[sliceIndex - 1].start;
            end = track.slices[sliceIndex - 1].end;
        }
    }
    
    sampler.trigger(trackIdx, velocity, pitch, pan, decay, start, end, reverse);
}

void VSTGodTheGodRealmAudioProcessor::updateTransportState(bool isPlaying, double bpm)
{
    transport.isPlaying.store(isPlaying, std::memory_order_relaxed);
    transport.bpm.store(bpm, std::memory_order_relaxed);
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
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("tuneSemitones", 1), "Tune", -24.0f, 24.0f, 0.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("masterVolume", 1), "Volume", -60.0f, 6.0f, 0.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("globalBpm", 1), "BPM", 20.0f, 300.0f, 140.0f));

    // --- Celestial Forge (Mastering) ---
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("masterInputGain", 1), "Input Gain", -12.0f, 12.0f, 0.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("masterDrive", 1), "Drive", 0.0f, 100.0f, 20.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("masterColorTilt", 1), "Color Tilt", 0.0f, 100.0f, 50.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("masterDynamicsThreshold", 1), "Threshold", -60.0f, 0.0f, -12.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("masterDynamicsRatio", 1), "Ratio", 1.0f, 10.0f, 2.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("masterAttack", 1), "Attack", 1.0f, 100.0f, 30.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("masterRelease", 1), "Release", 10.0f, 1000.0f, 100.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("masterColdExtension", 1), "Cold Extension", 0.0f, 100.0f, 0.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("masterCeiling", 1), "Ceiling", -12.0f, 12.0f, -0.1f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("masterWidth", 1), "Width", 0.0f, 200.0f, 100.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("masterImager", 1), "Imager", -1.0f, 1.0f, 0.0f));

    // --- Navigation & State ---
    layout.add(std::make_unique<juce::AudioParameterInt>(juce::ParameterID("activeTab", 1), "Active Tab", 0, 8, 0));
    layout.add(std::make_unique<juce::AudioParameterInt>(juce::ParameterID("selectedPreset", 1), "Selected Preset", 0, 511, 0));
    layout.add(std::make_unique<juce::AudioParameterInt>(juce::ParameterID("activePattern", 1), "Active Pattern", 0, 1, 0));
    layout.add(std::make_unique<juce::AudioParameterBool>(juce::ParameterID("isFillMode", 1), "Fill Mode", false));

    // --- Electric Pantheon Synth ---
    layout.add(std::make_unique<juce::AudioParameterInt>(juce::ParameterID("pantheonGod", 1), "Pantheon God", 0, 7, 0));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("pantheonMacro_energy", 1), "Pantheon Energy", 0.0f, 100.0f, 50.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("pantheonMacro_divinity", 1), "Pantheon Divinity", 0.0f, 100.0f, 50.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("pantheonMacro_width", 1), "Pantheon Width", 0.0f, 100.0f, 50.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("pantheonMacro_realm", 1), "Pantheon Realm", 0.0f, 100.0f, 50.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("pantheonMacro_aura", 1), "Pantheon Aura", 0.0f, 100.0f, 50.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("pantheonMacro_age", 1), "Pantheon Age", 0.0f, 100.0f, 50.0f));

    // --- Sample Chopper / Sequencer (Stubs for now) ---
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("morphFactor", 1), "Morph Factor", 0.0f, 1.0f, 0.0f));

    // --- 6-Slot Sample Engine Section ---
    layout.add(std::make_unique<juce::AudioParameterInt>(juce::ParameterID("slotPlayMode", 1), "Slot Play Mode", 0, 2, 0));
    for (int i = 0; i < 6; ++i)
    {
        juce::String idSuffix = juce::String(i);
        layout.add(std::make_unique<juce::AudioParameterBool>(juce::ParameterID("slotPower_" + idSuffix, 1), "Slot " + idSuffix + " Power", true));
        layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("slotVol_" + idSuffix, 1), "Slot " + idSuffix + " Volume", 0.0f, 100.0f, 75.0f));
        layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("slotPan_" + idSuffix, 1), "Slot " + idSuffix + " Pan", 0.0f, 100.0f, 50.0f));
        layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("slotTune_" + idSuffix, 1), "Slot " + idSuffix + " Tune", 0.0f, 100.0f, 50.0f));
        layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("slotTexture_" + idSuffix, 1), "Slot " + idSuffix + " Texture", 0.0f, 100.0f, 40.0f));
        layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("slotFine_" + idSuffix, 1), "Slot " + idSuffix + " Fine", 0.0f, 100.0f, 50.0f));
    }

    // --- Front-Panel Global Macros ---
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("macro_energy", 1), "Global Energy", 0.0f, 100.0f, 50.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("macro_divinity", 1), "Global Divinity", 0.0f, 100.0f, 50.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("macro_width", 1), "Global Width", 0.0f, 100.0f, 50.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("macro_realm", 1), "Global Realm", 0.0f, 100.0f, 50.0f));

    // --- CelestialPad Instrument ---
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("pad_reverbMix", 1), "Pad Depth", 0.0f, 100.0f, 60.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("pad_chorusMix", 1), "Pad Drift", 0.0f, 100.0f, 50.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("pad_filterFreq", 1), "Pad Warmth", 0.0f, 100.0f, 55.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("pad_attack", 1), "Pad Bloom", 0.0f, 100.0f, 65.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("pad_sustain", 1), "Pad Sustain", 0.0f, 100.0f, 80.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("pad_release", 1), "Pad Release", 0.0f, 100.0f, 75.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("pad_divinity", 1), "Pad Shimmer", 0.0f, 100.0f, 45.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("pad_width", 1), "Pad Space", 0.0f, 100.0f, 60.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("pad_bodyGain", 1), "Pad Body", 0.0f, 100.0f, 50.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("pad_subOscGain", 1), "Pad Sub", 0.0f, 100.0f, 30.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("pad_masterGain", 1), "Pad Master", 0.0f, 100.0f, 70.0f));
    layout.add(std::make_unique<juce::AudioParameterBool>(juce::ParameterID("pad_power", 1), "Pad Power", true));
    layout.add(std::make_unique<juce::AudioParameterInt>(juce::ParameterID("pad_waveType", 1), "Pad Wave Type", 0, 3, 0));

    // --- UnderworldBass Instrument ---
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("bass_subOscGain", 1), "Bass Sub Gain", 0.0f, 100.0f, 60.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("bass_satDrive", 1), "Bass Drive", 0.0f, 100.0f, 45.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("bass_satMix", 1), "Bass Distort", 0.0f, 100.0f, 30.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("bass_modIndex", 1), "Bass Crush", 0.0f, 100.0f, 15.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("bass_masterGain", 1), "Bass Level", 0.0f, 100.0f, 70.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("bass_filterFreq", 1), "Bass Cutoff", 0.0f, 100.0f, 55.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("bass_filterQ", 1), "Bass Reso", 0.0f, 100.0f, 35.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("bass_delayMix", 1), "Bass Lava Drip", 0.0f, 100.0f, 25.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("bass_attack", 1), "Bass Attack", 0.0f, 100.0f, 5.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("bass_decay", 1), "Bass Decay", 0.0f, 100.0f, 40.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("bass_sustain", 1), "Bass Sustain", 0.0f, 100.0f, 60.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("bass_release", 1), "Bass Release", 0.0f, 100.0f, 35.0f));

    // --- DivineTexture Instrument ---
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("texture_filterFreq", 1), "Texture Filter", 0.0f, 100.0f, 65.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("texture_morphBlend", 1), "Texture Blend", 0.0f, 100.0f, 50.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("texture_reverbMix", 1), "Texture Reverb", 0.0f, 100.0f, 55.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("texture_masterGain", 1), "Texture Output", 0.0f, 100.0f, 70.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("texture_energy", 1), "Texture Organic", 0.0f, 100.0f, 50.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("texture_divinity", 1), "Texture Growth", 0.0f, 100.0f, 45.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("texture_filterQ", 1), "Texture Resonance", 0.0f, 100.0f, 40.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("texture_subOscGain", 1), "Texture Roots", 0.0f, 100.0f, 55.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("texture_modIndex", 1), "Texture Harmonics", 0.0f, 100.0f, 50.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("texture_chorusMix", 1), "Texture Mystic", 0.0f, 100.0f, 35.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("texture_delayMix", 1), "Texture Vine", 0.0f, 100.0f, 40.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("texture_realm", 1), "Texture Divine", 0.0f, 100.0f, 50.0f));

    // --- EtherealPluck Instrument ---
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("pluck_modIndex", 1), "Pluck Tone", 0.0f, 100.0f, 55.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("pluck_filterQ", 1), "Pluck Res", 0.0f, 100.0f, 40.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("pluck_reverbMix", 1), "Pluck Shimmer", 0.0f, 100.0f, 65.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("pluck_attack", 1), "Pluck Attack", 0.0f, 100.0f, 20.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("pluck_bodyGain", 1), "Pluck Body", 0.0f, 100.0f, 50.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("pluck_chorusMix", 1), "Pluck Air", 0.0f, 100.0f, 45.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("pluck_width", 1), "Pluck Width", 0.0f, 100.0f, 60.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("pluck_masterGain", 1), "Pluck Master", 0.0f, 100.0f, 70.0f));

    // --- MythicLead Instrument ---
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("lead_satDrive", 1), "Lead Drive", 0.0f, 100.0f, 40.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("lead_bodyGain", 1), "Lead Level", 0.0f, 100.0f, 65.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("lead_subOscGain", 1), "Lead Lo", 0.0f, 100.0f, 30.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("lead_filterFreq", 1), "Lead Cutoff", 0.0f, 100.0f, 60.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("lead_filterQ", 1), "Lead Res", 0.0f, 100.0f, 35.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("lead_detuneCents", 1), "Lead Detune", 0.0f, 100.0f, 20.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("lead_attack", 1), "Lead Attack", 0.0f, 100.0f, 5.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("lead_decay", 1), "Lead Decay", 0.0f, 100.0f, 30.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("lead_sustain", 1), "Lead Sustain", 0.0f, 100.0f, 50.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("lead_release", 1), "Lead Release", 0.0f, 100.0f, 25.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("lead_satMix", 1), "Lead Sat", 0.0f, 100.0f, 30.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("lead_masterGain", 1), "Lead Master", 0.0f, 100.0f, 70.0f));
    layout.add(std::make_unique<juce::AudioParameterBool>(juce::ParameterID("lead_bypassed", 1), "Lead Bypassed", false));
    layout.add(std::make_unique<juce::AudioParameterInt>(juce::ParameterID("lead_voiceMode", 1), "Lead Voice Mode", 0, 1, 0));

    return layout;
}

juce::File VSTGodTheGodRealmAudioProcessor::getConfigFile()
{
    return juce::File::getSpecialLocation(juce::File::userApplicationDataDirectory)
        .getChildFile("MixxTech")
        .getChildFile("VST God")
        .getChildFile("config.json");
}

juce::String VSTGodTheGodRealmAudioProcessor::loadSettingsFromDisk()
{
    auto file = getConfigFile();
    if (file.existsAsFile())
    {
        return file.loadFileAsString();
    }
    return {};
}

void VSTGodTheGodRealmAudioProcessor::saveSettingsToDisk (const juce::String& settingsJson)
{
    auto file = getConfigFile();
    if (!file.getParentDirectory().exists())
    {
        file.getParentDirectory().createDirectory();
    }
    
    file.replaceWithText(settingsJson);
    
    // Parse out sampleLibraryPath and licenseActivated if available in the JSON
    auto json = juce::JSON::parse(settingsJson);
    if (json.hasProperty("sampleLibraryPath"))
    {
        sampleLibraryPath = json.getProperty("sampleLibraryPath", "").toString();
    }
    if (json.hasProperty("licenseActivated"))
    {
        licenseActivated.store((bool)json.getProperty("licenseActivated", false), std::memory_order_relaxed);
    }
}

void VSTGodTheGodRealmAudioProcessor::pushToFftBuffer (const float* samples, int numSamples)
{
    int wp = fftWritePos.load (std::memory_order_relaxed);
    for (int i = 0; i < numSamples; ++i)
    {
        fftRingBuffer[wp] = samples[i];
        wp = (wp + 1) % (kFftSize * 2);
    }
    fftWritePos.store (wp, std::memory_order_release);
}

void VSTGodTheGodRealmAudioProcessor::getLatestFftSamples (float* dest)
{
    int wp = fftWritePos.load (std::memory_order_relaxed);
    int readPos = (wp - kFftSize + kFftSize * 2) % (kFftSize * 2);
    for (int i = 0; i < kFftSize; ++i)
    {
        dest[i] = fftRingBuffer[readPos];
        readPos = (readPos + 1) % (kFftSize * 2);
    }
}

VSTGodTheGodRealmAudioProcessor::WaveformAnalysis VSTGodTheGodRealmAudioProcessor::getTrackAnalysis (int trackIdx)
{
    if (trackIdx < 0 || trackIdx >= 16) return {};
    const juce::ScopedLock sl (analysisLock);
    return trackAnalysis[trackIdx];
}

void VSTGodTheGodRealmAudioProcessor::clearTrackAnalysisPending (int trackIdx)
{
    if (trackIdx < 0 || trackIdx >= 16) return;
    const juce::ScopedLock sl (analysisLock);
    trackAnalysis[trackIdx].pendingUpdate = false;
}

void VSTGodTheGodRealmAudioProcessor::analyzeSample (int trackIdx, const juce::AudioBuffer<float>& buffer, double sampleRate)
{
    if (trackIdx < 0 || trackIdx >= 16) return;
    if (buffer.getNumSamples() <= 0) return;
    
    const float* data = buffer.getReadPointer (0);
    const int numSamples = buffer.getNumSamples();
    
    std::vector<float> transientsList;
    
    int blockSize = static_cast<int> (sampleRate * 0.01);
    if (blockSize < 16) blockSize = 16;
    
    int numBlocks = numSamples / blockSize;
    if (numBlocks > 1)
    {
        std::vector<float> energies (numBlocks, 0.0f);
        for (int b = 0; b < numBlocks; ++b)
        {
            float sum = 0.0f;
            for (int i = 0; i < blockSize; ++i)
            {
                float s = data[b * blockSize + i];
                sum += s * s;
            }
            energies[b] = sum / static_cast<float> (blockSize);
        }
        
        float threshold = 26.0f * 0.0002f; // (101 - 75) * 0.0002
        for (int b = 1; b < numBlocks; ++b)
        {
            float diff = energies[b] - energies[b - 1];
            if (diff > threshold && energies[b] > 0.0001f)
            {
                float pos = static_cast<float> (b * blockSize) / static_cast<float> (numSamples);
                if (transientsList.empty() || pos - transientsList.back() > 0.03f)
                {
                    transientsList.push_back (pos);
                }
            }
        }
    }
    
    std::vector<float> envelope (256, 0.0f);
    int step = numSamples / 256;
    if (step < 1) step = 1;
    for (int i = 0; i < 256; ++i)
    {
        float maxVal = 0.0f;
        int startSample = i * step;
        int endSample = std::min (numSamples, (i + 1) * step);
        for (int s = startSample; s < endSample; ++s)
        {
            maxVal = std::max (maxVal, std::abs (data[s]));
        }
        envelope[i] = maxVal;
    }
    
    {
        const juce::ScopedLock sl (analysisLock);
        trackAnalysis[trackIdx].padIndex = trackIdx;
        trackAnalysis[trackIdx].transients = std::move (transientsList);
        trackAnalysis[trackIdx].rmsEnvelope = std::move (envelope);
        trackAnalysis[trackIdx].pendingUpdate = true;
    }
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new VSTGodTheGodRealmAudioProcessor();
}
