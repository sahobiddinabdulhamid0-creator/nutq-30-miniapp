const express = require('express');
const http = require('http');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config();

const { createAuthMiddleware } = require('./auth');
const { configureTelegramBot, handleTelegramUpdate } = require('./botService');
const { analyzeSpeech, getCapabilities, synthesizeLesson } = require('./geminiService');
const { CURRICULUM, METRICS, PILLARS, STAGES, getDay } = require('./learningContent');
const { createLiveTranscriptionGateway } = require('./liveTranscriptionGateway');
const { UserStore, publicUser } = require('./userStore');
const pkg = require('../package.json');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const store = new UserStore();
const authenticate = createAuthMiddleware();
const activeAnalyses = new Set();
const liveGateway = createLiveTranscriptionGateway({
  apiKey: process.env.GEMINI_API_KEY,
  model: process.env.GEMINI_LIVE_TRANSCRIBE_MODEL || 'gemini-3.5-transcribe-live'
});

const allowedAudioTypes = new Set([
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/ogg',
  'audio/opus',
  'audio/mp4',
  'audio/m4a',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav'
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    if (!allowedAudioTypes.has(String(file.mimetype || '').toLowerCase())) {
      return callback(new Error('Qo‘llanmaydigan audio formati. WebM, OGG, M4A, MP3 yoki WAV ishlating.'));
    }
    callback(null, true);
  }
});

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://telegram.org https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; media-src 'self' blob: data:; connect-src 'self' ws: wss: https://cdn.tailwindcss.com; frame-ancestors https://web.telegram.org https://*.telegram.org"
  );
  req.requestId = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

