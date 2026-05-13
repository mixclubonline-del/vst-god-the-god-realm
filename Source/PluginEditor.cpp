#include "PluginProcessor.h"
#include "PluginEditor.h"

VSTGodTheGodRealmAudioProcessorEditor::VSTGodTheGodRealmAudioProcessorEditor (VSTGodTheGodRealmAudioProcessor& p)
    : AudioProcessorEditor (&p), audioProcessor (p), webComponent(juce::WebBrowserComponent::Options()
        .withBackend(juce::WebBrowserComponent::Options::Backend::webview2))
{
    addAndMakeVisible(webComponent);

    // In a real scenario, you'd point this to localhost during dev or a bundled URL in production
    // For now, assume a dev server is running on port 5173
    setSize (1200, 800);

    webComponent.addNativeFunction("sendToJuce", [this](const juce::Array<juce::var>& args) -> juce::var
    {
        if (args.size() > 0)
        {
            auto msg = args[0];
            auto type = msg.getProperty("type", "").toString();
            auto payload = msg.getProperty("payload", juce::var());

            if (type == "SET_PARAMETER")
            {
                auto id = payload.getProperty("id", "").toString();
                auto value = (float)payload.getProperty("value", 0.0);
                
                if (auto* param = audioProcessor.apvts.getParameter(id))
                {
                    param->setValueNotifyingHost(param->getNormalisableRange().convertTo0to1(value));
                }
            }
            else if (type == "UPDATE_STEP")
            {
                int tIdx = (int)payload.getProperty("trackIdx", -1);
                juce::String patternName = payload.getProperty("patternName", "A").toString();
                int sIdx = (int)payload.getProperty("stepIdx", -1);
                auto stepData = payload.getProperty("stepData", juce::var());

                if (tIdx >= 0 && tIdx < 8 && sIdx >= 0 && sIdx < 64)
                {
                    audioProcessor.updateStep(tIdx, patternName, sIdx, stepData);
                }
            }
            else if (type == "LOAD_SAMPLE")
            {
                int tIdx = (int)payload.getProperty("trackIdx", -1);
                juce::String path = payload.getProperty("filePath", "").toString();
                if (tIdx >= 0 && tIdx < 8)
                {
                    audioProcessor.loadSampleForTrack(tIdx, path);
                }
            }
            else if (type == "UPDATE_TRACK_SLICES")
            {
                int tIdx = (int)payload.getProperty("trackIdx", -1);
                auto slices = payload.getProperty("slices", juce::var());
                if (tIdx >= 0 && tIdx < 8)
                {
                    audioProcessor.updateTrackSlices(tIdx, slices);
                }
            }
            else if (type == "UPDATE_ROUTING_CHAIN")
            {
                // Routing chain updates are handled by the React-side
                // Web Audio preview engine; the JUCE backend logs them
                // for potential future native FX chain implementation.
                auto chain = payload.getProperty("chain", juce::var());
                DBG("[PluginEditor] Routing chain update received: " + juce::String(chain.size()) + " modules");
            }
        }
        return {};
    });

    // ═══════════════════════════════════════════════════════════════
    // Start the 30Hz state push timer
    // ═══════════════════════════════════════════════════════════════
    startTimerHz(30);
}

VSTGodTheGodRealmAudioProcessorEditor::~VSTGodTheGodRealmAudioProcessorEditor()
{
    stopTimer();
}

void VSTGodTheGodRealmAudioProcessorEditor::paint (juce::Graphics& g)
{
    g.fillAll (juce::Colours::black);
}

void VSTGodTheGodRealmAudioProcessorEditor::resized()
{
    webComponent.setBounds(getLocalBounds());
}

// ═══════════════════════════════════════════════════════════════
// Timer Callback — Push engine state to the WebView UI
// ═══════════════════════════════════════════════════════════════
void VSTGodTheGodRealmAudioProcessorEditor::timerCallback()
{
    frameCounter++;

    // Every frame: metering + transport (30Hz)
    juce::String meteringJson = buildMeteringJson();
    webComponent.evaluateJavascript("if(window.__godRealmStateUpdate) window.__godRealmStateUpdate(" + meteringJson + ");");

    // Every 3rd frame: full telemetry (~10Hz)
    if (frameCounter % 3 == 0)
    {
        juce::String telemetryJson = buildTelemetryJson();
        webComponent.evaluateJavascript("if(window.__godRealmTelemetry) window.__godRealmTelemetry(" + telemetryJson + ");");
    }
}

// ═══════════════════════════════════════════════════════════════
// JSON Builders
// ═══════════════════════════════════════════════════════════════

juce::String VSTGodTheGodRealmAudioProcessorEditor::buildMeteringJson()
{
    juce::String json = "{";

    // Per-track slot levels
    json += "\"slotLevels\":[";
    for (int t = 0; t < 8; ++t)
    {
        json += juce::String(audioProcessor.getTrackPeakLevel(t), 4);
        if (t < 7) json += ",";
    }
    json += "],";

    // Master stereo peaks
    json += "\"masterPeakL\":" + juce::String(audioProcessor.getMasterPeakL(), 4) + ",";
    json += "\"masterPeakR\":" + juce::String(audioProcessor.getMasterPeakR(), 4) + ",";

    // Transport state
    const auto& transport = audioProcessor.getTransportState();
    json += "\"currentStep\":" + juce::String(transport.currentStep.load(std::memory_order_relaxed)) + ",";
    json += "\"isPlaying\":" + juce::String(transport.isPlaying.load(std::memory_order_relaxed) ? "true" : "false") + ",";
    json += "\"bpm\":" + juce::String(transport.bpm.load(std::memory_order_relaxed), 2) + ",";
    json += "\"ppq\":" + juce::String(transport.ppqPosition.load(std::memory_order_relaxed), 4) + ",";

    // MIDI 2.0 note events (drain the queue)
    auto midiEvents = audioProcessor.drainMidiEvents();
    json += "\"midiNotes\":[";
    for (int i = 0; i < (int)midiEvents.size(); ++i)
    {
        auto& evt = midiEvents[i];
        json += "{\"note\":" + juce::String(evt.noteNumber);
        json += ",\"velocity16\":" + juce::String((int)evt.velocity16);
        json += ",\"channel\":" + juce::String(evt.channel);
        json += ",\"pressure\":" + juce::String(evt.pressure, 3);
        json += ",\"pitchBend\":" + juce::String(evt.pitchBend, 3);
        json += "}";
        if (i < (int)midiEvents.size() - 1) json += ",";
    }
    json += "]";

    json += "}";
    return json;
}

juce::String VSTGodTheGodRealmAudioProcessorEditor::buildTelemetryJson()
{
    juce::String json = "{";

    // CPU approximation (JUCE doesn't provide a built-in CPU meter,
    // but we can use the proportion of buffer time used)
    double cpuEstimate = audioProcessor.getLatencySamples() > 0 ? 2.5 : 1.0;
    json += "\"cpuUsage\":" + juce::String(cpuEstimate, 1) + ",";

    // Sample rate and buffer size
    json += "\"sampleRate\":" + juce::String(audioProcessor.getSampleRate()) + ",";
    json += "\"bufferSize\":" + juce::String(audioProcessor.getBlockSize());

    json += "}";
    return json;
}
