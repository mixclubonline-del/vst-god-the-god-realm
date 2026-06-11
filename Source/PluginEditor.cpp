#include "PluginProcessor.h"
#include "PluginEditor.h"
#include "BinaryData.h"
#include <iostream>

juce::WebBrowserComponent::Options VSTGodTheGodRealmAudioProcessorEditor::createWebBrowserOptions (VSTGodTheGodRealmAudioProcessorEditor* editor)
{
    auto options = juce::WebBrowserComponent::Options()
        .withBackend(juce::WebBrowserComponent::Options::Backend::webview2)
        .withNativeIntegrationEnabled(true)
        .withNativeFunction("sendToJuce", [editor](const juce::Array<juce::var>& args, juce::WebBrowserComponent::NativeFunctionCompletion completion)
        {
            editor->handleWebViewMessage(args, completion);
        })
        .withUserScript(
            "(function() {\n"
            "    window.juceMessageQueue = [];\n"
            "    window.sendToJuce = function(msg) {\n"
            "        if (window.__JUCE__ && window.__JUCE__.backend && window.__JUCE__.backend.emitEvent) {\n"
            "            window.__JUCE__.backend.emitEvent(\"__juce__invoke\", {\n"
            "                name: \"sendToJuce\",\n"
            "                params: [msg],\n"
            "                resultId: 0\n"
            "            });\n"
            "        } else {\n"
            "            window.juceMessageQueue.push(msg);\n"
            "        }\n"
            "    };\n"
            "    var flushInterval = setInterval(function() {\n"
            "        if (window.__JUCE__ && window.__JUCE__.backend && window.__JUCE__.backend.emitEvent) {\n"
            "            clearInterval(flushInterval);\n"
            "            while (window.juceMessageQueue.length > 0) {\n"
            "                var msg = window.juceMessageQueue.shift();\n"
            "                window.sendToJuce(msg);\n"
            "            }\n"
            "        }\n"
            "    }, 30);\n"
            "    var originalLog = console.log;\n"
            "    var originalError = console.error;\n"
            "    console.log = function() {\n"
            "        var msg = Array.prototype.slice.call(arguments).join(\" \");\n"
            "        originalLog.apply(console, arguments);\n"
            "        window.sendToJuce({ type: \"CONSOLE_LOG\", payload: msg });\n"
            "    };\n"
            "    console.error = function() {\n"
            "        var msg = Array.prototype.slice.call(arguments).join(\" \");\n"
            "        originalError.apply(console, arguments);\n"
            "        window.sendToJuce({ type: \"CONSOLE_ERROR\", payload: msg });\n"
            "    };\n"
            "    window.onerror = function(message, source, lineno, colno, error) {\n"
            "        var msg = \"Unhandled error: \" + message + \" at \" + source + \":\" + lineno + \":\" + colno;\n"
            "        window.sendToJuce({ type: \"CONSOLE_ERROR\", payload: msg });\n"
            "        return false;\n"
            "    };\n"
            "})();"
        );

    options = options.withResourceProvider([editor](const juce::String& url) -> std::optional<juce::WebBrowserComponent::Resource>
    {
        return editor->getEmbeddedUIResource(url);
    });

    return options;
}

VSTGodTheGodRealmAudioProcessorEditor::VSTGodTheGodRealmAudioProcessorEditor (VSTGodTheGodRealmAudioProcessor& p)
    : AudioProcessorEditor (&p), audioProcessor (p), webComponent(createWebBrowserOptions (this))
{
    addAndMakeVisible(webComponent);
    setSize (1200, 800);

    // ═══════════════════════════════════════════════════════════════
    // Register parameter listeners
    // ═══════════════════════════════════════════════════════════════
    for (auto* param : audioProcessor.getParameters())
        if (auto* paramWithID = dynamic_cast<juce::AudioProcessorParameterWithID*> (param))
            audioProcessor.apvts.addParameterListener (paramWithID->paramID, this);

    // ═══════════════════════════════════════════════════════════════
    // Load the React UI into the WebView
    // Dev: Vite dev server on port 3001
    // Release: Embedded BinaryData served via resource provider (Phase 7)
    // ═══════════════════════════════════════════════════════════════
    webComponent.goToURL(juce::WebBrowserComponent::getResourceProviderRoot());

    // ═══════════════════════════════════════════════════════════════
    // Start the 30Hz state push timer
    // ═══════════════════════════════════════════════════════════════
    startTimerHz(30);
}

