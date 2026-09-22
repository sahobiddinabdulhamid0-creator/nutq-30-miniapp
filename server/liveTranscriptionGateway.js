const crypto = require('crypto');
const { WebSocket, WebSocketServer } = require('ws');

const GEMINI_LIVE_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

function createLiveTranscriptionGateway({ apiKey, model = 'gemini-3.5-transcribe-live' } = {}) {
  const tickets = new Map();
  const websocketServer = new WebSocketServer({ noServer: true, maxPayload: 96 * 1024 });

  function issueTicket(userId) {
    if (!apiKey) throw new Error('GEMINI_API_KEY serverda sozlanmagan.');
    const ticket = crypto.randomBytes(32).toString('base64url');
    const expiresAt = Date.now() + 60_000;
    tickets.set(ticket, { userId: String(userId), expiresAt });
    return { ticket, model, expiresAt: new Date(expiresAt).toISOString() };
  }

  function consumeTicket(ticket) {
    const record = tickets.get(ticket);
    tickets.delete(ticket);
    if (!record || record.expiresAt < Date.now()) return null;
    return record;
  }

  function rejectUpgrade(socket, status = '401 Unauthorized') {
    socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
    socket.destroy();
  }

  function attach(httpServer) {
    httpServer.on('upgrade', (request, socket, head) => {
      let url;
      try {
        url = new URL(request.url, 'http://localhost');
      } catch {
        return rejectUpgrade(socket, '400 Bad Request');
      }
      if (url.pathname !== '/api/live/stream') return rejectUpgrade(socket, '404 Not Found');
      const identity = consumeTicket(url.searchParams.get('ticket'));
      if (!identity) return rejectUpgrade(socket);

      websocketServer.handleUpgrade(request, socket, head, client => {
        websocketServer.emit('connection', client, request, identity);
      });
    });
  }

  websocketServer.on('connection', client => {
    const upstream = new WebSocket(`${GEMINI_LIVE_URL}?key=${encodeURIComponent(apiKey)}`);
    const pending = [];
    let upstreamReady = false;

    const closeBoth = (code = 1011, reason = 'Jonli transkripsiya uzildi') => {
      if (client.readyState === WebSocket.OPEN) client.close(code, reason);
      if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) upstream.close();
    };

    const forwardAudio = raw => {
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        return;
      }
      const input = message.realtimeInput;
      if (!input || typeof input !== 'object') return;

      const normalized = { realtimeInput: {} };
      if (input.audio && typeof input.audio.data === 'string') {
        if (input.audio.data.length > 90_000) return;
        normalized.realtimeInput.audio = {
          data: input.audio.data,
          mimeType: 'audio/pcm;rate=16000'
        };
      }
      if (input.audioStreamEnd === true) normalized.realtimeInput.audioStreamEnd = true;
      if (!normalized.realtimeInput.audio && !normalized.realtimeInput.audioStreamEnd) return;

      const payload = JSON.stringify(normalized);
      if (!upstreamReady) {
        pending.push(payload);
        if (pending.length > 100) pending.shift();
        return;
      }
      upstream.send(payload);
    };

    client.on('message', forwardAudio);
    client.on('close', () => {
      if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) upstream.close();
    });
    client.on('error', () => closeBoth());

    upstream.on('open', () => {
      upstream.send(JSON.stringify({
        setup: {
          model: `models/${model}`,
          generationConfig: { responseModalities: ['TEXT'] },
          inputAudioTranscription: { languageCodes: [] }
        }
      }));
    });

    upstream.on('message', raw => {
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (message.setupComplete) {
        upstreamReady = true;
        while (pending.length && upstream.readyState === WebSocket.OPEN) upstream.send(pending.shift());
      }
      if (client.readyState === WebSocket.OPEN) client.send(raw.toString());
    });
    upstream.on('error', () => closeBoth());
    upstream.on('close', () => {
      if (client.readyState === WebSocket.OPEN) client.close(1011, 'Gemini Live ulanishi yopildi');
    });
  });

  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [ticket, record] of tickets.entries()) {
      if (record.expiresAt < now) tickets.delete(ticket);
    }
  }, 60_000);
  cleanupTimer.unref();

  return { attach, issueTicket };
}

module.exports = { createLiveTranscriptionGateway };
