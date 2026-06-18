#pragma once

#include <JuceHeader.h>
#include "DivineHeatSaturator.h"

/**
 * VelvetCurve — The God Realm proprietary mastering DSP chain.
 * Ports the high-fidelity JS prototype to native C++.
 */
class VelvetCurve
{
public:
    VelvetCurve() 
    {
        // Initialize filters
        auto& cold = filterChain.get<coldIndex>();
        cold.state = juce::dsp::IIR::Coefficients<float>::makeLowShelf(44100.0, 40.0f, 0.707f, 1.0f);

        auto& body = filterChain.get<bodyIndex>();
        body.state = juce::dsp::IIR::Coefficients<float>::makeLowShelf(44100.0, 200.0f, 0.707f, 1.0f);

        auto& soul = filterChain.get<soulIndex>();
        soul.state = juce::dsp::IIR::Coefficients<float>::makePeakFilter(44100.0, 1000.0f, 0.707f, 1.0f);

        auto& air = filterChain.get<airIndex>();
        air.state = juce::dsp::IIR::Coefficients<float>::makeHighShelf(44100.0, 8000.0f, 0.707f, 1.0f);
    }

    void prepare(const juce::dsp::ProcessSpec& spec)
    {
        sampleRate = spec.sampleRate;
        
        filterChain.prepare(spec);
        compressor.prepare(spec);
        limiter.prepare(spec);
        heatSaturator.prepare(spec);
        
        // Initial parameters
        updateEQ(0.0f, 0.0f, 0.0f);
        
        // Compressor defaults (dynamics shaping)
        compressor.setThreshold(-12.0f);
        compressor.setRatio(2.0f);
        compressor.setAttack(30.0f);
        compressor.setRelease(100.0f);
        
        // Limiter as ceiling protector
        limiter.setThreshold(-0.1f);
        limiter.setRelease(50.0f);
    }

    void process(juce::dsp::ProcessContextReplacing<float>& context)
    {
        auto& buffer = context.getOutputBlock();
        
        // Apply input gain
        buffer.multiplyBy(inputGain);
        
        // 1. Oversampled Tape Saturation Stage (Divine Heat)
        juce::dsp::AudioBlock<float> block(buffer);
        heatSaturator.process(block);

        // 2. Four Anchors EQ Stage (Cold Extension + Body + Soul + Air)
        filterChain.process(context);

        // 3. Dynamics Stage — Compressor then Limiter
        compressor.process(context);
        limiter.process(context);

        // 4. Soft Clipping Stage (Final Ceiling Protection)
        for (size_t channel = 0; channel < buffer.getNumChannels(); ++channel)
        {
            auto* samples = buffer.getChannelPointer(channel);
            for (size_t i = 0; i < buffer.getNumSamples(); ++i)
            {
                float x = samples[i];
                float absX = std::abs(x);
                float threshold = 0.85f;
                float softCeiling = 0.98f;
                
                if (absX > threshold)
                {
                    float val = threshold + (softCeiling - threshold) * std::tanh((absX - threshold) / (softCeiling - threshold));
                    samples[i] = x > 0 ? val : -val;
                }
            }
        }

        // 5. Stereo Width & Imager Stage (M/S Processing)
        if (buffer.getNumChannels() >= 2)
        {
            auto* left  = buffer.getChannelPointer(0);
            auto* right = buffer.getChannelPointer(1);
            for (size_t i = 0; i < buffer.getNumSamples(); ++i)
            {
                float mid  = (left[i] + right[i]) * 0.5f;
                float side = (left[i] - right[i]) * 0.5f;
                side *= widthFactor;           // scale side signal
                side += mid * imagerShift;     // imager: push mid energy into side
                left[i]  = (mid + side) * outputGain;
                right[i] = (mid - side) * outputGain;
            }
        }
        else
        {
            // Mono: just apply output gain
            auto* samples = buffer.getChannelPointer(0);
            for (size_t i = 0; i < buffer.getNumSamples(); ++i)
                samples[i] *= outputGain;
        }
    }

