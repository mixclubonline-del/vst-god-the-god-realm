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

target_compile_definitions(VSTGodTheGodRealm
    PUBLIC
        JUCE_IGNORE_VST3_MISMATCHED_PARAMETER_ID_WARNING=1
        JUCE_VST3_CAN_REPLACE_VST2=0
)

# Gather all WebUI build files in dist/
file(GLOB_RECURSE webui_files RELATIVE "${CMAKE_CURRENT_SOURCE_DIR}" "dist/*")

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
