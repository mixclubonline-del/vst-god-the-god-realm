// ═══════════════════════════════════════════════════════════════
// RelicDeconstructor — Forensic File Carver & Archive Unpacker
// ═══════════════════════════════════════════════════════════════
// Memory-maps binary containers and carves WAV, FLAC, and PNG files
// directly from proprietary monoliths (.mse, .hr1, .dat) and binaries.

#pragma once

#include <JuceHeader.h>

class RelicDeconstructor
{
public:
    /**
     * Deconstructs a proprietary soundbank or archive.
     * Returns an array of objects containing extracted file metadata.
     */
    static juce::var deconstruct(const juce::String& filePath, const juce::File& outputDir)
    {
        juce::File inputFile(filePath);
        if (!inputFile.existsAsFile())
            return juce::Array<juce::var>();

        outputDir.createDirectory();
        
        juce::Array<juce::var> extractedFiles;
        juce::String ext = inputFile.getFileExtension().toLowerCase();

        if (ext == ".zip")
        {
            extractedFiles = unpackZip(inputFile, outputDir);
        }
        else
        {
            extractedFiles = carveBinary(inputFile, outputDir);
        }

        return extractedFiles;
    }

private:
    static juce::Array<juce::var> unpackZip(const juce::File& zipFile, const juce::File& outputDir)
    {
        juce::Array<juce::var> results;
        juce::ZipFile archive(zipFile);
        
        if (archive.getNumEntries() == 0)
            return results;

        auto result = archive.uncompressTo(outputDir);
        if (result.wasOk())
        {
            // Scan output directory for extracted files
            juce::Array<juce::File> files;
            outputDir.findChildFiles(files, juce::File::findFiles, true);

            for (auto& f : files)
            {
                auto* obj = new juce::DynamicObject();
                obj->setProperty("name", f.getFileName());
                obj->setProperty("path", f.getFullPathName().replaceCharacter('\\', '/'));
                
                juce::String fileExt = f.getFileExtension().toLowerCase();
                if (fileExt == ".wav" || fileExt == ".flac" || fileExt == ".mp3" || fileExt == ".ogg")
                    obj->setProperty("type", "audio");
                else if (fileExt == ".png" || fileExt == ".jpg" || fileExt == ".jpeg")
                    obj->setProperty("type", "graphic");
                else
                    obj->setProperty("type", "other");

                obj->setProperty("size", (juce::int64) f.getSize());
                results.add(juce::var(obj));
            }
        }
        return results;
    }

