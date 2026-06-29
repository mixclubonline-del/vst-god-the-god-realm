#pragma once

#include <JuceHeader.h>
#include "VelvetCurve.h"
#include "SacredSampler.h"
#include "PantheonSynth.h"
#include "PedalFxChain.h"

class LicenseValidatorThread;

struct Step
{
    bool enabled = false;
    float velocity = 1.0f;
    float pitch = 0.0f;
    float pan = 0.0f;
    float decay = 0.5f;
    float start = 0.0f;
    float end = 1.0f;
    bool reverse = false;
    int sliceIndex = 0;
    int retrigRate = 0; // 0: none, 2: 1/2, 4: 1/4, 8: 1/8, 16: 1/16, 32: 1/32
    float probability = 100.0f;
    int microTiming = 0;
    juce::String trigCondition = "always";
};

struct Slice
{
    float start = 0.0f;
    float end = 1.0f;
};

struct Track
{
    std::vector<Step> patternA;
    std::vector<Step> patternB;
    int polymetricLength = 16;
    bool muted = false;
    juce::String samplePath;
    float volume = 1.0f;
    std::vector<Slice> slices;
};

// ═══════════════════════════════════════════════════════════════
// MIDI 2.0 Note Event — designed for high-resolution per-note data
// ═══════════════════════════════════════════════════════════════
struct Midi2NoteEvent
{
    int noteNumber = 60;
    int channel = 0;
    uint32_t velocity16 = 32768;   // MIDI 2.0: 16-bit velocity (0-65535)
    float pitchBend = 0.0f;        // Per-note pitch bend (-1.0 to 1.0)
    float pressure = 0.0f;         // Per-note aftertouch (0.0-1.0)
    int64_t timestampSamples = 0;
};

// ═══════════════════════════════════════════════════════════════
// MIDI CC Event — for forwarding physical controller changes to UI
// ═══════════════════════════════════════════════════════════════
struct MidiCCEvent
{
    int ccNumber = 0;
    int ccValue = 0;
    int channel = 0;
};

// ═══════════════════════════════════════════════════════════════
// Transport State — shared between audio thread & editor
// ═══════════════════════════════════════════════════════════════
struct TransportState
{
    std::atomic<bool> isPlaying { false };
    std::atomic<double> ppqPosition { 0.0 };
    std::atomic<double> bpm { 140.0 };
    std::atomic<int> currentStep { 0 };
};

// ═══════════════════════════════════════════════════════════════
// Divine LFO — dynamic modulation oscillator
// ═══════════════════════════════════════════════════════════════
class DivineLFO
{
public:
    DivineLFO() {}

    void prepare (double sr)
    {
        sampleRate = sr;
        if (phase >= 1.0)
            phase = 0.0;
    }

    void setRate (float rateHz)
    {
        rate = rateHz;
    }

    void setShape (int shapeIndex)
    {
        shape = shapeIndex; // 0: Sine, 1: Triangle, 2: Saw, 3: Square, 4: S&H
    }

    float getNextSample()
    {
        if (sampleRate <= 0.0) return 0.0f;

        float output = 0.0f;
        switch (shape)
        {
            case 0: // Sine
                output = std::sin (phase * 2.0 * juce::MathConstants<double>::pi);
                break;
            case 1: // Triangle
                output = 1.0f - 4.0f * std::abs (static_cast<float> (phase - 0.5));
                break;
            case 2: // Saw
                output = 2.0f * static_cast<float> (phase) - 1.0f;
                break;
            case 3: // Square
                output = phase < 0.5 ? 1.0f : -1.0f;
                break;
            case 4: // S&H (Sample & Hold)
                output = shValue;
                break;
            default:
                output = 0.0f;
                break;
        }

        // Advance phase
        double phaseIncrement = rate / sampleRate;
        phase += phaseIncrement;
        if (phase >= 1.0)
        {
            phase -= 1.0;
            if (shape == 4) // S&H
                shValue = random.nextFloat() * 2.0f - 1.0f;
        }

        return output;
    }

private:
    double sampleRate = 44100.0;
    double phase = 0.0;
    float rate = 1.0f;
    int shape = 0;
    float shValue = 0.0f;
    juce::Random random;
};

class VSTGodTheGodRealmAudioProcessor : public juce::AudioProcessor
{
public:
    VSTGodTheGodRealmAudioProcessor();
    ~VSTGodTheGodRealmAudioProcessor() override;

    void prepareToPlay (double sampleRate, int samplesPerBlock) override;
    void releaseResources() override;

   #ifndef JucePlugin_PreferredChannelConfigurations
    bool isBusesLayoutSupported (const BusesLayout& layouts) const override;
   #endif

    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override;

    const juce::String getName() const override;

    bool acceptsMidi() const override;
    bool producesMidi() const override;
    bool isMidiEffect() const override;
    double getTailLengthSeconds() const override;

    int getNumPrograms() override;
    int getCurrentProgram() override;
    void setCurrentProgram (int index) override;
    const juce::String getProgramName (int index) override;
    void changeProgramName (int index, const juce::String& newName) override;