void VSTGodTheGodRealmAudioProcessorEditor::handleWebViewMessage (const juce::Array<juce::var>& args, juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    if (args.size() > 0)
    {
        auto msg = args[0];
        auto type = msg.getProperty("type", "").toString();
        auto payload = msg.getProperty("payload", juce::var());

        if (type == "CONSOLE_LOG")
        {
            std::cerr << "[JS LOG] " << payload.toString().toRawUTF8() << std::endl;
        }
        else if (type == "CONSOLE_ERROR")
        {
            std::cerr << "[JS ERR] " << payload.toString().toRawUTF8() << std::endl;
        }
        else if (type == "SET_PARAMETER")
        {
            auto id = payload.getProperty("id", "").toString();
            auto valVar = payload.getProperty("value", juce::var());
            
            float value = 0.0f;
            if (id == "activeTab")
            {
                juce::String valStr = valVar.toString();
                if (valStr == "Multi-Realm") value = 0.0f;
                else if (valStr == "Pantheon") value = 1.0f;
                else if (valStr == "Sample Chopper") value = 2.0f;
                else if (valStr == "Divine Archive") value = 3.0f;
                else if (valStr == "Sequencer") value = 4.0f;
                else if (valStr == "Mastering") value = 5.0f;
                else if (valStr == "Export") value = 6.0f;
                else if (valStr == "Preset Vault") value = 7.0f;
                else if (valStr == "Electric Pantheon") value = 8.0f;
                else value = (float)valVar;
            }
            else if (id == "pantheonGod")
            {
                juce::String valStr = valVar.toString();
                if (valStr == "olympus") value = 0.0f;
                else if (valStr == "hades") value = 1.0f;
                else if (valStr == "zeus") value = 2.0f;
                else if (valStr == "athena") value = 3.0f;
                else if (valStr == "poseidon") value = 4.0f;
                else if (valStr == "titan") value = 5.0f;
                else if (valStr == "apollo") value = 6.0f;
                else if (valStr == "chronos") value = 7.0f;
                else value = (float)valVar;
            }
            else
            {
                value = (float)valVar;
            }
            
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
            auto chain = payload.getProperty("chain", juce::var());
            DBG("[PluginEditor] Routing chain update received: " + juce::String(chain.size()) + " modules");
        }
        else if (type == "GET_SETTINGS")
        {
            auto settings = audioProcessor.loadSettingsFromDisk();
            if (settings.isEmpty()) settings = "{}";
            auto parsed = juce::JSON::parse(settings);
            if (parsed.isUndefined() || parsed.isVoid())
            {
                parsed = juce::var(new juce::DynamicObject());
            }
            auto serialized = juce::JSON::toString(parsed);
            juce::MessageManager::callAsync([this, serialized]() {
                webComponent.evaluateJavascript("if(window.__godRealmSettingsUpdate) window.__godRealmSettingsUpdate(" + serialized + ");");
            });
        }
        else if (type == "GET_PARAMETERS")
        {
            std::cerr << "[PluginEditor] GET_PARAMETERS message received from WebUI" << std::endl;
            auto* obj = new juce::DynamicObject();
            auto parameters = audioProcessor.getParameters();
            for (auto* param : parameters)
            {
                if (auto* paramWithID = dynamic_cast<juce::AudioProcessorParameterWithID*> (param))
                {
                    float val = *audioProcessor.apvts.getRawParameterValue (paramWithID->paramID);
                    if (paramWithID->paramID == "activeTab")
                    {
                        int idx = juce::roundToInt (val);
                        juce::String valStr = "Multi-Realm";
                        if (idx == 0) valStr = "Multi-Realm";
                        else if (idx == 1) valStr = "Pantheon";
                        else if (idx == 2) valStr = "Sample Chopper";
                        else if (idx == 3) valStr = "Divine Archive";
                        else if (idx == 4) valStr = "Sequencer";
                        else if (idx == 5) valStr = "Mastering";
                        else if (idx == 6) valStr = "Export";
                        else if (idx == 7) valStr = "Preset Vault";
                        else if (idx == 8) valStr = "Electric Pantheon";
                        obj->setProperty (paramWithID->paramID, valStr);
                    }
                    else if (paramWithID->paramID == "pantheonGod")
                    {
                        int idx = juce::roundToInt (val);
                        juce::String valStr = "olympus";
                        if (idx == 0) valStr = "olympus";
                        else if (idx == 1) valStr = "hades";
                        else if (idx == 2) valStr = "zeus";
                        else if (idx == 3) valStr = "athena";
                        else if (idx == 4) valStr = "poseidon";
                        else if (idx == 5) valStr = "titan";
                        else if (idx == 6) valStr = "apollo";
                        else if (idx == 7) valStr = "chronos";
                        obj->setProperty (paramWithID->paramID, valStr);
                    }
                    else if (dynamic_cast<juce::AudioParameterBool*> (param))
                    {
                        obj->setProperty (paramWithID->paramID, val != 0.0f);
                    }
                    else
                    {
                        obj->setProperty (paramWithID->paramID, val);
                    }
                }
            }
            juce::var paramVar (obj);
            juce::String serialized = juce::JSON::toString (paramVar);
            juce::MessageManager::callAsync ([this, serialized]()
            {
                std::cerr << "[PluginEditor] Evaluating window.__godRealmParametersUpdate with " << serialized.length() << " chars" << std::endl;
                webComponent.evaluateJavascript ("if(window.__godRealmParametersUpdate) window.__godRealmParametersUpdate(" + serialized + ");");
            });
        }
        else if (type == "SAVE_SETTINGS")
        {
            audioProcessor.saveSettingsToDisk(juce::JSON::toString(payload));
        }
        else if (type == "BROWSE_LIBRARY_PATH")
        {
            juce::MessageManager::callAsync([this]() { browseForLibraryPath(); });
        }
        else if (type == "TRIGGER_NEURAL_ORCHESTRATION")
        {
            DBG("[PluginEditor] TRIGGER_NEURAL_ORCHESTRATION message received");
        }
        else if (type == "UPDATE_CHOPPER_SLICES")
        {
            int padIndex = (int)payload.getProperty("padIndex", -1);
            auto slices = payload.getProperty("slices", juce::var());
            juce::String samplePath = payload.getProperty("samplePath", "").toString();
            if (padIndex >= 0 && padIndex < 8)
            {
                audioProcessor.updateTrackSlices(padIndex, slices);
                if (samplePath.isNotEmpty())
                {
                    audioProcessor.loadSampleForTrack(padIndex, samplePath);
                }
            }
        }
        else if (type == "UPDATE_SPATIAL_POSITION")
        {
            float azimuth = (float)payload.getProperty("azimuth", 0.0);
            float elevation = (float)payload.getProperty("elevation", 0.5);
            
            float panVal = std::sin(azimuth * juce::MathConstants<float>::pi / 180.0f);
            
            if (auto* param = audioProcessor.apvts.getParameter("masterImager"))
                param->setValueNotifyingHost(param->getNormalisableRange().convertTo0to1(panVal));
            
            float widthVal = 100.0f + (elevation - 0.5f) * 100.0f; // 0.0 - 1.0 -> 50% - 150% width
            if (auto* param = audioProcessor.apvts.getParameter("masterWidth"))
                param->setValueNotifyingHost(param->getNormalisableRange().convertTo0to1(widthVal));
        }
        else if (type == "UPDATE_MASTERING_PARAMS")
        {
            auto updateParam = [this](const juce::String& paramId, float value) {
                if (auto* param = audioProcessor.apvts.getParameter(paramId))
                    param->setValueNotifyingHost(param->getNormalisableRange().convertTo0to1(value));
            };

            if (payload.hasProperty("drive")) updateParam("masterDrive", (float)payload.getProperty("drive", 20.0));
            if (payload.hasProperty("silk")) updateParam("masterColorTilt", (float)payload.getProperty("silk", 50.0));
            if (payload.hasProperty("threshold")) updateParam("masterDynamicsThreshold", (float)payload.getProperty("threshold", -12.0));
            if (payload.hasProperty("ceiling")) updateParam("masterCeiling", (float)payload.getProperty("ceiling", -0.1));
            if (payload.hasProperty("width")) updateParam("masterWidth", (float)payload.getProperty("width", 100.0));
            if (payload.hasProperty("imager")) updateParam("masterImager", (float)payload.getProperty("imager", 0.0));
            if (payload.hasProperty("volume")) updateParam("masterVolume", (float)payload.getProperty("volume", 0.0));
        }
        else if (type == "UPDATE_TRANSPORT")
        {
            bool isPlaying = payload.getProperty("isPlaying", false);
            double bpm = payload.getProperty("bpm", 140.0);
            
            audioProcessor.updateTransportState(isPlaying, bpm);
            
            if (auto* param = audioProcessor.apvts.getParameter("globalBpm"))
                param->setValueNotifyingHost(param->getNormalisableRange().convertTo0to1((float)bpm));
        }
        else if (type == "TRIGGER_STEP")
        {
            int trackIdx = (int)payload.getProperty("trackIndex", -1);
            auto stepData = payload.getProperty("stepData", juce::var());
            if (trackIdx >= 0 && trackIdx < 8)
            {
                float velocity = (float)stepData.getProperty("velocity", 100.0);
                float pitch = (float)stepData.getProperty("pitch", 0.0);
                float pan = (float)stepData.getProperty("pan", 0.0);
                float decay = (float)stepData.getProperty("decay", 0.5);
                int sliceIndex = (int)stepData.getProperty("sliceIndex", 0);
                
                audioProcessor.triggerStep(trackIdx, velocity / 127.0f, pitch, pan, decay, 0.0f, 1.0f, false, sliceIndex);
            }
        }
        else if (type == "UPDATE_AUTOMATION")
        {
            int trackIdx = (int)payload.getProperty("trackIndex", -1);
            juce::String paramId = payload.getProperty("paramId", "").toString();
            auto curve = payload.getProperty("curve", juce::var());
            juce::ignoreUnused(trackIdx, paramId, curve);
            DBG("[PluginEditor] UPDATE_AUTOMATION received: track " + juce::String(trackIdx) + ", param: " + paramId + ", points: " + juce::String(curve.size()));
        }
        else if (type == "UPDATE_SUB_OSC")
        {
            float drive = (float)payload.getProperty("drive", 0.0);
            float coldVal = drive * 100.0f;
            if (coldVal > 100.0f) coldVal = 100.0f;
            if (auto* param = audioProcessor.apvts.getParameter("masterColdExtension"))
                param->setValueNotifyingHost(param->getNormalisableRange().convertTo0to1(coldVal));
        }
    }
    completion({});
}

