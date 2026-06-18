#pragma once
#include <JuceHeader.h>

class DivineHeatSaturator
{
public:
    DivineHeatSaturator() {}

    void prepare(const juce::dsp::ProcessSpec& spec)
    {
        sampleRate = spec.sampleRate;
        
        // 4x oversampling (2 stages of 2x) to reject high-frequency distortion aliasing
        oversampler = std::make_unique<juce::dsp::Oversampling<float>>(
            spec.numChannels, 
            2, 
            juce::dsp::Oversampling<float>::filterHalfBandPolyphaseIIR,
            true, // transient response compensation
            true  // double precision
        );
        oversampler->initProcessing(spec.maximumBlockSize);

        // Configure pre-emphasis and de-emphasis filters
        juce::dsp::ProcessSpec oversampledSpec = spec;
        oversampledSpec.sampleRate = spec.sampleRate * 4.0;
        oversampledSpec.maximumBlockSize = spec.maximumBlockSize * 4;
        
        preEmphasisFilter.prepare(oversampledSpec);
        postDeemphasisFilter.prepare(oversampledSpec);
        
        updateFilters();
    }

    void reset()
    {
        if (oversampler != nullptr)
            oversampler->reset();
            
        preEmphasisFilter.reset();
        postDeemphasisFilter.reset();
    }

    void setParameters(float driveDb, float bias, float warmth, float crunch)
    {
        driveGain = juce::Decibels::decibelsToGain(driveDb);
        biasOffset.store(bias, std::memory_order_relaxed);
        warmthFactor.store(warmth, std::memory_order_relaxed);
        crunchFactor.store(crunch, std::memory_order_relaxed);
        
        updateFilters();
    }

    void process(juce::dsp::AudioBlock<float>& block)
    {
        if (oversampler == nullptr) return;

        // 1. Upsample block to 4x sample rate
        auto oversampledBlock = oversampler->processSamplesUp(block);
        juce::dsp::ProcessContextReplacing<float> oversampledContext(oversampledBlock);
        
        // 2. Pre-emphasis High Boost (increases saturation of highs)
        preEmphasisFilter.process(oversampledContext);

        float currentBias = biasOffset.load(std::memory_order_relaxed);
        float currentCrunch = crunchFactor.load(std::memory_order_relaxed);

        const auto numChannels = oversampledBlock.getNumChannels();
        const auto numSamples = oversampledBlock.getNumSamples();

        // 3. Nonlinear Waveshaping Stage
        for (size_t channel = 0; channel < numChannels; ++channel)
        {
            auto* samples = oversampledBlock.getChannelPointer(channel);
            for (size_t i = 0; i < numSamples; ++i)
            {
                float x = samples[i] * driveGain;
                float biasedX = x + currentBias;

                // Waveshaping: tanh + polynomial distortion blend
                float sat = std::tanh(biasedX);
                float y = sat;

                if (currentCrunch > 0.0f)
                {
                    // Polynomial soft clipper introducing third harmonics
                    float poly = biasedX - (currentCrunch * 0.0015f) * (biasedX * biasedX * biasedX);
                    y = sat * (1.0f - currentCrunch * 0.01f) + poly * (currentCrunch * 0.01f);
                }

                // Hard clamp for absolute ceiling safety
                samples[i] = juce::jlimit(-1.0f, 1.0f, y);
            }
        }

        // 4. De-emphasis High Cut (restores frequency balance)
        postDeemphasisFilter.process(oversampledContext);

        // 5. Downsample back to host sample rate
        oversampler->processSamplesDown(block);
    }

private:
    void updateFilters()
    {
        float currentWarmth = warmthFactor.load(std::memory_order_relaxed);
        float boostDb = currentWarmth * 0.08f; // Up to 8dB boost/cut at 4kHz
        
        double oversampledSampleRate = sampleRate * 4.0;
        
        *preEmphasisFilter.state = *juce::dsp::IIR::Coefficients<float>::makeHighShelf(
            oversampledSampleRate, 4000.0f, 0.707f, juce::Decibels::decibelsToGain(boostDb));
            
        *postDeemphasisFilter.state = *juce::dsp::IIR::Coefficients<float>::makeHighShelf(
            oversampledSampleRate, 4000.0f, 0.707f, juce::Decibels::decibelsToGain(-boostDb));
    }

    double sampleRate = 44100.0;
    float driveGain = 1.0f;
    std::atomic<float> biasOffset{ 0.0f };
    std::atomic<float> warmthFactor{ 0.0f };
    std::atomic<float> crunchFactor{ 0.0f };

    std::unique_ptr<juce::dsp::Oversampling<float>> oversampler;
    
    using Filter = juce::dsp::IIR::Filter<float>;
    using FilterCoefs = juce::dsp::IIR::Coefficients<float>;
    
    juce::dsp::ProcessorDuplicator<Filter, FilterCoefs> preEmphasisFilter;
    juce::dsp::ProcessorDuplicator<Filter, FilterCoefs> postDeemphasisFilter;
};
