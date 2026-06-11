#pragma once

#include <JuceHeader.h>
#include <vector>
#include <cmath>
#include <memory>
#include <algorithm>

// ═══════════════════════════════════════════════════════════════
// Electric Pantheon Deity Preset Definitions
// ═══════════════════════════════════════════════════════════════
struct GodVoicePreset
{
    juce::String id;
    juce::String carrier;     // "sine", "square", "sawtooth", "triangle"
    float modRatio;
    float modIndex;
    juce::String bodyType;    // "sine", "square", "sawtooth", "triangle"
    float bodyGain;
    float detuneCents;
    juce::String filterType;  // "lowpass", "highpass", "bandpass"
    float filterFreq;
    float filterQ;
    float attack;
    float decay;
    float sustain;
    float release;
    float reverbDecay;
    float reverbMix;
    float chorusRate;
    float chorusDepth;
    float chorusMix;
    float delayTime;
    float delayFeedback;
    float delayMix;
    float satDrive;
    float satMix;
    float subOscGain;
    float vibratoRate;
    float vibratoDepth;
};

// Constant preset database matching TypeScript pantheonVoicePresets.ts
static const GodVoicePreset kGodVoicePresets[8] = {
    // 0: Olympus
    { "olympus", "sine", 2.0f, 1.2f, "sine", 0.3f, 6.0f, "lowpass", 6000.0f, 0.7f,
      0.008f, 0.6f, 0.5f, 0.8f, 2.5f, 0.35f, 0.8f, 0.003f, 0.25f, 0.375f, 0.3f, 0.15f, 1.2f, 0.2f, 0.15f, 5.0f, 3.0f },
    // 1: Hades
    { "hades", "sawtooth", 3.0f, 4.0f, "square", 0.2f, 15.0f, "lowpass", 2800.0f, 2.0f,
      0.005f, 0.4f, 0.6f, 0.5f, 3.5f, 0.40f, 0.3f, 0.008f, 0.30f, 0.5f, 0.45f, 0.2f, 3.5f, 0.5f, 0.25f, 4.0f, 8.0f },
    // 2: Zeus
    { "zeus", "square", 7.0f, 2.5f, "sawtooth", 0.15f, 3.0f, "highpass", 400.0f, 1.0f,
      0.001f, 0.2f, 0.4f, 0.3f, 1.5f, 0.20f, 2.0f, 0.002f, 0.15f, 0.188f, 0.35f, 0.25f, 2.0f, 0.3f, 0.1f, 6.5f, 2.0f },
    // 3: Athena
    { "athena", "sine", 1.0f, 0.8f, "sine", 0.4f, 4.0f, "lowpass", 5000.0f, 0.5f,
      0.012f, 0.8f, 0.6f, 1.0f, 2.0f, 0.30f, 0.6f, 0.004f, 0.30f, 0.25f, 0.2f, 0.1f, 1.0f, 0.1f, 0.2f, 4.5f, 4.0f },
    // 4: Poseidon
    { "poseidon", "triangle", 0.5f, 1.5f, "sine", 0.35f, 8.0f, "lowpass", 3500.0f, 1.5f,
      0.05f, 1.0f, 0.7f, 2.0f, 4.0f, 0.50f, 0.3f, 0.006f, 0.40f, 0.666f, 0.5f, 0.3f, 1.0f, 0.1f, 0.3f, 3.0f, 6.0f },
    // 5: Titan
    { "titan", "sine", 4.0f, 2.0f, "sawtooth", 0.25f, 10.0f, "lowpass", 4000.0f, 0.8f,
      0.02f, 0.5f, 0.7f, 1.5f, 5.0f, 0.45f, 0.4f, 0.005f, 0.20f, 0.5f, 0.3f, 0.15f, 1.8f, 0.3f, 0.4f, 3.5f, 5.0f },
    // 6: Apollo
    { "apollo", "sine", 5.0f, 1.8f, "sine", 0.2f, 2.0f, "lowpass", 8000.0f, 0.3f,
      0.003f, 1.2f, 0.3f, 1.5f, 3.0f, 0.40f, 1.2f, 0.002f, 0.20f, 0.333f, 0.25f, 0.2f, 1.0f, 0.1f, 0.1f, 5.5f, 2.0f },
    // 7: Chronos
    { "chronos", "sine", 3.5f, 3.0f, "triangle", 0.2f, 20.0f, "bandpass", 2000.0f, 3.0f,
      0.03f, 0.3f, 0.5f, 2.5f, 4.5f, 0.50f, 0.2f, 0.01f, 0.35f, 0.75f, 0.6f, 0.35f, 1.5f, 0.2f, 0.15f, 2.0f, 12.0f }
};

