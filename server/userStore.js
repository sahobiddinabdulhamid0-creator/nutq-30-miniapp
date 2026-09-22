const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { GetObjectCommand, PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');

const DAY_DURATION_MS = 24 * 60 * 60 * 1000;

function isoNow() {
  return new Date().toISOString();
}

function createActiveDay(day, startedAt = isoNow()) {
  const startedTime = new Date(startedAt).getTime();
  const safeStartedAt = Number.isFinite(startedTime) ? new Date(startedTime).toISOString() : isoNow();
  return {
    day,
    startedAt: safeStartedAt,
    unlocksAt: new Date(new Date(safeStartedAt).getTime() + DAY_DURATION_MS).toISOString(),
    firstScore: null,
    latestScore: null,
    bestScore: null,
    growth: null,
    attemptCount: 0,
    cyclesCompleted: 0,
    activeCycle: null,
    lastAttemptAt: null,
    lastSuggestedFocus: '',
    completed: false
  };
}

function attemptCreatedAt(item) {
  const timestamp = new Date(item?.createdAt || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

// v2.2.0 dagi yozuvlarda `activeCycle` va `cycleId` hali bo‘lmagan. Ochiq
// 1→2 juftligini qayta tiklash, yangilanish paytida foydalanuvchini boshidan
// boshlashga majbur qilmasdan server nazoratini saqlab qoladi.
function recoverOpenCycle(user, activeDay) {
  if (!activeDay || activeDay.activeCycle) return false;

  const completedAttemptIds = new Set(
    (user.completions || [])
      .filter(item => item.day === activeDay.day)
      .flatMap(item => [item.attempt1Id, item.attempt2Id])
      .filter(Boolean)
  );
  const candidates = (user.attempts || [])
    .filter(item => item.day === activeDay.day && !completedAttemptIds.has(item.id))
    .sort((left, right) => attemptCreatedAt(left) - attemptCreatedAt(right));

  let firstAttempt = null;
  let secondAttempt = null;
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    if (candidates[index].attemptNumber !== 1) continue;
    firstAttempt = candidates[index];
    if (candidates[index + 1]?.attemptNumber === 2) secondAttempt = candidates[index + 1];
    break;
  }
  if (!firstAttempt) return false;

  const cycleId = firstAttempt.cycleId || secondAttempt?.cycleId || crypto.randomUUID();
  firstAttempt.cycleId = cycleId;
  if (secondAttempt) secondAttempt.cycleId = cycleId;
  activeDay.activeCycle = {
    id: cycleId,
    firstAttemptId: firstAttempt.id,
    secondAttemptId: secondAttempt?.id || null,
    startedAt: firstAttempt.createdAt || isoNow(),
    ...(secondAttempt ? { completedAt: secondAttempt.createdAt || isoNow() } : {})
  };
  return true;
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
      snapshots: [],
      activeDay: null,
      programCompletedAt: null,
      dayModeVersion: 2
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

  _migrateLegacyDailyProgress(user) {
    const progress = user.progress;
    if (!user.onboarding?.completed || progress?.dayModeVersion === 2) return false;

    const attempts = [...(user.attempts || [])]
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const completions = [...(user.completions || [])]
      .sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));
    let activeDayNumber = 1;
    let activeStartedAt = user.onboarding.completedAt || user.createdAt || isoNow();
    const validCompletedDays = [];

    while (activeDayNumber <= 30) {
      const earliestEligibleCompletion = completions.find(item => (
        item.day === activeDayNumber
        && new Date(item.completedAt).getTime() >= new Date(activeStartedAt).getTime() + DAY_DURATION_MS
      ));
      if (!earliestEligibleCompletion) break;
      validCompletedDays.push(activeDayNumber);
      if (activeDayNumber === 30) break;
      activeDayNumber += 1;
      activeStartedAt = earliestEligibleCompletion.completedAt;
    }

    const activeAttempts = attempts.filter(item => item.day === activeDayNumber);
    const activeCompletions = completions.filter(item => item.day === activeDayNumber);
    const firstAttempt = activeAttempts[0];
    const latestAttempt = activeAttempts.at(-1);
    const activeDay = createActiveDay(activeDayNumber, activeStartedAt);
    if (firstAttempt?.evaluation) {
      activeDay.firstScore = firstAttempt.evaluation.totalScore;
      activeDay.latestScore = latestAttempt.evaluation.totalScore;
      activeDay.bestScore = Math.max(...activeAttempts.map(item => item.evaluation.totalScore));
      activeDay.growth = activeDay.latestScore - activeDay.firstScore;
      activeDay.attemptCount = activeAttempts.length;
      activeDay.cyclesCompleted = activeCompletions.length;
      activeDay.lastAttemptAt = latestAttempt.createdAt;
      activeDay.lastSuggestedFocus = latestAttempt.evaluation.suggestedFocus || '';
    }
    recoverOpenCycle(user, activeDay);

    const futureAttempts = attempts.filter(item => item.day > activeDayNumber);
    const futureCompletions = completions.filter(item => item.day > activeDayNumber);
    if (futureAttempts.length || futureCompletions.length) {
      user.legacyArchive = {
        attempts: [...(user.legacyArchive?.attempts || []), ...futureAttempts],
        completions: [...(user.legacyArchive?.completions || []), ...futureCompletions],
        migratedAt: isoNow(),
        reason: '24-hour-day-mode'
      };
    }

    user.attempts = attempts.filter(item => item.day <= activeDayNumber);
    user.completions = completions.filter(item => item.day <= activeDayNumber);
    progress.currentDay = activeDayNumber;
    progress.completedDays = validCompletedDays;
    progress.activeDay = activeDay;
    progress.latestScore = activeDay.latestScore;
    progress.baselineScore = attempts.find(item => item.day === 1)?.evaluation?.totalScore
      ?? progress.baselineScore
      ?? null;
    if (latestAttempt?.evaluation?.pillarScores) {
      progress.skillScores = { ...latestAttempt.evaluation.pillarScores };
    }
    progress.snapshots = (progress.snapshots || []).filter(item => validCompletedDays.includes(item.day));
    progress.programCompletedAt = validCompletedDays.includes(30) ? isoNow() : null;
    progress.dayModeVersion = 2;
    return true;
  }

  _ensureProgressShape(user) {
    let changed = false;
    if (!Array.isArray(user.attempts)) { user.attempts = []; changed = true; }
    if (!Array.isArray(user.completions)) { user.completions = []; changed = true; }
    if (!user.progress || typeof user.progress !== 'object') {
      user.progress = createDefaultUser(user).progress;
      changed = true;
    }
    const progress = user.progress;
    changed = this._migrateLegacyDailyProgress(user) || changed;

    if (!Array.isArray(progress.completedDays)) { progress.completedDays = []; changed = true; }
    if (!Array.isArray(progress.snapshots)) { progress.snapshots = []; changed = true; }
    if (!Object.prototype.hasOwnProperty.call(progress, 'programCompletedAt')) {
      progress.programCompletedAt = null;
      changed = true;
    }
    if (!Object.prototype.hasOwnProperty.call(progress, 'dayModeVersion')) {
      progress.dayModeVersion = 2;
      changed = true;
    }

    if (user.onboarding?.completed && (!progress.activeDay || progress.activeDay.day !== progress.currentDay)) {
      const previousCompletion = [...(user.completions || [])]
        .reverse()
        .find(item => item.day === progress.currentDay - 1);
      const startedAt = previousCompletion?.completedAt || user.onboarding.completedAt || isoNow();
      progress.activeDay = createActiveDay(progress.currentDay || 1, startedAt);
      changed = true;
    }

    if (progress.activeDay) {
      const hadActiveCycle = Object.prototype.hasOwnProperty.call(progress.activeDay, 'activeCycle');
      const defaults = createActiveDay(progress.activeDay.day || progress.currentDay || 1, progress.activeDay.startedAt);
      for (const [key, value] of Object.entries(defaults)) {
        if (!Object.prototype.hasOwnProperty.call(progress.activeDay, key)) {
          progress.activeDay[key] = value;
          changed = true;
        }
      }
      if (!hadActiveCycle && recoverOpenCycle(user, progress.activeDay)) changed = true;
    }
    return changed;
  }

  _updateStreak(user, completedAt = new Date()) {
    const today = localDateKey(completedAt);
    const yesterday = localDateKey(new Date(completedAt.getTime() - DAY_DURATION_MS));
    if (user.progress.lastCompletedDate === today) return;
    if (user.progress.lastCompletedDate === yesterday) user.progress.streakDays += 1;
    else user.progress.streakDays = 1;
    user.progress.lastCompletedDate = today;
    user.progress.longestStreak = Math.max(user.progress.longestStreak, user.progress.streakDays);
  }

  _finalizeActiveDayIfReady(user, now = new Date()) {
    const activeDay = user.progress.activeDay;
    if (!activeDay || activeDay.completed || activeDay.cyclesCompleted < 1) {
      return { finalized: false, nextDay: null, programCompleted: false };
    }
    if (now.getTime() < new Date(activeDay.unlocksAt).getTime()) {
      return { finalized: false, nextDay: null, programCompleted: false };
    }

    const finishedDay = activeDay.day;
    activeDay.completed = true;
    if (!user.progress.completedDays.includes(finishedDay)) {
      user.progress.completedDays.push(finishedDay);
      user.progress.completedDays.sort((a, b) => a - b);
    }
    this._updateStreak(user, now);

    if ([1, 7, 15, 21, 30].includes(finishedDay) && activeDay.latestScore != null) {
      user.progress.snapshots = user.progress.snapshots.filter(item => item.day !== finishedDay);
      user.progress.snapshots.push({
        day: finishedDay,
        score: activeDay.latestScore,
        pillarScores: user.progress.skillScores || {},
        completedAt: now.toISOString()
      });
      user.progress.snapshots.sort((a, b) => a.day - b.day);
    }

    if (finishedDay >= 30) {
      user.progress.programCompletedAt = now.toISOString();
      return { finalized: true, nextDay: null, programCompleted: true };
    }

    const nextDay = finishedDay + 1;
    user.progress.currentDay = nextDay;
    user.progress.activeDay = createActiveDay(nextDay, now.toISOString());
    return { finalized: true, nextDay, programCompleted: false };
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

  async getOrCreate(authUser, options = {}) {
    await this._ready;
    const id = String(authUser.id);
    let changed = false;
    if (!this.users[id]) {
      this.users[id] = createDefaultUser(authUser);
      changed = true;
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
    const user = this.users[id];
    changed = this._ensureProgressShape(user) || changed;
    if (options.advanceDay && user.onboarding?.completed) {
      const advancement = this._finalizeActiveDayIfReady(user);
      changed = advancement.finalized || changed;
    }
    if (changed) {
      user.updatedAt = isoNow();
      await this._persist();
    }
    return user;
  }

  getById(userId) {
    return this.users[String(userId)] || null;
  }

  async finishOnboarding(userId, input) {
    await this._ready;
    const user = this.getById(userId);
    if (!user) throw new Error('Foydalanuvchi topilmadi.');
    const completedAt = isoNow();
    user.onboarding = {
      completed: true,
      goal: input.goal,
      level: input.level,
      dailyMinutes: input.dailyMinutes,
      aiConsent: Boolean(input.aiConsent),
      completedAt
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
      snapshots: [],
      activeDay: createActiveDay(1, completedAt),
      programCompletedAt: null,
      dayModeVersion: 2
    };
    user.attempts = [];
    user.completions = [];
    user.updatedAt = isoNow();
    await this._persist();
    return user;
  }

  getNextAttemptNumber(userId, day) {
    const user = this.getById(userId);
    const activeDay = user?.progress?.activeDay;
    if (Number(day) !== user?.progress?.currentDay || activeDay?.day !== Number(day) || activeDay.completed) {
      const error = new Error('Audio mashq faqat hozirgi faol kun uchun mumkin.');
      error.status = 403;
      throw error;
    }
    if (activeDay.activeCycle?.secondAttemptId) {
      const error = new Error('Avval ochiq mashq siklini saqlang, keyin yangi urinish boshlanadi.');
      error.status = 409;
      throw error;
    }
    return activeDay.activeCycle?.firstAttemptId ? 2 : 1;
  }

  getActiveCycleFocus(userId, day) {
    const user = this.getById(userId);
    const cycle = user?.progress?.activeDay?.activeCycle;
    if (!cycle?.firstAttemptId || Number(day) !== user?.progress?.currentDay) return '';
    return user.attempts.find(item => item.id === cycle.firstAttemptId)?.evaluation?.suggestedFocus || '';
  }

  async addAttempt(userId, input) {
    await this._ready;
    const user = this.getById(userId);
    if (!user) throw new Error('Foydalanuvchi topilmadi.');
    const activeDay = user.progress.activeDay;
    if (input.day !== user.progress.currentDay || activeDay?.day !== input.day || activeDay.completed) {
      const error = new Error('Audio mashq faqat hozirgi faol kun uchun mumkin.');
      error.status = 403;
      throw error;
    }
    const cycle = activeDay.activeCycle;
    if (cycle?.secondAttemptId) {
      const error = new Error('Avval ochiq mashq siklini saqlang, keyin yangi urinish boshlanadi.');
      error.status = 409;
      throw error;
    }
    const attemptNumber = cycle?.firstAttemptId ? 2 : 1;
    const attempt = {
      id: crypto.randomUUID(),
      day: input.day,
      attemptNumber,
      cycleId: cycle?.id || crypto.randomUUID(),
      durationSeconds: input.durationSeconds,
      selfReview: input.selfReview || {},
      selectedFocus: input.selectedFocus || '',
      evaluation: input.evaluation,
      audioStorage: 'device-only',
      createdAt: isoNow()
    };
    user.attempts.push(attempt);
    if (user.attempts.length > 300) user.attempts = user.attempts.slice(-300);

    if (attemptNumber === 1) {
      activeDay.activeCycle = {
        id: attempt.cycleId,
        firstAttemptId: attempt.id,
        secondAttemptId: null,
        startedAt: attempt.createdAt
      };
    } else {
      activeDay.activeCycle = {
        ...cycle,
        secondAttemptId: attempt.id,
        completedAt: attempt.createdAt
      };
    }
    const score = input.evaluation.totalScore;
    if (activeDay.firstScore == null) activeDay.firstScore = score;
    activeDay.latestScore = score;
    activeDay.bestScore = activeDay.bestScore == null ? score : Math.max(activeDay.bestScore, score);
    activeDay.growth = score - activeDay.firstScore;
    activeDay.attemptCount += 1;
    activeDay.lastAttemptAt = attempt.createdAt;
    activeDay.lastSuggestedFocus = input.evaluation.suggestedFocus || activeDay.lastSuggestedFocus || '';
    user.progress.latestScore = score;
    user.progress.skillScores = {
      ...(user.progress.skillScores || {}),
      ...input.evaluation.pillarScores
    };
    if (input.day === 1 && user.progress.baselineScore == null) {
      user.progress.baselineScore = activeDay.firstScore;
    }
    user.updatedAt = isoNow();
    await this._persist();
    return attempt;
  }

  async completeDay(userId, input) {
    await this._ready;
    const user = this.getById(userId);
    if (!user) throw new Error('Foydalanuvchi topilmadi.');

    const activeDay = user.progress.activeDay;
    if (input.day !== user.progress.currentDay || activeDay?.day !== input.day || activeDay.completed) {
      const error = new Error('Mashq sikli faqat hozirgi faol kun uchun saqlanadi.');
      error.status = 403;
      throw error;
    }
    const attempt1 = user.attempts.find(item => item.id === input.attempt1Id);
    const attempt2 = user.attempts.find(item => item.id === input.attempt2Id);
    const existingCompletion = attempt1 && attempt2
      ? user.completions.find(item => item.attempt1Id === attempt1.id && item.attempt2Id === attempt2.id)
      : null;
    if (existingCompletion) {
      return { user, completion: existingCompletion };
    }

    const cycle = activeDay.activeCycle;
    if (
      !attempt1
      || !attempt2
      || attempt1.id === attempt2.id
      || attempt1.day !== input.day
      || attempt2.day !== input.day
      || attempt1.attemptNumber !== 1
      || attempt2.attemptNumber !== 2
      || !cycle
      || cycle.firstAttemptId !== attempt1.id
      || cycle.secondAttemptId !== attempt2.id
      || attempt1.cycleId !== cycle.id
      || attempt2.cycleId !== cycle.id
    ) {
      const error = new Error('Birinchi va ikkinchi urinish to‘liq topilmadi.');
      error.status = 400;
      throw error;
    }

    const dayCompletions = user.completions.filter(item => item.day === input.day);
    const completion = {
      id: crypto.randomUUID(),
      day: input.day,
      sessionNumber: dayCompletions.length + 1,
      attempt1Id: attempt1.id,
      attempt2Id: attempt2.id,
      comparison: input.comparison,
      reflection: input.reflection || '',
      selectedFocus: input.selectedFocus || attempt2.selectedFocus || '',
      firstScore: attempt1.evaluation.totalScore,
      secondScore: attempt2.evaluation.totalScore,
      improvement: attempt2.evaluation.totalScore - attempt1.evaluation.totalScore,
      dailyFirstScore: activeDay?.day === input.day ? activeDay.firstScore : attempt1.evaluation.totalScore,
      dailyLatestScore: attempt2.evaluation.totalScore,
      dailyGrowth: activeDay?.day === input.day && activeDay.firstScore != null
        ? attempt2.evaluation.totalScore - activeDay.firstScore
        : attempt2.evaluation.totalScore - attempt1.evaluation.totalScore,
      completedAt: isoNow()
    };

    user.completions.push(completion);
    user.completions.sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));

    if (activeDay?.day === input.day && !activeDay.completed) {
      activeDay.cyclesCompleted += 1;
      activeDay.latestScore = completion.secondScore;
      activeDay.bestScore = activeDay.bestScore == null
        ? completion.secondScore
        : Math.max(activeDay.bestScore, completion.secondScore);
      activeDay.growth = activeDay.firstScore == null ? 0 : completion.secondScore - activeDay.firstScore;
      activeDay.lastSuggestedFocus = attempt2.evaluation.suggestedFocus || activeDay.lastSuggestedFocus || '';
      activeDay.activeCycle = null;
    }

    const advancement = this._finalizeActiveDayIfReady(user);
    completion.dayFinalized = advancement.finalized;
    completion.nextDay = advancement.nextDay;
    completion.programCompleted = advancement.programCompleted;

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
