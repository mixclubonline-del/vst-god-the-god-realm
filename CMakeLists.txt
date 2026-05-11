cmake_minimum_required(VERSION 3.24)

project(VSTGod_TheGodRealm VERSION 1.0.0)

# Fetch JUCE
include(FetchContent)
FetchContent_Declare(
    juce
    URL https://github.com/juce-framework/JUCE/archive/master.zip
)
FetchContent_MakeAvailable(juce)

# Create the Audio Plugin
juce_add_plugin(VSTGodTheGodRealm
    COMPANY_NAME "MixxTech"
    PLUGIN_MANUFACTURER_CODE "Mixt"
    PLUGIN_CODE "Vgod"
    FORMATS VST3 AU Standalone
    PRODUCT_NAME "VST God - The God Realm"
    NEEDS_WEB_BROWSER TRUE
    NEEDS_CURL TRUE
)

# Target compilation settings
juce_generate_juce_header(VSTGodTheGodRealm)
target_compile_features(VSTGodTheGodRealm PUBLIC cxx_std_20)

target_sources(VSTGodTheGodRealm
    PRIVATE
        Source/PluginProcessor.cpp
        Source/PluginEditor.cpp
)

target_link_libraries(VSTGodTheGodRealm
    PRIVATE
        juce::juce_audio_utils
        juce::juce_gui_extra
    PUBLIC
        juce::juce_recommended_config_flags
        juce::juce_recommended_lto_flags
        juce::juce_recommended_warning_flags
)