const rateBuckets = new Map();
function rateLimit({ windowMs, max, keyPrefix }) {
  return (req, res, next) => {
    const subject = req.authUser?.id || req.ip || 'unknown';
    const key = `${keyPrefix}:${subject}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (bucket.count >= max) {
      res.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000));
      return res.status(429).json({ error: 'Juda ko‘p so‘rov yuborildi. Birozdan keyin qayta urinib ko‘ring.' });
    }
    bucket.count += 1;
    next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets.entries()) {
    if (bucket.resetAt <= now) rateBuckets.delete(key);
  }
}, 10 * 60 * 1000).unref();

function integer(value, min, max, field) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    const error = new Error(`${field} ${min}–${max} oralig‘ida bo‘lishi kerak.`);
    error.status = 400;
    throw error;
  }
  return parsed;
}

function shortText(value, maxLength, field, required = true) {
  const text = String(value || '').trim();
  if (required && !text) {
    const error = new Error(`${field} kiritilmadi.`);
    error.status = 400;
    throw error;
  }
  return text.slice(0, maxLength);
}

function safeJson(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'nutq-30', version: pkg.version, time: new Date().toISOString() });
});

app.post('/api/telegram/webhook', async (req, res, next) => {
  try {
    const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
    const headerSecret = req.get('x-telegram-bot-api-secret-token');
    if (!expected || headerSecret !== expected) {
      return res.sendStatus(403);
    }
    res.sendStatus(200);
    await handleTelegramUpdate(req.body);
  } catch (error) {
    next(error);
  }
});

app.use('/api', authenticate);

app.get('/api/session', async (req, res, next) => {
  try {
    const user = await store.getOrCreate(req.authUser, { advanceDay: true });
    res.json({ user: publicUser(user), devMode: !req.get('x-telegram-init-data') });
  } catch (error) {
    next(error);
  }
});

app.post('/api/onboarding', async (req, res, next) => {
  try {
    const user = await store.getOrCreate(req.authUser);
    const allowedGoals = new Set(['ravonlik', 'parazit', 'ishonch', 'intervyu', 'talaffuz', 'tuzilma']);
    const allowedLevels = new Set(['boshlangich', 'orta', 'yuqori']);
    const goal = shortText(req.body.goal, 40, 'Maqsad');
    const level = shortText(req.body.level, 20, 'Daraja');
    const dailyMinutes = integer(req.body.dailyMinutes, 5, 30, 'Kunlik vaqt');
    if (!allowedGoals.has(goal) || !allowedLevels.has(level)) {
      return res.status(400).json({ error: 'Maqsad yoki daraja noto‘g‘ri.' });
    }
    const updated = await store.finishOnboarding(user.id, { goal, level, dailyMinutes, aiConsent: true });
    res.json({ user: publicUser(updated) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/curriculum', (req, res) => {
  res.json({ curriculum: CURRICULUM, stages: STAGES, metrics: METRICS, pillars: PILLARS });
});

app.get('/api/curriculum/day/:day', (req, res) => {
  const lesson = getDay(req.params.day);
  if (!lesson) return res.status(404).json({ error: 'Kun topilmadi.' });
  res.json(lesson);
});

app.get('/api/capabilities', rateLimit({ windowMs: 60_000, max: 10, keyPrefix: 'capabilities' }), async (req, res, next) => {
  try {
    res.json(await getCapabilities());
  } catch (error) {
    next(error);
  }
});

app.post('/api/live/token', rateLimit({ windowMs: 60_000, max: 8, keyPrefix: 'live-token' }), async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.json(liveGateway.issueTicket(req.authUser.id));
  } catch (error) {
    next(error);
  }
});

app.post('/api/tts/day/:day', rateLimit({ windowMs: 60_000, max: 5, keyPrefix: 'tts' }), async (req, res, next) => {
  try {
    const user = await store.getOrCreate(req.authUser, { advanceDay: true });
    if (!user.onboarding.completed) {
      return res.status(403).json({ error: 'Avval boshlang‘ich sozlamalarni yakunlang.' });
    }
    const day = integer(req.params.day, 1, 30, 'Kun');
    const canListen = day === user.progress.currentDay || user.progress.completedDays.includes(day);
    if (!canListen) {
      return res.status(403).json({ error: 'Bu audio dars hali ochilmagan.' });
    }
    const lesson = getDay(day);
    if (!lesson) return res.status(404).json({ error: 'Kun topilmadi.' });
    const wav = await synthesizeLesson(lesson);
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.send(wav);
  } catch (error) {
    next(error);
  }
});

app.post(
  '/api/attempts/analyze',
  rateLimit({ windowMs: 60_000, max: 6, keyPrefix: 'analyze' }),
  upload.single('audio'),
  async (req, res, next) => {
    try {
      const user = await store.getOrCreate(req.authUser, { advanceDay: true });
      if (!user.onboarding.completed || !user.onboarding.aiConsent) {
        return res.status(403).json({ error: 'Avval boshlang‘ich sozlamalarni yakunlang.' });
      }
      if (!req.file?.buffer?.length) return res.status(400).json({ error: 'Audio yozuv topilmadi.' });

      const day = integer(req.body.day, 1, 30, 'Kun');
      const durationSeconds = integer(req.body.durationSeconds, 3, 600, 'Audio davomiyligi');
      if (day !== user.progress.currentDay || user.progress.activeDay?.day !== day || user.progress.activeDay?.completed) {
        return res.status(403).json({ error: 'Audio mashq faqat hozirgi faol kun uchun mumkin.' });
      }

      const lesson = getDay(day);
      const selfReview = safeJson(req.body.selfReview, {});
      const attemptNumber = store.getNextAttemptNumber(user.id, day);
      const submittedFocus = shortText(req.body.selectedFocus, 300, 'Fokus', false);
      const selectedFocus = attemptNumber === 2
        ? submittedFocus || store.getActiveCycleFocus(user.id, day)
        : submittedFocus;
      if (activeAnalyses.has(user.id)) {
        const error = new Error('Oldingi audio tahlil qilinmoqda. Natijani kuting.');
        error.status = 409;
        throw error;
      }

      activeAnalyses.add(user.id);
      try {
        const evaluation = await analyzeSpeech({
          audioBuffer: req.file.buffer,
          mimeType: req.file.mimetype,
          lesson,
          attemptNumber,
          durationSeconds,
          selectedFocus
        });
        const attempt = await store.addAttempt(user.id, {
          day,
          attemptNumber,
          durationSeconds,
          selfReview: {
            mainIdea: shortText(selfReview.mainIdea, 500, 'Asosiy fikr', false),
            bestPart: shortText(selfReview.bestPart, 500, 'Yaxshi joy', false),
            improvePart: shortText(selfReview.improvePart, 500, 'Yaxshilash joyi', false)
          },
          selectedFocus,
          evaluation
        });
        res.json({ attempt, user: publicUser(user) });
      } finally {
        activeAnalyses.delete(user.id);
      }
    } catch (error) {
      next(error);
    }
  }
);

app.post('/api/days/:day/complete', async (req, res, next) => {
  try {
    const user = await store.getOrCreate(req.authUser, { advanceDay: true });
    const day = integer(req.params.day, 1, 30, 'Kun');
    if (day !== user.progress.currentDay || user.progress.activeDay?.day !== day || user.progress.activeDay?.completed) {
      return res.status(403).json({ error: 'Mashq sikli faqat hozirgi faol kun uchun saqlanadi.' });
    }
    const comparison = shortText(req.body.comparison, 30, 'Taqqoslash');
    if (!['yaxshilandi', 'bir_xil', 'qiyinlashdi'].includes(comparison)) {
      return res.status(400).json({ error: 'Taqqoslash qiymati noto‘g‘ri.' });
    }
    const result = await store.completeDay(user.id, {
      day,
      attempt1Id: shortText(req.body.attempt1Id, 80, 'Birinchi urinish'),
      attempt2Id: shortText(req.body.attempt2Id, 80, 'Ikkinchi urinish'),
      selectedFocus: shortText(req.body.selectedFocus, 300, 'Fokus', false),
      comparison,
      reflection: shortText(req.body.reflection, 800, 'Xulosa', false)
    });
    res.json({ user: publicUser(result.user), completion: result.completion });
  } catch (error) {
    next(error);
  }
});

app.post('/api/progress/reset', async (req, res, next) => {
  try {
    const user = await store.getOrCreate(req.authUser);
    const reset = await store.reset(user.id);
    res.json({ user: publicUser(reset) });
  } catch (error) {
    next(error);
  }
});

app.use(express.static(path.join(__dirname, '../public'), {
  etag: true,
  maxAge: 0,
  setHeaders(res) {
    res.setHeader('Cache-Control', 'no-cache');
  }
}));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error.status || (error instanceof multer.MulterError ? 400 : 500);
  const publicMessage = status >= 500 && process.env.NODE_ENV === 'production'
    ? 'Serverda xatolik yuz berdi. Qayta urinib ko‘ring.'
    : error.message || 'Xatolik yuz berdi.';
  console.error(`[${req.requestId || 'no-id'}]`, error.message);
  res.status(status).json({ error: publicMessage, requestId: req.requestId });
});

const server = http.createServer(app);
liveGateway.attach(server);

if (require.main === module) {
  server.listen(PORT, async () => {
    console.log(`Nutq 30 server: http://localhost:${PORT}`);
    console.log(`Muhit: ${process.env.NODE_ENV || 'development'}`);
    try {
      const result = await configureTelegramBot();
      if (result.configured) console.log('Telegram bot menyusi va webhook sozlandi.');
    } catch (error) {
      console.error('Telegram bot avtomatik sozlanmadi:', error.message);
    }
  });
}

module.exports = { app, store, server };
