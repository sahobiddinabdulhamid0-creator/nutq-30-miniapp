const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const API_KEY = process.env.GEMINI_API_KEY;
const DEFAULT_ANALYSIS_MODEL = process.env.GEMINI_ANALYSIS_MODEL || 'gemini-3.8-flash';
const ANALYSIS_FALLBACKS = String(process.env.GEMINI_ANALYSIS_FALLBACK_MODELS || 'gemini-3.5-flash-lite,gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);
const TRANSCRIBE_MODEL = process.env.GEMINI_TRANSCRIBE_MODEL || 'gemini-3.5-transcribe';
const LIVE_TRANSCRIBE_MODEL = process.env.GEMINI_LIVE_TRANSCRIBE_MODEL || 'gemini-3.5-transcribe-live';
const PRIMARY_ANALYSIS_TIMEOUT_MS = Math.max(1000, Number(process.env.GEMINI_PRIMARY_TIMEOUT_MS) || 10_000);
const FALLBACK_ANALYSIS_TIMEOUT_MS = Math.max(5000, Number(process.env.GEMINI_FALLBACK_TIMEOUT_MS) || 25_000);
const TTS_MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-3.1-flash-tts-preview';
const TTS_VOICE = process.env.GEMINI_TTS_VOICE || 'Kore';

let modelCache = { expiresAt: 0, names: [] };

function requireApiKey() {
  if (!API_KEY) throw new Error('GEMINI_API_KEY serverda sozlanmagan.');
}

async function geminiFetch(endpoint, options = {}) {
  requireApiKey();
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': API_KEY,
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const body = await response.text();
    const safeBody = body.slice(0, 800).replaceAll(API_KEY, '[redacted]');
    const error = new Error(`Gemini API ${response.status}: ${safeBody}`);
    error.status = response.status;
    throw error;
  }
  return response;
}

