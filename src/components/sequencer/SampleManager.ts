/**
 * SampleManager — AudioBuffer Loader & Cache
 * Handles fetching and decoding audio samples for the sequencer.
 */

export interface SampleKit {
  id: string;
  name: string;
  samples: Record<number, string>; // trackIndex -> url
}

const DIVINE_TRAP_KIT: SampleKit = {
  id: 'divine-trap',
  name: 'Divine Trap Kit',
  samples: {
    0: 'https://raw.githubusercontent.com/marius-f/drum-samples/master/808/808-Kicks01.wav',  // Kick
    1: 'https://raw.githubusercontent.com/marius-f/drum-samples/master/808/808-Snare01.wav',  // Snare
    2: 'https://raw.githubusercontent.com/marius-f/drum-samples/master/808/808-HiHats01.wav', // HH
    3: 'https://raw.githubusercontent.com/marius-f/drum-samples/master/808/808-OpenHiHats01.wav', // OH
    4: 'https://raw.githubusercontent.com/marius-f/drum-samples/master/808/808-Clap01.wav',   // Clap/Perc1
    5: 'https://raw.githubusercontent.com/marius-f/drum-samples/master/808/808-Cowbell.wav',  // Perc2
    6: 'https://raw.githubusercontent.com/marius-f/drum-samples/master/808/808-Kicks05.wav',  // 808
    7: 'https://raw.githubusercontent.com/marius-f/drum-samples/master/808/808-Maracas.wav',  // FX/Perc
  }
};

class SampleManager {
  private cache: Map<string, AudioBuffer> = new Map();
  private loading: Map<string, Promise<AudioBuffer>> = new Map();

  private reversedCache: Map<AudioBuffer, AudioBuffer> = new Map();

  async getSample(ctx: AudioContext, url: string): Promise<AudioBuffer> {
    if (this.cache.has(url)) return this.cache.get(url)!;
    if (this.loading.has(url)) return this.loading.get(url)!;

    const promise = (async () => {
      try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        this.cache.set(url, audioBuffer);
        return audioBuffer;
      } catch (err) {
        console.error(`Failed to load sample: ${url}`, err);
        throw err;
      } finally {
        this.loading.delete(url);
      }
    })();

    this.loading.set(url, promise);
    return promise;
  }

  reverseBuffer(ctx: AudioContext, buffer: AudioBuffer): AudioBuffer {
    if (this.reversedCache.has(buffer)) return this.reversedCache.get(buffer)!;

    const reversed = ctx.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );

    for (let i = 0; i < buffer.numberOfChannels; i++) {
      const dest = reversed.getChannelData(i);
      const src = buffer.getChannelData(i);
      for (let j = 0, len = buffer.length; j < len; j++) {
        dest[j] = src[len - 1 - j];
      }
    }

    this.reversedCache.set(buffer, reversed);
    return reversed;
  }

  async loadKit(ctx: AudioContext, kit: SampleKit = DIVINE_TRAP_KIT): Promise<Record<number, AudioBuffer>> {
    const buffers: Record<number, AudioBuffer> = {};
    const promises = Object.entries(kit.samples).map(async ([idx, url]) => {
      const buffer = await this.getSample(ctx, url);
      buffers[parseInt(idx)] = buffer;
    });
    await Promise.all(promises);
    return buffers;
  }

  getDivineKit() {
    return DIVINE_TRAP_KIT;
  }
}

export const sampleManager = new SampleManager();