    void setHeatParameters(float driveVal, float bias, float warmth, float crunch)
    {
        // Map 0-100 masterDrive slider to -12dB to +24dB range
        float driveDb = -12.0f + (driveVal / 100.0f) * 36.0f;
        heatSaturator.setParameters(driveDb, bias, warmth, crunch);
    }
    
    void updateEQ(float bodyGain, float soulGain, float airGain)
    {
        auto& body = filterChain.get<bodyIndex>();
        *body.state = *juce::dsp::IIR::Coefficients<float>::makeLowShelf(sampleRate, 200.0f, 0.707f, juce::Decibels::decibelsToGain(bodyGain));

        auto& soul = filterChain.get<soulIndex>();
        *soul.state = *juce::dsp::IIR::Coefficients<float>::makePeakFilter(sampleRate, 1000.0f, 0.707f, juce::Decibels::decibelsToGain(soulGain));

        auto& air = filterChain.get<airIndex>();
        *air.state = *juce::dsp::IIR::Coefficients<float>::makeHighShelf(sampleRate, 8000.0f, 0.707f, juce::Decibels::decibelsToGain(airGain));
    }

    // ─── Cold Extension ───
    void setColdExtension(float coldVal)
    {
        // Map 0–100 → 0–12dB low-shelf boost at 40Hz
        // Q increases with gain for a tighter, more focused sub extension
        float gainDb = coldVal * 0.12f;  // 0–12dB
        float q = 0.707f + coldVal * 0.005f;  // 0.707–1.207
        auto& cold = filterChain.get<coldIndex>();
        *cold.state = *juce::dsp::IIR::Coefficients<float>::makeLowShelf(
            sampleRate, 40.0f, q, juce::Decibels::decibelsToGain(gainDb));
    }

    // ─── Compressor (replaces limiter no-ops) ───
    void setCompressorThreshold(float thresholdDb) { compressor.setThreshold(thresholdDb); }
    void setCompressorAttack(float attackMs) { compressor.setAttack(attackMs); }
    void setCompressorRelease(float releaseMs) { compressor.setRelease(releaseMs); }
    void setCompressorRatio(float ratio) { compressor.setRatio(ratio); }

    // ─── Limiter (ceiling protector) ───
    void setLimiterThreshold(float thresholdDb) { limiter.setThreshold(thresholdDb); }
    void setLimiterRelease(float releaseMs) { limiter.setRelease(releaseMs); }
    
    // ─── Stereo Width & Imager ───
    void setWidth(float widthPercent) { widthFactor = widthPercent / 100.0f; }  // 0–200 → 0.0–2.0
    void setImager(float imagerVal) { imagerShift = imagerVal * 0.25f; }        // -1..+1 → ±0.25
    
    void setOutputGain(float volumeDb) { outputGain = juce::Decibels::decibelsToGain(volumeDb); }
    void setInputGain(float gainDb) { inputGain = juce::Decibels::decibelsToGain(gainDb); }

private:
    double sampleRate = 44100.0;
    float inputGain = 1.0f;
    float outputGain = 1.0f;
    float widthFactor = 1.0f;   // 1.0 = no change (100%)
    float imagerShift = 0.0f;   // 0 = off, ±0.25 = subtle shift

    using Filter = juce::dsp::IIR::Filter<float>;
    using FilterCoefs = juce::dsp::IIR::Coefficients<float>;

    enum
    {
        coldIndex,   // Cold Extension (40Hz sub-bass shelf)
        bodyIndex,   // Body (200Hz low shelf)
        soulIndex,   // Soul (1kHz peak)
        airIndex     // Air (8kHz high shelf)
    };

    juce::dsp::ProcessorChain<juce::dsp::ProcessorDuplicator<Filter, FilterCoefs>,   // Cold
                             juce::dsp::ProcessorDuplicator<Filter, FilterCoefs>,   // Body
                             juce::dsp::ProcessorDuplicator<Filter, FilterCoefs>,   // Soul
                             juce::dsp::ProcessorDuplicator<Filter, FilterCoefs>>   // Air
    filterChain;

    juce::dsp::Compressor<float> compressor;  // Dynamics shaping (attack, ratio, threshold)
    juce::dsp::Limiter<float> limiter;        // Ceiling protector (safety net)
    DivineHeatSaturator heatSaturator;
};
