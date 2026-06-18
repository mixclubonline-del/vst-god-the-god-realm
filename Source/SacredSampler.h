#pragma once

#include <JuceHeader.h>

/**
 * SacredSampler — A high-performance sample playback engine for the God Realm.
 * Handles slice-accurate triggers, pitch shifting, and ADSR-style decay.
 */
class SacredSamplerVoice
{
public:
    SacredSamplerVoice() {}

    void updateTextureFilter(float textureVal)
    {
        float blendedVal = textureVal + poseidonFilterDrift;
        float normalized = juce::jlimit(0.0f, 100.0f, blendedVal) / 100.0f;
        float cutoffHz = 200.0f * std::pow(100.0f, normalized); // 200–20000
        cutoffHz = juce::jmin(cutoffHz, static_cast<float>(outputSampleRate * 0.49));
        lpfCoeff = std::exp(-2.0f * juce::MathConstants<float>::pi * cutoffHz
                            / static_cast<float>(outputSampleRate));
    }

    void setTexture(float textureVal)
    {
        baseTextureVal = textureVal;
        updateTextureFilter(baseTextureVal + textureModulationOffset);
    }

    void setModulations(float decayMod, float textureMod)
    {
        decayModulationOffset = decayMod;
        textureModulationOffset = textureMod;
        updateTextureFilter(baseTextureVal + textureModulationOffset);
    }

    void setPoseidonDrift(float startDrift, float filterDrift)
    {
        poseidonStartDrift = startDrift;
        poseidonFilterDrift = filterDrift;
    }

    void setSample(std::shared_ptr<juce::AudioBuffer<float>> buffer, double sampleRate)
    {
        originalBuffer = buffer;
        sourceSampleRate = sampleRate;
    }

    static int findNearestZeroCrossing(const float* channelData, int targetSample, int searchWindow, int totalSamples)
    {
        if (totalSamples <= 0) return targetSample;
        targetSample = juce::jlimit(0, totalSamples - 1, targetSample);

        int bestSample = targetSample;
        float minVal = std::abs(channelData[targetSample]);
        bool foundSignChange = false;

        // Search outwards from targetSample
        for (int offset = 0; offset <= searchWindow; ++offset)
        {
            // Check right
            int rightIdx = targetSample + offset;
            if (rightIdx < totalSamples - 1)
            {
                bool isSignChange = (channelData[rightIdx] >= 0.0f && channelData[rightIdx + 1] < 0.0f) ||
                                    (channelData[rightIdx] < 0.0f && channelData[rightIdx + 1] >= 0.0f);
                if (isSignChange)
                {
                    float val1 = std::abs(channelData[rightIdx]);
                    float val2 = std::abs(channelData[rightIdx + 1]);
                    int bestIdx = (val1 < val2) ? rightIdx : (rightIdx + 1);
                    float bestAmp = std::min(val1, val2);

                    if (!foundSignChange || bestAmp < minVal)
                    {
                        minVal = bestAmp;
                        bestSample = bestIdx;
                        foundSignChange = true;
                    }
                }
            }

            // Check left
            int leftIdx = targetSample - offset;
            if (leftIdx > 0 && leftIdx < totalSamples)
            {
                bool isSignChange = (channelData[leftIdx] >= 0.0f && channelData[leftIdx - 1] < 0.0f) ||
                                    (channelData[leftIdx] < 0.0f && channelData[leftIdx - 1] >= 0.0f);
                if (isSignChange)
                {
                    float val1 = std::abs(channelData[leftIdx]);
                    float val2 = std::abs(channelData[leftIdx - 1]);
                    int bestIdx = (val1 < val2) ? leftIdx : (leftIdx - 1);
                    float bestAmp = std::min(val1, val2);

                    if (!foundSignChange || bestAmp < minVal)
                    {
                        minVal = bestAmp;
                        bestSample = bestIdx;
                        foundSignChange = true;
                    }
                }
            }

            if (foundSignChange && offset > 20)
            {
                break;
            }
        }

        // Fallback: search for absolute minimum if no sign change was found
        if (!foundSignChange)
        {
            for (int offset = 1; offset <= searchWindow; ++offset)
            {
                int rightIdx = targetSample + offset;
                if (rightIdx < totalSamples)
                {
                    float val = std::abs(channelData[rightIdx]);
                    if (val < minVal)
                    {
                        minVal = val;
                        bestSample = rightIdx;
                    }
                }
                int leftIdx = targetSample - offset;
                if (leftIdx >= 0)
                {
                    float val = std::abs(channelData[leftIdx]);
                    if (val < minVal)
                    {
                        minVal = val;
                        bestSample = leftIdx;
                    }
                }
            }
        }

        return bestSample;
    }