// ═══════════════════════════════════════════════════════════════
// Phase-Accumulator Synth Oscillator
// ═══════════════════════════════════════════════════════════════
class PantheonOscillator
{
public:
    PantheonOscillator() {}

    void setSampleRate(double sr) { sampleRate = sr; }
    void setFrequency(float freq) { frequency = freq; }
    void setType(const juce::String& t) { type = t; }

    float process(float phaseModulation = 0.0f)
    {
        if (sampleRate <= 0.0) return 0.0f;

        // Increment phase
        double phaseIncrement = (2.0 * juce::MathConstants<double>::pi * frequency) / sampleRate;
        currentPhase += phaseIncrement;
        if (currentPhase >= 2.0 * juce::MathConstants<double>::pi)
            currentPhase -= 2.0 * juce::MathConstants<double>::pi;

        // Apply phase modulation
        double modulatedPhase = currentPhase + phaseModulation;
        while (modulatedPhase < 0.0) modulatedPhase += 2.0 * juce::MathConstants<double>::pi;
        while (modulatedPhase >= 2.0 * juce::MathConstants<double>::pi) modulatedPhase -= 2.0 * juce::MathConstants<double>::pi;

        if (type == "sine")
        {
            return static_cast<float>(std::sin(modulatedPhase));
        }
        else if (type == "square")
        {
            return modulatedPhase < juce::MathConstants<double>::pi ? 1.0f : -1.0f;
        }
        else if (type == "sawtooth")
        {
            return static_cast<float>(2.0 * (modulatedPhase / (2.0 * juce::MathConstants<double>::pi)) - 1.0);
        }
        else if (type == "triangle")
        {
            float val = static_cast<float>(2.0 * (modulatedPhase / (2.0 * juce::MathConstants<double>::pi)) - 1.0);
            return 2.0f * std::abs(val) - 1.0f;
        }
        return 0.0f;
    }

    void reset() { currentPhase = 0.0; }

private:
    double sampleRate = 44100.0;
    double frequency = 440.0;
    double currentPhase = 0.0;
    juce::String type = "sine";
};

// ═══════════════════════════════════════════════════════════════
// Synthesizer Voice Class
// ═══════════════════════════════════════════════════════════════
class PantheonVoice
{
public:
    PantheonVoice()
    {
        filter.reset();
    }

    void prepare(double sr)
    {
        sampleRate = sr;
        carrierOsc.setSampleRate(sr);
        modulatorOsc.setSampleRate(sr);
        bodyOsc.setSampleRate(sr);
        subOsc.setSampleRate(sr);
        envelope.setSampleRate(sr);
        filter.reset();
    }

    void applyPreset(const GodVoicePreset& p)
    {
        preset = p;
        carrierOsc.setType(p.carrier);
        bodyOsc.setType(p.bodyType);
        modulatorOsc.setType("sine");
        subOsc.setType("sine");
        
        // Load envelope parameters
        juce::ADSR::Parameters params;
        params.attack = p.attack;
        params.decay = p.decay;
        params.sustain = p.sustain;
        params.release = p.release;
        envelope.setParameters(params);
    }

    void noteOn(int midiNumber, float velocity, float pitchBend)
    {
        midi = midiNumber;
        currentVelocity = velocity;
        startTime = juce::Time::getMillisecondCounter();
        active = true;

        carrierOsc.reset();
        modulatorOsc.reset();
        bodyOsc.reset();
        subOsc.reset();
        
        updateFrequencies(pitchBend);
        envelope.noteOn();
    }

    void noteOff()
    {
        envelope.noteOff();
    }

    void updateFrequencies(float pitchBend)
    {
        if (midi < 0) return;
        
        float finalMidi = static_cast<float>(midi) + pitchBend;
        float freq = 440.0f * std::pow(2.0f, (finalMidi - 69.0f) / 12.0f);
        
        carrierOsc.setFrequency(freq);
        
        // Modulator frequency: freq * modRatio
        modulatorOsc.setFrequency(freq * preset.modRatio);
        
        // Body frequency: detuned carrier
        float detuneMult = std::pow(2.0f, (preset.detuneCents / 100.0f) / 12.0f);
        bodyOsc.setFrequency(freq * detuneMult);
        
        // Sub frequency: freq * 0.5
        subOsc.setFrequency(freq * 0.5f);
    }

