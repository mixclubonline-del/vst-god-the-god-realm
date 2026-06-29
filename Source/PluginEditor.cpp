#include "PluginProcessor.h"
#include "PluginEditor.h"
#include "BinaryData.h"
#include "RelicDeconstructor.h"
#include <iostream>

juce::WebBrowserComponent::Options VSTGodTheGodRealmAudioProcessorEditor::createWebBrowserOptions (VSTGodTheGodRealmAudioProcessorEditor* editor)
{
    auto userDataDir = juce::File::getSpecialLocation (juce::File::userApplicationDataDirectory)
                           .getChildFile ("MixxTech")
                           .getChildFile ("VST God - The God Realm")
                           .getChildFile ("WebView2_v2");

    auto options = juce::WebBrowserComponent::Options()
#if JUCE_USE_WIN_WEBVIEW2
        .withBackend (juce::WebBrowserComponent::Options::Backend::webview2)
        .withWinWebView2Options (juce::WebBrowserComponent::Options::WinWebView2{}
                                     .withUserDataFolder (userDataDir))
        .withNativeIntegrationEnabled (true)
        .withNativeFunction ("sendToJuce",
            [editor] (const juce::Array<juce::var>& args,
                      juce::WebBrowserComponent::NativeFunctionCompletion completion)
            {
                editor->handleWebViewMessage (args, std::move (completion));
            })
        .withUserScript (
            // Polyfill sendToJuce + aggressively resume AudioContext on every
            // possible event so standalone works without a manual click.
            "(function(){"
            "if(window.sendToJuce) return;"
            "window.sendToJuce=function(msg){"
            "try{"
            "if(window.__JUCE__ && window.__JUCE__.backend && window.__JUCE__.backend.emitEvent){"
            "window.__JUCE__.backend.emitEvent('__juce__invoke',{name:'sendToJuce',params:[msg],resultId:0});"
            "}"
            "}catch(e){console.error(e);}"
            "};"
            // Resume any existing AudioContext and patch the constructor so
            // every future AudioContext also resumes immediately.
            "function tryResumeAll(){"
            "if(window.__audioCtx){try{window.__audioCtx.resume();}catch(e){}}"
            "if(window.audioEngineContext){try{window.audioEngineContext.resume();}catch(e){}}"
            "}"
            "var _origAC=window.AudioContext||window.webkitAudioContext;"
            "if(_origAC){"
            "var _patchAC=function(){"
            "var ctx=new _origAC(...arguments);"
            "window.__audioCtx=ctx;"
            "try{ctx.resume();}catch(e){}"
            "return ctx;"
            "};"
            "_patchAC.prototype=_origAC.prototype;"
            "window.AudioContext=_patchAC;"
            "window.webkitAudioContext=_patchAC;"
            "}"
            // Poll every 200 ms for the first 10 s to catch contexts created after this script.
            "var _ri=0;"
            "var _rt=setInterval(function(){tryResumeAll();if(++_ri>50)clearInterval(_rt);},200);"
            "['pointerdown','mousedown','keydown','touchstart'].forEach(function(e){"
            "document.addEventListener(e,tryResumeAll,{capture:true,once:false});"
            "});"
            "})();"
        )
#endif
        ;

#if JUCE_WEB_BROWSER_RESOURCE_PROVIDER_AVAILABLE
    options = options.withResourceProvider([editor](const juce::String& url) -> std::optional<juce::WebBrowserComponent::Resource>
    {
        return editor->getEmbeddedUIResource(url);
    });
#endif

    return options;
}