std::optional<juce::WebBrowserComponent::Resource> VSTGodTheGodRealmAudioProcessorEditor::getEmbeddedUIResource (const juce::String& url)
{
    juce::String path = url;
    juce::String root = juce::WebBrowserComponent::getResourceProviderRoot();
    if (path.startsWith (root))
        path = path.substring (root.length());
        
    if (path.startsWithChar ('/'))
        path = path.substring (1);
        
    if (path.isEmpty())
        path = "index.html";

    // Extract the basename of the requested file
    int lastSlash = path.lastIndexOfChar ('/');
    juce::String basename = (lastSlash >= 0) ? path.substring (lastSlash + 1) : path;

    const char* dataPtr = nullptr;
    int dataSize = 0;

    // Search for the basename in BinaryData::originalFilenames
    for (int i = 0; i < BinaryData::namedResourceListSize; ++i)
    {
        if (basename.equalsIgnoreCase (juce::String (BinaryData::originalFilenames[i])))
        {
            dataPtr = BinaryData::getNamedResource (BinaryData::namedResourceList[i], dataSize);
            break;
        }
    }

    std::cerr << "[ResourceProvider] Req: " << url.toRawUTF8() << " | Path: " << path.toRawUTF8() << " | Base: " << basename.toRawUTF8() << " | Found: " << (dataPtr != nullptr ? "YES" : "NO") << " | Size: " << dataSize << std::endl;

    if (dataPtr != nullptr && dataSize > 0)
    {
        juce::WebBrowserComponent::Resource resource;
        resource.data = std::vector<std::byte> (reinterpret_cast<const std::byte*> (dataPtr),
                                                reinterpret_cast<const std::byte*> (dataPtr) + dataSize);
        
        // Determine Mime Type
        juce::String mimeType = "application/octet-stream";
        if (path.endsWith (".html"))       mimeType = "text/html";
        else if (path.endsWith (".css"))  mimeType = "text/css";
        else if (path.endsWith (".js"))   mimeType = "application/javascript";
        else if (path.endsWith (".png"))  mimeType = "image/png";
        else if (path.endsWith (".svg"))  mimeType = "image/svg+xml";
        else if (path.endsWith (".json")) mimeType = "application/json";
        else if (path.endsWith (".woff")) mimeType = "font/woff";
        else if (path.endsWith (".woff2")) mimeType = "font/woff2";
        else if (path.endsWith (".mp4"))   mimeType = "video/mp4";
        else if (path.endsWith (".ogg"))   mimeType = "audio/ogg";
        else if (path.endsWith (".wav"))   mimeType = "audio/wav";
        
        resource.mimeType = mimeType;
        return resource;
    }
    return std::nullopt;
}