    void setGlideParameters(bool enabled, float timeMs, int curveType, bool legatoRetrigVal)
    {
        glideEnabled = enabled;
        glideTimeMs = timeMs;
        glideCurveType = curveType;
        legatoRetrig = legatoRetrigVal;
    }

    void trigger(float velocity, float pitch, float pan, float decay, float startNorm, float endNorm, bool reverse,
                 bool snapToZero, bool snapToTransient, const std::vector<float>* transients,
                 int retrigRate = 0, int samplesPer16th = 0, int microOffsetSamples = 0)
    {
        if (!originalBuffer) return;

        bool isLegatoOverlap = active;

        currentVelocity = velocity;
        currentPan = pan;
        currentReverse = reverse;
        currentRetrigRate = retrigRate;
        currentSamplesPer16th = samplesPer16th;
        
        if (isLegatoOverlap && glideEnabled && glideTimeMs > 0.0f)
        {
            gliding = true;
            startPitch = currentPitch;
            targetPitch = pitch;
            glideProgress = 0.0f;
            float glideSamples = (glideTimeMs / 1000.0f) * (float)outputSampleRate;
            glideIncrement = 1.0f / (glideSamples > 0.0f ? glideSamples : 1.0f);
        }
        else
        {
            gliding = false;
            currentPitch = pitch;
        }

        int numSamples = originalBuffer->getNumSamples();

        if (!isLegatoOverlap || legatoRetrig)
        {
            // Apply Poseidon start drift modulation
            startNorm += poseidonStartDrift;
            startNorm = juce::jlimit(0.0f, 1.0f, startNorm);

            // 1. Transient Snapping: Adjust startNorm to nearest transient
            if (snapToTransient && transients != nullptr && !transients->empty())
            {
                float nearestTransient = startNorm;
                float minDistance = 1.0f;
                for (float t : *transients)
                {
                    float dist = std::abs(t - startNorm);
                    if (dist < minDistance)
                    {
                        minDistance = dist;
                        nearestTransient = t;
                    }
                }
                if (minDistance < 0.05f)
                {
                    startNorm = nearestTransient;
                }
            }

            // Calculate start and end samples
            int targetStartSample = static_cast<int>(startNorm * numSamples);
            int targetEndSample = static_cast<int>(endNorm * numSamples);

            // 2. Zero-Crossing Snapping: Adjust start sample to nearest crossing
            if (snapToZero)
            {
                const float* channelData = originalBuffer->getReadPointer(0);
                targetStartSample = findNearestZeroCrossing(channelData, targetStartSample, 500, numSamples);
            }

            startSample = targetStartSample;
            endSample = targetEndSample;
            
            if (currentReverse)
            {
                currentIndex = static_cast<double>(endSample);
            }
            else
            {
                currentIndex = static_cast<double>(startSample);
            }

            // Reset texture filter state
            lpfStateL = 0.0f;
            lpfStateR = 0.0f;
            
            // Setup decay (simple linear ramp for now)
            triggeredDecay = decay;
            envelopeValue = 1.0f;
            float decaySeconds = 0.05f + decay * 2.0f;
            samplesToLive = static_cast<int>(decaySeconds * outputSampleRate);
            samplesProcessed = 0;
            retrigSampleCounter = 0;

            // Micro-timing offset
            pendingOffsetSamples = juce::jmax(0, microOffsetSamples);
            // Negative offsets: advance the playback index (trigger earlier in sample)
            if (microOffsetSamples < 0)
            {
                double offsetShift = static_cast<double>(-microOffsetSamples)
                    * std::pow(2.0f, pitch / 12.0f)
                    * (sourceSampleRate / outputSampleRate);
                if (currentReverse)
                    currentIndex += offsetShift;
                else
                    currentIndex = juce::jmax(static_cast<double>(startSample), currentIndex - offsetShift);
            }
        }

        active = true;
    }