    void getStateInformation (juce::MemoryBlock& destData) override;
    void setStateInformation (const void* data, int sizeInBytes) override;

    juce::AudioProcessorValueTreeState apvts;

    void loadSampleForTrack(int trackIdx, const juce::String& path);
    // Load a native-sampler track from in-memory audio bytes (wav/ogg/flac/...).
    // Used when the web UI has the audio but not an OS file path (FS Access API).
    void loadSampleFromBytes(int trackIdx, const juce::MemoryBlock& data);
    void updateStep(int trackIdx, const juce::String& patternName, int stepIdx, const juce::var& stepData);
    void updateTrackSlices(int trackIdx, const juce::var& sliceData);
    void triggerStep(int trackIdx, float velocity, float pitch, float pan, float decay, float startNorm, float endNorm, bool reverse, int sliceIndex);
    void updateTransportState(bool isPlaying, double bpm);
    
    // Pedal Realm native control setters
    void setPedalMasterActive(bool active);
    void setPedalEnabled(int pedalIdx, bool enabled);
    void setPedalParam(int pedalIdx, const juce::String& key, float value);

    // Settings I/O
    juce::String loadSettingsFromDisk();
    void saveSettingsToDisk (const juce::String& settingsJson);
    juce::File getConfigFile();
    juce::String sampleLibraryPath;

    juce::CriticalSection stepLock;
    juce::CriticalSection settingsLock;

    // ═══════════════════════════════════════════════════════════════
    // Metering & Transport — thread-safe accessors for the Editor
    // ═══════════════════════════════════════════════════════════════
    
    /** Per-track peak level (0.0 – 1.0+), exponentially decayed. */
    float getTrackPeakLevel (int trackIdx) const;
    
    /** Master bus stereo peaks. */
    float getMasterPeakL() const { return masterPeakL.load (std::memory_order_relaxed); }
    float getMasterPeakR() const { return masterPeakR.load (std::memory_order_relaxed); }
    
    /** Real-time CPU Usage estimation (0.0 to 100.0) */
    double getActiveCpuUsage() const { return cpuUsage.load (std::memory_order_relaxed); }
    
    /** Transport state. */
    const TransportState& getTransportState() const { return transport; }
    
    /** Drain recent MIDI 2.0 note events (clears the queue). */
    std::vector<Midi2NoteEvent> drainMidiEvents();

    /** Drain recent MIDI CC events (clears the queue). */
    std::vector<MidiCCEvent> drainCCEvents();

    /** True when running as a standalone application (not inside a DAW). */
    static bool isStandaloneApp() { return juce::JUCEApplicationBase::isStandaloneApp(); }

    /** Called from the editor message thread to push decoded PCM into the FIFO. */
    void pushWebAudio (const float* left, const float* right, int numSamples, double sourceSampleRate);

    /** Thread-safe: queue a UI-triggered note (piano click) into the audio thread. */
    void triggerUiNoteOn  (int note, int velocity);
    void triggerUiNoteOff (int note);

    /** Get the current DAW sample rate (for web UI sync). */
    double getDawSampleRate() const { return spec.sampleRate; }

    juce::MidiMessageCollector uiMidiCollector;

    // ─── Web UI state persistence (per-project, via get/setStateInformation) ──
    // The web UI has many parameters that are not backed by APVTS. We store the
    // latest full snapshot here so it can be saved into the host project and
    // pushed back to the UI when the project is reopened.
    juce::String webUiStateJson;       // latest snapshot received from the web UI
    juce::String pendingRestoreJson;   // snapshot restored from project, to push to UI

    // ─── Phase 4: FFT & Transient Analysis Accessors ───
    static constexpr int kFftSize = 1024;
    void pushToFftBuffer (const float* samples, int numSamples);
    void getLatestFftSamples (float* dest);

    struct WaveformAnalysis
    {
        int padIndex = 0;
        std::vector<float> transients;     // normalized positions (0.0 to 1.0)
        std::vector<float> rmsEnvelope;    // downsampled envelope values
        bool pendingUpdate = false;
    };

    WaveformAnalysis getTrackAnalysis (int trackIdx);
    void clearTrackAnalysisPending (int trackIdx);

private:
    // ─── Phase 4: FFT Ring Buffer & Transient state ───
    float fftRingBuffer[kFftSize * 2] = { 0.0f };
    std::atomic<int> fftWritePos { 0 };

    WaveformAnalysis trackAnalysis[16]; // support up to 16 pads/thrones
    juce::CriticalSection analysisLock;

    void analyzeSample (int trackIdx, const juce::AudioBuffer<float>& buffer, double sampleRate);
    juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout();
    
    std::unique_ptr<juce::XmlElement> serializeTracks();
    void deserializeTracks(juce::XmlElement* xml);

    VelvetCurve velvetChain;
    PedalFxChain pedalFxChain;
    SacredSamplerEngine sampler;
    PantheonSynthEngine pantheonSynth;
    
    std::vector<Track> tracks;
    
    double lastSixteenthNote = -1.0;
    int sequencerCycleCount = 0;
    
    juce::dsp::ProcessSpec spec;
    
