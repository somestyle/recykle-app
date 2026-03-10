/**
 * AudioWorklet processor for capturing raw PCM16 audio from the microphone.
 * Runs in a separate audio thread for low-latency capture.
 *
 * Output: 16-bit signed integers at the stream's native sample rate (typically 44100 or 48000 Hz).
 * The main thread is responsible for downsampling to 16000 Hz if needed.
 */
class RecykleAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    // Send chunks roughly every 250ms to avoid too many messages
    // At 16000 Hz: 250ms = 4000 samples
    this._chunkSize = 4096;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const channelData = input[0]; // Float32Array, mono
    if (!channelData) return true;

    // Downsample from native rate (sampleRate) to 16000 Hz
    const ratio = sampleRate / 16000;
    const outputLength = Math.floor(channelData.length / ratio);
    const downsampled = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      // Simple linear interpolation for downsampling
      const srcIdx = i * ratio;
      const idx0 = Math.floor(srcIdx);
      const idx1 = Math.min(idx0 + 1, channelData.length - 1);
      const frac = srcIdx - idx0;
      downsampled[i] = channelData[idx0] * (1 - frac) + channelData[idx1] * frac;
    }

    // Convert Float32 to Int16 (PCM16)
    const int16 = new Int16Array(downsampled.length);
    for (let i = 0; i < downsampled.length; i++) {
      const s = Math.max(-1, Math.min(1, downsampled[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    // Accumulate samples
    for (let i = 0; i < int16.length; i++) {
      this._buffer.push(int16[i]);
    }

    // Send in chunks
    while (this._buffer.length >= this._chunkSize) {
      const chunk = new Int16Array(this._buffer.splice(0, this._chunkSize));
      this.port.postMessage({ pcm16: chunk }, [chunk.buffer]);
    }

    return true;
  }
}

registerProcessor('recykle-audio-processor', RecykleAudioProcessor);
