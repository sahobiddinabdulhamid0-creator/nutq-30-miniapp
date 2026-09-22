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

