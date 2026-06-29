#include "PluginProcessor.h"
#include "PluginEditor.h"

// ═══════════════════════════════════════════════════════════════
// LicenseValidatorThread — Background HTTP License Checks
// ═══════════════════════════════════════════════════════════════
class LicenseValidatorThread : public juce::Thread
{
public:
    LicenseValidatorThread (VSTGodTheGodRealmAudioProcessor& p)
        : Thread ("LicenseValidator"), processor (p)
    {}

    ~LicenseValidatorThread() override
    {
        stopThread (5000);
    }

    void startValidation (const juce::String& key, bool isFirstActivation)
    {
        licenseKey = key;
        firstActivation = isFirstActivation;
        
        // Ensure the thread is not already running
        stopThread (5000);
        startThread (juce::Thread::Priority::normal);
    }

    void run() override
    {
        // Build JSON payload
        juce::DynamicObject::Ptr json = new juce::DynamicObject();
        json->setProperty ("key", licenseKey.trim());
        json->setProperty ("machine_id", juce::SystemStats::getUniqueDeviceID());
        #if JUCE_MAC
        json->setProperty ("platform", "macos");
        #else
        json->setProperty ("platform", "windows");
        #endif
        json->setProperty ("version", "v1.0.0");
        json->setProperty ("action", firstActivation ? "activate" : "verify");

        juce::var jsonVar (json.get());
        juce::String jsonString = juce::JSON::toString (jsonVar);

        juce::URL url ("https://coegagqdkgvayzuviqxw.supabase.co/functions/v1/validate-license");
        url = url.withPOSTData (jsonString);

        int statusCode = 0;
        auto options = juce::URL::InputStreamOptions (juce::URL::ParameterHandling::inPostData)
            .withHttpRequestCmd ("POST")
            .withExtraHeaders ("Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZWdhZ3Fka2d2YXl6dXZpcXh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMzczMjUsImV4cCI6MjA5NjcxMzMyNX0.l7W3taMUSFzCn4KvqOIKFCdvXUZd84Kym6cstnz1-ZA\nContent-Type: application/json")
            .withConnectionTimeoutMs (10000)
            .withStatusCode (&statusCode);

        std::unique_ptr<juce::InputStream> stream (url.createInputStream (options));

        bool success = false;
        juce::String message = "Could not connect to validation server.";

        if (stream != nullptr)
        {
            juce::String response = stream->readEntireStreamAsString();
            auto responseJson = juce::JSON::parse (response);
            if (responseJson.isObject())
            {
                success = (bool)responseJson.getProperty ("success", false);
                message = responseJson.getProperty ("message", "").toString();
            }
            else
            {
                message = "Invalid response from server.";
            }
        }
        else
        {
            // Network/HTTP error
            if (!firstActivation && processor.licenseActivated.load (std::memory_order_relaxed))
            {
                // Keep status active if offline and already activated
                success = true;
                message = "Offline: keeping previous active session.";
            }
        }

        processor.handleValidationResult (success, message, licenseKey, firstActivation);
    }

private:
    VSTGodTheGodRealmAudioProcessor& processor;
    juce::String licenseKey;
    bool firstActivation = false;
};

VSTGodTheGodRealmAudioProcessor::VSTGodTheGodRealmAudioProcessor()
#ifndef JucePlugin_PreferredChannelConfigurations
     : AudioProcessor (BusesProperties()
                     #if ! JucePlugin_IsMidiEffect
                      #if ! JucePlugin_IsSynth
                       .withInput  ("Input",  juce::AudioChannelSet::stereo(), true)
                      #endif
                       .withOutput ("Output", juce::AudioChannelSet::stereo(), true)
                       .withOutput ("Out 1-2", juce::AudioChannelSet::stereo(), false)
                       .withOutput ("Out 3-4", juce::AudioChannelSet::stereo(), false)
                       .withOutput ("Out 5-6", juce::AudioChannelSet::stereo(), false)
                       .withOutput ("Out 7-8", juce::AudioChannelSet::stereo(), false)
                       .withOutput ("Out 9-10", juce::AudioChannelSet::stereo(), false)
                       .withOutput ("Out 11-12", juce::AudioChannelSet::stereo(), false)
                       .withOutput ("Out 13-14", juce::AudioChannelSet::stereo(), false)
                       .withOutput ("Out 15-16", juce::AudioChannelSet::stereo(), false)
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
        if (json.hasProperty("licenseKey"))
        {
            activeLicenseKey = json.getProperty("licenseKey", "").toString();
        }
    }

    // Set default sample library path if none was saved
    if (sampleLibraryPath.isEmpty())
        sampleLibraryPath = juce::File::getSpecialLocation(juce::File::commonApplicationDataDirectory)
            .getChildFile("MixxTech").getChildFile("VST God").getChildFile("Samples")
            .getFullPathName();

    if (activeLicenseKey.isNotEmpty())
    {
        startLicenseValidation (activeLicenseKey, false);
    }
    
    updateVortexWeights(0.5f, 0.5f);
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
    pedalFxChain.prepare(sampleRate, samplesPerBlock);
    sampler.prepare(sampleRate);
    pantheonSynth.prepare(sampleRate);
    uiMidiCollector.reset(sampleRate);
    webResamplerL.reset();
    webResamplerR.reset();
    webAudioFifo.reset();
    webAudioPrimed = false;
    webAudioFadeGain = 0.0f;
    webAudioStarveBlocks = 0;
    lfo1.prepare(sampleRate);
    lfo2.prepare(sampleRate);
    
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

    // Validate that auxiliary buses are configured to mono, stereo, or disabled:
    for (int i = 0; i < layouts.outputBuses.size(); ++i) {
        auto set = layouts.outputBuses[i];
        if (set != juce::AudioChannelSet::mono() && set != juce::AudioChannelSet::stereo() && set != juce::AudioChannelSet::disabled())
            return false;
    }

    return true;
  #endif
}
#endif