    void updateFilter(float cutoff, float q, const juce::String& type)
    {
        cutoff = juce::jlimit(20.0f, static_cast<float>(sampleRate * 0.49), cutoff);
        q = juce::jmax(0.1f, q);

        if (type == "lowpass")
            filter.setCoefficients(juce::IIRCoefficients::makeLowPass(sampleRate, cutoff, q));
        else if (type == "highpass")
            filter.setCoefficients(juce::IIRCoefficients::makeHighPass(sampleRate, cutoff, q));
        else // bandpass
            filter.setCoefficients(juce::IIRCoefficients::makeBandPass(sampleRate, cutoff, q));
    }

    void process(juce::AudioBuffer<float>& buffer, int startSample, int numSamples, float pitchBend, float macroEnergyVal)
    {
        if (!active) return;

        updateFrequencies(pitchBend);

        auto* left = buffer.getWritePointer(0);
        auto* right = buffer.getWritePointer(1);

        float freq = 440.0f * std::pow(2.0f, (static_cast<float>(midi) + pitchBend - 69.0f) / 12.0f);

        for (int i = 0; i < numSamples; ++i)
        {
            float env = envelope.getNextSample();
            if (env <= 0.0f && !envelope.isActive())
            {
                active = false;
                midi = -1;
                break;
            }

            // 1. Process FM Modulator
            float modOut = modulatorOsc.process();
            
            // FM depth: freq * modIndex * vel
            // energy macro: modifies modIndex behavior
            float energyModScale = 0.5f + (macroEnergyVal / 100.0f) * 1.5f;
            float fmDepth = freq * preset.modIndex * currentVelocity * energyModScale;
            float phaseModVal = modOut * fmDepth * (2.0f * juce::MathConstants<float>::pi / static_cast<float>(sampleRate));

            // 2. Process Carrier with Phase Modulation
            float carrierOut = carrierOsc.process(phaseModVal);

            // 3. Process Body
            float bodyOut = bodyOsc.process();

            // 4. Process Sub
            float subOut = subOsc.process();

            // Mix carrier, body, sub
            float mixVal = carrierOut + bodyOut * preset.bodyGain + subOut * preset.subOscGain;
            
            // 5. Apply Voice Filter
            float filteredVal = filter.processSingleSampleRaw(mixVal);

            // 6. Apply Amplitude Envelope & Velocity
            float finalOut = filteredVal * env * currentVelocity * 0.25f; // scale down for headroom

            left[startSample + i] += finalOut;
            right[startSample + i] += finalOut;
        }
    }

    bool isActive() const { return active; }
    int getMidiNote() const { return midi; }
    uint32_t getStartTime() const { return startTime; }

private:
    double sampleRate = 44100.0;
    int midi = -1;
    float currentVelocity = 0.0f;
    uint32_t startTime = 0;
    bool active = false;

    PantheonOscillator carrierOsc;
    PantheonOscillator modulatorOsc;
    PantheonOscillator bodyOsc;
    PantheonOscillator subOsc;
    
    juce::ADSR envelope;
    juce::IIRFilter filter;
    GodVoicePreset preset;
};

// ═══════════════════════════════════════════════════════════════
// Global FX and Processing Chains
// ═══════════════════════════════════════════════════════════════

class PantheonDelay
{
public:
    void prepare(double sampleRate, float maxDelayTime = 2.0f)
    {
        this->sampleRate = sampleRate;
        buffer.setSize(2, static_cast<int>(maxDelayTime * sampleRate) + 10);
        buffer.clear();
        writeIndex = 0;
    }
    
    void process(float& left, float& right, float delayTimeSec, float feedback, float mix)
    {
        int size = buffer.getNumSamples();
        int delaySamples = static_cast<int>(delayTimeSec * sampleRate);
        int readIndex = writeIndex - delaySamples;
        if (readIndex < 0) readIndex += size;
        
        float delayedL = buffer.getSample(0, readIndex);
        float delayedR = buffer.getSample(1, readIndex);
        
        // Feed back to buffer
        buffer.setSample(0, writeIndex, left + delayedL * feedback);
        buffer.setSample(1, writeIndex, right + delayedR * feedback);
        
        writeIndex++;
        if (writeIndex >= size) writeIndex = 0;
        
        // Wet/dry mix
        left = (1.0f - mix) * left + mix * delayedL;
        right = (1.0f - mix) * right + mix * delayedR;
    }
private:
    juce::AudioBuffer<float> buffer;
    int writeIndex = 0;
    double sampleRate = 44100.0;
};