VSTGodTheGodRealmAudioProcessorEditor::VSTGodTheGodRealmAudioProcessorEditor (VSTGodTheGodRealmAudioProcessor& p)
    : AudioProcessorEditor (&p), audioProcessor (p), webComponent (createWebBrowserOptions (this))
{
    fft = std::make_unique<juce::dsp::FFT>(10);
    setSize (1200, 800);
    setResizable (true, true);
    setResizeLimits (800, 550, 3840, 2160);

    // ═══════════════════════════════════════════════════════════════
    // Register parameter listeners
    // ═══════════════════════════════════════════════════════════════
    for (auto* param : audioProcessor.getParameters())
        if (auto* paramWithID = dynamic_cast<juce::AudioProcessorParameterWithID*> (param))
            audioProcessor.apvts.addParameterListener (paramWithID->paramID, this);

    addAndMakeVisible (webComponent);

    #if JUCE_WEB_BROWSER_RESOURCE_PROVIDER_AVAILABLE
        webComponent.goToURL (juce::WebBrowserComponent::getResourceProviderRoot());
    #else
        webComponent.goToURL ("about:blank");
    #endif

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
                // Web-audio-only tabs that don't have a dedicated JUCE index
                // map to 7 (Preset Vault) so pantheonSynth/sampler stay silent
                else if (valStr == "Sound Realm") value = 7.0f;
                else if (valStr == "Pedal Realm") value = 9.0f;
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
        else if (type == "LOAD_SAMPLE_BYTES")
        {
            // Web UI feeds raw audio bytes (base64) into a native sampler track.
            int tIdx = (int)payload.getProperty("trackIdx", -1);
            juce::String b64 = payload.getProperty("bytes", "").toString();
            if (tIdx >= 0 && tIdx < 8 && b64.isNotEmpty())
            {
                juce::MemoryOutputStream out;
                if (juce::Base64::convertFromBase64(out, b64))
                {
                    juce::MemoryBlock mb(out.getData(), out.getDataSize());
                    audioProcessor.loadSampleFromBytes(tIdx, mb);
                }
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
        else if (type == "PEDAL_MASTER_ACTIVE")
        {
            bool active = (bool)payload.getProperty("active", false);
            audioProcessor.setPedalMasterActive(active);
        }
        else if (type == "PEDAL_ENABLED")
        {
            int pedalIdx = (int)payload.getProperty("pedalIdx", -1);
            bool enabled = (bool)payload.getProperty("enabled", false);
            if (pedalIdx >= 0 && pedalIdx < 8)
            {
                audioProcessor.setPedalEnabled(pedalIdx, enabled);
            }
        }
        else if (type == "PEDAL_PARAM")
        {
            int pedalIdx = (int)payload.getProperty("pedalIdx", -1);
            juce::String key = payload.getProperty("key", "").toString();
            float value = (float)payload.getProperty("value", 0.0f);
            if (pedalIdx >= 0 && pedalIdx < 8 && key.isNotEmpty())
            {
                audioProcessor.setPedalParam(pedalIdx, key, value);
            }
        }
        else if (type == "GET_SETTINGS")
        {
            pushSettingsToWebView();
        }
        else if (type == "ACTIVATE_LICENSE")
        {
            auto key = payload.getProperty("key", "").toString();
            audioProcessor.startLicenseValidation(key, true);
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
            // Include the actual DAW sample rate so web instruments can calculate
            // their parameters correctly (filters, LFOs, etc.) instead of assuming 48k.
            obj->setProperty("dawSampleRate", audioProcessor.getDawSampleRate());

            juce::var paramVar (obj);
            juce::String serialized = juce::JSON::toString (paramVar);
            juce::MessageManager::callAsync ([this, serialized]()
            {
                std::cerr << "[PluginEditor] Evaluating window.__godRealmParametersUpdate with " << serialized.length() << " chars" << std::endl;
                webComponent.evaluateJavascript ("if(window.__godRealmParametersUpdate) window.__godRealmParametersUpdate(" + serialized + ");");
            });

            // The web UI requests parameters once it has mounted, so this is a
            // reliable moment to push back any web-UI state restored from the
            // host project (params not backed by APVTS).
            if (audioProcessor.pendingRestoreJson.isNotEmpty())
            {
                juce::String restore = audioProcessor.pendingRestoreJson;
                juce::MessageManager::callAsync ([this, restore]()
                {
                    webComponent.evaluateJavascript ("if(window.__godRealmRestoreState) window.__godRealmRestoreState(" + restore + ");");
                });
            }
        }
        else if (type == "PERSIST_WEBUI_STATE")
        {
            // Full web-UI parameter snapshot; stored so getStateInformation can
            // save it into the host project for per-instance persistence.
            audioProcessor.webUiStateJson = juce::JSON::toString (payload);
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
            juce::String prompt = payload.getProperty("prompt", "").toString();
            auto activeSlots = payload.getProperty("activeSlots", juce::var());
            handleNeuralOrchestration (prompt, activeSlots);
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
        else if (type == "DECONSTRUCT_RELIC")
        {
            juce::String filePath = payload.getProperty("filePath", "").toString();
            
            // Spin up a thread to avoid blocking the message thread/UI thread
            juce::Thread::launch([this, filePath]()
            {
                juce::File libraryDir(audioProcessor.sampleLibraryPath);
                if (!libraryDir.exists())
                {
                    libraryDir = juce::File("I:\\kits\\new kits\\2024-2025\\VSTGOD- God Of Oneshots");
                }
                
                auto importedDir = libraryDir.getChildFile("Imported").getChildFile(juce::File(filePath).getFileNameWithoutExtension());
                importedDir.createDirectory();

                juce::var results = RelicDeconstructor::deconstruct(filePath, importedDir);
                juce::String serialized = juce::JSON::toString(results);
                
                // Escape paths for Javascript execution
                serialized = serialized.replace("\\", "\\\\").replace("'", "\\'");
                
                juce::MessageManager::callAsync([this, filePath, serialized]()
                {
                    webComponent.evaluateJavascript("if(window.__godRealmDeconstructResult) window.__godRealmDeconstructResult(true, '" + filePath.replace("\\", "\\\\").replace("'", "\\'") + "', " + serialized + ");");
                });
            });
        }
        else if (type == "HARVEST_GRAPHICS")
        {
            juce::String pluginPath = payload.getProperty("pluginPath", "").toString();
            
            juce::Thread::launch([this, pluginPath]()
            {
                juce::File libraryDir(audioProcessor.sampleLibraryPath);
                if (!libraryDir.exists())
                {
                    libraryDir = juce::File("I:\\kits\\new kits\\2024-2025\\VSTGOD- God Of Oneshots");
                }
                
                auto skinsDir = libraryDir.getChildFile("Skins").getChildFile(juce::File(pluginPath).getFileNameWithoutExtension());
                skinsDir.createDirectory();

                juce::var results = RelicDeconstructor::deconstruct(pluginPath, skinsDir);
                juce::String serialized = juce::JSON::toString(results);
                
                serialized = serialized.replace("\\", "\\\\").replace("'", "\\'");
                
                juce::MessageManager::callAsync([this, pluginPath, serialized]()
                {
                    webComponent.evaluateJavascript("if(window.__godRealmHarvestResult) window.__godRealmHarvestResult(true, '" + pluginPath.replace("\\", "\\\\").replace("'", "\\'") + "', " + serialized + ");");
                });
            });
        }
        else if (type == "UI_NOTE_ON")
        {
            // Piano click in the plugin UI — trigger JUCE native synth directly
            int note = (int)payload.getProperty("note", 60);
            int vel  = (int)payload.getProperty("velocity", 80);
            audioProcessor.triggerUiNoteOn(note, juce::jlimit(1, 127, vel));
        }
        else if (type == "UI_NOTE_OFF")
        {
            int note = (int)payload.getProperty("note", 60);
            audioProcessor.triggerUiNoteOff(note);
        }
        else if (type == "AUDIO_DATA")
        {
            // AUDIO_DATA is now ignored — audio is synthesised natively by JUCE.
            // Keeping this branch so old messages don't hit the unhandled log.
            auto& src = payload.isObject() ? payload : msg;
            juce::String leftB64  = src.getProperty("l", "").toString();
            juce::String rightB64 = src.getProperty("r", "").toString();
            int numSamples        = (int) src.getProperty("n", 0);
            double srcRate        = (double) src.getProperty("sr", 48000.0);

            if (leftB64.isNotEmpty() && numSamples > 0)
            {
                juce::MemoryBlock leftBytes, rightBytes;
                juce::MemoryOutputStream leftOut (leftBytes, false), rightOut (rightBytes, false);
                juce::Base64::convertFromBase64 (leftOut,  leftB64);
                juce::Base64::convertFromBase64 (rightOut, rightB64.isEmpty() ? leftB64 : rightB64);

                const int actualSamples = (int)(leftBytes.getSize() / sizeof(float));
                if (actualSamples > 0)
                {
                    audioProcessor.pushWebAudio (
                        reinterpret_cast<const float*>(leftBytes.getData()),
                        reinterpret_cast<const float*>(rightBytes.getData()),
                        actualSamples,
                        srcRate
                    );
                }
            }
        }
        else if (type == "OPEN_FOLDER_BROWSER")
        {
            fileChooser = std::make_unique<juce::FileChooser>(
                "Locate VSTGOD Core Library Folder",
                juce::File::getSpecialLocation (juce::File::userDocumentsDirectory),
                "", true  // native OS dialog — appears in front of plugin window
            );
            fileChooser->launchAsync (
                juce::FileBrowserComponent::openMode | juce::FileBrowserComponent::canSelectDirectories,
                [this](const juce::FileChooser& fc)
                {
                    auto result = fc.getResult();
                    if (result.exists())
                    {
                        juce::String p = result.getFullPathName();
                        juce::String safe = p.replace("\\","\\\\").replace("\"","\\\"");
                        juce::MessageManager::callAsync([this, safe]()
                        {
                            webComponent.evaluateJavascript (
                                "if(window.__godRealmLibraryLocated)window.__godRealmLibraryLocated(\"" + safe + "\");"
                            );
                        });
                    }
                }
            );
        }
        else if (type == "OPEN_FILE_BROWSER")
        {
            fileChooser = std::make_unique<juce::FileChooser>(
                "Open Audio File",
                juce::File::getSpecialLocation (juce::File::userDocumentsDirectory),
                "*.wav;*.aif;*.aiff;*.mp3;*.flac;*.ogg", true
            );
            fileChooser->launchAsync (
                juce::FileBrowserComponent::openMode | juce::FileBrowserComponent::canSelectFiles,
                [this](const juce::FileChooser& fc)
                {
                    auto result = fc.getResult();
                    if (result.existsAsFile())
                    {
                        juce::String p = result.getFullPathName();
                        juce::String safe = p.replace("\\","\\\\").replace("\"","\\\"");
                        webComponent.evaluateJavascript (
                            "if(window.__godRealmFileSelected)window.__godRealmFileSelected(\"" + safe + "\");"
                        );
                    }
                }
            );
        }
        else if (type == "LOAD_FILE_PATH")
        {
            juce::String filePath = payload.getProperty("path", "").toString();
            juce::String reqId    = payload.getProperty("id",   "").toString();
            juce::Thread::launch([this, filePath, reqId]()
            {
                juce::File f(filePath);
                if (!f.existsAsFile()) return;
                juce::MemoryBlock data;
                f.loadFileAsData(data);
                juce::MemoryOutputStream b64Out;
                juce::Base64::convertToBase64(b64Out, data.getData(), data.getSize());
                juce::String b64 = b64Out.toString();
                juce::String safeId = reqId.replace("\"","\\\"");
                juce::MessageManager::callAsync([this, safeId, b64]()
                {
                    webComponent.evaluateJavascript(
                        "if(window.__godRealmFileLoaded)window.__godRealmFileLoaded(\""
                        + safeId + "\",\"" + b64 + "\");"
                    );
                });
            });
        }
        else if (type == "START_MIDI_DRAG")
        {
            juce::String filename = payload.getProperty("filename", "pattern.mid").toString();
            juce::String base64Data = payload.getProperty("data", "").toString();
            
            if (base64Data.isNotEmpty())
            {
                juce::MemoryBlock decodedData;
                juce::MemoryOutputStream outputStream(decodedData, false);
                if (juce::Base64::convertFromBase64(outputStream, base64Data))
                {
                    auto tempFile = juce::File::getSpecialLocation(juce::File::tempDirectory).getChildFile(filename);
                    if (tempFile.replaceWithData(decodedData.getData(), decodedData.getSize()))
                    {
                        juce::StringArray files;
                        files.add(tempFile.getFullPathName());
                        
                        juce::MessageManager::callAsync([this, files]()
                        {
                            juce::DragAndDropContainer::performExternalDragDropOfFiles(files, false, &webComponent);
                        });
                    }
                }
            }
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

    // Match both full relative path and basename to improve lookup reliability.
    int lastSlash = path.lastIndexOfChar ('/');
    juce::String basename = (lastSlash >= 0) ? path.substring (lastSlash + 1) : path;
    juce::String fullPath = path;
    juce::String prefixedPath = "dist/" + path;

    const char* dataPtr = nullptr;
    int dataSize = 0;

    // Search for full path first, then basename as fallback.
    for (int i = 0; i < BinaryData::namedResourceListSize; ++i)
    {
        auto original = juce::String (BinaryData::originalFilenames[i]).replaceCharacter ('\\', '/');

        if (original.equalsIgnoreCase (fullPath)
            || original.equalsIgnoreCase (prefixedPath)
            || original.equalsIgnoreCase (basename))
        {
            dataPtr = BinaryData::getNamedResource (BinaryData::namedResourceList[i], dataSize);
            break;
        }
    }

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
    auto bounds = getLocalBounds().toFloat();
    juce::ColourGradient gradient (
        juce::Colour::fromRGB (10, 14, 22), bounds.getTopLeft(),
        juce::Colour::fromRGB (26, 35, 54), bounds.getBottomRight(), false);
    g.setGradientFill (gradient);
    g.fillAll();

    g.setColour (juce::Colours::white.withAlpha (0.92f));
    g.setFont (juce::FontOptions (28.0f, juce::Font::bold));
    g.drawFittedText ("VST God - The God Realm", getLocalBounds().removeFromTop (120),
                      juce::Justification::centred, 1);

    g.setColour (juce::Colours::white.withAlpha (0.78f));
    g.setFont (juce::FontOptions (16.0f));
    g.drawFittedText ("If this message remains visible, the embedded WebView did not initialize.",
                      getLocalBounds().reduced (40).withTrimmedTop (180),
                      juce::Justification::centredTop, 2);

    g.setColour (juce::Colours::white.withAlpha (0.65f));
    g.setFont (juce::FontOptions (14.0f));
    g.drawFittedText ("Instrument mode is enabled in this build. Rescan plugins in FL Studio after reinstalling.",
                      getLocalBounds().reduced (40).withTrimmedTop (250),
                      juce::Justification::centredTop, 3);
}

void VSTGodTheGodRealmAudioProcessorEditor::resized()
{
    webComponent.setBounds (getLocalBounds());
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

        juce::String idEscaped = parameterID.replace("\\", "\\\\").replace("\"", "\\\"");
        juce::String valueJson = juce::JSON::toString (valVar);
        juce::String jsonMsg = "{\"id\":\"" + idEscaped + "\",\"value\":" + valueJson + "}";
        webComponent.evaluateJavascript ("if(window.__godRealmParameterUpdate) window.__godRealmParameterUpdate(" + jsonMsg + ");");
    });
}

void VSTGodTheGodRealmAudioProcessorEditor::timerCallback()
{
    frameCounter++;

    auto meteringJson = buildMeteringJson();
    webComponent.evaluateJavascript ("if(window.__godRealmMeteringUpdate) window.__godRealmMeteringUpdate(" + meteringJson + ");");

    if ((frameCounter % 15) == 0)
    {
        auto telemetryJson = buildTelemetryJson();
        webComponent.evaluateJavascript ("if(window.__godRealmTelemetryUpdate) window.__godRealmTelemetryUpdate(" + telemetryJson + ");");
    }

    if (frameCounter == 2)
        pushSettingsToWebView();
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
    // wrapperType is set by JUCE at load time and is reliable in all hosts.
    // JUCEApplicationBase::isStandaloneApp() can falsely return true inside FL Studio.
    bool isStandaloneWrap = (audioProcessor.wrapperType == juce::AudioProcessor::wrapperType_Standalone);
    json += "\"isStandalone\":" + juce::String(isStandaloneWrap ? "true" : "false") + ",";
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

    // MIDI CC events (drain the queue)
    auto ccEvents = audioProcessor.drainCCEvents();
    json += ",\"midiCCs\":[";
    for (int i = 0; i < (int)ccEvents.size(); ++i)
    {
        auto& evt = ccEvents[i];
        json += "{\"cc\":" + juce::String(evt.ccNumber);
        json += ",\"value\":" + juce::String(evt.ccValue);
        json += ",\"channel\":" + juce::String(evt.channel);
        json += "}";
        if (i < (int)ccEvents.size() - 1) json += ",";
    }
    json += "]";

    json += "}";
    return json;
}

juce::String VSTGodTheGodRealmAudioProcessorEditor::buildTelemetryJson()
{
    juce::String json = "{";

    double cpuEstimate = audioProcessor.getActiveCpuUsage();
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
        "Select VSTGOD Sample Library Folder...",
        juce::File::getSpecialLocation(juce::File::userHomeDirectory), "", true);

    fileChooser->launchAsync(juce::FileBrowserComponent::openMode | juce::FileBrowserComponent::canSelectDirectories,
        [this](const juce::FileChooser& chooser) {
            auto result = chooser.getResult();
            if (result.exists())
            {
                juce::String p = result.getFullPathName();
                juce::String safe = p.replace("\\","\\\\").replace("\"","\\\"");
                juce::MessageManager::callAsync([this, safe]()
                {
                    webComponent.evaluateJavascript(
                        "if(window.__godRealmLibraryLocated)window.__godRealmLibraryLocated(\"" + safe + "\");"
                        "if(window.__godRealmLibraryPathSelected)window.__godRealmLibraryPathSelected(\"" + safe + "\");"
                    );
                });
            }
        });
}

void VSTGodTheGodRealmAudioProcessorEditor::handleNeuralOrchestration (const juce::String& prompt, const juce::var& activeSlotsVar)
{
    juce::ignoreUnused (activeSlotsVar);
    juce::String promptLower = prompt.toLowerCase();
    
    juce::Thread::launch ([this, promptLower]()
    {
        // Add a slight thinking delay for a more natural AI interaction feel
        juce::Thread::sleep (800);
        
        juce::String responseText;
        auto* paramsObj = new juce::DynamicObject();
        
        if (promptLower.contains ("dark") || promptLower.contains ("underworld") || promptLower.contains ("hades"))
        {
            responseText = "🧠 [Neural Analysis]: Hades summons the shadows. To guide this sound into the depths, we must increase saturation drive, lower the dynamics threshold for compression bite, and call Hades inside the Electric Pantheon.";
            paramsObj->setProperty ("activeTab", "Electric Pantheon");
            paramsObj->setProperty ("pantheonGod", "hades");
            paramsObj->setProperty ("masterDrive", 65.0f);
            paramsObj->setProperty ("masterColorTilt", 25.0f);
            paramsObj->setProperty ("masterDynamicsThreshold", -18.0f);
            paramsObj->setProperty ("pantheonMacro_energy", 60.0f);
            paramsObj->setProperty ("pantheonMacro_realm", 75.0f);
        }
        else if (promptLower.contains ("bright") || promptLower.contains ("sparkle") || promptLower.contains ("zeus") || promptLower.contains ("lightning"))
        {
            responseText = "🧠 [Neural Analysis]: Zeus strikes the stack with high-voltage FM sparks. We are activating Zeus, shifting color tilt up for high-end definition, and expanding the stereo width.";
            paramsObj->setProperty ("activeTab", "Electric Pantheon");
            paramsObj->setProperty ("pantheonGod", "zeus");
            paramsObj->setProperty ("masterDrive", 35.0f);
            paramsObj->setProperty ("masterColorTilt", 75.0f);
            paramsObj->setProperty ("masterWidth", 150.0f);
            paramsObj->setProperty ("pantheonMacro_divinity", 80.0f);
            paramsObj->setProperty ("pantheonMacro_energy", 75.0f);
        }
        else if (promptLower.contains ("wide") || promptLower.contains ("space") || promptLower.contains ("ambient") || promptLower.contains ("poseidon"))
        {
            responseText = "🧠 [Neural Analysis]: Poseidon commands a fluid, immersive ocean of sound. We are engaging Poseidon, maximizing master stereo width, and boosting the celestial divinity macro.";
            paramsObj->setProperty ("activeTab", "Electric Pantheon");
            paramsObj->setProperty ("pantheonGod", "poseidon");
            paramsObj->setProperty ("masterWidth", 180.0f);
            paramsObj->setProperty ("masterImager", 0.0f);
            paramsObj->setProperty ("pantheonMacro_width", 90.0f);
            paramsObj->setProperty ("pantheonMacro_divinity", 85.0f);
            paramsObj->setProperty ("pantheonMacro_realm", 80.0f);
        }
        else if (promptLower.contains ("lead") || promptLower.contains ("synth") || promptLower.contains ("keys") || promptLower.contains ("olympus"))
        {
            responseText = "🧠 [Neural Analysis]: Olympus brings a majestic, premium ivory warmth. Let us transition to the Electric Pantheon tab, load Olympus, and dial a balanced performance stack.";
            paramsObj->setProperty ("activeTab", "Electric Pantheon");
            paramsObj->setProperty ("pantheonGod", "olympus");
            paramsObj->setProperty ("masterDrive", 20.0f);
            paramsObj->setProperty ("masterColorTilt", 50.0f);
            paramsObj->setProperty ("masterWidth", 120.0f);
            paramsObj->setProperty ("pantheonMacro_energy", 50.0f);
            paramsObj->setProperty ("pantheonMacro_divinity", 65.0f);
            paramsObj->setProperty ("pantheonMacro_realm", 50.0f);
        }
        else if (promptLower.contains ("808") || promptLower.contains ("sub") || promptLower.contains ("bass") || promptLower.contains ("rumble") || promptLower.contains ("titan"))
        {
            responseText = "🧠 [Neural Analysis]: Titan is summoned to shake the heavens. We are loading Titan in the Electric Pantheon and driving the sub-oscillator extension for colossal low-frequency pressure.";
            paramsObj->setProperty ("activeTab", "Electric Pantheon");
            paramsObj->setProperty ("pantheonGod", "titan");
            paramsObj->setProperty ("masterDrive", 55.0f);
            paramsObj->setProperty ("masterColorTilt", 35.0f);
            paramsObj->setProperty ("masterColdExtension", 85.0f);
            paramsObj->setProperty ("pantheonMacro_energy", 80.0f);
            paramsObj->setProperty ("pantheonMacro_realm", 90.0f);
        }
        else if (promptLower.contains ("time") || promptLower.contains ("glitch") || promptLower.contains ("slow") || promptLower.contains ("chronos"))
        {
            responseText = "🧠 [Neural Analysis]: Chronos fractures the timeline. We are activating Chronos, turning up the age macro for instability, and dialing in saturation.";
            paramsObj->setProperty ("activeTab", "Electric Pantheon");
            paramsObj->setProperty ("pantheonGod", "chronos");
            paramsObj->setProperty ("masterDrive", 45.0f);
            paramsObj->setProperty ("pantheonMacro_age", 90.0f);
            paramsObj->setProperty ("pantheonMacro_energy", 40.0f);
            paramsObj->setProperty ("pantheonMacro_realm", 70.0f);
        }
        else
        {
            responseText = "🧠 [Neural Analysis]: The Divine Forge has analyzed your prompt: \"" + promptLower + "\". We detect an opportunity to increase overall saturation drive, expand the master stereo image, and awaken Apollo to guide the melody.";
            paramsObj->setProperty ("activeTab", "Electric Pantheon");
            paramsObj->setProperty ("pantheonGod", "apollo");
            paramsObj->setProperty ("masterDrive", 40.0f);
            paramsObj->setProperty ("masterWidth", 140.0f);
            paramsObj->setProperty ("pantheonMacro_energy", 60.0f);
            paramsObj->setProperty ("pantheonMacro_divinity", 60.0f);
        }
        
        auto* responseObj = new juce::DynamicObject();
        responseObj->setProperty ("text", responseText);
        responseObj->setProperty ("params", paramsObj);
        
        juce::var responseVar (responseObj);
        juce::String serialized = juce::JSON::toString (responseVar);
        
        juce::MessageManager::callAsync ([this, serialized]()
        {
            webComponent.evaluateJavascript ("if(window.__godRealmNeuralResponse) window.__godRealmNeuralResponse(" + serialized + ");");
        });
    });
}

void VSTGodTheGodRealmAudioProcessorEditor::pushSettingsToWebView()
{
    auto settings = audioProcessor.loadSettingsFromDisk();
    if (settings.isEmpty()) settings = "{}";
    auto parsed = juce::JSON::parse(settings);
    if (parsed.isUndefined() || parsed.isVoid() || !parsed.isObject())
    {
        parsed = juce::var(new juce::DynamicObject());
    }
    
    if (auto* obj = parsed.getDynamicObject())
    {
        obj->setProperty("machineId", juce::SystemStats::getUniqueDeviceID());
        #if JUCE_MAC
        obj->setProperty("platform", "macos");
        #else
        obj->setProperty("platform", "windows");
        #endif
        obj->setProperty("pluginVersion", "v1.0.0");
        obj->setProperty("licenseActivated", audioProcessor.licenseActivated.load(std::memory_order_relaxed));
        if (parsed.hasProperty("licenseKey"))
        {
            obj->setProperty("licenseKey", parsed.getProperty("licenseKey", ""));
        }
        // Always send the current library path so the frontend can find samples
        obj->setProperty("sampleLibraryPath", audioProcessor.sampleLibraryPath);
    }
    
    auto serialized = juce::JSON::toString(parsed);
    juce::MessageManager::callAsync([this, serialized]() {
        webComponent.evaluateJavascript("if(window.__godRealmSettingsUpdate) window.__godRealmSettingsUpdate(" + serialized + ");");
    });
}

