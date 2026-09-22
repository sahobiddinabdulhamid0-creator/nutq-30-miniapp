const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { GetObjectCommand, PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');

function isoNow() {
  return new Date().toISOString();
}

function createDefaultUser(authUser) {
  const now = isoNow();
  return {
    id: String(authUser.id),
    profile: {
      firstName: authUser.firstName || 'Foydalanuvchi',
      lastName: authUser.lastName || '',
      username: authUser.username || '',
      photoUrl: authUser.photoUrl || '',
      languageCode: authUser.languageCode || 'uz'
    },
    onboarding: {
      completed: false,
      goal: '',
      level: 'boshlangich',
      dailyMinutes: 15,
      aiConsent: false,
      completedAt: null
    },
    progress: {
      currentDay: 1,
      completedDays: [],
      streakDays: 0,
      longestStreak: 0,
      lastCompletedDate: null,
      latestScore: null,
      baselineScore: null,
      skillScores: null,
      snapshots: []
    },
    attempts: [],
    completions: [],
    createdAt: now,
    updatedAt: now
  };
}

function localDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.TZ || 'Asia/Tashkent',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function createR2Store(env = process.env) {
  const endpoint = env.R2_ENDPOINT;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  const bucket = env.R2_BUCKET;
  const supplied = [endpoint, accessKeyId, secretAccessKey, bucket].filter(Boolean).length;
  if (supplied === 0) return null;
  if (supplied !== 4) throw new Error('R2 sozlamalari to‘liq emas. Endpoint, access key, secret va bucket kerak.');

  return {
    client: new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey }
    }),
    bucket,
    key: env.R2_OBJECT_KEY || 'production/users.json'
  };
}

class UserStore {
  constructor(options = {}) {
    const baseDir = options.dataDir || process.env.DATA_DIR || path.join(__dirname, 'data');
    this.filePath = options.filePath || path.join(baseDir, 'users.json');
    this.r2 = options.r2 === undefined ? createR2Store() : options.r2;
    this.users = {};
    this._saveQueue = Promise.resolve();
    if (this.r2) {
      this._ready = this._loadRemote();
    } else {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      this._loadLocal();
      this._ready = Promise.resolve();
    }
  }

  _loadLocal() {
    try {
      if (fs.existsSync(this.filePath)) {
        const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
        this.users = parsed && typeof parsed === 'object' ? parsed : {};
      }
    } catch (error) {
      console.error('Foydalanuvchi bazasini o‘qib bo‘lmadi:', error.message);
      this.users = {};
    }
  }

