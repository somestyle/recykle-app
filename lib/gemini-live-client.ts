import type { CityInfo, DisposalResult, ServerMessage } from './types';

export type GeminiLiveStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected' // WebSocket open, waiting for Gemini session
  | 'ready'     // Gemini session established, streaming active
  | 'speaking'  // Gemini is outputting audio
  | 'error';

export interface GeminiLiveCallbacks {
  onStatusChange: (status: GeminiLiveStatus) => void;
  onDisposalResult: (result: DisposalResult, thumbnail?: string, thinkingText?: string) => void;
  onTranscriptUpdate: (text: string) => void;
  onUserTranscript?: (text: string, finished: boolean) => void;
  onTurnComplete?: () => void;
  onError: (message: string) => void;
}

export class GeminiLiveClient {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private mediaStream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private videoInterval: ReturnType<typeof setInterval> | null = null;
  private audioQueue: AudioBuffer[] = [];
  private isPlayingAudio = false;
  private nextPlayTime = 0;
  private status: GeminiLiveStatus = 'disconnected';
  private callbacks: GeminiLiveCallbacks;
  private thinkingTranscript = '';    // pre-disposal text (not shown in caption)
  private responseTranscript = '';    // post-disposal spoken response text
  private disposalFiredThisTurn = false;
  private streamingPaused = false;
  private lastThumbnail: string | undefined;

  constructor(callbacks: GeminiLiveCallbacks) {
    this.callbacks = callbacks;
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  async start(city: CityInfo, videoEl: HTMLVideoElement): Promise<void> {
    this.videoElement = videoEl;
    this.setStatus('connecting');

    // Connect WebSocket
    const wsUrl = this.getWebSocketUrl();
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.setStatus('connected');
      // Send setup message with city info
      this.sendMessage({
        type: 'setup',
        city: city.city,
        province: city.province,
        country: city.country,
        cityKey: city.key,
      });
    };

    this.ws.onmessage = (event) => {
      this.handleServerMessage(JSON.parse(event.data) as ServerMessage);
    };

    this.ws.onerror = () => {
      this.setStatus('error');
      this.callbacks.onError('WebSocket connection failed. Check server and API key.');
    };

    this.ws.onclose = () => {
      if (this.status !== 'error') {
        this.setStatus('disconnected');
      }
      this.cleanup(false);
    };

    // Start microphone and audio worklet
    try {
      await this.startAudioCapture();
    } catch (err) {
      this.callbacks.onError(`Microphone access failed: ${(err as Error).message}`);
      this.stop();
      return;
    }
  }

  stop(): void {
    this.cleanup(true);
    this.setStatus('disconnected');
  }

  pause(): void {
    this.streamingPaused = true;
  }

  resume(): void {
    this.streamingPaused = false;
  }

