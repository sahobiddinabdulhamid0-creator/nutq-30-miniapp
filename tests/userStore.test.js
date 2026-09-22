const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { UserStore } = require('../server/userStore');

function evaluation(score, focus = 'Sekinroq gapiring') {
  return {
    totalScore: score,
    suggestedFocus: focus,
    pillarScores: { ravonlik: Math.round(score / 5) }
  };
}

test('ikki foydalanuvchi progressini alohida saqlaydi', async t => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nutq30-'));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
  const store = new UserStore({ dataDir: tempDir });
  const first = await store.getOrCreate({ id: 'one', firstName: 'Birinchi' });
  const second = await store.getOrCreate({ id: 'two', firstName: 'Ikkinchi' });

  await store.finishOnboarding(first.id, {
    goal: 'ravonlik', level: 'boshlangich', dailyMinutes: 15, aiConsent: true
  });

  assert.equal(store.getById('one').onboarding.completed, true);
  assert.equal(store.getById('two').onboarding.completed, false);
  assert.deepEqual(store.getById('one').progress.completedDays, []);
  assert.deepEqual(store.getById('two').progress.completedDays, []);
  assert.notEqual(first.id, second.id);
});

test('R2 adapteri progressni qayta ishga tushganda tiklaydi', async () => {
  const objects = new Map();
  const client = {
    async send(command) {
      if (command.constructor.name === 'GetObjectCommand') {
        if (!objects.has(command.input.Key)) {
          const error = new Error('topilmadi');
          error.name = 'NoSuchKey';
          throw error;
        }
        return { Body: { transformToString: async () => objects.get(command.input.Key) } };
      }
      if (command.constructor.name === 'PutObjectCommand') {
        objects.set(command.input.Key, command.input.Body);
        return {};
      }
      throw new Error('Kutilmagan R2 buyrug‘i');
    }
  };
  const r2 = { client, bucket: 'test-bucket', key: 'users.json' };
  const firstStore = new UserStore({ r2 });
  await firstStore.getOrCreate({ id: 'one', firstName: 'Birinchi' });
  await firstStore.finishOnboarding('one', {
    goal: 'ravonlik', level: 'boshlangich', dailyMinutes: 15, aiConsent: true
  });

  const restartedStore = new UserStore({ r2 });
  const restored = await restartedStore.getOrCreate({ id: 'one', firstName: 'Birinchi' });

  assert.equal(restored.onboarding.completed, true);
  assert.equal(restored.progress.currentDay, 1);
});

test('kun 24 soat davomida ochiq qoladi va faqat oxirgi ball hisoblanadi', async t => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nutq30-day-'));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
  const store = new UserStore({ dataDir: tempDir });
  const authUser = { id: 'daily-user', firstName: 'Kunlik' };
  const user = await store.getOrCreate(authUser);
  await store.finishOnboarding(user.id, {
    goal: 'ravonlik', level: 'boshlangich', dailyMinutes: 15, aiConsent: true
  });

  const first = await store.addAttempt(user.id, {
    day: 1, attemptNumber: 1, durationSeconds: 60, evaluation: evaluation(48)
  });
  const second = await store.addAttempt(user.id, {
    day: 1, attemptNumber: 2, durationSeconds: 60, evaluation: evaluation(63)
  });
  await store.completeDay(user.id, {
    day: 1,
    attempt1Id: first.id,
    attempt2Id: second.id,
    comparison: 'yaxshilandi'
  });

  let current = store.getById(user.id);
  assert.equal(current.progress.currentDay, 1);
  assert.deepEqual(current.progress.completedDays, []);
  assert.equal(current.progress.latestScore, 63);
  assert.equal(current.progress.activeDay.firstScore, 48);
  assert.equal(current.progress.activeDay.latestScore, 63);
  assert.equal(current.progress.activeDay.growth, 15);
  assert.equal(current.progress.activeDay.attemptCount, 2);
  assert.equal(current.progress.activeDay.cyclesCompleted, 1);

  const third = await store.addAttempt(user.id, {
    day: 1, attemptNumber: 1, durationSeconds: 60, evaluation: evaluation(58)
  });
  const fourth = await store.addAttempt(user.id, {
    day: 1, attemptNumber: 2, durationSeconds: 60, evaluation: evaluation(71)
  });
  await store.completeDay(user.id, {
    day: 1,
    attempt1Id: third.id,
    attempt2Id: fourth.id,
    comparison: 'yaxshilandi'
  });

  current = store.getById(user.id);
  assert.equal(current.progress.latestScore, 71);
  assert.equal(current.progress.activeDay.latestScore, 71);
  assert.equal(current.progress.activeDay.growth, 23);
  assert.equal(current.progress.activeDay.attemptCount, 4);
  assert.equal(current.progress.activeDay.cyclesCompleted, 2);
  assert.equal(current.completions.length, 2);

  current.progress.activeDay.unlocksAt = new Date(Date.now() - 1000).toISOString();
  const advanced = await store.getOrCreate(authUser, { advanceDay: true });
  assert.equal(advanced.progress.currentDay, 2);
  assert.deepEqual(advanced.progress.completedDays, [1]);
  assert.equal(advanced.progress.activeDay.day, 2);
  assert.equal(advanced.progress.activeDay.latestScore, null);
});