class PantheonChorus
{
public:
    void prepare(double sampleRate)
    {
        this->sampleRate = sampleRate;
        buffer.setSize(2, static_cast<int>(0.05f * sampleRate) + 10);
        buffer.clear();
        writeIndex = 0;
        lfoPhase = 0.0;
    }
    
    void process(float& left, float& right, float rate, float depth, float mix)
    {
        int size = buffer.getNumSamples();
        
        // Increment LFO
        double lfoIncrement = (2.0 * juce::MathConstants<double>::pi * rate) / sampleRate;
        lfoPhase += lfoIncrement;
        if (lfoPhase >= 2.0 * juce::MathConstants<double>::pi)
            lfoPhase -= 2.0 * juce::MathConstants<double>::pi;
        
        // Modulate delay times (around 5ms - 10ms)
        float baseDelayTime = 0.007f;
        float lfoValL = static_cast<float>(std::sin(lfoPhase));
        float lfoValR = static_cast<float>(std::cos(lfoPhase)); // 90 degree phase shift for stereo width
        
        float delaySecL = baseDelayTime + lfoValL * depth;
        float delaySecR = baseDelayTime + lfoValR * depth;
        
        // Read L (interpolated)
        float delaySamplesL = delaySecL * static_cast<float>(sampleRate);
        float readIndexL = static_cast<float>(writeIndex) - delaySamplesL;
        if (readIndexL < 0.0f) readIndexL += static_cast<float>(size);
        
        int readIdxL0 = static_cast<int>(readIndexL);
        int readIdxL1 = (readIdxL0 + 1) % size;
        float fracL = readIndexL - static_cast<float>(readIdxL0);
        float delayedL = buffer.getSample(0, readIdxL0) * (1.0f - fracL) + buffer.getSample(0, readIdxL1) * fracL;
        
        // Read R (interpolated)
        float delaySamplesR = delaySecR * static_cast<float>(sampleRate);
        float readIndexR = static_cast<float>(writeIndex) - delaySamplesR;
        if (readIndexR < 0.0f) readIndexR += static_cast<float>(size);
        
        int readIdxR0 = static_cast<int>(readIndexR);
        int readIdxR1 = (readIdxR0 + 1) % size;
        float fracR = readIndexR - static_cast<float>(readIdxR0);
        float delayedR = buffer.getSample(1, readIdxR0) * (1.0f - fracR) + buffer.getSample(1, readIdxR1) * fracR;
        
        // Write to buffer
        buffer.setSample(0, writeIndex, left);
        buffer.setSample(1, writeIndex, right);
        
        writeIndex++;
        if (writeIndex >= size) writeIndex = 0;
        
        // Wet/dry mix
        left = (1.0f - mix) * left + mix * delayedL;
        right = (1.0f - mix) * right + mix * delayedR;
    }
private:
    juce::AudioBuffer<float> buffer;
    int writeIndex = 0;
    double sampleRate = 44100.0;
    double lfoPhase = 0.0;
};

class PantheonReverb
{
public:
    void prepare(double sampleRate)
    {
        this->sampleRate = sampleRate;
        for (int i = 0; i < 4; ++i)
        {
            combFilters[i].setSize(2, static_cast<int>((0.03f + i * 0.012f) * sampleRate) + 10);
            combFilters[i].clear();
            combWriteIndexes[i] = 0;
        }
        allPass.setSize(2, static_cast<int>(0.005f * sampleRate) + 10);
        allPass.clear();
        allPassWriteIndex = 0;
    }
    
