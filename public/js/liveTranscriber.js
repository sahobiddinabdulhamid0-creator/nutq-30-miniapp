class GeminiLiveTranscriber {
  constructor({ onTranscript, onStatus } = {}) {
    this.onTranscript = onTranscript;
    this.onStatus = onStatus;
    this.socket = null;
    this.ready = false;
    this.stopped = false;
    this.pendingChunks = [];
    this.startPromise = null;
  }

  start() {
    if (this.startPromise) return this.startPromise;
    this.stopped = false;
    this.onStatus?.('connecting');
    this.startPromise = this._connect();
    return this.startPromise;
  }

  async _connect() {
    const credentials = await Api.post('/api/live/token', {});
    if (this.stopped) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const endpoint = `${protocol}//${window.location.host}/api/live/stream`;
    const url = `${endpoint}?ticket=${encodeURIComponent(credentials.ticket)}`;

    await new Promise((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.socket?.close();
        reject(new Error('Jonli transkripsiya ulanishi vaqtida javob bermadi.'));
      }, 10_000);

      this.socket = new WebSocket(url);
      this.socket.onopen = () => {};

      this.socket.onmessage = event => {
        let message;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }

        if (message.setupComplete && !settled) {
          settled = true;
          clearTimeout(timeout);
          this.ready = true;
          this.onStatus?.('ready');
          this._flush();
          resolve();
        }

        const text = message.serverContent?.interimInputTranscription?.text
          || message.serverContent?.inputTranscription?.text;
        if (text) this.onTranscript?.(String(text).trim());
      };

      this.socket.onerror = () => {
        if (settled) return this.onStatus?.('unavailable');
        settled = true;
        clearTimeout(timeout);
        reject(new Error('Jonli transkripsiyaga ulanib bo‘lmadi.'));
      };

      this.socket.onclose = () => {
        this.ready = false;
        if (!this.stopped) this.onStatus?.('unavailable');
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          reject(new Error('Jonli transkripsiya ulanishi yopildi.'));
        }
      };
    });
  }

  sendPcm(bytes) {
    if (this.stopped || !bytes?.length) return;
    const encoded = GeminiLiveTranscriber.toBase64(bytes);
    if (!this.ready || this.socket?.readyState !== WebSocket.OPEN) {
      this.pendingChunks.push(encoded);
      if (this.pendingChunks.length > 80) this.pendingChunks.shift();
      return;
    }
    this._sendAudio(encoded);
  }

  _sendAudio(data) {
    this.socket?.send(JSON.stringify({
      realtimeInput: {
        audio: { data, mimeType: 'audio/pcm;rate=16000' }
      }
    }));
  }

  _flush() {
    for (const data of this.pendingChunks.splice(0)) this._sendAudio(data);
  }

  stop() {
    this.stopped = true;
    this.pendingChunks = [];
    if (this.ready && this.socket?.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
      } catch {}
    }
    const socket = this.socket;
    setTimeout(() => {
      try { socket?.close(); } catch {}
    }, 250);
    this.socket = null;
    this.ready = false;
    this.startPromise = null;
  }

  static toBase64(bytes) {
    let binary = '';
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    return btoa(binary);
  }
}

window.GeminiLiveTranscriber = GeminiLiveTranscriber;