    void process(juce::AudioBuffer<float>& outputBuffer, int startSampleInOutput, int numSamples)
    {
        if (!active || !originalBuffer) return;

        // Update texture filter coefficients dynamically for LFO drift
        updateTextureFilter(baseTextureVal + textureModulationOffset);

        // Handle positive micro-timing (delay trigger by N samples)
        if (pendingOffsetSamples > 0)
        {
            int skip = juce::jmin(pendingOffsetSamples, numSamples);
            pendingOffsetSamples -= skip;
            startSampleInOutput += skip;
            numSamples -= skip;
            if (numSamples <= 0) return;
        }

        float playbackRate = 1.0f;
        if (!gliding)
        {
            playbackRate = std::pow(2.0f, currentPitch / 12.0f) * (float)(sourceSampleRate / outputSampleRate);
        }
        
        auto* leftOut = outputBuffer.getWritePointer(0, startSampleInOutput);
        auto* rightOut = outputBuffer.getNumChannels() > 1 ? outputBuffer.getWritePointer(1, startSampleInOutput) : nullptr;
        
        auto* leftIn = originalBuffer->getReadPointer(0);
        auto* rightIn = originalBuffer->getNumChannels() > 1 ? originalBuffer->getReadPointer(1) : nullptr;

        int retrigInterval = (currentRetrigRate > 1 && currentSamplesPer16th > 0) 
                             ? (currentSamplesPer16th / currentRetrigRate) 
                             : 0;

        for (int i = 0; i < numSamples; ++i)
        {
            // ─── Pitch Glide logic per-sample ───
            if (gliding)
            {
                glideProgress += glideIncrement;
                if (glideProgress >= 1.0f)
                {
                    glideProgress = 1.0f;
                    gliding = false;
                    currentPitch = targetPitch;
                }
                else
                {
                    float t = glideProgress;
                    if (glideCurveType == 1) // Exponential
                    {
                        t = t * t;
                    }
                    else if (glideCurveType == 2) // Logarithmic
                    {
                        t = 1.0f - (1.0f - t) * (1.0f - t);
                    }
                    else if (glideCurveType == 3) // Sigmoid
                    {
                        t = 0.5f - 0.5f * std::cos(t * juce::MathConstants<float>::pi);
                    }
                    // Linear is glideCurveType == 0, so t = glideProgress
                    
                    currentPitch = startPitch + t * (targetPitch - startPitch);
                }
                playbackRate = std::pow(2.0f, currentPitch / 12.0f) * (float)(sourceSampleRate / outputSampleRate);
            }

            // Handle Retriggering
            if (retrigInterval > 0)
            {
                retrigSampleCounter++;
                if (retrigSampleCounter >= retrigInterval)
                {
                    retrigSampleCounter = 0;
                    currentIndex = currentReverse ? static_cast<double>(endSample) : static_cast<double>(startSample);
                    samplesProcessed = 0; // Reset envelope too? Usually yes for retrigs
                    envelopeValue = 1.0f;
                }
            }

            if (envelopeValue <= 0.0f)
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
                float sR = rightIn != nullptr ? rightIn[idx] : sL;

                if (nextIdx >= 0 && nextIdx < originalBuffer->getNumSamples())
                {
                    float nL = leftIn[nextIdx];
                    float nR = rightIn != nullptr ? rightIn[nextIdx] : nL;
                    sL = sL + fraction * (nL - sL);
                    sR = sR + fraction * (nR - sR);
                }

                // Apply Texture (one-pole LPF)
                lpfStateL = lpfCoeff * lpfStateL + (1.0f - lpfCoeff) * sL;
                lpfStateR = lpfCoeff * lpfStateR + (1.0f - lpfCoeff) * sR;
                sL = lpfStateL;
                sR = lpfStateR;

                // Apply Envelope
                float env = envelopeValue;
                float gain = env * currentVelocity * 0.35f; // Scale down for headroom to prevent blowing out

                // Apply Pan
                float panL = std::cos((currentPan + 1.0f) * juce::MathConstants<float>::pi * 0.25f);
                float panR = std::sin((currentPan + 1.0f) * juce::MathConstants<float>::pi * 0.25f);

                leftOut[i] += sL * gain * panL;
                if (rightOut != nullptr)
                {
                    rightOut[i] += sR * gain * panR;
                }
                else
                {
                    leftOut[i] += sR * gain * panR; // Downmix R panned component to mono output
                }
            }

            if (currentReverse)
                currentIndex -= playbackRate;
            else
                currentIndex += playbackRate;

            samplesProcessed++;
            
            // Decrement envelopeValue using modulated decay
            {
                float decayModulated = triggeredDecay + decayModulationOffset;
                decayModulated = juce::jlimit(0.0f, 1.0f, decayModulated);
                float decaySeconds = 0.05f + decayModulated * 2.0f;
                float currentSamplesToLive = decaySeconds * outputSampleRate;
                float decrement = 1.0f / (currentSamplesToLive > 0.0f ? currentSamplesToLive : 1.0f);
                envelopeValue = juce::jmax(0.0f, envelopeValue - decrement);
            }
        }
    }

    void setOutputSampleRate(double sr) { outputSampleRate = sr; }
    bool isActive() const { return active; }
    float getLastVelocity() const { return currentVelocity; }
    bool hasSample() const { return originalBuffer != nullptr; }
    int getSamplesProcessed() const { return samplesProcessed; }
    int getAssociatedTrackIdx() const { return associatedTrackIdx; }
    void setAssociatedTrackIdx(int trackIdx) { associatedTrackIdx = trackIdx; }

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

    // Texture filter (one-pole LPF)
    float lpfCoeff = 0.0f;     // 0 = fully open, →1 = very dark
    float lpfStateL = 0.0f;
    float lpfStateR = 0.0f;

    // Micro-timing offset
    int pendingOffsetSamples = 0;

    // Glide parameters
    bool glideEnabled = false;
    float glideTimeMs = 100.0f;
    int glideCurveType = 1;
    bool legatoRetrig = false;

    // Glide runtime state
    bool gliding = false;
    float startPitch = 0.0f;
    float targetPitch = 0.0f;
    float glideProgress = 0.0f;
    float glideIncrement = 0.0f;

    // Phase 6: Modulation fields
    float baseTextureVal = 40.0f;
    float triggeredDecay = 0.5f;
    float decayModulationOffset = 0.0f;
    float textureModulationOffset = 0.0f;
    float envelopeValue = 1.0f;

    // Phase 7: Poseidon Drift fields
    float poseidonStartDrift = 0.0f;
    float poseidonFilterDrift = 0.0f;

    int associatedTrackIdx = -1;
};