  // Send a "Check This" query — captures the current frame and sends it with the text turn
  sendCheckThis(): void {
    // Capture a high-quality snapshot of the current camera frame
    let imageData: string | undefined;
    if (this.videoElement && this.videoElement.videoWidth > 0) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = this.videoElement.videoWidth;
        canvas.height = this.videoElement.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(this.videoElement, 0, 0);
          // Strip the data URL prefix — server only needs raw base64
          imageData = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
        }
      } catch {
        // If capture fails, fall back to text-only (Gemini will use recent stream frames)
      }
    }
    this.sendMessage({
      type: 'clientText',
      text: 'Look at this image and identify the item. What is it and how should I dispose of it?',
      image: imageData,
    });
  }

  // ─── Internal: WebSocket message handling ────────────────────────────────────

  private handleServerMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'connected':
        // WebSocket connected, waiting for Gemini to be ready
        break;

      case 'ready':
        this.setStatus('ready');
        // Start sending video frames once Gemini is ready
        this.startVideoCapture();
        break;

      case 'audio':
        this.setStatus('speaking');
        this.queueAudio(msg.data, msg.mimeType);
        break;

      case 'text':
        if (this.disposalFiredThisTurn) {
          // Post-disposal spoken verdict — stream live into caption
          this.responseTranscript += msg.text;
          this.callbacks.onTranscriptUpdate(this.responseTranscript);
        } else {
          // Pre-disposal or conversational — accumulate for Thinking bubble
          // AND stream live into caption so the user sees it as it's spoken
          this.thinkingTranscript += msg.text;
          this.callbacks.onTranscriptUpdate(this.thinkingTranscript);
        }
        break;

      case 'disposal': {
        this.disposalFiredThisTurn = true;
        // Clear the streamed pre-disposal text from the caption — the card takes over,
        // and the post-disposal verdict will stream fresh into the transcript
        this.callbacks.onTranscriptUpdate('');
        this.responseTranscript = '';
        const d = msg as typeof msg & { address?: { name: string; address: string; note: string } };
        this.callbacks.onDisposalResult(
          {
            item: d.item,
            material: d.material,
            category: d.category,
            explanation: d.explanation,
            tip: d.tip,
            ...(d.address ? { address: d.address } : {}),
          },
          this.lastThumbnail,
          this.thinkingTranscript || undefined,
        );
        this.thinkingTranscript = '';
        this.responseTranscript = '';
        break;
      }

      case 'turnComplete':
        // Text is already streamed live — just reset buffers and signal turn end
        this.thinkingTranscript = '';
        this.responseTranscript = '';
        this.disposalFiredThisTurn = false;
        this.callbacks.onTurnComplete?.();
        if (this.status === 'speaking') {
          this.onAudioDrained(() => this.setStatus('ready'));
        }
        break;

      case 'interrupted':
        this.thinkingTranscript = '';
        this.responseTranscript = '';
        this.disposalFiredThisTurn = false;
        this.callbacks.onTurnComplete?.();
        this.clearAudioQueue();
        this.setStatus('ready');
        break;

      case 'userTranscript':
        this.callbacks.onUserTranscript?.(msg.text, msg.finished);
        break;

      case 'error':
        this.callbacks.onError(msg.message);
        this.setStatus('error');
        break;
    }
  }

  // ─── Audio capture (microphone → PCM16 → WebSocket) ──────────────────────

  private async startAudioCapture(): Promise<void> {
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });

    this.audioContext = new AudioContext({ sampleRate: 16000 });

    // Load the AudioWorklet processor
    await this.audioContext.audioWorklet.addModule('/audio-processor.js');

    const source = this.audioContext.createMediaStreamSource(this.mediaStream);

    this.workletNode = new AudioWorkletNode(this.audioContext, 'recykle-audio-processor');
    this.workletNode.port.onmessage = (event: MessageEvent<{ pcm16: Int16Array }>) => {
      if (this.ws?.readyState !== WebSocket.OPEN) return;
      if (this.status !== 'ready' && this.status !== 'speaking') return;
      if (this.streamingPaused) return;

      const { pcm16 } = event.data;
      const base64 = this.int16ToBase64(pcm16);
      this.sendMessage({ type: 'audio', data: base64 });
    };

    source.connect(this.workletNode);
    // Don't connect workletNode to destination — we don't want to hear ourselves
  }

  // ─── Video capture (camera frame → JPEG → WebSocket) ─────────────────────

  private startVideoCapture(): void {
    if (this.videoInterval) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    // Send a frame every 1 second
    this.videoInterval = setInterval(() => {
      if (!this.videoElement || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      if (this.status !== 'ready' && this.status !== 'speaking') return;
      if (this.streamingPaused) return;

      const video = this.videoElement;
      if (video.videoWidth === 0 || video.videoHeight === 0) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      // Get base64 JPEG (quality 0.8 for reasonable size)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      const base64 = dataUrl.split(',')[1];

      // Save thumbnail for history
      this.lastThumbnail = canvas.toDataURL('image/jpeg', 0.3);

      this.sendMessage({ type: 'video', data: base64 });
    }, 1000);
  }

  private stopVideoCapture(): void {
    if (this.videoInterval) {
      clearInterval(this.videoInterval);
      this.videoInterval = null;
    }
  }

  // ─── Audio playback (PCM16 chunks → AudioContext) ─────────────────────────

  private queueAudio(base64Data: string, mimeType: string): void {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }

    // Parse sample rate from MIME type (e.g. "audio/pcm;rate=24000")
    const rateMatch = mimeType.match(/rate=(\d+)/);
    const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;

    const pcm16 = this.base64ToInt16(base64Data);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / 32768.0;
    }

    const buffer = this.audioContext.createBuffer(1, float32.length, sampleRate);
    buffer.getChannelData(0).set(float32);
    this.audioQueue.push(buffer);

    if (!this.isPlayingAudio) {
      this.playNextAudio();
    }
  }

  private playNextAudio(): void {
    if (!this.audioContext || this.audioQueue.length === 0) {
      this.isPlayingAudio = false;
      return;
    }

    this.isPlayingAudio = true;
    const buffer = this.audioQueue.shift()!;

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);

    const startTime = Math.max(this.audioContext.currentTime, this.nextPlayTime);
    source.start(startTime);
    this.nextPlayTime = startTime + buffer.duration;

    source.onended = () => {
      this.playNextAudio();
    };
  }

  private clearAudioQueue(): void {
    this.audioQueue = [];
    this.isPlayingAudio = false;
    this.nextPlayTime = 0;
  }

  private onAudioDrained(callback: () => void): void {
    if (!this.audioContext || this.audioQueue.length === 0) {
      callback();
      return;
    }
    // Poll until audio queue is empty
    const check = setInterval(() => {
      if (this.audioQueue.length === 0 && !this.isPlayingAudio) {
        clearInterval(check);
        callback();
      }
    }, 200);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private getWebSocketUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/ws/gemini`;
  }

  private sendMessage(msg: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private setStatus(status: GeminiLiveStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.callbacks.onStatusChange(status);
    }
  }

  private cleanup(closeWs: boolean): void {
    this.stopVideoCapture();

    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    this.clearAudioQueue();

    if (closeWs && this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private int16ToBase64(int16: Int16Array): string {
    const bytes = new Uint8Array(int16.buffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  private base64ToInt16(base64: string): Int16Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Int16Array(bytes.buffer);
  }

  // Expose media stream so LiveScanner can attach it to a video element
  getMediaStream(): MediaStream | null {
    return this.mediaStream;
  }

  // Capture a JPEG thumbnail of the current frame
  captureThumbnail(videoEl: HTMLVideoElement): string | undefined {
    if (!videoEl || videoEl.videoWidth === 0) return undefined;
    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    canvas.getContext('2d')?.drawImage(videoEl, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.3);
  }
}
