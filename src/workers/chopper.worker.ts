// chopper.worker.ts
// Web Worker for processing audio transient detection off the main thread.

self.onmessage = (e: MessageEvent) => {
  const { channelData, sampleRate, duration, sensitivity, minSpacing } = e.data;

  // We map sensitivity 0-100 to an effective threshold
  // Assuming sensitivity 50 -> 0.05 threshold
  // Higher sensitivity -> lower threshold
  const threshold = 0.5 * Math.pow(0.1, sensitivity / 50);

  const markers: number[] = [];
  const step = Math.floor(sampleRate * 0.01); // 10ms windows
  let lastMarkerTime = -minSpacing;

  for (let i = 0; i < channelData.length; i += step) {
    const time = i / sampleRate;
    let peak = 0;
    
    // Find the peak in this 10ms window
    for (let j = 0; j < step && i + j < channelData.length; j++) {
      peak = Math.max(peak, Math.abs(channelData[i + j]));
    }

    if (peak > threshold && (time - lastMarkerTime) > minSpacing) {
      markers.push(time / duration); // Normalized 0.0 - 1.0
      lastMarkerTime = time;
    }
  }

  // Return at most 16 markers
  const finalMarkers = markers.slice(0, 16);

  self.postMessage({ markers: finalMarkers });
};
