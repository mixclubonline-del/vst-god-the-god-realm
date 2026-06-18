#pragma once

#include <JuceHeader.h>
#include "VelvetCurve.h"
#include "SacredSampler.h"
#include "PantheonSynth.h"

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
    void updateStep(int trackIdx, const juce::String& patternName, int stepIdx, const juce::var& stepData);
    void updateTrackSlices(int trackIdx, const juce::var& sliceData);
    void triggerStep(int trackIdx, float velocity, float pitch, float pan, float decay, float startNorm, float endNorm, bool reverse, int sliceIndex);
    void updateTransportState(bool isPlaying, double bpm);

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
