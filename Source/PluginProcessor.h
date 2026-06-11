#pragma once

#include <JuceHeader.h>
#include "VelvetCurve.h"
#include "SacredSampler.h"
#include "PantheonSynth.h"

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
// Transport State — shared between audio thread & editor
// ═══════════════════════════════════════════════════════════════
struct TransportState
{
    std::atomic<bool> isPlaying { false };
    std::atomic<double> ppqPosition { 0.0 };
    std::atomic<double> bpm { 140.0 };
    std::atomic<int> currentStep { 0 };
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

    juce::CriticalSection stepLock;

    // ═══════════════════════════════════════════════════════════════
    // Metering & Transport — thread-safe accessors for the Editor
    // ═══════════════════════════════════════════════════════════════
    
    /** Per-track peak level (0.0 – 1.0+), exponentially decayed. */
    float getTrackPeakLevel (int trackIdx) const;
    
    /** Master bus stereo peaks. */
    float getMasterPeakL() const { return masterPeakL.load (std::memory_order_relaxed); }
    float getMasterPeakR() const { return masterPeakR.load (std::memory_order_relaxed); }
    
    /** Transport state. */
    const TransportState& getTransportState() const { return transport; }
    
    /** Drain recent MIDI 2.0 note events (clears the queue). */
    std::vector<Midi2NoteEvent> drainMidiEvents();

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
    juce::String sampleLibraryPath;
    
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

    // ─── Transport ───
    TransportState transport;

    // ─── MIDI 2.0 Event Queue ───
    static constexpr int kMaxMidiEvents = 64;
    Midi2NoteEvent midiEventBuffer[kMaxMidiEvents];
    std::atomic<int> midiEventWritePos { 0 };
    std::atomic<int> midiEventReadPos { 0 };

    // ─── Round Robin & Random Sample Playback ───
    std::atomic<int> currentRoundRobinSlot { 0 };
    juce::Random randomGen;

    // ─── License Verification & Demo Watermark ───
public:
    std::atomic<bool> licenseActivated { false };
private:
    int watermarkSampleCounter = 0;
    float currentWatermarkGain = 1.0f;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (VSTGodTheGodRealmAudioProcessor)
};