class SacredSamplerEngine
{
public:
    SacredSamplerEngine() 
    {
        for (int i = 0; i < 24; ++i)
            voices.emplace_back(std::make_unique<SacredSamplerVoice>());
        tempBuffer.setSize(2, 4096);
    }

    void prepare(double sampleRate)
    {
        for (auto& voice : voices)
            voice->setOutputSampleRate(sampleRate);
        tempBuffer.setSize(2, 4096);
    }

    void setSample(int trackIdx, std::shared_ptr<juce::AudioBuffer<float>> buffer, double sampleRate)
    {
        if (trackIdx >= 0 && trackIdx < 8)
        {
            trackBuffers[trackIdx] = buffer;
            trackSampleRates[trackIdx] = sampleRate;
        }
    }

    void trigger(int trackIdx, float velocity, float pitch, float pan, float decay, float startNorm, float endNorm, bool reverse,
                 bool snapToZero, bool snapToTransient, const std::vector<float>& transients,
                 int retrigRate = 0, int samplesPer16th = 0, int microOffsetSamples = 0)
    {
        if (trackIdx >= 0 && trackIdx < 8)
        {
            auto* voice = findFreeVoice(trackIdx);
            if (voice != nullptr)
            {
                // Synchronize sample/buffer info dynamically to voice
                voice->setSample(trackBuffers[trackIdx], trackSampleRates[trackIdx]);
                voice->setAssociatedTrackIdx(trackIdx);
                
                // Synchronize cached parameters to this voice
                voice->setTexture(trackTextureVals[trackIdx]);
                voice->setGlideParameters(trackGlideEnabled[trackIdx], trackGlideTimeMs[trackIdx], trackGlideCurveType[trackIdx], trackLegatoRetrig[trackIdx]);
                voice->setModulations(trackDecayMods[trackIdx], trackTextureMods[trackIdx]);
                
                // Trigger the voice
                voice->trigger(velocity, pitch, pan, decay, startNorm, endNorm, reverse,
                               snapToZero, snapToTransient, &transients,
                               retrigRate, samplesPer16th, microOffsetSamples);
            }
        }
    }