  async _loadRemote() {
    try {
      const response = await this.r2.client.send(new GetObjectCommand({
        Bucket: this.r2.bucket,
        Key: this.r2.key
      }));
      const text = await response.Body.transformToString('utf-8');
      const parsed = JSON.parse(text);
      this.users = parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        this.users = {};
        return;
      }
      throw new Error(`R2 foydalanuvchi bazasini o‘qib bo‘lmadi: ${error.message}`);
    }
  }

  async _persist() {
    this._saveQueue = this._saveQueue.then(async () => {
      const payload = JSON.stringify(this.users, null, 2);
      if (this.r2) {
        await this.r2.client.send(new PutObjectCommand({
          Bucket: this.r2.bucket,
          Key: this.r2.key,
          Body: payload,
          ContentType: 'application/json'
        }));
        return;
      }
      const tempPath = `${this.filePath}.${process.pid}.tmp`;
      await fs.promises.writeFile(tempPath, payload, 'utf8');
      await fs.promises.rename(tempPath, this.filePath);
    });
    return this._saveQueue;
  }

  async getOrCreate(authUser) {
    await this._ready;
    const id = String(authUser.id);
    if (!this.users[id]) {
      this.users[id] = createDefaultUser(authUser);
      await this._persist();
    } else {
      this.users[id].profile = {
        ...this.users[id].profile,
        firstName: authUser.firstName || this.users[id].profile.firstName,
        lastName: authUser.lastName || '',
        username: authUser.username || '',
        photoUrl: authUser.photoUrl || this.users[id].profile.photoUrl || '',
        languageCode: authUser.languageCode || 'uz'
      };
    }
    return this.users[id];
  }

  getById(userId) {
    return this.users[String(userId)] || null;
  }

  async finishOnboarding(userId, input) {
    await this._ready;
    const user = this.getById(userId);
    if (!user) throw new Error('Foydalanuvchi topilmadi.');
    user.onboarding = {
      completed: true,
      goal: input.goal,
      level: input.level,
      dailyMinutes: input.dailyMinutes,
      aiConsent: Boolean(input.aiConsent),
      completedAt: isoNow()
    };
    user.progress = {
      currentDay: 1,
      completedDays: [],
      streakDays: 0,
      longestStreak: 0,
      lastCompletedDate: null,
      latestScore: null,
      baselineScore: null,
      skillScores: null,
      snapshots: []
    };
    user.attempts = [];
    user.completions = [];
    user.updatedAt = isoNow();
    await this._persist();
    return user;
  }

  async addAttempt(userId, input) {
    await this._ready;
    const user = this.getById(userId);
    if (!user) throw new Error('Foydalanuvchi topilmadi.');
    const attempt = {
      id: crypto.randomUUID(),
      day: input.day,
      attemptNumber: input.attemptNumber,
      durationSeconds: input.durationSeconds,
      selfReview: input.selfReview || {},
      selectedFocus: input.selectedFocus || '',
      evaluation: input.evaluation,
      audioStorage: 'device-only',
      createdAt: isoNow()
    };
    user.attempts.push(attempt);
    if (user.attempts.length > 120) user.attempts = user.attempts.slice(-120);
    user.updatedAt = isoNow();
    await this._persist();
    return attempt;
  }

  async completeDay(userId, input) {
    await this._ready;
    const user = this.getById(userId);
    if (!user) throw new Error('Foydalanuvchi topilmadi.');

    const attempt1 = user.attempts.find(item => item.id === input.attempt1Id);
    const attempt2 = user.attempts.find(item => item.id === input.attempt2Id);
    if (
      !attempt1
      || !attempt2
      || attempt1.id === attempt2.id
      || attempt1.day !== input.day
      || attempt2.day !== input.day
      || attempt1.attemptNumber !== 1
      || attempt2.attemptNumber !== 2
    ) {
      const error = new Error('Birinchi va ikkinchi urinish to‘liq topilmadi.');
      error.status = 400;
      throw error;
    }

    const completion = {
      id: crypto.randomUUID(),
      day: input.day,
      attempt1Id: attempt1.id,
      attempt2Id: attempt2.id,
      comparison: input.comparison,
      reflection: input.reflection || '',
      selectedFocus: input.selectedFocus || attempt2.selectedFocus || '',
      firstScore: attempt1.evaluation.totalScore,
      secondScore: attempt2.evaluation.totalScore,
      improvement: attempt2.evaluation.totalScore - attempt1.evaluation.totalScore,
      completedAt: isoNow()
    };

    user.completions = user.completions.filter(item => item.day !== input.day);
    user.completions.push(completion);
    user.completions.sort((a, b) => a.day - b.day);

    if (!user.progress.completedDays.includes(input.day)) {
      user.progress.completedDays.push(input.day);
      user.progress.completedDays.sort((a, b) => a - b);
    }
    if (input.day === user.progress.currentDay && input.day < 30) {
      user.progress.currentDay = input.day + 1;
    }

    const today = localDateKey();
    const yesterday = localDateKey(new Date(Date.now() - 86400000));
    if (user.progress.lastCompletedDate === today) {
      // Bir kunda qayta bajarish streakni oshirmaydi.
    } else if (user.progress.lastCompletedDate === yesterday) {
      user.progress.streakDays += 1;
    } else {
      user.progress.streakDays = 1;
    }
    user.progress.lastCompletedDate = today;
    user.progress.longestStreak = Math.max(user.progress.longestStreak, user.progress.streakDays);
    user.progress.latestScore = completion.secondScore;
    user.progress.skillScores = {
      ...(user.progress.skillScores || {}),
      ...attempt2.evaluation.pillarScores
    };
    if (input.day === 1 && user.progress.baselineScore == null) {
      user.progress.baselineScore = completion.secondScore;
    }
    if ([1, 7, 15, 21, 30].includes(input.day)) {
      user.progress.snapshots = user.progress.snapshots.filter(item => item.day !== input.day);
      user.progress.snapshots.push({
        day: input.day,
        score: completion.secondScore,
        pillarScores: attempt2.evaluation.pillarScores,
        completedAt: completion.completedAt
      });
      user.progress.snapshots.sort((a, b) => a.day - b.day);
    }

    user.updatedAt = isoNow();
    await this._persist();
    return { user, completion };
  }

  async reset(userId) {
    await this._ready;
    const current = this.getById(userId);
    if (!current) throw new Error('Foydalanuvchi topilmadi.');
    const fresh = createDefaultUser({ id: current.id, ...current.profile });
    this.users[String(userId)] = fresh;
    await this._persist();
    return fresh;
  }
}

function publicUser(user) {
  return {
    id: user.id,
    profile: user.profile,
    onboarding: user.onboarding,
    progress: user.progress,
    attempts: user.attempts,
    completions: user.completions,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

module.exports = {
  UserStore,
  createR2Store,
  createDefaultUser,
  localDateKey,
  publicUser
};
