class AudioSpeechRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.stream = null;
    this.audioContext = null;
    this.source = null;
    this.analyser = null;
    this.processor = null;
    this.silentGain = null;
    this.animationFrame = null;
    this.timer = null;
    this.chunks = [];
    this.startedAt = 0;
    this.elapsedSeconds = 0;
    this.isRecording = false;
    this.maxSeconds = 300;
    this.onTick = null;
    this.onVolume = null;
    this.onPcm = null;
    this.onLimit = null;
  }

  static supported() {
    return Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
  }

  static chooseMimeType() {
    const options = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4'
    ];
    return options.find(type => MediaRecorder.isTypeSupported(type)) || '';
  }

  async start({ maxSeconds = 300 } = {}) {
    if (!AudioSpeechRecorder.supported()) {
      throw new Error('Bu qurilmada audio yozish qo‘llanmaydi. Telegram yoki zamonaviy brauzerni yangilang.');
    }
    if (this.isRecording) throw new Error('Yozuv allaqachon boshlangan.');

    this.maxSeconds = maxSeconds;
    this.elapsedSeconds = 0;
    this.chunks = [];

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        },
        video: false
      });
    } catch (error) {
      if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
        throw new Error('Mikrofon ruxsati berilmadi. Telegram sozlamalaridan mikrofonni yoqing.');
      }
      if (error.name === 'NotFoundError') {
        throw new Error('Mikrofon topilmadi. Qurilma mikrofonini tekshiring.');
      }
      throw new Error(`Mikrofonni ishga tushirib bo‘lmadi: ${error.message}`);
    }

    const mimeType = AudioSpeechRecorder.chooseMimeType();
    this.mediaRecorder = mimeType
      ? new MediaRecorder(this.stream, { mimeType, audioBitsPerSecond: 96000 })
      : new MediaRecorder(this.stream);
    this.mediaRecorder.ondataavailable = event => {
      if (event.data?.size) this.chunks.push(event.data);
    };
    this.mediaRecorder.onerror = event => console.error('MediaRecorder:', event.error);

    this.mediaRecorder.start(500);
    this.isRecording = true;
    this.startedAt = Date.now();
    this._startMeter();
    this._startTimer();
    return true;
  }

  _startTimer() {
    this.timer = setInterval(() => {
      this.elapsedSeconds = Math.max(0, Math.floor((Date.now() - this.startedAt) / 1000));
      this.onTick?.(this.elapsedSeconds, AudioSpeechRecorder.formatTime(this.elapsedSeconds));
      if (this.elapsedSeconds >= this.maxSeconds) {
        clearInterval(this.timer);
        this.onLimit?.();
      }
    }, 250);
  }

  _startMeter() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    this.audioContext = new AudioContextClass();
    this.audioContext.resume?.().catch(() => {});
    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.source.connect(this.analyser);

    if (this.audioContext.createScriptProcessor) {
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.silentGain = this.audioContext.createGain();
      this.silentGain.gain.value = 0;
      this.processor.onaudioprocess = event => {
        if (!this.isRecording || !this.onPcm) return;
        const input = event.inputBuffer.getChannelData(0);
        this.onPcm(AudioSpeechRecorder.toPcm16k(input, this.audioContext.sampleRate));
      };
      this.source.connect(this.processor);
      this.processor.connect(this.silentGain);
      this.silentGain.connect(this.audioContext.destination);
    }
    const values = new Uint8Array(this.analyser.frequencyBinCount);
    const draw = () => {
      if (!this.isRecording && this.mediaRecorder?.state !== 'recording') return;
      this.analyser.getByteFrequencyData(values);
      const average = values.reduce((sum, value) => sum + value, 0) / values.length;
      this.onVolume?.(Math.min(1, average / 100), values);
      this.animationFrame = requestAnimationFrame(draw);
    };
    draw();
  }

  async stop() {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      throw new Error('Faol yozuv topilmadi.');
    }
    const durationSeconds = Math.max(1, Math.floor((Date.now() - this.startedAt) / 1000));
    return new Promise((resolve, reject) => {
      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(this.chunks, { type: mimeType });
        this._cleanup();
        if (!blob.size) return reject(new Error('Audio yozuv bo‘sh chiqdi. Qayta urinib ko‘ring.'));
        resolve({ blob, mimeType, durationSeconds, audioUrl: URL.createObjectURL(blob) });
      };
      this.mediaRecorder.stop();
      this.isRecording = false;
    });
  }

  cancel() {
    try {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') this.mediaRecorder.stop();
    } catch {}
    this.isRecording = false;
    this.chunks = [];
    this._cleanup();
  }

  _cleanup() {
    clearInterval(this.timer);
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    if (this.processor) this.processor.onaudioprocess = null;
    try { this.processor?.disconnect(); } catch {}
    try { this.silentGain?.disconnect(); } catch {}
    try { this.source?.disconnect(); } catch {}
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
    if (this.audioContext && this.audioContext.state !== 'closed') this.audioContext.close().catch(() => {});
    this.audioContext = null;
    this.source = null;
    this.analyser = null;
    this.processor = null;
    this.silentGain = null;
  }

  static toPcm16k(input, sourceRate) {
    const targetRate = 16000;
    const ratio = sourceRate / targetRate;
    const outputLength = Math.max(1, Math.floor(input.length / ratio));
    const buffer = new ArrayBuffer(outputLength * 2);
    const view = new DataView(buffer);

    for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
      const start = Math.floor(outputIndex * ratio);
      const end = Math.min(input.length, Math.max(start + 1, Math.floor((outputIndex + 1) * ratio)));
      let sum = 0;
      for (let inputIndex = start; inputIndex < end; inputIndex += 1) sum += input[inputIndex];
      const sample = Math.max(-1, Math.min(1, sum / (end - start)));
      view.setInt16(outputIndex * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    }
    return new Uint8Array(buffer);
  }

  static formatTime(seconds) {
    const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
    const rest = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${minutes}:${rest}`;
  }
}

window.AudioSpeechRecorder = AudioSpeechRecorder;
