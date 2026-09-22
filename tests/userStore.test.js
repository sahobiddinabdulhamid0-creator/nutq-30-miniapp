const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { UserStore } = require('../server/userStore');

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