void VSTGodTheGodRealmAudioProcessor::processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages)
{
    auto startTime = juce::Time::getHighResolutionTicks();
    juce::ScopedNoDenormals noDenormals;

    int blockRRIdx = currentRoundRobinSlot.load(std::memory_order_relaxed);
    auto totalNumInputChannels  = getTotalNumInputChannels();
    auto totalNumOutputChannels = getTotalNumOutputChannels();

    for (auto i = totalNumInputChannels; i < totalNumOutputChannels; ++i)
        buffer.clear (i, 0, buffer.getNumSamples());

    // Clear main stereo output before sampler/synth add their signal.
    // Without this, any uncleared host buffer or oversampler state produces white noise.
    getBusBuffer(buffer, false, 0).clear();

    // Clear all auxiliary outputs at the start of each block
    for (int b = 1; b < getBusCount(false); ++b)
        getBusBuffer(buffer, false, b).clear();

    // ─── Merge UI-triggered MIDI (piano clicks) into this block ────────────
    {
        juce::MidiBuffer uiMidi;
        uiMidiCollector.removeNextBlockOfMessages (uiMidi, buffer.getNumSamples());
        for (const auto& meta : uiMidi)
            midiMessages.addEvent (meta.getMessage(), meta.samplePosition);
    }

    // ─── Web Audio Bridge ────────────────────────────────────────────────────
    // JS synthesisers (SoundRealm, GodVault, MultiRealm) capture audio via
    // ScriptProcessor and send it here so it routes through the DAW bus.
    if (webAudioActive.load (std::memory_order_relaxed))
    {
        const int n = buffer.getNumSamples();

        // Target ~50 ms of buffered audio. Deep enough to absorb React render
        // stalls (typically 20–40 ms) without underrunning; shallow enough that
        // first-note audio reaches the DAW output in ~50 ms rather than ~120 ms.
        // The adaptive fade in the consumer handles any short underrun gracefully.
        const int primeTarget = juce::jmax (2048, (int) (spec.sampleRate * 0.05)); // ~50 ms

        int ready = webAudioFifo.getNumReady();

        // Safety ceiling: only if the buffer grossly overflows (e.g. transport
        // glitch / the UI bursts a backlog after a stall) do we drop down to the
        // target. Adaptive resampling normally prevents this.
        const int ceiling = juce::jmax (primeTarget * 6, (int) (spec.sampleRate * 0.5));
        if (ready > ceiling)
        {
            int drop = ready - primeTarget;
            int ds1, dn1, ds2, dn2;
            webAudioFifo.prepareToRead (drop, ds1, dn1, ds2, dn2);
            webAudioFifo.finishedRead (dn1 + dn2);
            ready = webAudioFifo.getNumReady();
        }

        // Priming: don't start reading until we have the full target buffered.
        // Reading a partial/empty FIFO is what clicked at the start of notes.
        if (! webAudioPrimed && ready >= primeTarget)
            webAudioPrimed = true;

        if (webAudioPrimed)
        {
            auto* outL = buffer.getWritePointer (0);
            auto* outR = buffer.getNumChannels() > 1 ? buffer.getWritePointer (1) : outL;

            // Read whatever we have, up to a full block. If it's short we're
            // starving — fade the gain to 0 across the block so the audio we DO
            // have tails out smoothly instead of stopping dead (a click). When a
            // full block is available again, fade back up. ~4 ms ramp.
            const int   avail    = juce::jmin (ready, n);
            const float fadeStep = 1.0f / juce::jmax (1.0f, (float) (spec.sampleRate * 0.004));
            const float target   = (avail >= n) ? 1.0f : 0.0f;

            int s1, n1, s2, n2;
            webAudioFifo.prepareToRead (avail, s1, n1, s2, n2);

            int idx = 0;
            for (int i = 0; i < n1; ++i, ++idx)
            {
                webAudioFadeGain += juce::jlimit (-fadeStep, fadeStep, target - webAudioFadeGain);
                outL[idx] += webAudioBufL[s1 + i] * webAudioFadeGain;
                outR[idx] += webAudioBufR[s1 + i] * webAudioFadeGain;
            }
            for (int i = 0; i < n2; ++i, ++idx)
            {
                webAudioFadeGain += juce::jlimit (-fadeStep, fadeStep, target - webAudioFadeGain);
                outL[idx] += webAudioBufL[s2 + i] * webAudioFadeGain;
                outR[idx] += webAudioBufR[s2 + i] * webAudioFadeGain;
            }
            webAudioFifo.finishedRead (n1 + n2);

            // Remaining samples (under-run): no data to add, keep ramping the
            // gain toward 0 so the next recovery fades in from silence.
            for (; idx < n; ++idx)
                webAudioFadeGain += juce::jlimit (-fadeStep, fadeStep, target - webAudioFadeGain);

            if (avail < n)
            {
                // Only force a full re-prime after a sustained dropout, so a
                // momentary jitter gap doesn't cost a 120 ms re-buffer stall.
                if (++webAudioStarveBlocks > 8)
                {
                    webAudioPrimed = false;
                    webAudioStarveBlocks = 0;
                }
            }
            else
            {
                webAudioStarveBlocks = 0;
            }
        }
    }

    // ─── LFO phase increment and values calculation ───
    lfo1.setRate(*apvts.getRawParameterValue("lfo1Rate"));
    lfo2.setRate(*apvts.getRawParameterValue("lfo2Rate"));
    lfo1.setShape(static_cast<int>(*apvts.getRawParameterValue("lfo1Shape")));
    lfo2.setShape(static_cast<int>(*apvts.getRawParameterValue("lfo2Shape")));

    float lfo1Val = 0.0f;
    float lfo2Val = 0.0f;
    int numSamples = buffer.getNumSamples();
    for (int i = 0; i < numSamples; ++i)
    {
        lfo1Val = lfo1.getNextSample();
        lfo2Val = lfo2.getNextSample();
    }
    lfo1Value.store(lfo1Val, std::memory_order_relaxed);
    lfo2Value.store(lfo2Val, std::memory_order_relaxed);

    float aftertouchVal = midiAftertouch.load(std::memory_order_relaxed);
    float modwheelVal = midiModWheel.load(std::memory_order_relaxed);

    // Accumulate modulation targets
    float modDecay = 0.0f;
    float modCutoff = 0.0f;
    float modWarmth = 0.0f;
    float modEnergy = 0.0f;

    // Get secondary envelope values from synth
    float env2Val = pantheonSynth.getAverageModEnvelopeValue();

    // Get the modulation slot values and sync them to synth
    int modSources[4];
    int modTargets[4];
    float modAmounts[4];

    for (int slot = 0; slot < 4; ++slot)
    {
        juce::String idSuffix = juce::String(slot);
        modSources[slot] = static_cast<int>(*apvts.getRawParameterValue("modSource_" + idSuffix));
        modTargets[slot] = static_cast<int>(*apvts.getRawParameterValue("modTarget_" + idSuffix));
        modAmounts[slot] = *apvts.getRawParameterValue("modAmount_" + idSuffix);

        int source = modSources[slot];
        int target = modTargets[slot];
        float amount = modAmounts[slot];

        if (source == 0 || target == 0 || amount == 0.0f)
            continue;

        float sourceVal = 0.0f;
        if (source == 1) sourceVal = lfo1Val;
        else if (source == 2) sourceVal = lfo2Val;
        else if (source == 3) sourceVal = aftertouchVal;
        else if (source == 4) sourceVal = modwheelVal;
        else if (source == 5) sourceVal = env2Val; // Env 2!

        float modContribution = sourceVal * amount;

        if (target == 1) modDecay += modContribution;
        else if (target == 2) modCutoff += modContribution;
        else if (target == 3) modWarmth += modContribution;
        else if (target == 4) modEnergy += modContribution;
    }

    // Pass the mod matrix slots and global modulations to synth
    pantheonSynth.setModMatrixSlots(modSources, modTargets, modAmounts);
    pantheonSynth.setGlobalModulations(modDecay, modCutoff, modWarmth, modEnergy);

    // Apply modulation values to engines
    for (int t = 0; t < 8; ++t)
    {
        sampler.setModulations(t, modDecay, modCutoff * 50.0f);
    }

    // ═══════════════════════════════════════════════════════════
    // MIDI 2.0 Note Event Capture & Routing
    // ═══════════════════════════════════════════════════════════
    int activeTab = static_cast<int>(*apvts.getRawParameterValue("activeTab"));

    for (const auto metadata : midiMessages)
    {
        const auto msg = metadata.getMessage();
        
        // Capture global mod wheel and aftertouch for the Modulation Matrix
        if (msg.isChannelPressure())
        {
            midiAftertouch.store(static_cast<float>(msg.getChannelPressureValue()) / 127.0f, std::memory_order_relaxed);
        }
        else if (msg.isController())
        {
            int ccNum = msg.getControllerNumber();
            int ccVal = msg.getControllerValue();
            int channel = msg.getChannel() - 1; // 0-based channel
            
            if (ccNum == 1)
            {
                midiModWheel.store(static_cast<float>(ccVal) / 127.0f, std::memory_order_relaxed);
            }
            else if (ccNum == 11) // Expression pedal
            {
                midiExpression.store(static_cast<float>(ccVal) / 127.0f, std::memory_order_relaxed);
            }
            else if (ccNum == 64) // Sustain pedal
            {
                bool sustainOn = ccVal >= 64;
                bool wasSustained = midiSustainHeld.exchange(sustainOn, std::memory_order_relaxed);
                // On pedal release in Pantheon tab, trigger deferred note-offs
                if (wasSustained && !sustainOn && activeTab == 8)
                {
                    // Release all Pantheon voices that were held by sustain
                    for (int n = 0; n < 128; ++n)
                        pantheonSynth.noteOff(n, 0);
                }
            }
            
            // Queue CC event for custom MIDI learn/mapping in the webview
            int ccWp = ccEventWritePos.load(std::memory_order_relaxed);
            int nextCcWp = (ccWp + 1) % kMaxCCEvents;
            if (nextCcWp != ccEventReadPos.load(std::memory_order_acquire))
            {
                auto& ccEvt = ccEventBuffer[ccWp];
                ccEvt.ccNumber = ccNum;
                ccEvt.ccValue = ccVal;
                ccEvt.channel = channel;
                ccEventWritePos.store(nextCcWp, std::memory_order_release);
            }
            
            // Apply native Arturia KeyLab controller mappings
            handleArturiaKeyLabCC(ccNum, ccVal);
        }

        if (activeTab == 8) // Electric Pantheon tab
        {
            bool mpe = *apvts.getRawParameterValue("mpeEnabled") >= 0.5f;
            int ch = mpe ? (msg.getChannel() - 1) : 0;

            if (msg.isNoteOn())
            {
                pantheonSynth.noteOn(msg.getNoteNumber(), static_cast<float>(msg.getVelocity()) / 127.0f, ch);
                
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
                // Honour sustain pedal — defer note-off until pedal is released
                if (!midiSustainHeld.load(std::memory_order_relaxed))
                {
                    pantheonSynth.noteOff(msg.getNoteNumber(), ch);
                    // Queue noteOff for the web UI (velocity16=0 = noteOff convention)
                    int wp = midiEventWritePos.load(std::memory_order_relaxed);
                    int nextWp = (wp + 1) % kMaxMidiEvents;
                    if (nextWp != midiEventReadPos.load(std::memory_order_acquire))
                    {
                        auto& evt = midiEventBuffer[wp];
                        evt.noteNumber = msg.getNoteNumber();
                        evt.channel = msg.getChannel() - 1;
                        evt.velocity16 = 0; // 0 = note-off
                        evt.pitchBend = 0.0f;
                        evt.pressure = 0.0f;
                        evt.timestampSamples = metadata.samplePosition;
                        midiEventWritePos.store(nextWp, std::memory_order_release);
                    }
                }
            }
            else if (msg.isPitchWheel())
            {
                float pbVal = (static_cast<float>(msg.getPitchWheelValue()) - 8192.0f) / 8192.0f;
                if (mpe)
                    pantheonSynth.setMpePitchBend(ch, pbVal);
                else
                    pantheonSynth.setPitchBend(pbVal);
            }
            else if (msg.isChannelPressure())
            {
                float pressure = static_cast<float>(msg.getChannelPressureValue()) / 127.0f;
                if (mpe)
                    pantheonSynth.setMpePressure(ch, pressure);
            }
            else if (msg.isAftertouch())
            {
                float pressure = static_cast<float>(msg.getAfterTouchValue()) / 127.0f;
                if (mpe)
                    pantheonSynth.setMpePressure(ch, pressure);
            }
            else if (msg.isController() && msg.getControllerNumber() == 74) // MPE slide/timbre
            {
                float timbre = static_cast<float>(msg.getControllerValue()) / 127.0f;
                if (mpe)
                    pantheonSynth.setMpeTimbre(ch, timbre);
            }
        }
        else // Other tabs trigger the sampler
        {
            if (msg.isNoteOn())
            {
                // ─── Sample Chopper Tab (tab 2): MIDI note → slice playback ───
                // C4 (note 60) = slice 0, C#4 = slice 1, etc.
                // Each note plays the corresponding chop of the currently loaded chopper sample.
                if (activeTab == 2)
                {
                    int chopperTrack = 0; // Chopper always operates on track 0 as its primary slot
                    if (sampler.hasSample(chopperTrack))
                    {
                        int sliceIdx = msg.getNoteNumber() - 60; // C4 = slice 0
                        float velocity = static_cast<float>(msg.getVelocity()) / 127.0f;
                        float finalPitch = 0.0f; // Chops play at natural pitch (no transpose)
                        float finalPan = 0.0f;

                        float start = 0.0f;
                        float end = 1.0f;
                        bool validSlice = false;
                        {
                            const juce::ScopedLock sl(stepLock);
                            auto& slices = tracks[chopperTrack].slices;
                            if (sliceIdx >= 0 && sliceIdx < static_cast<int>(slices.size()))
                            {
                                start = slices[sliceIdx].start;
                                end = slices[sliceIdx].end;
                                validSlice = true;
                            }
                        }

                        // Only play if we have a valid slice — don't fall through to full sample
                        if (validSlice)
                        {
                            bool snapToZeroVal = true;
                            if (auto* param = apvts.getRawParameterValue("snapToZero"))
                                snapToZeroVal = param->load() >= 0.5f;

                            bool snapToTransientVal = true;
                            if (auto* param = apvts.getRawParameterValue("snapToTransient"))
                                snapToTransientVal = param->load() >= 0.5f;

                            std::vector<float> transients;
                            {
                                const juce::ScopedLock sl(analysisLock);
                                transients = trackAnalysis[chopperTrack].transients;
                            }

                            sampler.trigger(chopperTrack, velocity, finalPitch, finalPan, 0.5f,
                                            start, end, false, snapToZeroVal, snapToTransientVal, transients);

                            // Queue noteOn for the web UI so bridge.ts forwards it via neuralInputBus
                            {
                                int wp = midiEventWritePos.load(std::memory_order_relaxed);
                                int nextWp = (wp + 1) % kMaxMidiEvents;
                                if (nextWp != midiEventReadPos.load(std::memory_order_acquire))
                                {
                                    auto& evt = midiEventBuffer[wp];
                                    evt.noteNumber = msg.getNoteNumber();
                                    evt.channel = 15; // channel 15 = Chopper DAW MIDI marker
                                    evt.velocity16 = static_cast<uint32_t>(msg.getVelocity()) * 516;
                                    evt.pitchBend = 0.0f; evt.pressure = 0.0f;
                                    evt.timestampSamples = metadata.samplePosition;
                                    midiEventWritePos.store(nextWp, std::memory_order_release);
                                }
                            }
                        }
                        // If sliceIdx < 0 or beyond slice list: play nothing (key outside mapped range)
                    }
                }
                else
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
                        juce::uint32 now = juce::Time::getMillisecondCounter();
                        if (now - lastRRTriggerTimeMs > 30)
                        {
                            if (lastRRTriggerTimeMs > 0)
                            {
                                blockRRIdx = (blockRRIdx + 1) % 1024; // Wrap to prevent signed overflow
                                currentRoundRobinSlot.store(blockRRIdx, std::memory_order_relaxed);
                            }
                            lastRRTriggerTimeMs = now;
                        }
                        int slotIdx = activeSlots[static_cast<size_t>(blockRRIdx) % activeSlots.size()];
                        slotsToTrigger.push_back(slotIdx);
                    }
                    else if (playMode == 2) // Random
                    {
                        juce::uint32 now = juce::Time::getMillisecondCounter();
                        if (now - lastRandomTriggerTimeMs > 30)
                        {
                            // No-immediate-repeat: re-roll if same slot picked and alternatives exist
                            int newSlot = randomGen.nextInt(static_cast<int>(activeSlots.size()));
                            if (activeSlots.size() > 1)
                            {
                                int attempts = 0;
                                while (newSlot == lastRandomSlot && attempts < 3)
                                {
                                    newSlot = randomGen.nextInt(static_cast<int>(activeSlots.size()));
                                    ++attempts;
                                }
                            }
                            lastRandomSlot = newSlot;
                            lastRandomTriggerTimeMs = now;
                        }
                        int slotIdx = activeSlots[static_cast<size_t>(lastRandomSlot) % activeSlots.size()];
                        slotsToTrigger.push_back(slotIdx);
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
                        // Scale gain by layer count to prevent summing blow-out in Layer mode
                        int layerCount = static_cast<int>(slotsToTrigger.size());
                        float layerScale = (playMode == 0 && layerCount > 1)
                                           ? (1.0f / std::sqrt(static_cast<float>(layerCount)))
                                           : 1.0f;
                        float finalVelocity = velocity * slotGain * layerScale;

                        // Apply texture (per-voice LPF cutoff)
                        sampler.setTexture(slotIdx, textureVal);

                        // Trigger the voice
                        bool snapToZeroVal = true;
                        if (auto* param = apvts.getRawParameterValue("snapToZero"))
                            snapToZeroVal = param->load() >= 0.5f;

                        bool snapToTransientVal = true;
                        if (auto* param = apvts.getRawParameterValue("snapToTransient"))
                            snapToTransientVal = param->load() >= 0.5f;

                        std::vector<float> transients;
                        {
                            const juce::ScopedLock sl(analysisLock);
                            if (slotIdx >= 0 && slotIdx < 16)
                                transients = trackAnalysis[slotIdx].transients;
                        }

                        sampler.trigger(slotIdx, finalVelocity, finalPitch, finalPan, 0.5f, 0.0f, 1.0f, false,
                                        snapToZeroVal, snapToTransientVal, transients);
                    }

                    // Queue noteOn for web UI — bridge.ts forwards to neuralInputBus → web audio plays
                    {
                        int wp = midiEventWritePos.load(std::memory_order_relaxed);
                        int nextWp = (wp + 1) % kMaxMidiEvents;
                        if (nextWp != midiEventReadPos.load(std::memory_order_acquire))
                        {
                            auto& evt = midiEventBuffer[wp];
                            evt.noteNumber = msg.getNoteNumber();
                            evt.channel = 0; // channel 0 = Multi-Realm
                            evt.velocity16 = static_cast<uint32_t>(msg.getVelocity()) * 516;
                            evt.pitchBend = 0.0f; evt.pressure = 0.0f;
                            evt.timestampSamples = metadata.samplePosition;
                            midiEventWritePos.store(nextWp, std::memory_order_release);
                        }
                    }
                }
                else
                {
                    // ─── No sampler slots active: fall through to Pantheon synth ───
                    // Allows melody recording in FL Studio even without samples loaded.
                    float vel = static_cast<float>(msg.getVelocity()) / 127.0f;
                    pantheonSynth.noteOn(msg.getNoteNumber(), vel, 0);
                }
                } // end non-chopper tab
            }
            else if (msg.isNoteOff())
            {
                // Release fallback synth voices triggered when no sampler slots were active
                pantheonSynth.noteOff(msg.getNoteNumber(), 0);
                // Queue noteOff for the web UI (velocity16=0 = noteOff convention)
                int wp = midiEventWritePos.load(std::memory_order_relaxed);
                int nextWp = (wp + 1) % kMaxMidiEvents;
                if (nextWp != midiEventReadPos.load(std::memory_order_acquire))
                {
                    auto& evt = midiEventBuffer[wp];
                    evt.noteNumber = msg.getNoteNumber();
                    evt.channel = msg.getChannel() - 1;
                    evt.velocity16 = 0; // 0 = note-off
                    evt.pitchBend = 0.0f;
                    evt.pressure = 0.0f;
                    evt.timestampSamples = metadata.samplePosition;
                    midiEventWritePos.store(nextWp, std::memory_order_release);
                }
            }
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
    }

    // ═══════════════════════════════════════════════════════════
    // Transport Synchronization
    // ═══════════════════════════════════════════════════════════
    auto* playHead = getPlayHead();
    if (playHead != nullptr)
    {
        auto position = playHead->getPosition();
        
        // Always try to get BPM from the host first — this ensures the plugin
        // stays in sync with the DAW regardless of whether the transport is playing.
        {
            auto tempo = position->getBpm();
            if (tempo.hasValue() && *tempo > 0.0)
                transport.bpm.store(*tempo, std::memory_order_relaxed);
            else
                transport.bpm.store(static_cast<double>(apvts.getRawParameterValue("globalBpm")->load()), std::memory_order_relaxed);
        }

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
                    // Use the already-resolved transport.bpm (which prefers host tempo above)
                    double resolvedBpm = transport.bpm.load(std::memory_order_relaxed);
                    float bpm = static_cast<float>(resolvedBpm > 0.0 ? resolvedBpm : static_cast<double>(apvts.getRawParameterValue("globalBpm")->load()));
                    int samplesPer16th = static_cast<int>((60.0 / bpm / 4.0) * getSampleRate());
                    
                    // Increment cycle counter every 16 steps (wrap at 65536 to prevent overflow)
                    if (static_cast<int>(currentSixteenth) % 16 == 0)
                        sequencerCycleCount = (sequencerCycleCount + 1) % 65536;

                    // Trigger enabled steps
                    {
                        const juce::ScopedLock sl(stepLock);
                        bool snapToZeroVal = true;
                        if (auto* param = apvts.getRawParameterValue("snapToZero"))
                            snapToZeroVal = param->load() >= 0.5f;

                        bool snapToTransientVal = true;
                        if (auto* param = apvts.getRawParameterValue("snapToTransient"))
                            snapToTransientVal = param->load() >= 0.5f;

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

                                std::vector<float> transients;
                                {
                                    const juce::ScopedLock sl(analysisLock);
                                    if (t >= 0 && t < 16)
                                        transients = trackAnalysis[t].transients;
                                }

                                sampler.trigger(t, step.velocity / 127.0f, step.pitch, step.pan, step.decay, start, end, step.reverse, snapToZeroVal, snapToTransientVal, transients, step.retrigRate, samplesPer16th, microOffsetSamples);
                            }
                        }
                    }
                    
                    lastSixteenthNote = currentSixteenth;
                }
            }
            // transport.bpm already set at the top of this playHead block
        }
        else
        {
            transport.isPlaying.store(false, std::memory_order_relaxed);
            lastSixteenthNote = -1.0;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // Sampler Glide Parameter Updates
    // ═══════════════════════════════════════════════════════════
    for (int t = 0; t < 8; ++t)
    {
        juce::String idSuffix = juce::String(t);
        bool glideEnabled = *apvts.getRawParameterValue("slotGlideEnabled_" + idSuffix) >= 0.5f;
        float glideTimeMs = *apvts.getRawParameterValue("slotGlideTimeMs_" + idSuffix);
        int glideCurveType = static_cast<int>(*apvts.getRawParameterValue("slotGlideCurveType_" + idSuffix));
        bool legatoRetrig = *apvts.getRawParameterValue("slotLegatoRetrig_" + idSuffix) >= 0.5f;

        sampler.setGlideParameters(t, glideEnabled, glideTimeMs, glideCurveType, legatoRetrig);
    }

    // ═══════════════════════════════════════════════════════════
    // Sampler Processing (Multi-Output Routing)
    // Only render the JUCE sampler for Chopper (tab 2, track 0).
    // ═══════════════════════════════════════════════════════════
    // JUCE sampler rendering:
    //   Tab 2 (Chopper)     — sample slices triggered by MIDI notes (C4=slice 0)
    //   Tab 0 (Multi-Realm) — sample slots triggered by MIDI; enables DAW MIDI playback.
    //                         Web audio handles OSC slots; JUCE handles sample slots.
    // ═══════════════════════════════════════════════════════════
    // Suppress the C++ sampler while the web engine is live (editor open and
    // streaming): on tabs 0 & 2 the web instruments produce the sound, so
    // rendering the sampler too would double the note ~50ms apart = phasing.
    // When the web goes quiet (UI closed, DAW bounce/playback), the sampler
    // takes over so notes still sound.
    // 3-second window: wider than the worklet idle-gate tail (~1 s) so a normal
    // rest between notes never lets the C++ sampler re-enter. The sampler only
    // takes over after 3 s of complete silence (editor closed / offline bounce).
    const bool webLive = (juce::Time::getMillisecondCounter()
                          - webAudioLastMs.load (std::memory_order_relaxed)) < 3000;

    // Tabs: 0=Multi-Realm, 2=Sample Chopper, 7=Preset Vault, 9=Pedal Realm
    // Render native sampler on any instrument tab.
    if (activeTab == 0 || activeTab == 2 || activeTab == 7)
    {
        for (int t = 0; t < 8; ++t)
        {
            int route = static_cast<int>(*apvts.getRawParameterValue("slotOutputRoute_" + juce::String(t)));
            bool routedToAux = false;
            if (route > 0 && route < getBusCount(false))
            {
                auto& auxBus = *getBus(false, route);
                if (auxBus.isEnabled())
                {
                    auto auxBuffer = getBusBuffer(buffer, false, route);
                    sampler.processTrack(t, auxBuffer);
                    routedToAux = true;
                }
            }
            if (!routedToAux)
            {
                sampler.processTrack(t, buffer);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    // Electric Pantheon Synth Parameters & Processing (Multi-Output Routing)
    // ═══════════════════════════════════════════════════════════
    float vortexX = *apvts.getRawParameterValue("pantheonVortexX");
    float vortexY = *apvts.getRawParameterValue("pantheonVortexY");
    float driftAmt = *apvts.getRawParameterValue("pantheonDriftAmount");
    
    updateVortexWeights(vortexX, vortexY);
    
    // Update Poseidon Drift LFO
    poseidonLfoPhase += 0.00002f;
    if (poseidonLfoPhase >= 1.0f) poseidonLfoPhase -= 1.0f;
    float poseidonLfo = std::sin(poseidonLfoPhase * juce::MathConstants<float>::twoPi + 0.3f * std::sin(poseidonLfoPhase * 4.0f * juce::MathConstants<float>::pi));
    
    // Apply Poseidon drift to sampler
    float poseidonWeight = vortexWeights[4]; // Poseidon is index 4
    sampler.setPoseidonDrift(poseidonLfo * driftAmt * poseidonWeight * 0.1f,
                             poseidonLfo * driftAmt * poseidonWeight * 20.0f);
    
    // Apply Vortex morph to Synth
    pantheonSynth.setVortexWeights(vortexWeights, driftAmt, poseidonLfo);
    
    float subGain = *apvts.getRawParameterValue("pantheonSubGain");
    pantheonSynth.setSubGain(subGain);
    
    // Sync Mod Envelope (Env 2) parameters
    float modEnvAttack = *apvts.getRawParameterValue("modEnvAttack");
    float modEnvDecay = *apvts.getRawParameterValue("modEnvDecay");
    float modEnvSustain = *apvts.getRawParameterValue("modEnvSustain");
    float modEnvRelease = *apvts.getRawParameterValue("modEnvRelease");
    pantheonSynth.setModEnvelopeParameters(modEnvAttack, modEnvDecay, modEnvSustain, modEnvRelease);
    
    float energy = *apvts.getRawParameterValue("pantheonMacro_energy");
    float modulatedEnergy = energy + modEnergy * 50.0f; // Scale modulation to fit 0-100 range
    modulatedEnergy = juce::jlimit(0.0f, 100.0f, modulatedEnergy);
    
    float divinity = *apvts.getRawParameterValue("pantheonMacro_divinity");
    float width = *apvts.getRawParameterValue("pantheonMacro_width");
    float realm = *apvts.getRawParameterValue("pantheonMacro_realm");
    float aura = *apvts.getRawParameterValue("pantheonMacro_aura");
    float age = *apvts.getRawParameterValue("pantheonMacro_age");

    pantheonSynth.setMacros(modulatedEnergy, divinity, width, realm, aura, age);
    
    // Electric Pantheon synth rendering:
    //   Tab 8 (Electric Pantheon): always render — this is its primary tab.
    //   All other non-sampler tabs (!= 0, 2) when !webLive: render as a DAW-MIDI
    //   fallback. noteOn is already routed to pantheonSynth on these tabs when no
    //   sampler slots are active (see the fallback at the MIDI loop above). Without
    //   this render condition those notes trigger voices that never get processed,
    //   producing complete silence. We exclude tabs 0 and 2 because the JUCE sampler
    //   handles those; when webLive the JS bridge handles all tabs and the double-path
    //   phasing risk goes away naturally.
    // Electric Pantheon is now a WEB instrument routed through the capture bridge
    // (see ElectricPantheon.tsx → audioEngine.masterBus), exactly like every other
    // tab. The native pantheonSynth is therefore only a safety net for tab 8 when
    // the web bridge is momentarily quiet (editor closed / offline bounce). It must
    // NOT render as a universal fallback on every tab — doing that played one native
    // "default sound" on all tabs and masked the real per-tab web audio.
    if (activeTab == 8)
    {
        int synthRoute = static_cast<int>(*apvts.getRawParameterValue("synthOutputRoute"));
        bool synthRoutedToAux = false;
        if (synthRoute > 0 && synthRoute < getBusCount(false))
        {
            auto& auxBus = *getBus(false, synthRoute);
            if (auxBus.isEnabled())
            {
                auto auxBuffer = getBusBuffer(buffer, false, synthRoute);
                pantheonSynth.process(auxBuffer);
                synthRoutedToAux = true;
            }
        }
        if (!synthRoutedToAux)
        {
            pantheonSynth.process(buffer);
        }
    }

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
    
    float masterDrive = *apvts.getRawParameterValue("masterDrive");
    float masterHeatBias = *apvts.getRawParameterValue("masterHeatBias");
    float masterHeatWarmth = *apvts.getRawParameterValue("masterHeatWarmth");
    // Apply Modulation Matrix slot contribution for Saturation Warmth (modWarmth)
    float modulatedWarmth = masterHeatWarmth + modWarmth * 50.0f; // Scale modulation to fit 0-100 range
    modulatedWarmth = juce::jlimit(0.0f, 100.0f, modulatedWarmth);
    
    float masterHeatCrunch = *apvts.getRawParameterValue("masterHeatCrunch");
    velvetChain.setHeatParameters(masterDrive, masterHeatBias, modulatedWarmth, masterHeatCrunch);
    
    float colorTilt = *apvts.getRawParameterValue("masterColorTilt"); 
    
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
    // Skip the mastering chain when the buffer is silent — the 4x polyphase
    // IIR oversampler in DivineHeatSaturator can produce ring artifacts on
    // init even for zero input, which the DAW then outputs as a tone.
    // ═══════════════════════════════════════════════════════════
    pedalFxChain.process (buffer);
    {
        bool hasSignal = false;
        const int numSamplesM = buffer.getNumSamples();
        for (int ch = 0; ch < buffer.getNumChannels() && !hasSignal; ++ch)
        {
            const float* data = buffer.getReadPointer (ch);
            for (int i = 0; i < numSamplesM && !hasSignal; ++i)
                if (data[i] * data[i] > 1e-12f) hasSignal = true;
        }
        if (hasSignal)
        {
            juce::dsp::AudioBlock<float> block (buffer);
            juce::dsp::ProcessContextReplacing<float> context (block);
            velvetChain.process (context);
        }
    }

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
    // Reset bridge state so stale FIFO data from a previous editor session
    // can't prime the output before the new WebView sends clean audio.
    // The worklet also discards its first ~1.5 s (warmup window), so both
    // sides agree that nothing should play until the graph has settled.
    webAudioActive.store (false, std::memory_order_relaxed);
    webAudioPrimed = false;
    webAudioStarveBlocks = 0;
    webAudioFadeGain = 0.0f;
    {
        int s1, n1, s2, n2;
        const int toClear = webAudioFifo.getNumReady();
        if (toClear > 0)
        {
            webAudioFifo.prepareToRead (toClear, s1, n1, s2, n2);
            webAudioFifo.finishedRead (n1 + n2);
        }
    }
    // Prime webAudioLastMs so the webLive gate suppresses the C++ sampler
    // during the JS worklet warmup (~430 ms, 10 chunks @ 48 kHz).
    // Subtract 2400 from now so the 3000 ms gate expires after ~600 ms,
    // just after the first web audio chunks arrive and take over.
    webAudioLastMs.store (juce::Time::getMillisecondCounter() - 2400, std::memory_order_relaxed);
    return new VSTGodTheGodRealmAudioProcessorEditor (*this);
}

void VSTGodTheGodRealmAudioProcessor::getStateInformation (juce::MemoryBlock& destData)
{
    auto state = apvts.copyState();
    std::unique_ptr<juce::XmlElement> xml (state.createXml());
    
    // Add sequencer data
    auto* tracksXml = serializeTracks().release();
    xml->addChildElement(tracksXml);

    // Add the full web-UI parameter snapshot (params not backed by APVTS).
    if (webUiStateJson.isNotEmpty())
    {
        auto* webXml = new juce::XmlElement("WEBUI_STATE");
        webXml->addTextElement(webUiStateJson);
        xml->addChildElement(webXml);
    }

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

        // Stash the web-UI snapshot; the editor pushes it back to the web UI
        // once it loads and requests parameters (see GET_PARAMETERS handler).
        if (auto* webXml = xmlState->getChildByName("WEBUI_STATE"))
            pendingRestoreJson = webXml->getAllSubText();
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

void VSTGodTheGodRealmAudioProcessor::loadSampleFromBytes(int trackIdx, const juce::MemoryBlock& data)
{
    if (trackIdx < 0 || trackIdx >= 8 || data.getSize() == 0) return;

    // createReaderFor takes ownership of the stream; it sniffs the format
    // (wav/ogg/flac/aiff) from the bytes, so no extension is needed.
    auto stream = std::make_unique<juce::MemoryInputStream>(data.getData(), data.getSize(), false);
    std::unique_ptr<juce::AudioFormatReader> reader(formatManager.createReaderFor(std::move(stream)));
    if (reader == nullptr) return;

    auto buffer = std::make_shared<juce::AudioBuffer<float>>(
        static_cast<int>(reader->numChannels),
        static_cast<int>(reader->lengthInSamples));
    reader->read(buffer.get(), 0, static_cast<int>(reader->lengthInSamples), 0, true, true);

    sampler.setSample(trackIdx, buffer, reader->sampleRate);
    tracks[trackIdx].samplePath = "mem://" + juce::String(trackIdx);
    analyzeSample(trackIdx, *buffer, reader->sampleRate);
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
    
    bool snapToZeroVal = true;
    if (auto* param = apvts.getRawParameterValue("snapToZero"))
        snapToZeroVal = param->load() >= 0.5f;

    bool snapToTransientVal = true;
    if (auto* param = apvts.getRawParameterValue("snapToTransient"))
        snapToTransientVal = param->load() >= 0.5f;

    std::vector<float> transients;
    {
        const juce::ScopedLock slAnalysis(analysisLock);
        if (trackIdx >= 0 && trackIdx < 16)
            transients = trackAnalysis[trackIdx].transients;
    }
    
    sampler.trigger(trackIdx, velocity, pitch, pan, decay, start, end, reverse, snapToZeroVal, snapToTransientVal, transients);
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

std::vector<MidiCCEvent> VSTGodTheGodRealmAudioProcessor::drainCCEvents()
{
    std::vector<MidiCCEvent> events;
    
    int rp = ccEventReadPos.load(std::memory_order_acquire);
    int wp = ccEventWritePos.load(std::memory_order_acquire);
    
    while (rp != wp)
    {
        events.push_back(ccEventBuffer[rp]);
        rp = (rp + 1) % kMaxCCEvents;
    }
    
    ccEventReadPos.store(rp, std::memory_order_release);
    return events;
}

void VSTGodTheGodRealmAudioProcessor::pushWebAudio (const float* left, const float* right, int numSamples, double sourceSampleRate)
{
    if (numSamples <= 0) return;

    const double dawRate = spec.sampleRate > 0.0 ? spec.sampleRate : 48000.0;
    const double srcRate = sourceSampleRate > 0.0 ? sourceSampleRate : dawRate;

    // Base ratio: input samples consumed per output sample, converting the
    // web-audio context rate to the DAW rate.
    const double nominalRatio = srcRate / dawRate;

    // ─── Adaptive drift correction ───────────────────────────────────────────
    // The web-audio clock and the DAW clock are independent and drift apart over
    // time. Instead of hard-dropping samples on overflow (which splices the
    // waveform and clicks), we gently nudge the resample ratio so the FIFO stays
    // near a target fill. The pitch variation is capped at ±0.4%, well below the
    // threshold of audibility, and it eliminates both overflow and underflow.
    const int    target = juce::jmax (2048, (int) (dawRate * 0.05)); // ~50ms — matches consumer prime target
    const int    ready  = webAudioFifo.getNumReady();
    const double err    = (double) (ready - target) / (double) juce::jmax (1, target);
    const double correction = 1.0 + juce::jlimit (-0.004, 0.004, err * 0.02);
    const double speedRatio = nominalRatio * correction;

    const int numOut = (int) std::floor (numSamples / speedRatio);
    if (numOut <= 0) return;

    juce::HeapBlock<float> outL ((size_t) numOut), outR ((size_t) numOut);
    webResamplerL.process (speedRatio, left,  outL.get(), numOut);
    webResamplerR.process (speedRatio, right, outR.get(), numOut);

    const int space = webAudioFifo.getFreeSpace();
    const int toWrite = juce::jmin (numOut, space);
    if (toWrite <= 0) return;

    int s1, n1, s2, n2;
    webAudioFifo.prepareToWrite (toWrite, s1, n1, s2, n2);

    if (n1 > 0) { memcpy (webAudioBufL + s1, outL.get(),       n1 * sizeof (float)); memcpy (webAudioBufR + s1, outR.get(),       n1 * sizeof (float)); }
    if (n2 > 0) { memcpy (webAudioBufL + s2, outL.get() + n1,  n2 * sizeof (float)); memcpy (webAudioBufR + s2, outR.get() + n1,  n2 * sizeof (float)); }

    webAudioFifo.finishedWrite (n1 + n2);
    webAudioActive.store (true, std::memory_order_relaxed);
    webAudioLastMs.store (juce::Time::getMillisecondCounter(), std::memory_order_relaxed);
}

void VSTGodTheGodRealmAudioProcessor::triggerUiNoteOn (int note, int velocity)
{
    // Called from the UI/message thread — queues a note for the audio thread via MidiMessageCollector
    uiMidiCollector.addMessageToQueue (
        juce::MidiMessage::noteOn (1, note, static_cast<juce::uint8> (juce::jlimit (1, 127, velocity))));
}

void VSTGodTheGodRealmAudioProcessor::triggerUiNoteOff (int note)
{
    uiMidiCollector.addMessageToQueue (
        juce::MidiMessage::noteOff (1, note, static_cast<juce::uint8> (0)));
}

void VSTGodTheGodRealmAudioProcessor::updateParameterValue (const juce::String& paramID, float newValue)
{
    if (auto* param = apvts.getParameter(paramID))
    {
        float normVal = param->getNormalisableRange().convertTo0to1(newValue);
        param->setValueNotifyingHost(normVal);
    }
}

void VSTGodTheGodRealmAudioProcessor::handleArturiaKeyLabCC(int ccNum, int ccVal)
{
    int activeTab = static_cast<int>(*apvts.getRawParameterValue("activeTab"));
    
    // Global Master Volume fader (Fader 9 on Arturia KeyLab defaults to CC 85 or CC 7)
    if (ccNum == 85 || ccNum == 7)
    {
        // masterVolume range: -60.0f to 6.0f
        float vol = -60.0f + (static_cast<float>(ccVal) / 127.0f) * 66.0f;
        updateParameterValue("masterVolume", vol);
        return;
    }

    if (activeTab == 8) // Electric Pantheon tab
    {
        switch (ccNum)
        {
            // Knobs
            case 74: updateParameterValue("pantheonMacro_energy", (static_cast<float>(ccVal) / 127.0f) * 100.0f); break;
            case 71: updateParameterValue("pantheonMacro_divinity", (static_cast<float>(ccVal) / 127.0f) * 100.0f); break;
            case 76: updateParameterValue("pantheonMacro_width", (static_cast<float>(ccVal) / 127.0f) * 100.0f); break;
            case 77: updateParameterValue("pantheonMacro_realm", (static_cast<float>(ccVal) / 127.0f) * 100.0f); break;
            case 93: updateParameterValue("pantheonMacro_aura", (static_cast<float>(ccVal) / 127.0f) * 100.0f); break;
            case 18: updateParameterValue("pantheonMacro_age", (static_cast<float>(ccVal) / 127.0f) * 100.0f); break;
            case 19: updateParameterValue("pantheonDriftAmount", static_cast<float>(ccVal) / 127.0f); break;
            case 16: updateParameterValue("pantheonVortexX", static_cast<float>(ccVal) / 127.0f); break;
            case 17: updateParameterValue("pantheonVortexY", static_cast<float>(ccVal) / 127.0f); break;
            
            // Faders
            case 73: updateParameterValue("modEnvAttack", (static_cast<float>(ccVal) / 127.0f) * 100.0f); break;
            case 75: updateParameterValue("modEnvDecay", (static_cast<float>(ccVal) / 127.0f) * 100.0f); break;
            case 79: updateParameterValue("modEnvSustain", (static_cast<float>(ccVal) / 127.0f) * 100.0f); break;
            case 72: updateParameterValue("modEnvRelease", (static_cast<float>(ccVal) / 127.0f) * 100.0f); break;
            case 80: updateParameterValue("pantheonSubGain", (static_cast<float>(ccVal) / 127.0f) * 100.0f); break;
            default: break;
        }
    }
    else if (activeTab == 5) // Mastering / Celestial Forge
    {
        switch (ccNum)
        {
            // Knobs
            case 74: updateParameterValue("masterInputGain", -12.0f + (static_cast<float>(ccVal) / 127.0f) * 24.0f); break;
            case 71: updateParameterValue("masterDrive", (static_cast<float>(ccVal) / 127.0f) * 100.0f); break;
            case 76: updateParameterValue("masterColorTilt", (static_cast<float>(ccVal) / 127.0f) * 100.0f); break;
            case 77: updateParameterValue("masterColdExtension", (static_cast<float>(ccVal) / 127.0f) * 100.0f); break;
            case 93: updateParameterValue("masterHeatBias", -1.0f + (static_cast<float>(ccVal) / 127.0f) * 2.0f); break;
            case 18: updateParameterValue("masterHeatWarmth", (static_cast<float>(ccVal) / 127.0f) * 100.0f); break;
            case 19: updateParameterValue("masterHeatCrunch", (static_cast<float>(ccVal) / 127.0f) * 100.0f); break;
            case 16: updateParameterValue("masterWidth", (static_cast<float>(ccVal) / 127.0f) * 200.0f); break;
            case 17: updateParameterValue("masterImager", -1.0f + (static_cast<float>(ccVal) / 127.0f) * 2.0f); break;
            
            // Faders
            case 73: updateParameterValue("masterDynamicsThreshold", -60.0f + (static_cast<float>(ccVal) / 127.0f) * 60.0f); break;
            case 75: updateParameterValue("masterDynamicsRatio", 1.0f + (static_cast<float>(ccVal) / 127.0f) * 9.0f); break;
            case 79: updateParameterValue("masterAttack", 1.0f + (static_cast<float>(ccVal) / 127.0f) * 99.0f); break;
            case 72: updateParameterValue("masterRelease", 10.0f + (static_cast<float>(ccVal) / 127.0f) * 990.0f); break;
            case 80: updateParameterValue("masterCeiling", -12.0f + (static_cast<float>(ccVal) / 127.0f) * 24.0f); break;
            default: break;
        }
    }
    else // Sampler, Sequencer, Preset Vault, Multi-Realm, etc.
    {
        switch (ccNum)
        {
            // Knobs 1-6 (Pan)
            case 74: updateParameterValue("slotPan_0", (static_cast<float>(ccVal) / 127.0f) * 100.0f); break;
            case 71: updateParameterValue("slotPan_1", (static_cast<float>(ccVal) / 127.0f) * 100.0f); break;
            case 76: updateParameterValue("slotPan_2", (static_cast<float>(ccVal) / 127.0f) * 100.0f); break;
            case 77: updateParameterValue("slotPan_3", (static_cast<float>(ccVal) / 127.0f) * 100.0f); break;
            case 93: updateParameterValue("slotPan_4", (static_cast<float>(ccVal) / 127.0f) * 100.0f); break;
            case 18: updateParameterValue("slotPan_5", (static_cast<float>(ccVal) / 127.0f) * 100.0f); break;
            
            // Knobs 7-9 (Global Macros)
            case 19: updateParameterValue("macro_energy", (static_cast<float>(ccVal) / 127.0f) * 100.0f); break;
            case 16: updateParameterValue("macro_divinity", (static_cast<float>(ccVal) / 127.0f) * 100.0f); break;
            case 17: updateParameterValue("macro_width", (static_cast<float>(ccVal) / 127.0f) * 100.0f); break;
            
            // Faders 1-6 (Volumes)
            case 73: updateParameterValue("slotVol_0", (static_cast<float>(ccVal) / 127.0f) * 100.0f); break;
            case 75: updateParameterValue("slotVol_1", (static_cast<float>(ccVal) / 127.0f) * 100.0f); break;
            case 79: updateParameterValue("slotVol_2", (static_cast<float>(ccVal) / 127.0f) * 100.0f); break;
            case 72: updateParameterValue("slotVol_3", (static_cast<float>(ccVal) / 127.0f) * 100.0f); break;
            case 80: updateParameterValue("slotVol_4", (static_cast<float>(ccVal) / 127.0f) * 100.0f); break;
            case 81: updateParameterValue("slotVol_5", (static_cast<float>(ccVal) / 127.0f) * 100.0f); break;
            
            // Faders 7-8 (General/Global)
            case 82: updateParameterValue("morphFactor", static_cast<float>(ccVal) / 127.0f); break;
            case 83: updateParameterValue("macro_realm", (static_cast<float>(ccVal) / 127.0f) * 100.0f); break;
            default: break;
        }
    }
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
                bool hasNonDefaults = step.enabled || step.velocity != 1.0f || step.pitch != 0.0f
                    || step.pan != 0.0f || step.decay != 0.5f || step.probability != 100.0f
                    || step.microTiming != 0 || step.trigCondition != "always"
                    || step.sliceIndex != 0 || step.retrigRate != 0 || step.reverse
                    || step.start != 0.0f || step.end != 1.0f;
                if (hasNonDefaults) 
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

        // Serialize slice boundaries
        if (!tracks[t].slices.empty())
        {
            auto* slicesXml = trackXml->createNewChildElement("SLICES");
            for (size_t s = 0; s < tracks[t].slices.size(); ++s)
            {
                auto* sliceXml = slicesXml->createNewChildElement("SLICE");
                sliceXml->setAttribute("start", (double)tracks[t].slices[s].start);
                sliceXml->setAttribute("end",   (double)tracks[t].slices[s].end);
            }
        }
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

            // Deserialize slice boundaries
            tracks[t].slices.clear();
            auto* slicesXml = trackXml->getChildByName("SLICES");
            if (slicesXml != nullptr)
            {
                auto* sliceXml = slicesXml->getChildByName("SLICE");
                while (sliceXml != nullptr)
                {
                    Slice slice;
                    slice.start = (float)sliceXml->getDoubleAttribute("start", 0.0);
                    slice.end   = (float)sliceXml->getDoubleAttribute("end", 1.0);
                    tracks[t].slices.push_back(slice);
                    sliceXml = sliceXml->getNextElementWithTagName("SLICE");
                }
            }
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
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("masterHeatBias", 1), "Heat Bias", -1.0f, 1.0f, 0.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("masterHeatWarmth", 1), "Heat Warmth", 0.0f, 100.0f, 30.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("masterHeatCrunch", 1), "Heat Crunch", 0.0f, 100.0f, 10.0f));

    // --- Navigation & State ---
    layout.add(std::make_unique<juce::AudioParameterInt>(juce::ParameterID("activeTab", 1), "Active Tab", 0, 9, 7)); // 7=Preset Vault, 9=Pedal Realm
    layout.add(std::make_unique<juce::AudioParameterInt>(juce::ParameterID("selectedPreset", 1), "Selected Preset", 0, 511, 0));
    layout.add(std::make_unique<juce::AudioParameterInt>(juce::ParameterID("activePattern", 1), "Active Pattern", 0, 1, 0));
    layout.add(std::make_unique<juce::AudioParameterBool>(juce::ParameterID("isFillMode", 1), "Fill Mode", false));
    layout.add(std::make_unique<juce::AudioParameterBool>(juce::ParameterID("snapToZero", 1), "Snap to Zero Crossing", true));
    layout.add(std::make_unique<juce::AudioParameterBool>(juce::ParameterID("snapToTransient", 1), "Snap to Transient", true));

    // --- Electric Pantheon Synth ---
    layout.add(std::make_unique<juce::AudioParameterInt>(juce::ParameterID("pantheonGod", 1), "Pantheon God", 0, 7, 0));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("pantheonVortexX", 1), "Pantheon Vortex X", 0.0f, 1.0f, 0.5f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("pantheonVortexY", 1), "Pantheon Vortex Y", 0.0f, 1.0f, 0.5f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("pantheonDriftAmount", 1), "Pantheon Drift Amount", 0.0f, 1.0f, 0.1f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("pantheonMacro_energy", 1), "Pantheon Energy", 0.0f, 100.0f, 50.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("pantheonMacro_divinity", 1), "Pantheon Divinity", 0.0f, 100.0f, 50.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("pantheonMacro_width", 1), "Pantheon Width", 0.0f, 100.0f, 50.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("pantheonMacro_realm", 1), "Pantheon Realm", 0.0f, 100.0f, 50.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("pantheonMacro_aura", 1), "Pantheon Aura", 0.0f, 100.0f, 50.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("pantheonMacro_age", 1), "Pantheon Age", 0.0f, 100.0f, 50.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("pantheonSubGain", 1), "Chthonic Sub Gain", 0.0f, 100.0f, 40.0f));

    // --- Sample Chopper / Sequencer (Stubs for now) ---
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("morphFactor", 1), "Morph Factor", 0.0f, 1.0f, 0.0f));

    // --- 6-Slot Sample Engine Section ---
    layout.add(std::make_unique<juce::AudioParameterInt>(juce::ParameterID("slotPlayMode", 1), "Slot Play Mode", 0, 2, 1));
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

    // --- Glide Parameters ---
    for (int i = 0; i < 8; ++i)
    {
        juce::String idSuffix = juce::String(i);
        layout.add(std::make_unique<juce::AudioParameterBool>(juce::ParameterID("slotGlideEnabled_" + idSuffix, 1), "Slot " + idSuffix + " Glide Enabled", false));
        layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("slotGlideTimeMs_" + idSuffix, 1), "Slot " + idSuffix + " Glide Time", 0.0f, 1000.0f, 100.0f));
        layout.add(std::make_unique<juce::AudioParameterInt>(juce::ParameterID("slotGlideCurveType_" + idSuffix, 1), "Slot " + idSuffix + " Glide Curve", 0, 3, 1));
        layout.add(std::make_unique<juce::AudioParameterBool>(juce::ParameterID("slotLegatoRetrig_" + idSuffix, 1), "Slot " + idSuffix + " Legato Retrigger", false));
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
    // --- Phase 6: Modulation Matrix, LFOs, Multi-Output Routing & MPE ---
    for (int i = 0; i < 4; ++i)
    {
        juce::String idSuffix = juce::String(i);
        layout.add(std::make_unique<juce::AudioParameterInt>(juce::ParameterID("modSource_" + idSuffix, 1), "Mod Source " + idSuffix, 0, 5, 0));
        layout.add(std::make_unique<juce::AudioParameterInt>(juce::ParameterID("modTarget_" + idSuffix, 1), "Mod Target " + idSuffix, 0, 4, 0));
        layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("modAmount_" + idSuffix, 1), "Mod Amount " + idSuffix, -1.0f, 1.0f, 0.0f));
    }

    // Secondary Envelope (Env 2) Parameters
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("modEnvAttack", 1), "Mod Envelope Attack", 0.0f, 100.0f, 20.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("modEnvDecay", 1), "Mod Envelope Decay", 0.0f, 100.0f, 50.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("modEnvSustain", 1), "Mod Envelope Sustain", 0.0f, 100.0f, 70.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("modEnvRelease", 1), "Mod Envelope Release", 0.0f, 100.0f, 35.0f));

    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("lfo1Rate", 1), "LFO 1 Rate", 0.1f, 50.0f, 1.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID("lfo2Rate", 1), "LFO 2 Rate", 0.1f, 50.0f, 1.0f));
    layout.add(std::make_unique<juce::AudioParameterInt>(juce::ParameterID("lfo1Shape", 1), "LFO 1 Shape", 0, 4, 0));
    layout.add(std::make_unique<juce::AudioParameterInt>(juce::ParameterID("lfo2Shape", 1), "LFO 2 Shape", 0, 4, 0));

    for (int i = 0; i < 8; ++i)
    {
        juce::String idSuffix = juce::String(i);
        layout.add(std::make_unique<juce::AudioParameterInt>(juce::ParameterID("slotOutputRoute_" + idSuffix, 1), "Slot " + idSuffix + " Output Route", 0, 8, 0));
    }
    layout.add(std::make_unique<juce::AudioParameterInt>(juce::ParameterID("synthOutputRoute", 1), "Synth Output Route", 0, 8, 0));
    layout.add(std::make_unique<juce::AudioParameterBool>(juce::ParameterID("mpeEnabled", 1), "MPE Enabled", false));

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
    const juce::ScopedLock sl (settingsLock);
    auto file = getConfigFile();
    if (file.existsAsFile())
    {
        return file.loadFileAsString();
    }
    return {};
}