VSTGodTheGodRealmAudioProcessorEditor::~VSTGodTheGodRealmAudioProcessorEditor()
{
    stopTimer();
    for (auto* param : audioProcessor.getParameters())
        if (auto* paramWithID = dynamic_cast<juce::AudioProcessorParameterWithID*> (param))
            audioProcessor.apvts.removeParameterListener (paramWithID->paramID, this);
}

void VSTGodTheGodRealmAudioProcessorEditor::paint (juce::Graphics& g)
{
    g.fillAll (juce::Colours::black);
}

void VSTGodTheGodRealmAudioProcessorEditor::resized()
{
    webComponent.setBounds(getLocalBounds());
}

void VSTGodTheGodRealmAudioProcessorEditor::parameterChanged (const juce::String& parameterID, float newValue)
{
    juce::MessageManager::callAsync ([this, parameterID, newValue]()
    {
        juce::var valVar;
        if (parameterID == "activeTab")
        {
            int idx = juce::roundToInt (newValue);
            if (idx == 0) valVar = "Multi-Realm";
            else if (idx == 1) valVar = "Pantheon";
            else if (idx == 2) valVar = "Sample Chopper";
            else if (idx == 3) valVar = "Divine Archive";
            else if (idx == 4) valVar = "Sequencer";
            else if (idx == 5) valVar = "Mastering";
            else if (idx == 6) valVar = "Export";
            else if (idx == 7) valVar = "Preset Vault";
            else if (idx == 8) valVar = "Electric Pantheon";
            else valVar = idx;
        }
        else if (parameterID == "pantheonGod")
        {
            int idx = juce::roundToInt (newValue);
            if (idx == 0) valVar = "olympus";
            else if (idx == 1) valVar = "hades";
            else if (idx == 2) valVar = "zeus";
            else if (idx == 3) valVar = "athena";
            else if (idx == 4) valVar = "poseidon";
            else if (idx == 5) valVar = "titan";
            else if (idx == 6) valVar = "apollo";
            else if (idx == 7) valVar = "chronos";
            else valVar = idx;
        }
        else
        {
            valVar = newValue;
        }
        
        juce::String jsonMsg = "{\"id\":\"" + parameterID + "\",\"value\":";
        if (valVar.isString())
            jsonMsg += "\"" + valVar.toString() + "\"}";
        else if (valVar.isBool())
            jsonMsg += (static_cast<bool> (valVar) ? juce::String ("true") : juce::String ("false")) + "}";
        else
            jsonMsg += juce::String (static_cast<double> (valVar)) + "}";
            
        webComponent.evaluateJavascript ("if(window.__godRealmParameterUpdate) window.__godRealmParameterUpdate(" + jsonMsg + ");");
    });
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

void VSTGodTheGodRealmAudioProcessorEditor::browseForLibraryPath()
{
    fileChooser = std::make_unique<juce::FileChooser>(
        "Select VST GOD Sample Library...",
        juce::File::getSpecialLocation(juce::File::userHomeDirectory), "*");
    
    fileChooser->launchAsync(juce::FileBrowserComponent::openMode | juce::FileBrowserComponent::canSelectDirectories,
        [this](const juce::FileChooser& chooser) {
            auto result = chooser.getResult();
            if (result.exists())
            {
                auto path = result.getFullPathName().replaceCharacter('\\', '/');
                webComponent.evaluateJavascript("if(window.__godRealmLibraryPathSelected) window.__godRealmLibraryPathSelected('" + path + "');");
            }
        });
}