    static juce::Array<juce::var> carveBinary(const juce::File& binaryFile, const juce::File& outputDir)
    {
        juce::Array<juce::var> results;
        
        // Memory-map the file to avoid loading gigabytes into RAM
        juce::MemoryMappedFile mappedFile(binaryFile, juce::MemoryMappedFile::readOnly);
        
        const uint8* data = (const uint8*) mappedFile.getData();
        size_t size = mappedFile.getSize();
        
        if (data == nullptr || size < 12)
            return results;

        int sampleCount = 0;
        int graphicCount = 0;
        juce::String baseName = binaryFile.getFileNameWithoutExtension();

        for (size_t i = 0; i < size - 12; )
        {
            // ─── 1. Scan WAV: "RIFF" ───
            if (data[i] == 'R' && data[i+1] == 'I' && data[i+2] == 'F' && data[i+3] == 'F')
            {
                // Check if sub-type is "WAVE"
                if (data[i+8] == 'W' && data[i+9] == 'A' && data[i+10] == 'V' && data[i+11] == 'E')
                {
                    // Read chunk size (little endian 32-bit int)
                    uint32 riffSize = data[i+4] | (data[i+5] << 8) | (data[i+6] << 16) | (data[i+7] << 24);
                    size_t totalWavSize = riffSize + 8;
                    
                    if (i + totalWavSize <= size && totalWavSize > 44) // standard WAV header is at least 44 bytes
                    {
                        juce::String fileName = baseName + "_sample_" + juce::String(sampleCount++) + ".wav";
                        juce::File outFile = outputDir.getChildFile(fileName);
                        outFile.deleteFile();
                        
                        outFile.appendData(data + i, totalWavSize);
                        
                        auto* obj = new juce::DynamicObject();
                        obj->setProperty("name", fileName);
                        obj->setProperty("path", outFile.getFullPathName().replaceCharacter('\\', '/'));
                        obj->setProperty("type", "audio");
                        obj->setProperty("size", (juce::int64) totalWavSize);
                        results.add(juce::var(obj));

                        i += totalWavSize;
                        continue;
                    }
                }
            }
            
            // ─── 2. Scan FLAC: "fLaC" ───
            else if (data[i] == 'f' && data[i+1] == 'L' && data[i+2] == 'a' && data[i+3] == 'C')
            {
                // Find end of FLAC chunk (scan forward until next file header or EOF)
                size_t flacEnd = i + 4;
                bool foundEnd = false;
                for (size_t j = i + 4; j < size - 4; j++)
                {
                    if ((data[j] == 'R' && data[j+1] == 'I' && data[j+2] == 'F' && data[j+3] == 'F') ||
                        (data[j] == 'f' && data[j+1] == 'L' && data[j+2] == 'a' && data[j+3] == 'C') ||
                        (data[j] == 0x89 && data[j+1] == 0x50 && data[j+2] == 0x4E && data[j+3] == 0x47))
                    {
                        flacEnd = j;
                        foundEnd = true;
                        break;
                    }
                }
                if (!foundEnd) flacEnd = size;
                
                size_t flacSize = flacEnd - i;
                if (flacSize > 44) // minimum size of playable FLAC
                {
                    juce::String fileName = baseName + "_sample_" + juce::String(sampleCount++) + ".flac";
                    juce::File outFile = outputDir.getChildFile(fileName);
                    outFile.deleteFile();
                    
                    outFile.appendData(data + i, flacSize);
                    
                    auto* obj = new juce::DynamicObject();
                    obj->setProperty("name", fileName);
                    obj->setProperty("path", outFile.getFullPathName().replaceCharacter('\\', '/'));
                    obj->setProperty("type", "audio");
                    obj->setProperty("size", (juce::int64) flacSize);
                    results.add(juce::var(obj));

                    i += flacSize;
                    continue;
                }
            }
            
            // ─── 3. Scan PNG: "\x89PNG\r\n\x1a\n" ───
            else if (data[i] == 0x89 && data[i+1] == 0x50 && data[i+2] == 0x4E && data[i+3] == 0x47 &&
                     data[i+4] == 0x0D && data[i+5] == 0x0A && data[i+6] == 0x1A && data[i+7] == 0x0A)
            {
                // Scan forward for IEND chunk: "IEND" followed by 4 bytes CRC
                size_t pngEnd = 0;
                for (size_t j = i + 8; j < size - 8; j++)
                {
                    if (data[j] == 'I' && data[j+1] == 'E' && data[j+2] == 'N' && data[j+3] == 'D')
                    {
                        pngEnd = j + 8; // IEND (4 bytes) + CRC (4 bytes)
                        break;
                    }
                }
                
                if (pngEnd > 0 && pngEnd <= size)
                {
                    size_t pngSize = pngEnd - i;
                    juce::String fileName = baseName + "_skin_" + juce::String(graphicCount++) + ".png";
                    juce::File outFile = outputDir.getChildFile(fileName);
                    outFile.deleteFile();
                    
                    outFile.appendData(data + i, pngSize);
                    
                    auto* obj = new juce::DynamicObject();
                    obj->setProperty("name", fileName);
                    obj->setProperty("path", outFile.getFullPathName().replaceCharacter('\\', '/'));
                    obj->setProperty("type", "graphic");
                    obj->setProperty("size", (juce::int64) pngSize);
                    results.add(juce::var(obj));

                    i += pngSize;
                    continue;
                }
            }
            
            i++;
        }
        
        return results;
    }
};