    void setTexture(int trackIdx, float textureVal)
    {
        if (trackIdx >= 0 && trackIdx < 8)
        {
            trackTextureVals[trackIdx] = textureVal;
            for (auto& voice : voices)
            {
                if (voice->isActive() && voice->getAssociatedTrackIdx() == trackIdx)
                    voice->setTexture(textureVal);
            }
        }
    }

    void setGlideParameters(int trackIdx, bool enabled, float timeMs, int curveType, bool retrigger)
    {
        if (trackIdx >= 0 && trackIdx < 8)
        {
            trackGlideEnabled[trackIdx] = enabled;
            trackGlideTimeMs[trackIdx] = timeMs;
            trackGlideCurveType[trackIdx] = curveType;
            trackLegatoRetrig[trackIdx] = retrigger;
            for (auto& voice : voices)
            {
                if (voice->isActive() && voice->getAssociatedTrackIdx() == trackIdx)
                    voice->setGlideParameters(enabled, timeMs, curveType, retrigger);
            }
        }
    }

    void setModulations(int trackIdx, float decayMod, float textureMod)
    {
        if (trackIdx >= 0 && trackIdx < 8)
        {
            trackDecayMods[trackIdx] = decayMod;
            trackTextureMods[trackIdx] = textureMod;
            for (auto& voice : voices)
            {
                if (voice->isActive() && voice->getAssociatedTrackIdx() == trackIdx)
                    voice->setModulations(decayMod, textureMod);
            }
        }
    }

    void setPoseidonDrift(float startDrift, float filterDrift)
    {
        for (auto& voice : voices)
            voice->setPoseidonDrift(startDrift, filterDrift);
    }

    void process(juce::AudioBuffer<float>& buffer)
    {
        for (auto& voice : voices)
        {
            if (voice->isActive())
                voice->process(buffer, 0, buffer.getNumSamples());
        }
    }