    juce::AudioFormatManager formatManager;

    // ─── Peak Metering ───
    static constexpr int kNumTracks = 8;
    std::atomic<float> trackPeaks[kNumTracks] {};
    std::atomic<float> masterPeakL { 0.0f };
    std::atomic<float> masterPeakR { 0.0f };
    float peakDecayCoeff = 0.9992f;  // ~300ms decay at 44100Hz
    std::atomic<double> cpuUsage { 0.0 };

    // ─── Transport ───
    TransportState transport;

    // ─── MIDI 2.0 Event Queue ───
    static constexpr int kMaxMidiEvents = 64;
    Midi2NoteEvent midiEventBuffer[kMaxMidiEvents];
    std::atomic<int> midiEventWritePos { 0 };
    std::atomic<int> midiEventReadPos { 0 };

    // ─── MIDI CC Event Queue ───
    static constexpr int kMaxCCEvents = 256;
    MidiCCEvent ccEventBuffer[kMaxCCEvents];
    std::atomic<int> ccEventWritePos { 0 };
    std::atomic<int> ccEventReadPos { 0 };

    // ─── Web Audio Bridge Ring Buffer ───────────────────────────────────────
    // Receives decoded PCM from the WebView ScriptProcessor and outputs it in
    // processBlock so all Web-Audio instruments route through the DAW bus.
    static constexpr int kWebAudioFifoSize = 96000; // 2 s at 48 kHz
    juce::AbstractFifo webAudioFifo { kWebAudioFifoSize };
    float webAudioBufL[kWebAudioFifoSize] {};
    float webAudioBufR[kWebAudioFifoSize] {};
    std::atomic<bool> webAudioActive { false };
    // Liveness: millisecond timestamp of the last web-audio block received. The
    // web engine only delivers audio while the editor UI is open/active. We use
    // this to suppress the C++ sampler on tabs where the web engine is also the
    // sound source (tabs 0 & 2) — otherwise both play the same note ~50ms apart,
    // which is the phasing/doubling the user hears. When the UI is closed (DAW
    // bounce/playback), web goes quiet and the C++ sampler takes over.
    std::atomic<juce::uint32> webAudioLastMs { 0 };
    // Resamplers: convert the incoming web-audio stream (its own context rate)
    // to the DAW rate so the FIFO never drifts (the cause of escalating buzz).
    juce::LagrangeInterpolator webResamplerL, webResamplerR;
    // Priming: the consumer (processBlock) refuses to read until the FIFO has
    // buffered a target amount (~120 ms). This guarantees we never read a
    // partial/empty block, which is what produced the click at the start of
    // every note, and gives enough headroom to ride out main-thread (React)
    // stalls without starving. Audio-thread only; no atomics needed.
    bool webAudioPrimed { false };
    // Smooth, click-free transitions. The bridge is a streaming buffer between
    // two free-running clocks; any hard start/stop of the read splices the
    // waveform = a click ("static"). We ramp this gain toward 1 while we have a
    // full block of data and toward 0 the moment we starve, so under-runs fade
    // out and recoveries fade in instead of clicking. Audio-thread only.
    float webAudioFadeGain { 0.0f };
    // Consecutive starved blocks; only force a full re-prime after a sustained
    // dropout (a brief jitter gap should NOT trigger a 120 ms re-prime stall).
    int  webAudioStarveBlocks { 0 };

    void handleArturiaKeyLabCC (int ccNum, int ccVal);
    void updateParameterValue (const juce::String& paramID, float newValue);

    // ─── Round Robin & Random Sample Playback ───
    std::atomic<int> currentRoundRobinSlot { 0 };
    juce::Random randomGen;
    juce::uint32 lastRRTriggerTimeMs { 0 };
    juce::uint32 lastRandomTriggerTimeMs { 0 };
    int lastRandomSlot { 0 };
    
    // ─── Phase 6: LFOs & Modulation Matrix ───
    DivineLFO lfo1;
    DivineLFO lfo2;
    std::atomic<float> lfo1Value { 0.0f };
    std::atomic<float> lfo2Value { 0.0f };
    std::atomic<float> midiAftertouch { 0.0f };
    std::atomic<float> midiModWheel { 0.0f };
    std::atomic<float> midiExpression { 1.0f };  // CC11 expression pedal (0-1)
    std::atomic<bool>  midiSustainHeld { false }; // CC64 sustain pedal

    // ─── Phase 7: Vortex Morph Weight System ───
    std::array<float, 8> vortexWeights;
    void updateVortexWeights(float x, float y);
    float poseidonLfoPhase = 0.0f;

    // ─── License Verification & Demo Watermark ───
public:
    std::atomic<bool> licenseActivated { false };
    juce::String activeLicenseKey;
    void startLicenseValidation (const juce::String& key, bool isFirstActivation);
    void handleValidationResult (bool success, const juce::String& message, const juce::String& key, bool isFirstActivation);
private:
    int watermarkSampleCounter = 0;
    float currentWatermarkGain = 1.0f;
    std::unique_ptr<LicenseValidatorThread> validatorThread;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (VSTGodTheGodRealmAudioProcessor)
};