    void process(float& left, float& right, float decay, float mix)
    {
        float inL = left;
        float inR = right;
        float outL = 0.0f;
        float outR = 0.0f;
        
        // Parallel comb filters
        float g = 0.7f + decay * 0.15f;
        for (int i = 0; i < 4; ++i)
        {
            int size = combFilters[i].getNumSamples();
            int rdIdx = combWriteIndexes[i] - (size - 10);
            if (rdIdx < 0) rdIdx += size;
            
            float dL = combFilters[i].getSample(0, rdIdx);
            float dR = combFilters[i].getSample(1, rdIdx);
            
            combFilters[i].setSample(0, combWriteIndexes[i], inL + dL * g);
            combFilters[i].setSample(1, combWriteIndexes[i], inR + dR * g);
            
            combWriteIndexes[i]++;
            if (combWriteIndexes[i] >= size) combWriteIndexes[i] = 0;
            
            outL += dL;
            outR += dR;
        }
        outL *= 0.25f;
        outR *= 0.25f;
        
        // Allpass filter
        int apSize = allPass.getNumSamples();
        int apRdIdx = allPassWriteIndex - (apSize - 10);
        if (apRdIdx < 0) apRdIdx += apSize;
        
        float apL = allPass.getSample(0, apRdIdx);
        float apR = allPass.getSample(1, apRdIdx);
        
        float apFeedback = 0.5f;
        allPass.setSample(0, allPassWriteIndex, outL - apL * apFeedback);
        allPass.setSample(1, allPassWriteIndex, outR - apR * apFeedback);
        
        allPassWriteIndex++;
        if (allPassWriteIndex >= apSize) allPassWriteIndex = 0;
        
        outL = apL + outL * apFeedback;
        outR = apR + outR * apFeedback;
        
        // Wet/dry mix
        left = (1.0f - mix) * left + mix * outL;
        right = (1.0f - mix) * right + mix * outR;
    }
private:
    juce::AudioBuffer<float> combFilters[4];
    int combWriteIndexes[4] { 0, 0, 0, 0 };
    juce::AudioBuffer<float> allPass;
    int allPassWriteIndex = 0;
    double sampleRate = 44100.0;
};

// ═══════════════════════════════════════════════════════════════
// Main Polyphonic FM Synthesis Engine
// ═══════════════════════════════════════════════════════════════
class PantheonSynthEngine
{
public:
    PantheonSynthEngine()
    {
        // Allocate 8 voices
        for (int i = 0; i < 8; ++i)
            voices.emplace_back(std::make_unique<PantheonVoice>());
            
        currentGodPreset = kGodVoicePresets[0]; // Olympus by default
    }

    void prepare(double sr)
    {
        sampleRate = sr;
        for (auto& voice : voices)
            voice->prepare(sr);
            
        delay.prepare(sr);
        chorus.prepare(sr);
        reverb.prepare(sr);
    }

    void setGod(int godIndex)
    {
        if (godIndex >= 0 && godIndex < 8)
        {
            currentGodIndex = godIndex;
            currentGodPreset = kGodVoicePresets[godIndex];
            
            // Apply preset to all voices
            for (auto& voice : voices)
                voice->applyPreset(currentGodPreset);
        }
    }

    void noteOn(int midiNumber, float velocity)
    {
        // Allocator: find free voice or steal oldest
        PantheonVoice* voiceToUse = nullptr;
        for (auto& voice : voices)
        {
            if (!voice->isActive())
            {
                voiceToUse = voice.get();
                break;
            }
        }
        
        if (voiceToUse == nullptr)
        {
            // Steal voice: oldest active voice
            uint32_t oldestTime = 0xFFFFFFFF;
            for (auto& voice : voices)
            {
                if (voice->getStartTime() < oldestTime)
                {
                    oldestTime = voice->getStartTime();
                    voiceToUse = voice.get();
                }
            }
        }
        
        if (voiceToUse != nullptr)
        {
            voiceToUse->applyPreset(currentGodPreset);
            voiceToUse->noteOn(midiNumber, velocity, pitchBend);
        }
    }

    void noteOff(int midiNumber)
    {
        for (auto& voice : voices)
        {
            if (voice->isActive() && voice->getMidiNote() == midiNumber)
            {
                voice->noteOff();
            }
        }
    }

    void setPitchBend(float pbVal)
    {
        // pbVal: -1.0 to 1.0 -> ±2 semitones
        pitchBend = pbVal * 2.0f;
    }