    void processTrack(int trackIdx, juce::AudioBuffer<float>& destinationBuffer)
    {
        if (trackIdx >= 0 && trackIdx < 8)
        {
            int numSamples = destinationBuffer.getNumSamples();
            if (tempBuffer.getNumSamples() < numSamples)
            {
                tempBuffer.setSize(2, numSamples, false, true, true);
            }
            tempBuffer.clear();

            bool hasActiveVoices = false;
            for (auto& voice : voices)
            {
                if (voice->isActive() && voice->getAssociatedTrackIdx() == trackIdx)
                {
                    voice->process(tempBuffer, 0, numSamples);
                    hasActiveVoices = true;
                }
            }

            if (hasActiveVoices)
            {
                // Soft clipping / gain limiting on track-level summing
                int numChannels = destinationBuffer.getNumChannels();
                for (int ch = 0; ch < numChannels; ++ch)
                {
                    auto* data = tempBuffer.getWritePointer(ch);
                    for (int i = 0; i < numSamples; ++i)
                    {
                        // Soft clipper: f(x) = x / (1.0f + |x|)
                        float x = data[i];
                        data[i] = x / (1.0f + std::abs(x));
                    }
                }

                // Add to output destination
                for (int ch = 0; ch < numChannels; ++ch)
                {
                    destinationBuffer.addFrom(ch, 0, tempBuffer, ch, 0, numSamples);
                }
            }
        }
    }

    bool isTrackActive(int trackIdx) const
    {
        if (trackIdx >= 0 && trackIdx < 8)
        {
            for (auto& voice : voices)
            {
                if (voice->isActive() && voice->getAssociatedTrackIdx() == trackIdx)
                    return true;
            }
        }
        return false;
    }

    float getTrackVelocity(int trackIdx) const
    {
        float maxVelocity = 0.0f;
        if (trackIdx >= 0 && trackIdx < 8)
        {
            for (auto& voice : voices)
            {
                if (voice->isActive() && voice->getAssociatedTrackIdx() == trackIdx)
                {
                    maxVelocity = std::max(maxVelocity, voice->getLastVelocity());
                }
            }
        }
        return maxVelocity;
    }

    bool hasSample(int trackIdx) const
    {
        if (trackIdx >= 0 && trackIdx < 8)
            return trackBuffers[trackIdx] != nullptr;
        return false;
    }

    static constexpr int kMaxVoicesPerTrack = 6;

private:
    SacredSamplerVoice* findFreeVoice(int requestingTrack = -1)
    {
        // 1. Look for an inactive voice
        for (auto& voice : voices)
        {
            if (!voice->isActive())
                return voice.get();
        }

        // 2. Per-track voice limit: if the requesting track already has
        //    kMaxVoicesPerTrack active, steal its oldest voice first
        if (requestingTrack >= 0)
        {
            int trackVoiceCount = 0;
            SacredSamplerVoice* oldestSameTrack = nullptr;
            int maxSameTrackSamples = -1;

            for (auto& voice : voices)
            {
                if (voice->isActive() && voice->getAssociatedTrackIdx() == requestingTrack)
                {
                    ++trackVoiceCount;
                    if (voice->getSamplesProcessed() > maxSameTrackSamples)
                    {
                        maxSameTrackSamples = voice->getSamplesProcessed();
                        oldestSameTrack = voice.get();
                    }
                }
            }

            if (trackVoiceCount >= kMaxVoicesPerTrack && oldestSameTrack != nullptr)
                return oldestSameTrack;
        }

        // 3. Global fallback: steal the oldest active voice across all tracks
        SacredSamplerVoice* oldestVoice = nullptr;
        int maxSamples = -1;
        for (auto& voice : voices)
        {
            if (voice->isActive() && voice->getSamplesProcessed() > maxSamples)
            {
                maxSamples = voice->getSamplesProcessed();
                oldestVoice = voice.get();
            }
        }
        return oldestVoice;
    }

    std::vector<std::unique_ptr<SacredSamplerVoice>> voices;
    juce::AudioBuffer<float> tempBuffer; // Real-time safe temporary buffer

    // Caches for track configurations
    std::shared_ptr<juce::AudioBuffer<float>> trackBuffers[8] = { nullptr };
    double trackSampleRates[8] = { 44100.0 };
    float trackTextureVals[8] = { 40.0f };
    float trackDecayMods[8] = { 0.0f };
    float trackTextureMods[8] = { 0.0f };

    bool trackGlideEnabled[8] = { false };
    float trackGlideTimeMs[8] = { 100.0f };
    int trackGlideCurveType[8] = { 1 };
    bool trackLegatoRetrig[8] = { false };
};
