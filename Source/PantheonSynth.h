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
    // 0: Olympus (Lo-fi Trap Bell/Keys)
    { "olympus", "sine", 2.0f, 1.2f, "sine", 0.3f, 10.0f, "lowpass", 3200.0f, 0.7f,
      0.008f, 0.6f, 0.5f, 0.8f, 2.5f, 0.35f, 0.8f, 0.003f, 0.25f, 0.375f, 0.3f, 0.15f, 1.2f, 0.2f, 0.15f, 3.5f, 5.0f },
    // 1: Hades
    { "hades", "sawtooth", 3.0f, 4.0f, "square", 0.2f, 15.0f, "lowpass", 2800.0f, 2.0f,
      0.005f, 0.4f, 0.6f, 0.5f, 3.5f, 0.40f, 0.3f, 0.008f, 0.30f, 0.5f, 0.45f, 0.2f, 3.5f, 0.5f, 0.25f, 4.0f, 8.0f },
    // 2: Zeus
    { "zeus", "square", 7.0f, 2.5f, "sawtooth", 0.15f, 3.0f, "highpass", 400.0f, 1.0f,
      0.001f, 0.2f, 0.4f, 0.3f, 1.5f, 0.20f, 2.0f, 0.002f, 0.15f, 0.188f, 0.35f, 0.25f, 2.0f, 0.3f, 0.1f, 6.5f, 2.0f },
    // 3: Athena (Lo-fi Warm EP/Keys)
    { "athena", "sine", 1.0f, 0.8f, "sine", 0.4f, 12.0f, "lowpass", 1800.0f, 0.5f,
      0.012f, 0.8f, 0.6f, 1.0f, 2.0f, 0.30f, 0.6f, 0.004f, 0.30f, 0.25f, 0.2f, 0.1f, 1.6f, 0.25f, 0.2f, 4.0f, 6.0f },
    // 4: Poseidon (Lush Wide Warm Pad)
    { "poseidon", "triangle", 0.5f, 1.5f, "sine", 0.35f, 16.0f, "lowpass", 1400.0f, 0.6f,
      0.22f, 1.0f, 0.7f, 2.4f, 4.0f, 0.45f, 0.3f, 0.006f, 0.40f, 0.666f, 0.5f, 0.3f, 1.0f, 0.1f, 0.3f, 2.2f, 10.0f },
    // 5: Titan
    { "titan", "sine", 4.0f, 2.0f, "sawtooth", 0.25f, 10.0f, "lowpass", 4000.0f, 0.8f,
      0.02f, 0.5f, 0.7f, 1.5f, 5.0f, 0.45f, 0.4f, 0.005f, 0.20f, 0.5f, 0.3f, 0.15f, 1.8f, 0.3f, 0.4f, 3.5f, 5.0f },
    // 6: Apollo
    { "apollo", "sine", 5.0f, 1.8f, "sine", 0.2f, 2.0f, "lowpass", 8000.0f, 0.3f,
      0.003f, 1.2f, 0.3f, 1.5f, 3.0f, 0.40f, 1.2f, 0.002f, 0.20f, 0.333f, 0.25f, 0.2f, 1.0f, 0.1f, 0.1f, 5.5f, 2.0f },
    // 7: Chronos (Lo-fi Dark Evolving Pad)
    { "chronos", "sine", 3.5f, 3.0f, "triangle", 0.2f, 25.0f, "lowpass", 1100.0f, 0.7f,
      0.20f, 0.3f, 0.5f, 2.8f, 4.5f, 0.50f, 0.2f, 0.01f, 0.35f, 0.75f, 0.6f, 0.35f, 1.5f, 0.2f, 0.15f, 2.8f, 12.0f }
};

// ═══════════════════════════════════════════════════════════════
// Blended Deity Preset for real-time morphing
// ═══════════════════════════════════════════════════════════════
struct BlendedGodPreset
{
    float modRatio = 0.0f;
    float modIndex = 0.0f;
    float bodyGain = 0.0f;
    float detuneCents = 0.0f;
    float filterFreq = 0.0f;
    float filterQ = 0.0f;
    float attack = 0.0f;
    float decay = 0.0f;
    float sustain = 0.0f;
    float release = 0.0f;
    float reverbDecay = 0.0f;
    float reverbMix = 0.0f;
    float chorusRate = 0.0f;
    float chorusDepth = 0.0f;
    float chorusMix = 0.0f;
    float delayTime = 0.0f;
    float delayFeedback = 0.0f;
    float delayMix = 0.0f;
    float satDrive = 0.0f;
    float satMix = 0.0f;
    float subOscGain = 0.0f;
    float vibratoRate = 0.0f;
    float vibratoDepth = 0.0f;