    void process(juce::AudioBuffer<float>& buffer)
    {
        int numSamples = buffer.getNumSamples();
        
        // Temporary synth block
        juce::AudioBuffer<float> synthBuffer(2, numSamples);
        synthBuffer.clear();

        // 1. Process all active voices
        for (auto& voice : voices)
        {
            if (voice->isActive())
            {
                // Set dynamic filter cutoff and Q
                float cutoff = currentGodPreset.filterFreq;
                float filterQ = currentGodPreset.filterQ;
                
                // energy macro: boosts filter cutoff and Q
                float energyNorm = macroEnergy.load(std::memory_order_relaxed) / 100.0f;
                if (energyNorm > 0.0f)
                {
                    cutoff = 1000.0f + energyNorm * 7000.0f;
                    filterQ = 0.5f + energyNorm * 4.0f;
                }
                
                voice->updateFilter(cutoff, filterQ, currentGodPreset.filterType);
                voice->process(synthBuffer, 0, numSamples, pitchBend, macroEnergy.load(std::memory_order_relaxed));
            }
        }

        // 2. Process Global FX Chain
        float* left = synthBuffer.getWritePointer(0);
        float* right = synthBuffer.getWritePointer(1);

        float energyNorm = macroEnergy.load(std::memory_order_relaxed) / 100.0f;
        float divinityNorm = macroDivinity.load(std::memory_order_relaxed) / 100.0f;
        float widthNorm = macroWidth.load(std::memory_order_relaxed) / 100.0f;
        float realmNorm = macroRealm.load(std::memory_order_relaxed) / 100.0f;

        // Saturation drive/mix
        float satDrive = currentGodPreset.satDrive * (1.0f + energyNorm * 4.0f);
        float satMix = currentGodPreset.satMix * (1.0f - realmNorm * 0.4f) + (realmNorm * realmNorm * 0.4f);

        // Chorus rate/depth/mix
        float chorusRate = currentGodPreset.chorusRate * (0.8f + divinityNorm * 0.8f);
        float chorusDepth = currentGodPreset.chorusDepth * (0.5f + divinityNorm * 1.5f);
        float chorusMix = currentGodPreset.chorusMix * (0.5f + widthNorm);

        // Delay feedback/mix
        float delayTime = currentGodPreset.delayTime;
        float delayFeedback = currentGodPreset.delayFeedback;
        float delayMix = currentGodPreset.delayMix * (0.1f + realmNorm * 0.5f * 1.5f);

        // Reverb mix/decay
        float reverbDecay = currentGodPreset.reverbDecay;
        float reverbMix = currentGodPreset.reverbMix * (0.5f + divinityNorm) * (0.1f + realmNorm * 0.5f * 2.0f);

        for (int i = 0; i < numSamples; ++i)
        {
            float l = left[i];
            float r = right[i];

            // A. Saturation
            float satL = std::tanh(l * satDrive);
            float satR = std::tanh(r * satDrive);
            l = (1.0f - satMix) * l + satMix * satL;
            r = (1.0f - satMix) * r + satMix * satR;

            // B. Chorus
            chorus.process(l, r, chorusRate, chorusDepth, chorusMix);

            // C. Delay
            delay.process(l, r, delayTime, delayFeedback, delayMix);

            // D. Reverb
            reverb.process(l, r, reverbDecay, reverbMix);

            // E. Stereo Width (Mid/Side matrix)
            // side gain: 0.2 to 1.0
            float sideGain = 0.2f + widthNorm * 0.8f;
            float midGain = 1.0f - widthNorm * 0.3f;
            
            float mid = (l + r) * 0.5f;
            float side = (l - r) * 0.5f;
            
            mid *= midGain;
            side *= sideGain;
            
            // Re-matrix
            l = mid + side;
            r = mid - side;

            left[i] = l;
            right[i] = r;
        }

        // 3. Accumulate to host output buffer
        buffer.addFrom(0, 0, synthBuffer.getReadPointer(0), numSamples);
        buffer.addFrom(1, 0, synthBuffer.getReadPointer(1), numSamples);
    }

    void setMacros(float energy, float divinity, float width, float realm, float aura, float age)
    {
        macroEnergy.store(energy, std::memory_order_relaxed);
        macroDivinity.store(divinity, std::memory_order_relaxed);
        macroWidth.store(width, std::memory_order_relaxed);
        macroRealm.store(realm, std::memory_order_relaxed);
        macroAura.store(aura, std::memory_order_relaxed);
        macroAge.store(age, std::memory_order_relaxed);
    }

private:
    double sampleRate = 44100.0;
    int currentGodIndex = 0;
    GodVoicePreset currentGodPreset;
    
    std::vector<std::unique_ptr<PantheonVoice>> voices;
    float pitchBend = 0.0f;

    // FX Blocks
    PantheonDelay delay;
    PantheonChorus chorus;
    PantheonReverb reverb;

    // Thread-safe macro parameter values
    std::atomic<float> macroEnergy { 50.0f };
    std::atomic<float> macroDivinity { 50.0f };
    std::atomic<float> macroWidth { 50.0f };
    std::atomic<float> macroRealm { 50.0f };
    std::atomic<float> macroAura { 50.0f };
    std::atomic<float> macroAge { 50.0f };
};
