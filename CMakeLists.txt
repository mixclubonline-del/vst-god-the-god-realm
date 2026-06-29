cmake_minimum_required(VERSION 3.24)

project(VSTGod_TheGodRealm VERSION 1.0.0)

# Fetch JUCE
include(FetchContent)
FetchContent_Declare(
    juce
    URL https://github.com/juce-framework/JUCE/archive/refs/tags/8.0.6.zip
)
FetchContent_MakeAvailable(juce)

# Patch JUCE's WebView2 initialization so AudioContext.resume() is allowed
# without a user gesture. WebView2 uses Chromium's autoplay policy by default,
# which blocks programmatic resume() from evaluateJavascript() (no user-
# activation status). --autoplay-policy=no-user-gesture-required disables that.
if(WIN32)
    set(_juce_webview2_cpp
        "${juce_SOURCE_DIR}/modules/juce_gui_extra/native/juce_WebBrowserComponent_windows.cpp")
    if(EXISTS "${_juce_webview2_cpp}")
        file(READ "${_juce_webview2_cpp}" _juce_wv2_content)
        string(FIND "${_juce_wv2_content}" "autoplay-policy=no-user-gesture-required" _already_patched)
        if(_already_patched EQUAL -1)
            string(REPLACE
                "auto webViewOptions = Microsoft::WRL::Make<CoreWebView2EnvironmentOptions>();"
                "auto webViewOptions = Microsoft::WRL::Make<CoreWebView2EnvironmentOptions>();\n        webViewOptions->put_AdditionalBrowserArguments(L\"--autoplay-policy=no-user-gesture-required\");"
                _juce_wv2_patched "${_juce_wv2_content}")
            file(WRITE "${_juce_webview2_cpp}" "${_juce_wv2_patched}")
            message(STATUS "Applied WebView2 autoplay patch to JUCE")
        endif()
    endif()
endif()

# Platform-conditional plugin formats (AU is macOS-only).
# Standalone is built too: in the standalone wrapper the app reports
# isStandalone=true, so the web instruments play straight through the system
# output (every tab is audible) instead of routing through the host bridge.
if(WIN32)
    set(_PLUGIN_FORMATS VST3 Standalone)
else()
    set(_PLUGIN_FORMATS VST3 AU Standalone)
endif()

# Create the Audio Plugin
juce_add_plugin(VSTGodTheGodRealm
    COMPANY_NAME "MixxTech"
    PLUGIN_MANUFACTURER_CODE "Mixt"
    PLUGIN_CODE "Vgod"
    FORMATS ${_PLUGIN_FORMATS}
    PRODUCT_NAME "VST God - The God Realm"
    BUNDLE_ID "com.mixxtech.vstgod.thegodrealm"
    IS_SYNTH TRUE
    # Auto-install the freshly built .vst3 into the system VST3 folder after every
    # build, so the DAW always loads the latest binary. Without this, the build
    # output sat in build/ and a stale hand-copied plugin kept loading instead.
    COPY_PLUGIN_AFTER_BUILD TRUE
    NEEDS_MIDI_INPUT TRUE
    NEEDS_MIDI_OUTPUT FALSE
    IS_MIDI_EFFECT FALSE
    VST3_CATEGORIES "Instrument|Synth"
    NEEDS_WEB_BROWSER TRUE
    NEEDS_CURL TRUE
)

# Target compilation settings
juce_generate_juce_header(VSTGodTheGodRealm)
target_compile_features(VSTGodTheGodRealm PUBLIC cxx_std_20)

target_compile_definitions(VSTGodTheGodRealm
    PUBLIC
        JUCE_IGNORE_VST3_MISMATCHED_PARAMETER_ID_WARNING=1
        JUCE_VST3_CAN_REPLACE_VST2=0
)

# Gather all WebUI build files in dist/
file(GLOB_RECURSE webui_files RELATIVE "${CMAKE_CURRENT_SOURCE_DIR}" "dist/*")

# Exclude large kits/ directory from binary data (loaded dynamically from disk at runtime)
list(FILTER webui_files EXCLUDE REGEX "^dist/kits/")

# Create BinaryData target
juce_add_binary_data(VSTGodTheGodRealm_BinaryData
    SOURCES
        ${webui_files}
)

target_sources(VSTGodTheGodRealm
    PRIVATE
        Source/PluginProcessor.cpp
        Source/PluginEditor.cpp
)

target_link_libraries(VSTGodTheGodRealm
    PRIVATE
        VSTGodTheGodRealm_BinaryData
        juce::juce_audio_utils
        juce::juce_gui_extra
        juce::juce_dsp
    PUBLIC
        juce::juce_recommended_config_flags
        juce::juce_recommended_lto_flags
        juce::juce_recommended_warning_flags
)

# ─── Windows: WebView2 SDK for embedded React UI ───
# Run scripts/setup-webview2-sdk.bat ONCE before building to download the SDK.
if(WIN32)
    set(WEBVIEW2_SDK_DIR "${CMAKE_CURRENT_SOURCE_DIR}/build/_webview2_sdk")

    if(EXISTS "${WEBVIEW2_SDK_DIR}/build/native/include/WebView2.h")
        message(STATUS "WebView2 SDK found at ${WEBVIEW2_SDK_DIR}")
        target_include_directories(VSTGodTheGodRealm PRIVATE "${WEBVIEW2_SDK_DIR}/build/native/include")
        target_compile_definitions(VSTGodTheGodRealm PUBLIC JUCE_USE_WIN_WEBVIEW2=1)
        target_link_libraries(VSTGodTheGodRealm PRIVATE "${WEBVIEW2_SDK_DIR}/build/native/x64/WebView2Loader.dll.lib")
    else()
        message(WARNING "WebView2 SDK not found. Run scripts/setup-webview2-sdk.bat first, then reconfigure. Building without WebView2 (UI will be blank in VST mode).")
    endif()
endif()