test('24 soat o‘tsa ham to‘liq mashq siklisiz keyingi kun ochilmaydi', async t => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nutq30-lock-'));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
  const store = new UserStore({ dataDir: tempDir });
  const authUser = { id: 'locked-user', firstName: 'Qulflangan' };
  const user = await store.getOrCreate(authUser);
  await store.finishOnboarding(user.id, {
    goal: 'ravonlik', level: 'boshlangich', dailyMinutes: 15, aiConsent: true
  });
  user.progress.activeDay.unlocksAt = new Date(Date.now() - 1000).toISOString();

  const stillLocked = await store.getOrCreate(authUser, { advanceDay: true });
  assert.equal(stillLocked.progress.currentDay, 1);
  assert.deepEqual(stillLocked.progress.completedDays, []);
});

test('eski tez ochilgan kunlarni 24 soatlik rejimga xavfsiz qaytaradi', async t => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nutq30-migrate-'));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
  const store = new UserStore({ dataDir: tempDir });
  const authUser = { id: 'legacy-user', firstName: 'Eski' };
  const user = await store.getOrCreate(authUser);
  await store.finishOnboarding(user.id, {
    goal: 'ravonlik', level: 'boshlangich', dailyMinutes: 15, aiConsent: true
  });

  const startedAt = new Date().toISOString();
  user.onboarding.completedAt = startedAt;
  delete user.progress.dayModeVersion;
  delete user.progress.activeDay;
  user.progress.currentDay = 3;
  user.progress.completedDays = [1, 2];
  user.attempts = [
    { id: 'a1', day: 1, attemptNumber: 1, createdAt: new Date(Date.now() + 1000).toISOString(), evaluation: evaluation(30, 'Pauza') },
    { id: 'a2', day: 1, attemptNumber: 2, createdAt: new Date(Date.now() + 2000).toISOString(), evaluation: evaluation(42, 'Xulosa') },
    { id: 'a3', day: 2, attemptNumber: 1, createdAt: new Date(Date.now() + 3000).toISOString(), evaluation: evaluation(70) }
  ];
  user.completions = [{
    id: 'c1', day: 1, attempt1Id: 'a1', attempt2Id: 'a2', firstScore: 30, secondScore: 42,
    completedAt: new Date(Date.now() + 2500).toISOString()
  }];

  const migrated = await store.getOrCreate(authUser, { advanceDay: true });
  assert.equal(migrated.progress.dayModeVersion, 2);
  assert.equal(migrated.progress.currentDay, 1);
  assert.deepEqual(migrated.progress.completedDays, []);
  assert.equal(migrated.progress.activeDay.firstScore, 30);
  assert.equal(migrated.progress.activeDay.latestScore, 42);
  assert.equal(migrated.progress.activeDay.growth, 12);
  assert.equal(migrated.progress.activeDay.cyclesCompleted, 1);
  assert.deepEqual(migrated.attempts.map(item => item.id), ['a1', 'a2']);
  assert.deepEqual(migrated.legacyArchive.attempts.map(item => item.id), ['a3']);
});