void VSTGodTheGodRealmAudioProcessor::saveSettingsToDisk (const juce::String& settingsJson)
{
    const juce::ScopedLock sl (settingsLock);
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
    if (json.hasProperty("licenseKey"))
    {
        activeLicenseKey = json.getProperty("licenseKey", "").toString();
    }
}

void VSTGodTheGodRealmAudioProcessor::startLicenseValidation (const juce::String& key, bool isFirstActivation)
{
    if (validatorThread == nullptr)
    {
        validatorThread = std::make_unique<LicenseValidatorThread> (*this);
    }
    validatorThread->startValidation (key, isFirstActivation);
}

void VSTGodTheGodRealmAudioProcessor::handleValidationResult (bool success, const juce::String& message, const juce::String& key, bool isFirstActivation)
{
    licenseActivated.store (success, std::memory_order_relaxed);
    if (success)
    {
        activeLicenseKey = key;
    }
    else
    {
        activeLicenseKey = "";
    }

    // Save updated settings to disk
    {
        const juce::ScopedLock sl (settingsLock);
        auto settings = loadSettingsFromDisk();
        if (settings.isEmpty()) settings = "{}";
        auto parsed = juce::JSON::parse (settings);
        if (parsed.isUndefined() || parsed.isVoid() || !parsed.isObject())
        {
            parsed = juce::var (new juce::DynamicObject());
        }

        if (auto* obj = parsed.getDynamicObject())
        {
            obj->setProperty ("licenseActivated", success);
            obj->setProperty ("licenseKey", success ? key : "");
        }
        
        auto file = getConfigFile();
        file.replaceWithText (juce::JSON::toString (parsed));
    }

    // Notify WebView
    juce::MessageManager::callAsync ([this, success, message, key]() {
        auto* activeEditor = getActiveEditor();
        if (activeEditor != nullptr)
        {
            if (auto* editorCast = dynamic_cast<VSTGodTheGodRealmAudioProcessorEditor*> (activeEditor))
            {
                editorCast->pushSettingsToWebView();
                
                // Invoke callback
                editorCast->evaluateJavaScript ("if (window.__godRealmLicenseResult) window.__godRealmLicenseResult(" 
                                                + juce::String (success ? "true" : "false") 
                                                + ", \"" + message.replace("\"", "\\\"") + "\");");
            }
        }
    });
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

void VSTGodTheGodRealmAudioProcessor::updateVortexWeights(float x, float y)
{
    x = juce::jlimit(0.0f, 1.0f, x);
    y = juce::jlimit(0.0f, 1.0f, y);

    static const float vertices[8][2] = {
        { 1.0f, 0.5f },        // 0: olympus
        { 0.85355f, 0.85355f },  // 1: hades
        { 0.5f, 1.0f },        // 2: zeus
        { 0.14645f, 0.85355f },  // 3: athena
        { 0.0f, 0.5f },        // 4: poseidon
        { 0.14645f, 0.14645f },  // 5: titan
        { 0.5f, 0.0f },        // 6: apollo
        { 0.85355f, 0.14645f }   // 7: chronos
    };

    float dSq[8];
    float sumWeights = 0.0f;
    constexpr float epsilon = 0.00001f;

    for (int i = 0; i < 8; ++i)
    {
        float dx = x - vertices[i][0];
        float dy = y - vertices[i][1];
        dSq[i] = dx * dx + dy * dy;

        if (dSq[i] < epsilon)
        {
            for (int j = 0; j < 8; ++j)
            {
                vortexWeights[j] = (j == i) ? 1.0f : 0.0f;
            }
            return;
        }
    }

    for (int i = 0; i < 8; ++i)
    {
        vortexWeights[i] = 1.0f / dSq[i];
        sumWeights += vortexWeights[i];
    }

    if (sumWeights > 0.0f)
    {
        float invSum = 1.0f / sumWeights;
        for (int i = 0; i < 8; ++i)
        {
            vortexWeights[i] *= invSum;
        }
    }
    else
    {
        for (int i = 0; i < 8; ++i)
        {
            vortexWeights[i] = (i == 0) ? 1.0f : 0.0f;
        }
    }
}

void VSTGodTheGodRealmAudioProcessor::setPedalMasterActive(bool active)
{
    pedalFxChain.setActive(active);
}

void VSTGodTheGodRealmAudioProcessor::setPedalEnabled(int pedalIdx, bool enabled)
{
    pedalFxChain.setPedalEnabled(pedalIdx, enabled);
}

void VSTGodTheGodRealmAudioProcessor::setPedalParam(int pedalIdx, const juce::String& key, float value)
{
    pedalFxChain.setPedalParam(pedalIdx, key, value);
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new VSTGodTheGodRealmAudioProcessor();
}
