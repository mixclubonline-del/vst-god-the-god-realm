#pragma once

#include <JuceHeader.h>

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
        auto& body = filterChain.get<bodyIndex>();
        body.setType(juce::dsp::IIR::ArrayCoefficients<float>::makeLowShelf(44100.0, 200.0f, 0.707f, 1.0f));

        auto& soul = filterChain.get<soulIndex>();
        soul.setType(juce::dsp::IIR::ArrayCoefficients<float>::makePeakFilter(44100.0, 1000.0f, 0.707f, 1.0f));

        auto& air = filterChain.get<airIndex>();
        air.setType(juce::dsp::IIR::ArrayCoefficients<float>::makeHighShelf(44100.0, 8000.0f, 0.707f, 1.0f));
    }

    void prepare(const juce::dsp::ProcessSpec& spec)
    {
        sampleRate = spec.sampleRate;
        
        filterChain.prepare(spec);
        limiter.prepare(spec);
        
        // Initial parameters
        updateEQ(0.0f, 0.0f, 0.0f);
        
        limiter.setThreshold(-0.5f);
        limiter.setRelease(100.0f);
        limiter.setRatio(20.0f);
        limiter.setAttack(1.0f);
    }

    void process(juce::dsp::ProcessContextReplacing<float>& context)
    {
        auto& buffer = context.getOutputBlock();
        
        // 1. Input Gain & Saturation Stage
        for (size_t channel = 0; channel < buffer.getNumChannels(); ++channel)
        {
            auto* samples = buffer.getChannelPointer(channel);
            for (size_t i = 0; i < buffer.getNumSamples(); ++i)
            {
                float x = samples[i] * inputGain;
                
                // --- Core Velvet Saturation ---
                float driveScaled = drive * (1.0f + silk * 0.1f);
                float y = (2.0f / juce::MathConstants<float>::pi) * std::atan(x * driveScaled);
                
                // --- Silk Stage (Even Harmonics) ---
                if (silk > 0.0f)
                {
                    float silkHarmonic = silk * 0.08f * std::sin(juce::MathConstants<float>::pi * y * 0.5f);
                    y += silkHarmonic * (1.0f - std::abs(y));
                }
                
                samples[i] = y;
            }
        }

        // 2. Four Anchors EQ Stage
        filterChain.process(context);

        // 3. Dynamics Stage
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
                
                // Apply final volume
                samples[i] *= outputGain;
            }
        }
    }

    void setInputGain(float gainDb) { inputGain = juce::Decibels::decibelsToGain(gainDb); }
    void setDrive(float driveVal) { drive = 1.0f + (driveVal / 25.0f); } // Map 0-100 to 1-5 approx
    void setSilk(float silkVal) { silk = silkVal / 100.0f; } // Map 0-100 to 0-1
    
    void updateEQ(float bodyGain, float soulGain, float airGain)
    {
        auto& body = filterChain.get<bodyIndex>();
        *body.state = *juce::dsp::IIR::Coefficients<float>::makeLowShelf(sampleRate, 200.0f, 0.707f, juce::Decibels::decibelsToGain(bodyGain));

        auto& soul = filterChain.get<soulIndex>();
        *soul.state = *juce::dsp::IIR::Coefficients<float>::makePeakFilter(sampleRate, 1000.0f, 0.707f, juce::Decibels::decibelsToGain(soulGain));

        auto& air = filterChain.get<airIndex>();
        *air.state = *juce::dsp::IIR::Coefficients<float>::makeHighShelf(sampleRate, 8000.0f, 0.707f, juce::Decibels::decibelsToGain(airGain));
    }

    void setLimiterThreshold(float thresholdDb) { limiter.setThreshold(thresholdDb); }
    void setLimiterAttack(float attackMs) { limiter.setAttack(attackMs); }
    void setLimiterRelease(float releaseMs) { limiter.setRelease(releaseMs); }
    void setLimiterRatio(float ratio) { limiter.setRatio(ratio); }
    
    void setOutputGain(float volumeDb) { outputGain = juce::Decibels::decibelsToGain(volumeDb); }

private:
    double sampleRate = 44100.0;
    float inputGain = 1.0f;
    float drive = 1.0f;
    float silk = 0.5f;
    float outputGain = 1.0f;

    using Filter = juce::dsp::IIR::Filter<float>;
    using FilterCoefs = juce::dsp::IIR::Coefficients<float>;

    enum
    {
        bodyIndex,
        soulIndex,
        airIndex
    };

    juce::dsp::ProcessorChain<juce::dsp::ProcessorDuplicator<Filter, FilterCoefs>,
                             juce::dsp::ProcessorDuplicator<Filter, FilterCoefs>,
                             juce::dsp::ProcessorDuplicator<Filter, FilterCoefs>> filterChain;

    juce::dsp::Limiter<float> limiter;
};
