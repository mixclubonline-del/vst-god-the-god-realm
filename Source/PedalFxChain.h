#pragma once

#include <JuceHeader.h>
#include <array>
#include <cmath>

/**
 * PedalFxChain — native C++ mirror of the JS PedalChain (PedalRealm tab).
 *
 * Eight pedals wired in series: each is a simple in-place DSP effect with
 * an enabled flag and param setters. The chain processes the entire plugin
 * output buffer, identical in behaviour to the Web Audio implementation.
 *
 * Signal order (matches JS PEDAL_ORDER):
 *   OVERTONE → LOFREQ → CHORUS → TREM → TIMEWARP → BACKTRACK → ECHOFLUX → RETROVERB
 *
 * How to use:
 *   1. Call prepare() in prepareToPlay().
 *   2. Call process() in processBlock() if active.
 *   3. Call setPedalEnabled() / setPedalParam() from message-thread handlers.
 */
class PedalFxChain
{
public:
    // ── Types ────────────────────────────────────────────────────────────────

    static constexpr int kMaxDelaySamples = 192000 * 3; // 3 s at 192 kHz

    // ── Prepare / Reset ──────────────────────────────────────────────────────

    void prepare (double sampleRate, int /*blockSize*/)
    {
        sr = sampleRate;

        overtone.prepare (sr);
        lofreq.prepare   (sr);
        chorus.prepare   (sr);
        trem.prepare     (sr);
        timewarp.prepare (sr);
        backtrack.prepare (sr);
        echoflux.prepare (sr);
        retroverb.prepare (sr);
    }

    // ── Master switch ────────────────────────────────────────────────────────

    void setActive (bool on) { active = on; }
    bool isActive() const { return active; }

    // ── Parameter routing ────────────────────────────────────────────────────

    /** @param id   0=overtone 1=lofreq 2=chorus 3=trem 4=timewarp 5=backtrack 6=echoflux 7=retroverb */
    void setPedalEnabled (int id, bool on)
    {
        switch (id) {
            case 0: overtone.enabled  = on; break;
            case 1: lofreq.enabled    = on; break;
            case 2: chorus.enabled    = on; break;
            case 3: trem.enabled      = on; break;
            case 4: timewarp.enabled  = on; break;
            case 5: backtrack.enabled = on; break;
            case 6: echoflux.enabled  = on; break;
            case 7: retroverb.enabled = on; break;
            default: break;
        }
    }

    void setPedalParam (int id, const juce::String& key, float value)
    {
        switch (id) {
            case 0: overtone.setParam  (key, value); break;
            case 1: lofreq.setParam    (key, value); break;
            case 2: chorus.setParam    (key, value); break;
            case 3: trem.setParam      (key, value); break;
            case 4: timewarp.setParam  (key, value); break;
            case 5: backtrack.setParam (key, value); break;
            case 6: echoflux.setParam  (key, value); break;
            case 7: retroverb.setParam (key, value); break;
            default: break;
        }
    }

    // ── Main process ─────────────────────────────────────────────────────────

    void process (juce::AudioBuffer<float>& buffer)
    {
        if (!active) return;

        auto* L = buffer.getWritePointer (0);
        auto* R = buffer.getNumChannels() > 1 ? buffer.getWritePointer (1) : L;
        const int N = buffer.getNumSamples();

        overtone.process  (L, R, N);
        lofreq.process    (L, R, N);
        chorus.process    (L, R, N);
        trem.process      (L, R, N);
        timewarp.process  (L, R, N);
        backtrack.process (L, R, N);
        echoflux.process  (L, R, N);
        retroverb.process (L, R, N);
    }

private:
    double sr = 44100.0;
    bool active = false;

    // ─────────────────────────────────────────────────────────────────────────
    // Utility: one-pole low-pass filter state
    struct OnePole {
        float state = 0;
        float coeff = 0;
        void setHz (float hz, double sampleRate) {
            coeff = std::exp (-juce::MathConstants<float>::twoPi * hz / (float)sampleRate);
        }
        float tick (float x) { return state = state * coeff + x * (1.f - coeff); }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Delay line utility
    struct DelayLine {
        std::vector<float> buf;
        int write = 0;