    // discrete shape weights
    float carrierSine = 0.0f;
    float carrierSquare = 0.0f;
    float carrierSaw = 0.0f;
    float carrierTriangle = 0.0f;

    float bodySine = 0.0f;
    float bodySquare = 0.0f;
    float bodySaw = 0.0f;
    float bodyTriangle = 0.0f;

    float filterLP = 0.0f;
    float filterHP = 0.0f;
    float filterBP = 0.0f;

    std::array<float, 8> weights { 0.0f };
};

inline BlendedGodPreset blendPresets(const std::array<float, 8>& weights)
{
    BlendedGodPreset bp;
    bp.weights = weights;
    for (int i = 0; i < 8; ++i)
    {
        float w = weights[i];
        if (w <= 0.0f) continue;

        const auto& p = kGodVoicePresets[i];
        bp.modRatio += p.modRatio * w;
        bp.modIndex += p.modIndex * w;
        bp.bodyGain += p.bodyGain * w;
        bp.detuneCents += p.detuneCents * w;
        bp.filterFreq += p.filterFreq * w;
        bp.filterQ += p.filterQ * w;
        bp.attack += p.attack * w;
        bp.decay += p.decay * w;
        bp.sustain += p.sustain * w;
        bp.release += p.release * w;
        bp.reverbDecay += p.reverbDecay * w;
        bp.reverbMix += p.reverbMix * w;
        bp.chorusRate += p.chorusRate * w;
        bp.chorusDepth += p.chorusDepth * w;
        bp.chorusMix += p.chorusMix * w;
        bp.delayTime += p.delayTime * w;
        bp.delayFeedback += p.delayFeedback * w;
        bp.delayMix += p.delayMix * w;
        bp.satDrive += p.satDrive * w;
        bp.satMix += p.satMix * w;
        bp.subOscGain += p.subOscGain * w;
        bp.vibratoRate += p.vibratoRate * w;
        bp.vibratoDepth += p.vibratoDepth * w;

        if (p.carrier == "sine") bp.carrierSine += w;
        else if (p.carrier == "square") bp.carrierSquare += w;
        else if (p.carrier == "sawtooth") bp.carrierSaw += w;
        else if (p.carrier == "triangle") bp.carrierTriangle += w;

        if (p.bodyType == "sine") bp.bodySine += w;
        else if (p.bodyType == "square") bp.bodySquare += w;
        else if (p.bodyType == "sawtooth") bp.bodySaw += w;
        else if (p.bodyType == "triangle") bp.bodyTriangle += w;

        if (p.filterType == "lowpass") bp.filterLP += w;
        else if (p.filterType == "highpass") bp.filterHP += w;
        else if (p.filterType == "bandpass") bp.filterBP += w;
    }
    return bp;
}

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

    float processBlended(float sineW, float sqW, float sawW, float triW, float phaseModulation = 0.0f)
    {
        if (sampleRate <= 0.0) return 0.0f;

        double phaseIncrement = (2.0 * juce::MathConstants<double>::pi * frequency) / sampleRate;
        currentPhase += phaseIncrement;
        if (currentPhase >= 2.0 * juce::MathConstants<double>::pi)
            currentPhase -= 2.0 * juce::MathConstants<double>::pi;

        double modulatedPhase = currentPhase + phaseModulation;
        while (modulatedPhase < 0.0) modulatedPhase += 2.0 * juce::MathConstants<double>::pi;
        while (modulatedPhase >= 2.0 * juce::MathConstants<double>::pi) modulatedPhase -= 2.0 * juce::MathConstants<double>::pi;

        float out = 0.0f;

        if (sineW > 0.0f)
            out += sineW * static_cast<float>(std::sin(modulatedPhase));

        if (sqW > 0.0f)
            out += sqW * (modulatedPhase < juce::MathConstants<double>::pi ? 1.0f : -1.0f);

        if (sawW > 0.0f)
            out += sawW * static_cast<float>(2.0 * (modulatedPhase / (2.0 * juce::MathConstants<double>::pi)) - 1.0);

        if (triW > 0.0f)
        {
            float val = static_cast<float>(2.0 * (modulatedPhase / (2.0 * juce::MathConstants<double>::pi)) - 1.0);
            out += triW * (2.0f * std::abs(val) - 1.0f);
        }

        return out;
    }

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
        filterLP.reset();
        filterHP.reset();
        filterBP.reset();
    }

    void prepare(double sr)
    {
        sampleRate = sr;
        carrierOsc.setSampleRate(sr);
        modulatorOsc.setSampleRate(sr);
        bodyOsc.setSampleRate(sr);
        subOsc.setSampleRate(sr);
        envelope.setSampleRate(sr);
        modEnvelope.setSampleRate(sr);
        filterLP.reset();
        filterHP.reset();
        filterBP.reset();
    }

    void applyPreset(const GodVoicePreset& p)
    {
        preset = p;
        
        std::array<float, 8> weights = { 0.0f };
        int idx = 0;
        for (int i = 0; i < 8; ++i)
        {
            if (kGodVoicePresets[i].id == p.id)
            {
                idx = i;
                break;
            }
        }
        weights[idx] = 1.0f;
        blendedPreset = blendPresets(weights);

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

    void noteOn(int midiNumber, float velocity, float pitchBendVal, int channel = 0)
    {
        midi = midiNumber;
        currentVelocity = velocity;
        midiChannel = channel;
        startTime = juce::Time::getMillisecondCounter();
        active = true;

        mpePitchBend = 0.0f;
        mpePressure = 0.0f;
        mpeTimbre = 0.0f;

        carrierOsc.reset();
        modulatorOsc.reset();
        bodyOsc.reset();
        subOsc.reset();
        
        vibratoPhase = 0.0f;
        lastEnv = 0.0f;

        olympusPhase = 0.0;
        hadesPhase = 0.0;
        zeusPhase = 0.0;
        athenaPhase = 0.0;
        poseidonPhase = 0.0;
        titanPhase = 0.0;
        apolloPhase = 0.0;
        chronosPhase = 0.0;
        apolloVibratoPhase = 0.0f;
        titanLpfState = 0.0f;
        subSampleCount = 0;
        
        voiceDrift = (randomGen.nextFloat() * 2.0f - 1.0f) * 0.1f;
        driftNoiseTarget = voiceDrift;

        if (velocity > 0.8f)
        {
            zeusTransientActive = true;
            zeusTransientSamplesLeft = static_cast<int>(0.010f * sampleRate);
            lastZeusSample = 0.0f;
        }
        else
        {
            zeusTransientActive = false;
            zeusTransientSamplesLeft = 0;
        }

        updateFrequencies(pitchBendVal, 0.0f, 0);
        envelope.noteOn();
        modEnvelope.noteOn();
    }

    void noteOff()
    {
        envelope.noteOff();
        modEnvelope.noteOff();
    }

    void setMpePitchBend(float pbVal)
    {
        mpePitchBend = pbVal * 48.0f; // MPE standard bend range is ±48 semitones
    }

    void setMpePressure(float pressureVal)
    {
        mpePressure = pressureVal;
    }

    void setMpeTimbre(float timbreVal)
    {
        mpeTimbre = timbreVal;
    }

    void setEnvelopeParameters(const juce::ADSR::Parameters& params)
    {
        envelope.setParameters(params);
    }

    void setModEnvelopeParameters(const juce::ADSR::Parameters& params)
    {
        modEnvelope.setParameters(params);
    }

    void setModMatrixSlots(const int* sources, const int* targets, const float* amounts)
    {
        for (int i = 0; i < 4; ++i)
        {
            modSources[i] = sources[i];
            modTargets[i] = targets[i];
            modAmounts[i] = amounts[i];
        }
    }

    float getLastModEnvValue() const
    {
        return lastModEnv;
    }

    void setMidiChannel(int channel)
    {
        midiChannel = channel;
    }

    int getMidiChannel() const
    {
        return midiChannel;
    }

    void updateFrequencies(float pitchBendVal, float driftAmount, int numSamples)
    {
        if (midi < 0) return;
        
        if (numSamples > 0 && blendedPreset.vibratoRate > 0.0f)
        {
            vibratoPhase += static_cast<float>((static_cast<double>(numSamples) / sampleRate) * blendedPreset.vibratoRate * 2.0 * juce::MathConstants<double>::pi);
            if (vibratoPhase > 2.0f * juce::MathConstants<float>::pi)
                vibratoPhase -= 2.0f * juce::MathConstants<float>::pi;
        }

        float vibratoMod = 0.0f;
        if (blendedPreset.vibratoDepth > 0.0f)
        {
            vibratoMod = std::sin(vibratoPhase) * (blendedPreset.vibratoDepth / 100.0f); // convert cents to semitones
        }

        float drift = 0.0f;
        if (driftAmount > 0.0f)
        {
            drift = voiceDrift * driftAmount * 0.15f; // scale maximum drift to ±0.15 semitones
        }
        
        float finalMidi = static_cast<float>(midi) + pitchBendVal + mpePitchBend + drift + vibratoMod;
        float modulatedFreq = 440.0f * std::pow(2.0f, (finalMidi - 69.0f) / 12.0f);
        
        carrierOsc.setFrequency(modulatedFreq);
        modulatorOsc.setFrequency(modulatedFreq * blendedPreset.modRatio);
        
        float detuneMult = std::pow(2.0f, (blendedPreset.detuneCents / 100.0f) / 12.0f);
        bodyOsc.setFrequency(modulatedFreq * detuneMult);
        subOsc.setFrequency(modulatedFreq * 0.5f);
    }

    void updateFilters(float cutoff, float q)
    {
        float finalCutoff = cutoff + (mpeTimbre * 4000.0f) + (mpePressure * 2000.0f);
        finalCutoff = juce::jlimit(20.0f, static_cast<float>(sampleRate * 0.49), finalCutoff);
        q = juce::jmax(0.1f, q);

        filterLP.setCoefficients(juce::IIRCoefficients::makeLowPass(sampleRate, finalCutoff, q));
        filterHP.setCoefficients(juce::IIRCoefficients::makeHighPass(sampleRate, finalCutoff, q));
        filterBP.setCoefficients(juce::IIRCoefficients::makeBandPass(sampleRate, finalCutoff, q));
    }

    float processSubBass(float env, float vel)
    {
        const auto& w = blendedPreset.weights;
        
        ++subSampleCount;
        float timeSec = static_cast<float>(subSampleCount) / static_cast<float>(sampleRate);
        
        float subMix = 0.0f;
        
        // --- 0: Olympus (Triangle + FM Shimmer) ---
        if (w[0] > 0.0f)
        {
            double phaseInc = (2.0 * juce::MathConstants<double>::pi * (freq * 0.5f)) / sampleRate;
            olympusPhase += phaseInc;
            if (olympusPhase >= 2.0 * juce::MathConstants<double>::pi) olympusPhase -= 2.0 * juce::MathConstants<double>::pi;
            
            float val = static_cast<float>(2.0 * (olympusPhase / (2.0 * juce::MathConstants<double>::pi)) - 1.0);
            float tri = 2.0f * std::abs(val) - 1.0f;
            
            float fmBleed = 0.08f * std::sin(olympusPhase * 3.0f);
            subMix += w[0] * (tri + fmBleed);
        }
        
        // --- 1: Hades (Distorted Glide 808) ---
        if (w[1] > 0.0f)
        {
            float pitchKick = 1.0f + 1.5f * std::exp(-timeSec * 8.0f);
            double phaseInc = (2.0 * juce::MathConstants<double>::pi * (freq * 0.5f * pitchKick)) / sampleRate;
            hadesPhase += phaseInc;
            if (hadesPhase >= 2.0 * juce::MathConstants<double>::pi) hadesPhase -= 2.0 * juce::MathConstants<double>::pi;
            
            float sine = std::sin(hadesPhase);
            float dist = std::tanh(sine * 2.0f) * 0.8f;
            subMix += w[1] * dist;
        }
        
        // --- 2: Zeus (Snappy Click Sub) ---
        if (w[2] > 0.0f)
        {
            float clickAmp = std::exp(-timeSec * 45.0f);
            float clickNoise = (randomGen.nextFloat() * 2.0f - 1.0f) * clickAmp * 0.2f;
            
            double phaseInc = (2.0 * juce::MathConstants<double>::pi * (freq * 0.5f)) / sampleRate;
            zeusPhase += phaseInc;
            if (zeusPhase >= 2.0 * juce::MathConstants<double>::pi) zeusPhase -= 2.0 * juce::MathConstants<double>::pi;
            
            float sine = std::sin(zeusPhase);
            float saturated = std::tanh(sine * 1.3f);
            subMix += w[2] * (saturated + clickNoise);
        }
        
        // --- 3: Athena (Plucky Sub) ---
        if (w[3] > 0.0f)
        {
            double phaseInc = (2.0 * juce::MathConstants<double>::pi * (freq * 0.5f)) / sampleRate;
            athenaPhase += phaseInc;
            if (athenaPhase >= 2.0 * juce::MathConstants<double>::pi) athenaPhase -= 2.0 * juce::MathConstants<double>::pi;
            
            float pluckEnv = std::exp(-timeSec * 4.0f);
            float sine = std::sin(athenaPhase);
            subMix += w[3] * (sine * pluckEnv);
        }
        
        // --- 4: Poseidon (Warm LFO Sub) ---
        if (w[4] > 0.0f)
        {
            float wobble = 1.0f + 0.015f * poseidonLfoVal;
            double phaseInc = (2.0 * juce::MathConstants<double>::pi * (freq * 0.5f * wobble)) / sampleRate;
            poseidonPhase += phaseInc;
            if (poseidonPhase >= 2.0 * juce::MathConstants<double>::pi) poseidonPhase -= 2.0 * juce::MathConstants<double>::pi;
            
            float sine = std::sin(poseidonPhase);
            subMix += w[4] * sine;
        }
        
        // --- 5: Titan (Heavy LP Square) ---
        if (w[5] > 0.0f)
        {
            double phaseInc = (2.0 * juce::MathConstants<double>::pi * (freq * 0.5f)) / sampleRate;
            titanPhase += phaseInc;
            if (titanPhase >= 2.0 * juce::MathConstants<double>::pi) titanPhase -= 2.0 * juce::MathConstants<double>::pi;
            
            float sq = (titanPhase < juce::MathConstants<double>::pi) ? 1.0f : -1.0f;
            titanLpfState = 0.3f * sq + 0.7f * titanLpfState;
            subMix += w[5] * titanLpfState;
        }
        
        // --- 6: Apollo (Triangle Vibrato) ---
        if (w[6] > 0.0f)
        {
            float vibratoPhaseInc = (2.0f * juce::MathConstants<float>::pi * 6.0f) / static_cast<float>(sampleRate);
            apolloVibratoPhase += vibratoPhaseInc;
            if (apolloVibratoPhase >= 2.0f * juce::MathConstants<float>::pi) apolloVibratoPhase -= 2.0f * juce::MathConstants<float>::pi;
            
            float vib = 1.0f + 0.008f * std::sin(apolloVibratoPhase);
            double phaseInc = (2.0 * juce::MathConstants<double>::pi * (freq * 0.5f * vib)) / sampleRate;
            apolloPhase += phaseInc;
            if (apolloPhase >= 2.0 * juce::MathConstants<double>::pi) apolloPhase -= 2.0 * juce::MathConstants<double>::pi;
            
            float val = static_cast<float>(2.0 * (apolloPhase / (2.0 * juce::MathConstants<double>::pi)) - 1.0);
            float tri = 2.0f * std::abs(val) - 1.0f;
            subMix += w[6] * tri;
        }
        
        // --- 7: Chronos (Unstable Sub) ---
        if (w[7] > 0.0f)
        {
            float jitter = 1.0f + (randomGen.nextFloat() * 2.0f - 1.0f) * 0.006f;
            double phaseInc = (2.0 * juce::MathConstants<double>::pi * (freq * 0.5f * jitter)) / sampleRate;
            chronosPhase += phaseInc;
            if (chronosPhase >= 2.0 * juce::MathConstants<double>::pi) chronosPhase -= 2.0 * juce::MathConstants<double>::pi;
            
            float sine = std::sin(chronosPhase);
            float volJitter = 1.0f + (randomGen.nextFloat() * 2.0f - 1.0f) * 0.05f;
            subMix += w[7] * (sine * volJitter);
        }
        
        return subMix;
    }

    void process(juce::AudioBuffer<float>& buffer, int startSample, int numSamples, float pitchBend, float macroEnergyVal, float driftAmount, float poseidonDriftAmt,
                 float modCutoffVal, float modDecayVal, float modEnergyVal)
    {
        if (!active) return;

        updateFrequencies(pitchBend, driftAmount, numSamples);

        // Accumulate voice-specific modulations
        float voiceModCutoff = modCutoffVal;
        float voiceModDecay = modDecayVal;
        float voiceModEnergy = modEnergyVal;

        for (int slot = 0; slot < 4; ++slot)
        {
            if (modSources[slot] == 5 && modTargets[slot] != 0 && modAmounts[slot] != 0.0f)
            {
                float contribution = lastModEnv * modAmounts[slot];
                if (modTargets[slot] == 1) voiceModDecay += contribution;
                else if (modTargets[slot] == 2) voiceModCutoff += contribution;
                else if (modTargets[slot] == 4) voiceModEnergy += contribution;
            }
        }

        // Update ADSR parameters dynamically
        juce::ADSR::Parameters params;
        params.attack = blendedPreset.attack;
        params.decay = juce::jmax(0.01f, blendedPreset.decay + voiceModDecay * 3.0f); // Modulate decay up to ±3s
        params.sustain = blendedPreset.sustain;
        params.release = blendedPreset.release;
        envelope.setParameters(params);

        auto* left = buffer.getWritePointer(0);
        auto* right = buffer.getWritePointer(1);

        float finalMidi = static_cast<float>(midi) + pitchBend + mpePitchBend;
        float freqVal = 440.0f * std::pow(2.0f, (finalMidi - 69.0f) / 12.0f);
        freq = freqVal; // Update member freq

        float cutoff = blendedPreset.filterFreq;
        
        // Filter envelope modulation: shorter plucky sounds sweep down, pads stay open/smooth
        float envModAmt = 0.6f * (1.0f - juce::jmin(1.0f, blendedPreset.decay / 2.0f));
        // Add voiceModCutoff * 4000.0f (modulate up to ±4000Hz)
        float modulatedCutoff = cutoff * ((1.0f - envModAmt) + envModAmt * lastEnv) + (voiceModCutoff * 4000.0f);
        modulatedCutoff = juce::jlimit(20.0f, 20000.0f, modulatedCutoff);

        float filterQ = blendedPreset.filterQ;
        
        float energyNorm = macroEnergyVal / 100.0f;
        if (energyNorm > 0.0f)
        {
            modulatedCutoff = 1000.0f + energyNorm * 7000.0f;
            filterQ = 0.5f + energyNorm * 4.0f;
        }

        if (poseidonDriftAmt != 0.0f)
        {
            modulatedCutoff += poseidonDriftAmt;
        }

        updateFilters(modulatedCutoff, filterQ);

        // Update thermal drift slow-moving noise
        if (driftAmount > 0.0f)
        {
            driftNoiseTarget += (randomGen.nextFloat() * 2.0f - 1.0f) * 0.05f;
            driftNoiseTarget = juce::jlimit(-1.0f, 1.0f, driftNoiseTarget);
            voiceDrift += (driftNoiseTarget - voiceDrift) * 0.001f;
        }

        for (int i = 0; i < numSamples; ++i)
        {
            float env = envelope.getNextSample();
            lastEnv = env;

            float modEnvVal = modEnvelope.getNextSample();
            lastModEnv = modEnvVal;

            if (env <= 0.0f && !envelope.isActive())
            {
                active = false;
                midi = -1;
                break;
            }

            // 1. Process FM Modulator
            float modOut = modulatorOsc.process();
            
            // FM depth
            float totalEnergy = macroEnergyVal + voiceModEnergy * 50.0f;
            totalEnergy = juce::jlimit(0.0f, 100.0f, totalEnergy);
            float energyModScale = 0.5f + (totalEnergy / 100.0f) * 1.5f;
            float fmDepth = freq * blendedPreset.modIndex * currentVelocity * energyModScale;
            float phaseModVal = modOut * fmDepth * (2.0f * juce::MathConstants<float>::pi / static_cast<float>(sampleRate));

            // 2. Process Carrier with Phase Modulation
            float carrierOut = carrierOsc.processBlended(blendedPreset.carrierSine,
                                                         blendedPreset.carrierSquare,
                                                         blendedPreset.carrierSaw,
                                                         blendedPreset.carrierTriangle,
                                                         phaseModVal);

            // 3. Process Body
            float bodyOut = bodyOsc.processBlended(blendedPreset.bodySine,
                                                   blendedPreset.bodySquare,
                                                   blendedPreset.bodySaw,
                                                   blendedPreset.bodyTriangle);

            // 4. Process Sub
            float subOut = processSubBass(env, currentVelocity);

            // Mix carrier, body, sub
            float mixVal = carrierOut + bodyOut * blendedPreset.bodyGain + subOut * blendedPreset.subOscGain * (subGainMaster / 100.0f);
            
            // 5. Apply Voice Filter
            float lpOut = filterLP.processSingleSampleRaw(mixVal);
            float hpOut = filterHP.processSingleSampleRaw(mixVal);
            float bpOut = filterBP.processSingleSampleRaw(mixVal);
            float filteredVal = lpOut * blendedPreset.filterLP + hpOut * blendedPreset.filterHP + bpOut * blendedPreset.filterBP;

            // 6. Apply Amplitude Envelope, Velocity, and MPE Pressure
            float pressureGainScale = 0.6f + mpePressure * 0.4f;
            float finalOut = filteredVal * env * currentVelocity * pressureGainScale * 0.25f; // scale down for headroom

            // Apply Zeus transient exciter if active
            if (zeusTransientActive && zeusTransientSamplesLeft > 0)
            {
                float hpSample = finalOut - lastZeusSample;
                lastZeusSample = finalOut;
                float decayNorm = static_cast<float>(zeusTransientSamplesLeft) / (0.010f * sampleRate);
                float saturatedHp = std::tanh(hpSample * 4.0f) * 0.3f * decayNorm;
                finalOut += saturatedHp * blendedPreset.filterHP;
                
                --zeusTransientSamplesLeft;
                if (zeusTransientSamplesLeft == 0)
                    zeusTransientActive = false;
            }

            left[startSample + i] += finalOut;
            right[startSample + i] += finalOut;
        }
    }

    bool isActive() const { return active; }
    int getMidiNote() const { return midi; }
    uint32_t getStartTime() const { return startTime; }

    BlendedGodPreset blendedPreset;
    float poseidonLfoVal = 0.0f;
    float subGainMaster = 40.0f;

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
    juce::ADSR modEnvelope;
    juce::IIRFilter filterLP;
    juce::IIRFilter filterHP;
    juce::IIRFilter filterBP;
    GodVoicePreset preset;

    // Phase 7: Drift and Transient fields
    float voiceDrift = 0.0f;
    float driftNoiseTarget = 0.0f;
    juce::Random randomGen;
    
    bool zeusTransientActive = false;
    int zeusTransientSamplesLeft = 0;
    float lastZeusSample = 0.0f;

    // Phase 6: MPE parameters
    float mpePitchBend = 0.0f;
    float mpePressure = 0.0f;
    float mpeTimbre = 0.0f;
    int midiChannel = -1;

    // Hip-hop optimization additions (Phase 7 expansion)
    float vibratoPhase = 0.0f;
    float lastEnv = 0.0f;
    float lastModEnv = 0.0f;
    int modSources[4] = { 0 };
    int modTargets[4] = { 0 };
    float modAmounts[4] = { 0.0f };

    // Phase 8: Chthonic Sub accumulators
    double olympusPhase = 0.0;
    double hadesPhase = 0.0;
    double zeusPhase = 0.0;
    double athenaPhase = 0.0;
    double poseidonPhase = 0.0;
    double titanPhase = 0.0;
    double apolloPhase = 0.0;
    double chronosPhase = 0.0;
    float apolloVibratoPhase = 0.0f;
    float titanLpfState = 0.0f;
    int subSampleCount = 0;
    float freq = 440.0f;
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
        vortexWeights.fill(0.0f);
        vortexWeights[0] = 1.0f;
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
            useVortexMorph = false; // Reset morph mode
            
            // Apply preset to all voices
            for (auto& voice : voices)
                voice->applyPreset(currentGodPreset);
        }
    }

    void setVortexWeights(const std::array<float, 8>& weights, float driftAmt, float lfoVal)
    {
        vortexWeights = weights;
        driftAmount = driftAmt;
        poseidonLfo = lfoVal;
        useVortexMorph = true;
    }

    void setSubGain(float gain)
    {
        subGainParameter.store(gain, std::memory_order_relaxed);
    }

    void noteOn(int midiNumber, float velocity, int channel = 0)
    {
        PantheonVoice* voiceToUse = nullptr;
        // First check if there is already an active voice on this MPE channel
        for (auto& voice : voices)
        {
            if (voice->isActive() && voice->getMidiChannel() == channel)
            {
                voiceToUse = voice.get();
                break;
            }
        }

        if (voiceToUse == nullptr)
        {
            // Allocate a free voice
            for (auto& voice : voices)
            {
                if (!voice->isActive())
                {
                    voiceToUse = voice.get();
                    break;
                }
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
            if (useVortexMorph)
            {
                voiceToUse->blendedPreset = blendPresets(vortexWeights);
                juce::ADSR::Parameters params;
                params.attack = voiceToUse->blendedPreset.attack;
                params.decay = voiceToUse->blendedPreset.decay;
                params.sustain = voiceToUse->blendedPreset.sustain;
                params.release = voiceToUse->blendedPreset.release;
                voiceToUse->setEnvelopeParameters(params);
            }
            else
            {
                voiceToUse->applyPreset(currentGodPreset);
            }
            voiceToUse->noteOn(midiNumber, velocity, pitchBend, channel);
        }
    }

    void noteOff(int midiNumber, int channel = 0)
    {
        for (auto& voice : voices)
        {
            if (voice->isActive() && voice->getMidiNote() == midiNumber && voice->getMidiChannel() == channel)
            {
                voice->noteOff();
            }
        }
    }

    void setPitchBend(float pbVal)
    {
        // Global/Master pitch bend (non-MPE mode)
        // pbVal: -1.0 to 1.0 -> ±2 semitones
        pitchBend = pbVal * 2.0f;
    }

    void setMpePitchBend(int channel, float pbVal)
    {
        for (auto& voice : voices)
        {
            if (voice->isActive() && voice->getMidiChannel() == channel)
            {
                voice->setMpePitchBend(pbVal);
            }
        }
    }

    void setMpePressure(int channel, float pressureVal)
    {
        for (auto& voice : voices)
        {
            if (voice->isActive() && voice->getMidiChannel() == channel)
            {
                voice->setMpePressure(pressureVal);
            }
        }
    }

    void setMpeTimbre(int channel, float timbreVal)
    {
        for (auto& voice : voices)
        {
            if (voice->isActive() && voice->getMidiChannel() == channel)
            {
                voice->setMpeTimbre(timbreVal);
            }
        }
    }

    void process(juce::AudioBuffer<float>& buffer)
    {
        int numSamples = buffer.getNumSamples();
        
        // Temporary synth block
        juce::AudioBuffer<float> synthBuffer(2, numSamples);
        synthBuffer.clear();

        // Compute dynamic blended preset
        BlendedGodPreset blendedPreset;
        if (useVortexMorph)
        {
            blendedPreset = blendPresets(vortexWeights);
        }
        else
        {
            std::array<float, 8> weights = { 0.0f };
            weights[currentGodIndex] = 1.0f;
            blendedPreset = blendPresets(weights);
        }

        // 1. Process all active voices
        for (auto& voice : voices)
        {
            if (voice->isActive())
            {
                voice->blendedPreset = blendedPreset;
                voice->subGainMaster = subGainParameter.load(std::memory_order_relaxed);
                voice->poseidonLfoVal = poseidonLfo;
                
                // Poseidon filter width drift:
                float poseidonDriftAmt = 0.0f;
                if (useVortexMorph)
                {
                    poseidonDriftAmt = driftAmount * vortexWeights[4] * poseidonLfo * 1500.0f;
                }
                
                voice->setModMatrixSlots(modSources, modTargets, modAmounts);
                voice->process(synthBuffer, 0, numSamples, pitchBend, macroEnergy.load(std::memory_order_relaxed), driftAmount, poseidonDriftAmt,
                               globalModCutoff, globalModDecay, globalModEnergy);
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
        float satDrive = blendedPreset.satDrive * (1.0f + energyNorm * 4.0f);
        float satMix = blendedPreset.satMix * (1.0f - realmNorm * 0.4f) + (realmNorm * realmNorm * 0.4f);

        // Chorus rate/depth/mix
        float chorusRate = blendedPreset.chorusRate * (0.8f + divinityNorm * 0.8f);
        float chorusDepth = blendedPreset.chorusDepth * (0.5f + divinityNorm * 1.5f);
        float chorusMix = blendedPreset.chorusMix * (0.5f + widthNorm);

        // Delay feedback/mix
        float delayTime = blendedPreset.delayTime;
        float delayFeedback = blendedPreset.delayFeedback;
        float delayMix = blendedPreset.delayMix * (0.1f + realmNorm * 0.5f * 1.5f);

        // Reverb mix/decay
        float reverbDecay = blendedPreset.reverbDecay;
        float reverbMix = blendedPreset.reverbMix * (0.5f + divinityNorm) * (0.1f + realmNorm * 0.5f * 2.0f);

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
            float sideGain = 0.2f + widthNorm * 0.8f;
            float midGain = 1.0f - widthNorm * 0.3f;
            
            float mid = (l + r) * 0.5f;
            float side = (l - r) * 0.5f;
            
            mid *= midGain;
            side *= sideGain;
            
            l = mid + side;
            r = mid - side;

            left[i] = l;
            right[i] = r;
        }

        // 3. Accumulate to host output buffer
        buffer.addFrom(0, 0, synthBuffer.getReadPointer(0), numSamples);
        if (buffer.getNumChannels() > 1)
        {
            buffer.addFrom(1, 0, synthBuffer.getReadPointer(1), numSamples);
        }
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

    void setModMatrixSlots(const int* sources, const int* targets, const float* amounts)
    {
        for (int i = 0; i < 4; ++i)
        {
            modSources[i] = sources[i];
            modTargets[i] = targets[i];
            modAmounts[i] = amounts[i];
        }
    }

    void setGlobalModulations(float decay, float cutoff, float warmth, float energy)
    {
        globalModDecay = decay;
        globalModCutoff = cutoff;
        globalModWarmth = warmth;
        globalModEnergy = energy;
    }

    void setModEnvelopeParameters(float attack, float decay, float sustain, float release)
    {
        juce::ADSR::Parameters params;
        params.attack = juce::jmax(0.001f, attack / 100.0f * 4.0f);
        params.decay = juce::jmax(0.01f, decay / 100.0f * 5.0f);
        params.sustain = sustain / 100.0f;
        params.release = juce::jmax(0.01f, release / 100.0f * 8.0f);

        for (auto& voice : voices)
        {
            voice->setModEnvelopeParameters(params);
        }
    }

    float getAverageModEnvelopeValue() const
    {
        float sum = 0.0f;
        int activeCount = 0;
        for (const auto& voice : voices)
        {
            if (voice->isActive())
            {
                sum += voice->getLastModEnvValue();
                activeCount++;
            }
        }
        return activeCount > 0 ? (sum / static_cast<float>(activeCount)) : 0.0f;
    }

private:
    double sampleRate = 44100.0;
    int currentGodIndex = 0;
    GodVoicePreset currentGodPreset;
    
    std::vector<std::unique_ptr<PantheonVoice>> voices;
    float pitchBend = 0.0f;
    
    int modSources[4] = { 0 };
    int modTargets[4] = { 0 };
    float modAmounts[4] = { 0.0f };

    float globalModDecay = 0.0f;
    float globalModCutoff = 0.0f;
    float globalModWarmth = 0.0f;
    float globalModEnergy = 0.0f;

    // Phase 7: Vortex Weight Morphing
    std::array<float, 8> vortexWeights;
    bool useVortexMorph = false;
    float driftAmount = 0.1f;
    float poseidonLfo = 0.0f;

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
    std::atomic<float> subGainParameter { 40.0f };
};
