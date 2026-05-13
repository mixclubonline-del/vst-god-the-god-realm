#pragma once

#include <JuceHeader.h>

/**
 * SacredSampler — A high-performance sample playback engine for the God Realm.
 * Handles slice-accurate triggers, pitch shifting, and ADSR-style decay.
 */
class SamplerVoice
{
public:
    SamplerVoice() {}

    void setSample(std::shared_ptr<juce::AudioBuffer<float>> buffer, double sampleRate)
    {
        originalBuffer = buffer;
        sourceSampleRate = sampleRate;
    }

    void trigger(float velocity, float pitch, float pan, float decay, float startNorm, float endNorm, bool reverse, int retrigRate = 0, int samplesPer16th = 0)
    {
        if (!originalBuffer) return;

        currentVelocity = velocity;
        currentPitch = pitch;
        currentPan = pan;
        currentReverse = reverse;
        currentRetrigRate = retrigRate;
        currentSamplesPer16th = samplesPer16th;
        retrigSampleCounter = 0;
        
        // Calculate start and end samples
        int numSamples = originalBuffer->getNumSamples();
        startSample = static_cast<int>(startNorm * numSamples);
        endSample = static_cast<int>(endNorm * numSamples);
        
        if (currentReverse)
        {
            currentIndex = static_cast<double>(endSample);
        }
        else
        {
            currentIndex = static_cast<double>(startSample);
        }

        active = true;
        
        // Setup decay (simple linear ramp for now)
        float decaySeconds = 0.05f + decay * 2.0f;
        samplesToLive = static_cast<int>(decaySeconds * outputSampleRate);
        samplesProcessed = 0;
    }

    void process(juce::AudioBuffer<float>& outputBuffer, int startSampleInOutput, int numSamples)
    {
        if (!active || !originalBuffer) return;

        float playbackRate = std::pow(2.0f, currentPitch / 12.0f) * (float)(sourceSampleRate / outputSampleRate);
        
        auto* leftOut = outputBuffer.getWritePointer(0, startSampleInOutput);
        auto* rightOut = outputBuffer.getWritePointer(1, startSampleInOutput);
        
        auto* leftIn = originalBuffer->getReadPointer(0);
        auto* rightIn = originalBuffer->getReadPointer(1);

        int retrigInterval = (currentRetrigRate > 1 && currentSamplesPer16th > 0) 
                             ? (currentSamplesPer16th / currentRetrigRate) 
                             : 0;

        for (int i = 0; i < numSamples; ++i)
        {
            // Handle Retriggering
            if (retrigInterval > 0)
            {
                retrigSampleCounter++;
                if (retrigSampleCounter >= retrigInterval)
                {
                    retrigSampleCounter = 0;
                    currentIndex = currentReverse ? static_cast<double>(endSample) : static_cast<double>(startSample);
                    samplesProcessed = 0; // Reset envelope too? Usually yes for retrigs
                }
            }

            if (samplesProcessed >= samplesToLive)
            {
                // If we are retriggering, we don't necessarily want to kill the voice if it finishes before the next retrig
                // but for now let's keep it simple.
                active = false;
                break;
            }

            int idx = static_cast<int>(currentIndex);
            if (idx < 0 || idx >= originalBuffer->getNumSamples() || (currentReverse && idx < startSample) || (!currentReverse && idx > endSample))
            {
                // If retrig is active, we might wait for the next retrig instead of deactivating
                if (retrigInterval == 0)
                {
                    active = false;
                    break;
                }
                // Otherwise just output silence until next retrig
            }
            else
            {
                // Simple linear interpolation
                int nextIdx = currentReverse ? idx - 1 : idx + 1;
                float fraction = static_cast<float>(currentIndex - idx);
                
                float sL = leftIn[idx];
                float sR = originalBuffer->getNumChannels() > 1 ? rightIn[idx] : sL;

                if (nextIdx >= 0 && nextIdx < originalBuffer->getNumSamples())
                {
                    float nL = leftIn[nextIdx];
                    float nR = originalBuffer->getNumChannels() > 1 ? rightIn[nextIdx] : nL;
                    sL = sL + fraction * (nL - sL);
                    sR = sR + fraction * (nR - sR);
                }

                // Apply Envelope
                float env = 1.0f - (static_cast<float>(samplesProcessed) / samplesToLive);
                float gain = env * currentVelocity;

                // Apply Pan
                float panL = std::cos((currentPan + 1.0f) * juce::MathConstants<float>::pi * 0.25f);
                float panR = std::sin((currentPan + 1.0f) * juce::MathConstants<float>::pi * 0.25f);

                leftOut[i] += sL * gain * panL;
                rightOut[i] += sR * gain * panR;
            }

            if (currentReverse)
                currentIndex -= playbackRate;
            else
                currentIndex += playbackRate;

            samplesProcessed++;
        }
    }

    void setOutputSampleRate(double sr) { outputSampleRate = sr; }
    bool isActive() const { return active; }
    float getLastVelocity() const { return currentVelocity; }

private:
    std::shared_ptr<juce::AudioBuffer<float>> originalBuffer;
    double sourceSampleRate = 44100.0;
    double outputSampleRate = 44100.0;
    double currentIndex = 0;
    
    int startSample = 0;
    int endSample = 0;
    bool currentReverse = false;

    float currentVelocity = 1.0f;
    float currentPitch = 0.0f;
    float currentPan = 0.0f;
    
    int samplesToLive = 0;
    int samplesProcessed = 0;
    bool active = false;

    int currentRetrigRate = 0;
    int currentSamplesPer16th = 0;
    int retrigSampleCounter = 0;
};

class SamplerEngine
{
public:
    SamplerEngine() 
    {
        for (int i = 0; i < 8; ++i)
            voices.emplace_back(std::make_unique<SamplerVoice>());
    }

    void prepare(double sampleRate)
    {
        for (auto& voice : voices)
            voice->setOutputSampleRate(sampleRate);
    }

    void setSample(int trackIdx, std::shared_ptr<juce::AudioBuffer<float>> buffer, double sampleRate)
    {
        if (trackIdx >= 0 && trackIdx < 8)
            voices[trackIdx]->setSample(buffer, sampleRate);
    }

    void trigger(int trackIdx, float velocity, float pitch, float pan, float decay, float startNorm, float endNorm, bool reverse, int retrigRate = 0, int samplesPer16th = 0)
    {
        if (trackIdx >= 0 && trackIdx < 8)
            voices[trackIdx]->trigger(velocity, pitch, pan, decay, startNorm, endNorm, reverse, retrigRate, samplesPer16th);
    }

    void process(juce::AudioBuffer<float>& buffer)
    {
        for (auto& voice : voices)
        {
            if (voice->isActive())
                voice->process(buffer, 0, buffer.getNumSamples());
        }
    }

    bool isTrackActive(int trackIdx) const
    {
        if (trackIdx >= 0 && trackIdx < 8)
            return voices[trackIdx]->isActive();
        return false;
    }

    float getTrackVelocity(int trackIdx) const
    {
        if (trackIdx >= 0 && trackIdx < 8)
            return voices[trackIdx]->getLastVelocity();
        return 0.0f;
    }

private:
    std::vector<std::unique_ptr<SamplerVoice>> voices;
};