        void prepare (int maxSamples) {
            buf.assign (maxSamples, 0.f);
            write = 0;
        }

        void push (float s) {
            buf[write] = s;
            if (++write >= (int)buf.size()) write = 0;
        }

        float read (float delaySamples) const {
            float fIdx = (float)write - delaySamples - 1.f;
            int i0 = (int)fIdx; float frac = fIdx - (float)i0;
            int sz = (int)buf.size();
            i0 = ((i0 % sz) + sz) % sz;
            int i1 = (i0 + 1) % sz;
            return buf[i0] + frac * (buf[i1] - buf[i0]);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Soft-clip waveshaper (inline for performance)
    static float softSat (float x, float drive)
    {
        float k = std::max (0.0001f, drive);
        return (1.f + k) * x / (1.f + k * std::abs (x));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ── OVERTONE — soft-clip saturation ─────────────────────────────────────
    struct Overtone {
        bool enabled = false;
        float drive = 8.f, mix = 1.f, toneHz = 8000.f;
        OnePole lpL, lpR;

        void prepare (double sr) { lpL.setHz (toneHz, sr); lpR.setHz (toneHz, sr); }

        void setParam (const juce::String& k, float v) {
            if (k == "drive") drive = v;
            else if (k == "mix") mix = v / 100.f;
            else if (k == "tone" || k == "freq") toneHz = 400.f + (v / 100.f) * 11000.f;
        }

        void process (float* L, float* R, int N) {
            if (!enabled) return;
            const float preGain = 0.5f + drive / 20.f;
            for (int i = 0; i < N; ++i) {
                float wL = lpL.tick (softSat (L[i] * preGain, drive));
                float wR = lpR.tick (softSat (R[i] * preGain, drive));
                L[i] = L[i] * (1.f - mix) + wL * mix;
                R[i] = R[i] * (1.f - mix) + wR * mix;
            }
        }
    } overtone;

    // ─────────────────────────────────────────────────────────────────────────
    // ── LOFREQ — bit crush + low-pass ─────────────────────────────────────
    struct LoFreq {
        bool enabled = false;
        float bits = 8.f, mix = 1.f;
        OnePole lpL, lpR;
        double sampleRate = 44100;

        void prepare (double sr) { sampleRate = sr; lpL.setHz (12000.f, sr); lpR.setHz (12000.f, sr); }

        void setParam (const juce::String& k, float v) {
            if (k == "bits" || k == "drive") bits = std::max (1.f, 16.f - (v / 100.f) * 14.f);
            else if (k == "frequency") { float hz = 500.f + (v / 100.f) * 16000.f; lpL.setHz (hz, sampleRate); lpR.setHz (hz, sampleRate); }
            else if (k == "mix") mix = v / 100.f;
        }

        float crush (float x) {
            float steps = std::pow (2.f, bits);
            return std::round (x * steps) / steps;
        }

        void process (float* L, float* R, int N) {
            if (!enabled) return;
            for (int i = 0; i < N; ++i) {
                float wL = lpL.tick (crush (L[i]));
                float wR = lpR.tick (crush (R[i]));
                L[i] = L[i] * (1.f - mix) + wL * mix;
                R[i] = R[i] * (1.f - mix) + wR * mix;
            }
        }
    } lofreq;

    // ─────────────────────────────────────────────────────────────────────────
    // ── CHORUS — stereo modulated delay ────────────────────────────────────
    struct Chorus {
        bool enabled = false;
        float mix = 0.5f;
        DelayLine d1L, d1R, d2L, d2R;
        double sr = 44100;
        float lfo1Phase = 0, lfo2Phase = 0;
        float lfo1Rate = 1.2f, lfo2Rate = 1.6f;
        float depth = 0.004f;
        float baseDelay1 = 0.018f, baseDelay2 = 0.025f;

        void prepare (double sampleRate) {
            sr = sampleRate;
            int mx = (int)(sampleRate * 0.06);
            d1L.prepare (mx); d1R.prepare (mx);
            d2L.prepare (mx); d2R.prepare (mx);
        }

        void setParam (const juce::String& k, float v) {
            if (k == "rate")    { lfo1Rate = 0.1f + (v/100.f)*6; lfo2Rate = 0.15f + (v/100.f)*7; }
            else if (k == "depth") depth = (v/100.f) * 0.01f;
            else if (k == "mix")   mix = v / 100.f;
            else if (k == "vibrato") baseDelay1 = 0.005f + (v/100.f)*0.03f;
        }

        void process (float* L, float* R, int N) {
            const float twoPi = juce::MathConstants<float>::twoPi;
            const float inc1 = lfo1Rate / (float)sr;
            const float inc2 = lfo2Rate / (float)sr;

            for (int i = 0; i < N; ++i) {
                lfo1Phase += inc1; if (lfo1Phase >= 1.f) lfo1Phase -= 1.f;
                lfo2Phase += inc2; if (lfo2Phase >= 1.f) lfo2Phase -= 1.f;

                float mod1 = std::sin (lfo1Phase * twoPi) * depth;
                float mod2 = std::sin (lfo2Phase * twoPi) * depth;
                float ds1 = (baseDelay1 + mod1) * (float)sr;
                float ds2 = (baseDelay2 + mod2) * (float)sr;

                d1L.push (L[i]); d1R.push (R[i]);
                d2L.push (L[i]); d2R.push (R[i]);

                float wetL = (d1L.read (ds1) + d2L.read (ds2)) * 0.5f;
                float wetR = (d1R.read (ds1) + d2R.read (ds2)) * 0.5f;

                if (enabled) { L[i] += wetL * mix; R[i] += wetR * mix; }
            }
        }
    } chorus;

    // ─────────────────────────────────────────────────────────────────────────
    // ── TREM — amplitude LFO ────────────────────────────────────────────────
    struct Trem {
        bool enabled = false;
        float rate = 5.f, depth = 0.5f;
        bool square = false;
        float phase = 0;
        double sr = 44100;

        void prepare (double sampleRate) { sr = sampleRate; }

        void setParam (const juce::String& k, float v) {
            if (k == "rate")  rate  = 0.1f + (v/100.f) * 18.f;
            else if (k == "depth") depth = v / 100.f;
            else if (k == "shape") square = (v > 50.f);
        }

        void process (float* L, float* R, int N) {
            if (!enabled) return;
            const float inc = rate / (float)sr;
            for (int i = 0; i < N; ++i) {
                phase += inc; if (phase >= 1.f) phase -= 1.f;
                float lfo = square ? (phase < 0.5f ? 1.f : -1.f)
                                   : std::sin (phase * juce::MathConstants<float>::twoPi);
                float gain = 1.f - depth * 0.5f + lfo * depth * 0.5f;
                L[i] *= gain; R[i] *= gain;
            }
        }
    } trem;

    // ─────────────────────────────────────────────────────────────────────────
    // ── TIMEWARP — tape delay with wow/flutter ───────────────────────────────
    struct TimeWarp {
        bool enabled = false;
        float mix = 0.4f, feedback = 0.35f;
        DelayLine dlL, dlR;
        float delaySamples = 0;
        double sr = 44100;
        float wowPhase = 0, wowRate = 0.6f, flutter = 0.0008f;
        OnePole lpL, lpR;

        void prepare (double sampleRate) {
            sr = sampleRate;
            delaySamples = 0.375f * (float)sampleRate;
            int mx = (int)(sampleRate * 2.2);
            dlL.prepare (mx); dlR.prepare (mx);
            lpL.setHz (4500.f, sampleRate); lpR.setHz (4500.f, sampleRate);
        }

        void setParam (const juce::String& k, float v) {
            if (k == "time" || k == "capture") delaySamples = (0.05f + (v/100.f)*1.2f) * (float)sr;
            else if (k == "flux" || k == "feedback") feedback = (v/100.f) * 0.92f;
            else if (k == "flutter") flutter = (v/100.f) * 0.003f;
            else if (k == "drift" || k == "slower") wowRate = 0.1f + (v/100.f) * 3.f;
            else if (k == "mix") mix = v / 100.f;
        }

        void process (float* L, float* R, int N) {
            const float inc = wowRate / (float)sr;
            for (int i = 0; i < N; ++i) {
                wowPhase += inc; if (wowPhase >= 1.f) wowPhase -= 1.f;
                float wow = std::sin (wowPhase * juce::MathConstants<float>::twoPi) * flutter * (float)sr;
                float ds = juce::jmax (1.f, delaySamples + wow);

                float dL = dlL.read (ds);
                float dR = dlR.read (ds);
                float satL = lpL.tick (softSat (dL, 2.f));
                float satR = lpR.tick (softSat (dR, 2.f));

                dlL.push (L[i] + satL * feedback);
                dlR.push (R[i] + satR * feedback);

                if (enabled) { L[i] += satL * mix; R[i] += satR * mix; }
                else         { dlL.push (0.f);      dlR.push (0.f); } // still advance when bypassed
            }
        }
    } timewarp;

    // ─────────────────────────────────────────────────────────────────────────
    // ── BACKTRACK — reverse-style swell delay ───────────────────────────────
    struct Backtrack {
        bool enabled = false;
        float mix = 0.5f, feedback = 0.4f, width = 0.7f;
        DelayLine dlL, dlR;
        float delaySamples = 0;
        double sr = 44100;
        float lfoPhase = 0, lfoRate = 2.f;

        void prepare (double sampleRate) {
            sr = sampleRate;
            delaySamples = 0.25f * (float)sampleRate;
            int mx = (int)(sampleRate * 1.2);
            dlL.prepare (mx); dlR.prepare (mx);
        }

        void setParam (const juce::String& k, float v) {
            if (k == "pitch" || k == "speed") lfoRate = 0.5f + (v/100.f) * 8.f;
            else if (k == "forward" || k == "feedback") feedback = (v/100.f) * 0.9f;
            else if (k == "mix") mix = v / 100.f;
            else if (k == "width") width = 0.2f + (v/100.f) * 0.8f;
        }

        void process (float* L, float* R, int N) {
            const float inc = lfoRate / (float)sr;
            for (int i = 0; i < N; ++i) {
                lfoPhase += inc; if (lfoPhase >= 1.f) lfoPhase -= 1.f;
                // Sawtooth swell: 0..1 amplitude envelope on the delayed signal
                float swell = lfoPhase * width;
                float dL = dlL.read (delaySamples) * swell;
                float dR = dlR.read (delaySamples) * swell;

                dlL.push (L[i] + dL * feedback);
                dlR.push (R[i] + dR * feedback);

                if (enabled) { L[i] += dL * mix; R[i] += dR * mix; }
            }
        }
    } backtrack;

    // ─────────────────────────────────────────────────────────────────────────
    // ── ECHOFLUX — echo / delay with feedback + tone + freeze ───────────────
    struct EchoFlux {
        bool enabled = false;
        float mix = 0.45f, feedback = 0.4f;
        DelayLine dlL, dlR;
        float delaySamples = 0;
        double sr = 44100;
        bool frozen = false;
        float savedFeedback = 0.4f;
        OnePole hpL, hpR;

        void prepare (double sampleRate) {
            sr = sampleRate;
            delaySamples = 0.3f * (float)sampleRate;
            int mx = (int)(sampleRate * 2.2);
            dlL.prepare (mx); dlR.prepare (mx);
            hpL.setHz (120.f, sampleRate); hpR.setHz (120.f, sampleRate);
        }

        void setParam (const juce::String& k, float v) {
            if (k == "time" || k == "speed") delaySamples = (0.02f + (v/100.f)*1.5f) * (float)sr;
            else if (k == "feedback") { savedFeedback = (v/100.f)*0.95f; if (!frozen) feedback = savedFeedback; }
            else if (k == "mix") mix = v / 100.f;
            else if (k == "freeze") { frozen = (v > 50.f); feedback = frozen ? 1.0f : savedFeedback; }
        }

        void process (float* L, float* R, int N) {
            for (int i = 0; i < N; ++i) {
                float dL = dlL.read (delaySamples);
                float dR = dlR.read (delaySamples);
                // Highpass in feedback path (tone control)
                float hL = dL - hpL.tick (dL);
                float hR = dR - hpR.tick (dR);

                dlL.push (L[i] + hL * feedback);
                dlR.push (R[i] + hR * feedback);

                if (enabled) { L[i] += hL * mix; R[i] += hR * mix; }
            }
        }
    } echoflux;

    // ─────────────────────────────────────────────────────────────────────────
    // ── RETROVERB — algorithmic reverb (FDN-lite: 8 all-pass + 4 combs) ─────
    struct RetroVerb {
        bool enabled = false;
        float mix = 0.35f;
        double sr = 44100;
        float decayTime = 2.5f, bright = 0.5f;

        // 4 comb filters (L/R)
        static constexpr int kNumCombs = 4;
        static constexpr int kCombDelays[kNumCombs] = { 1557, 1617, 1491, 1422 };
        std::array<DelayLine, kNumCombs> combL, combR;
        std::array<OnePole,  kNumCombs> combLpL, combLpR;

        // 2 allpass
        static constexpr int kNumAP = 2;
        static constexpr int kApDelays[kNumAP] = { 225, 341 };
        std::array<DelayLine, kNumAP> apL, apR;

        float predelay = 0.f; // seconds
        DelayLine preL, preR;

        void prepare (double sampleRate) {
            sr = sampleRate;
            for (int i = 0; i < kNumCombs; ++i) {
                combL[i].prepare ((int)(kCombDelays[i] * sampleRate / 44100 + 1));
                combR[i].prepare ((int)(kCombDelays[i] * sampleRate / 44100 * 1.02f + 1));
                combLpL[i].setHz (4000.f * bright + 200.f, sampleRate);
                combLpR[i].setHz (4000.f * bright + 200.f, sampleRate);
            }
            for (int i = 0; i < kNumAP; ++i) {
                apL[i].prepare ((int)(kApDelays[i] * sampleRate / 44100 + 1));
                apR[i].prepare ((int)(kApDelays[i] * sampleRate / 44100 * 1.01f + 1));
            }
            preL.prepare ((int)(0.3 * sampleRate + 2));
            preR.prepare ((int)(0.3 * sampleRate + 2));
        }

        void setParam (const juce::String& k, float v) {
            if (k == "time")    decayTime = 0.3f + (v/100.f) * 5.5f;
            else if (k == "predelay" || k == "pre delay") predelay = (v/100.f) * 0.2f;
            else if (k == "mix")    mix = v / 100.f;
            else if (k == "drift")  decayTime = 1.f + (v/100.f) * 3.f;
            else if (k == "unstable") {
                bright = v / 100.f;
                float lpHz = 400.f + bright * 7600.f;
                for (int i = 0; i < kNumCombs; ++i) {
                    combLpL[i].setHz (lpHz, sr);
                    combLpR[i].setHz (lpHz, sr);
                }
            }
        }

        float combFeedback (int i) const {
            // g = exp(-3 * delaySamples / (decayTime * sr))
            float delaySec = (float)kCombDelays[i] / 44100.f;
            return std::exp (-3.f * delaySec / std::max (0.01f, decayTime));
        }

        void process (float* L, float* R, int N) {
            for (int i = 0; i < N; ++i) {
                // Pre-delay
                float pds = predelay * (float)sr;
                preL.push (L[i]); preR.push (R[i]);
                float inL = preL.read (pds);
                float inR = preR.read (pds);

                // Parallel combs
                float revL = 0, revR = 0;
                for (int c = 0; c < kNumCombs; ++c) {
                    float g = combFeedback (c);
                    float ds = (float)kCombDelays[c] * (float)sr / 44100.f;
                    float cL = combLpL[c].tick (combL[c].read (ds));
                    float cR = combLpR[c].tick (combR[c].read (ds));
                    combL[c].push (inL + cL * g);
                    combR[c].push (inR + cR * g);
                    revL += cL * (c % 2 == 0 ?  1.f : -1.f);
                    revR += cR * (c % 2 == 0 ? -1.f :  1.f);
                }
                revL *= 0.25f; revR *= 0.25f;

                // Series all-pass
                for (int a = 0; a < kNumAP; ++a) {
                    float ds = (float)kApDelays[a] * (float)sr / 44100.f;
                    const float g = 0.7f;
                    float dL = apL[a].read (ds);
                    float dR = apR[a].read (ds);
                    float outL = -revL * g + dL; apL[a].push (revL + dL * g); revL = outL;
                    float outR = -revR * g + dR; apR[a].push (revR + dR * g); revR = outR;
                }

                if (enabled) { L[i] += revL * mix; R[i] += revR * mix; }
            }
        }
    } retroverb;
};