async function listAvailableModels(force = false) {
  if (!API_KEY) return [];
  if (!force && modelCache.expiresAt > Date.now()) return modelCache.names;

  const response = await geminiFetch('/models?pageSize=1000', { method: 'GET' });
  const data = await response.json();
  const names = (data.models || [])
    .map(model => String(model.name || '').replace(/^models\//, ''))
    .filter(Boolean);
  modelCache = { expiresAt: Date.now() + 10 * 60 * 1000, names };
  return names;
}

async function getCapabilities() {
  if (!API_KEY) {
    return {
      configured: false,
      analysisModel: DEFAULT_ANALYSIS_MODEL,
      fallbackModel: ANALYSIS_FALLBACKS[0] || null,
      transcribeModel: TRANSCRIBE_MODEL,
      liveTranscribeModel: LIVE_TRANSCRIBE_MODEL,
      ttsModel: TTS_MODEL,
      analysisAvailable: false,
      transcriptionAvailable: false,
      liveTranscriptionAvailable: false,
      ttsAvailable: false
    };
  }

  try {
    const names = await listAvailableModels();
    return {
      configured: true,
      analysisModel: [DEFAULT_ANALYSIS_MODEL, ...ANALYSIS_FALLBACKS].find(name => names.includes(name)) || DEFAULT_ANALYSIS_MODEL,
      fallbackModel: ANALYSIS_FALLBACKS.find(name => names.includes(name)) || null,
      transcribeModel: TRANSCRIBE_MODEL,
      liveTranscribeModel: LIVE_TRANSCRIBE_MODEL,
      ttsModel: TTS_MODEL,
      analysisAvailable: [DEFAULT_ANALYSIS_MODEL, ...ANALYSIS_FALLBACKS].some(name => names.includes(name)),
      transcriptionAvailable: names.includes(TRANSCRIBE_MODEL),
      liveTranscriptionAvailable: names.includes(LIVE_TRANSCRIBE_MODEL),
      ttsAvailable: names.includes(TTS_MODEL)
    };
  } catch (error) {
    return {
      configured: true,
      analysisModel: DEFAULT_ANALYSIS_MODEL,
      fallbackModel: ANALYSIS_FALLBACKS[0] || null,
      transcribeModel: TRANSCRIBE_MODEL,
      liveTranscribeModel: LIVE_TRANSCRIBE_MODEL,
      ttsModel: TTS_MODEL,
      analysisAvailable: true,
      transcriptionAvailable: true,
      liveTranscriptionAvailable: true,
      ttsAvailable: true,
      discoveryWarning: error.message
    };
  }
}

function parseJsonResponse(text) {
  const cleaned = String(text || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

function numberInRange(value, min, max, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new Error(`Gemini javobida ${field} noto‘g‘ri.`);
  }
  return number;
}

function sanitizeString(value, maxLength = 4000) {
  return String(value || '').trim().slice(0, maxLength);
}

function validateEvaluation(data, lesson, durationSeconds) {
  if (!data || typeof data !== 'object') throw new Error('Gemini tahlili bo‘sh qaytdi.');
  const transcript = sanitizeString(data.transcript, 12000);
  if (!transcript) throw new Error('Gemini transkripsiya qaytarmadi.');

  const activeIds = new Set(lesson.activeMetricIds);
  const metricScores = Array.isArray(data.metricScores)
    ? data.metricScores
        .filter(item => activeIds.has(item.metricId))
        .map(item => ({
          metricId: item.metricId,
          score: numberInRange(item.score, 0, 10, `metricScores.${item.metricId}`),
          evidence: sanitizeString(item.evidence, 500)
        }))
    : [];

  for (const metricId of activeIds) {
    if (!metricScores.some(item => item.metricId === metricId)) {
      throw new Error(`Gemini ${metricId} mezonini qaytarmadi.`);
    }
  }

  const totalScore = Math.round(
    (metricScores.reduce((sum, item) => sum + item.score, 0) / metricScores.length) * 10
  );

  const pillarScores = {};
  for (const metric of lesson.activeMetrics) {
    const scored = metricScores.find(item => item.metricId === metric.id);
    if (!scored) continue;
    if (!pillarScores[metric.pillar]) pillarScores[metric.pillar] = [];
    pillarScores[metric.pillar].push(scored.score);
  }
  for (const [pillar, scores] of Object.entries(pillarScores)) {
    pillarScores[pillar] = Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 2);
  }

  const parasiteWords = Array.isArray(data.parasiteWords)
    ? data.parasiteWords.slice(0, 15).map(item => ({
        word: sanitizeString(item.word, 40),
        count: Math.max(0, Math.round(Number(item.count) || 0)),
        evidence: sanitizeString(item.evidence, 300)
      }))
    : [];

  const strengths = Array.isArray(data.strengths)
    ? data.strengths.slice(0, 2).map(value => sanitizeString(value, 500)).filter(Boolean)
    : [];
  const improvements = Array.isArray(data.improvements)
    ? data.improvements.slice(0, 2).map(value => sanitizeString(value, 500)).filter(Boolean)
    : [];
  if (strengths.length === 0 || improvements.length === 0) {
    throw new Error('Gemini kuchli va yaxshilash nuqtalarini to‘liq qaytarmadi.');
  }

  return {
    transcript,
    durationSeconds: Math.max(1, Math.round(Number(durationSeconds) || Number(data.durationSeconds) || 1)),
    wordCount: Math.max(1, Math.round(Number(data.wordCount) || transcript.split(/\s+/).length)),
    wpm: Math.max(1, Math.round(Number(data.wpm) || 1)),
    fillerCount: Math.max(0, Math.round(Number(data.fillerCount) || 0)),
    longPauseCount: Math.max(0, Math.round(Number(data.longPauseCount) || 0)),
    restartCount: Math.max(0, Math.round(Number(data.restartCount) || 0)),
    parasiteWords,
    metricScores,
    pillarScores,
    totalScore,
    strengths,
    improvements,
    suggestedFocus: sanitizeString(data.suggestedFocus, 300),
    summary: sanitizeString(data.summary, 800),
    model: data.model || null,
    evaluatedAt: new Date().toISOString()
  };
}

function buildAnalysisPrompt(lesson, attemptNumber, selectedFocus = '') {
  const metrics = lesson.activeMetrics
    .map(metric => `- ${metric.id}: ${metric.title} (0–10)`)
    .join('\n');

  return `
Siz “Nutq 30” audio murabbiyisiz. O‘zbek lotin tilidagi yozuvni xolis va dalil bilan tahlil qiling.
Bu klinik yoki logopedik tashxis emas. Foydalanuvchini uyaltirmang va umumiy maqtov bilan cheklanmang.

KUN: ${lesson.day}. ${lesson.title}
URINISH: ${attemptNumber}
TOPSHIRIQ: ${lesson.prompt}
BUGUNGI TEKSHIRUV: ${lesson.check}
${selectedFocus ? `FOYDALANUVCHI TUZATAYOTGAN OLDINGI XATO/FOKUS: ${selectedFocus}` : ''}

Faqat quyidagi mezonlarni baholang:
${metrics}

Baholash shkalasi:
0–2: ko‘nikma ko‘rinmadi yoki nutqqa jiddiy xalal berdi.
3–5: ayrim joylarda bor, lekin barqaror emas.
6–8: ko‘p qismda to‘g‘ri, mayda uzilishlar bor.
9–10: tabiiy, barqaror va vaziyatga mos.

Qoidalar:
1. Nutqni o‘zbek lotin yozuvida so‘zma-so‘z transkripsiya qiling.
2. “eee”, “aaa”, “haligi”, “anaqa”, “demak”, “xullas” kabi parazitlarni sanang.
3. Ikki soniyadan uzun noaniq pauza va qayta boshlashlarni sanang.
4. Har bir ball uchun transkripsiyadan yoki eshitilgan holatdan aniq dalil yozing.
5. Ikki kuchli nuqta, ikki aniq yaxshilash nuqtasi va keyingi urinish uchun faqat bitta fokus bering.
${selectedFocus ? '6. Tanlangan fokus oldingi urinishga nisbatan tuzatilgan-tuzatilmaganini dalil bilan ayting.' : ''}
${selectedFocus ? '7' : '6'}. Faqat JSON qaytaring. Hech qanday Markdown yozmang.

JSON shakli:
{
  "transcript": "...",
  "durationSeconds": 60,
  "wordCount": 90,
  "wpm": 90,
  "fillerCount": 2,
  "longPauseCount": 1,
  "restartCount": 0,
  "parasiteWords": [{"word":"eee","count":2,"evidence":"qayerda eshitildi"}],
  "metricScores": [{"metricId":"oqim","score":7,"evidence":"aniq dalil"}],
  "strengths": ["aniq dalilli kuchli nuqta", "ikkinchi kuchli nuqta"],
  "improvements": ["aniq amaliy tuzatish", "ikkinchi tuzatish"],
  "suggestedFocus": "keyingi urinishda bajariladigan bitta ish",
  "summary": "2–3 jumlalik xolis xulosa"
}`.trim();
}

function buildTranscriptAnalysisPrompt(lesson, attemptNumber, transcript, durationSeconds, selectedFocus = '') {
  return `${buildAnalysisPrompt(lesson, attemptNumber, selectedFocus)}

MAXSUS TRANSKRIPSIYA MODELI QAYTARGAN MATN:
${transcript}

AUDIO DAVOMIYLIGI: ${durationSeconds} soniya.
Transkripsiyadagi parazit, takror, qayta boshlash va mazmuniy tuzilmani saqlagan holda JSON bahoni chiqaring. WPMni transkripsiya va davomiylikdan hisoblang.`;
}

async function withTimeout(operation, timeoutMs, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await operation(controller.signal);
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error(`${label} ${Math.round(timeoutMs / 1000)} soniyada javob bermadi.`);
      timeoutError.status = 408;
      timeoutError.code = 'GEMINI_TIMEOUT';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function callAnalysisModel(model, payload, timeoutMs = FALLBACK_ANALYSIS_TIMEOUT_MS) {
  return withTimeout(async signal => {
    const response = await geminiFetch(`/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      body: JSON.stringify(payload),
      signal
    });
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.find(part => typeof part.text === 'string')?.text;
    if (!text) throw new Error('Gemini tahlil matnini qaytarmadi.');
    return parseJsonResponse(text);
  }, timeoutMs, model);
}

async function transcribeAudio(audioBuffer, mimeType) {
  const payload = {
    contents: [{
      role: 'user',
      parts: [{ inlineData: { mimeType, data: audioBuffer.toString('base64') } }]
    }],
    generationConfig: {
      audioTranscriptionConfig: {
        languageCodes: []
      }
    }
  };

  return withTimeout(async signal => {
    const response = await geminiFetch(`/models/${encodeURIComponent(TRANSCRIBE_MODEL)}:generateContent`, {
      method: 'POST',
      body: JSON.stringify(payload),
      signal
    });
    const data = await response.json();
    const transcript = data.candidates?.[0]?.content?.parts
      ?.map(part => part.audioTranscription?.text || part.text || '')
      .join('\n')
      .trim();
    if (!transcript) throw new Error(`${TRANSCRIBE_MODEL} transkripsiya qaytarmadi.`);
    return transcript;
  }, FALLBACK_ANALYSIS_TIMEOUT_MS, TRANSCRIBE_MODEL);
}

async function analyzeSpeech({ audioBuffer, mimeType = 'audio/webm', lesson, attemptNumber = 1, durationSeconds, selectedFocus = '' }) {
  requireApiKey();
  if (!audioBuffer?.length) throw new Error('Audio fayl bo‘sh.');
  if (!lesson) throw new Error('Kun darsi topilmadi.');

  let availableNames = [];
  try {
    availableNames = await listAvailableModels();
  } catch (error) {
    console.warn('Gemini modellar ro‘yxatini tekshirib bo‘lmadi:', error.message);
  }

  let candidates = [...new Set([DEFAULT_ANALYSIS_MODEL, ...ANALYSIS_FALLBACKS])];
  if (availableNames.length) candidates = candidates.filter(name => availableNames.includes(name));
  if (!candidates.length) candidates = [DEFAULT_ANALYSIS_MODEL];

  const payload = {
    contents: [{
      role: 'user',
      parts: [
        { text: buildAnalysisPrompt(lesson, attemptNumber, selectedFocus) },
        { inlineData: { mimeType, data: audioBuffer.toString('base64') } }
      ]
    }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1
    }
  };

  let lastError;
  for (const [modelIndex, model] of candidates.entries()) {
    const timeoutMs = modelIndex === 0 ? PRIMARY_ANALYSIS_TIMEOUT_MS : FALLBACK_ANALYSIS_TIMEOUT_MS;
    const maxAttempts = modelIndex === 0 ? 1 : 2;
    for (let retry = 0; retry < maxAttempts; retry += 1) {
      try {
        const raw = await callAnalysisModel(model, payload, timeoutMs);
        const evaluation = validateEvaluation(raw, lesson, durationSeconds);
        evaluation.model = model;
        return evaluation;
      } catch (error) {
        lastError = error;
        console.warn(`Gemini ${model} tahlili bajarilmadi:`, error.message);
        const transient = [429, 500, 502, 503, 504].includes(error.status);
        if (!transient || retry === maxAttempts - 1) break;
        await new Promise(resolve => setTimeout(resolve, 1000 * (retry + 1)));
      }
    }
  }

  const transcribeAvailable = !availableNames.length || availableNames.includes(TRANSCRIBE_MODEL);
  if (transcribeAvailable) {
    try {
      const transcript = await transcribeAudio(audioBuffer, mimeType);
      const textPayload = {
        contents: [{
          role: 'user',
          parts: [{ text: buildTranscriptAnalysisPrompt(lesson, attemptNumber, transcript, durationSeconds, selectedFocus) }]
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1
        }
      };
      const textModels = [...new Set([
        ANALYSIS_FALLBACKS.find(name => name === 'gemini-3.5-flash-lite'),
        ...ANALYSIS_FALLBACKS,
        DEFAULT_ANALYSIS_MODEL
      ].filter(Boolean))]
        .filter(name => !availableNames.length || availableNames.includes(name));

      for (const model of textModels) {
        try {
          const raw = await callAnalysisModel(model, textPayload, FALLBACK_ANALYSIS_TIMEOUT_MS);
          if (!raw.transcript) raw.transcript = transcript;
          const evaluation = validateEvaluation(raw, lesson, durationSeconds);
          evaluation.model = `${TRANSCRIBE_MODEL} + ${model}`;
          return evaluation;
        } catch (error) {
          lastError = error;
          console.warn(`Gemini transkript asosidagi ${model} tahlili bajarilmadi:`, error.message);
        }
      }
    } catch (error) {
      lastError = error;
      console.warn(`Gemini ${TRANSCRIBE_MODEL} zaxira transkripsiyasi bajarilmadi:`, error.message);
    }
  }
  throw new Error(`Audio tahlil qilinmadi: ${lastError?.message || 'noma’lum xato'}`);
}

function wrapPcmAsWav(pcmBuffer, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * bitsPerSample / 8;
  const blockAlign = channels * bitsPerSample / 8;
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmBuffer.length, 40);
  return Buffer.concat([header, pcmBuffer]);
}

async function synthesizeLesson(lesson, options = {}) {
  requireApiKey();
  if (!lesson?.narrationText) throw new Error('Audio dars matni topilmadi.');

  const voice = options.voice || TTS_VOICE;
  const model = options.model || TTS_MODEL;
  const cacheDir = options.cacheDir || path.join(process.env.DATA_DIR || path.join(__dirname, 'data'), 'tts-cache');
  const cacheKey = crypto.createHash('sha256').update(`${model}|${voice}|${lesson.narrationText}`).digest('hex');
  const cachePath = path.join(cacheDir, `${cacheKey}.wav`);

  if (fs.existsSync(cachePath)) return fs.promises.readFile(cachePath);

  const prompt = `Quyidagi o‘zbekcha mikro-darsni ravon, xotirjam, tabiiy va o‘rgatuvchi ohangda o‘qing. O‘zbekcha O‘, G‘, Q, X, Sh va Ch tovushlarini aniq talaffuz qiling. Matnni o‘zgartirmang:\n\n${lesson.narrationText}`;
  const response = await geminiFetch('/interactions', {
    method: 'POST',
    body: JSON.stringify({
      model,
      input: prompt,
      response_format: { type: 'audio' },
      generation_config: { speech_config: [{ voice }] },
      store: false
    })
  });
  const data = await response.json();
  const contentBlocks = (data.steps || []).flatMap(step => step.content || []);
  const audioBlock = contentBlocks.find(block => block.type === 'audio' && block.data);
  const encoded = audioBlock?.data || data.output_audio?.data || data.interaction?.output_audio?.data;
  if (!encoded) throw new Error('Gemini TTS audio qaytarmadi.');

  const audioBuffer = Buffer.from(encoded, 'base64');
  const isWav = audioBuffer.subarray(0, 4).toString('ascii') === 'RIFF'
    || audioBlock?.mime_type === 'audio/wav';
  const wav = isWav
    ? audioBuffer
    : wrapPcmAsWav(audioBuffer, audioBlock?.sample_rate || 24000, audioBlock?.channels || 1);
  await fs.promises.mkdir(cacheDir, { recursive: true });
  await fs.promises.writeFile(cachePath, wav);
  return wav;
}

module.exports = {
  analyzeSpeech,
  getCapabilities,
  listAvailableModels,
  synthesizeLesson,
  validateEvaluation,
  wrapPcmAsWav
};
