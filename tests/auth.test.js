const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { createAuthMiddleware, validateTelegramInitData } = require('../server/auth');

function signedInitData(botToken, user, extra = {}) {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'test-query',
    user: JSON.stringify(user),
    ...extra
  });
  const pairs = [...params.entries()].map(([key, value]) => `${key}=${value}`).sort();
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secret).update(pairs.join('\n')).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

test('Telegram initData imzosini tekshiradi', () => {
  const token = '123456:test-token';
  const initData = signedInitData(token, { id: 123, first_name: 'Ali', username: 'ali' });
  const user = validateTelegramInitData(initData, token);
  assert.equal(user.id, '123');
  assert.equal(user.firstName, 'Ali');
});

test('buzilgan Telegram initData rad etiladi', () => {
  const token = '123456:test-token';
  const initData = signedInitData(token, { id: 123, first_name: 'Ali' }).replace('Ali', 'Vali');
  assert.throws(() => validateTelegramInitData(initData, token), /imzosi noto‘g‘ri/);
});

test('Telegram yangi signature maydoni bilan initData imzosini tekshiradi', () => {
  const token = '123456:test-token';
  const initData = signedInitData(
    token,
    { id: 456, first_name: 'Zuhra' },
    { signature: 'telegram-ed25519-signature_value' }
  );
  const user = validateTelegramInitData(initData, token);

  assert.equal(user.id, '456');
  assert.equal(user.firstName, 'Zuhra');
});

test('production aynan ikki foydalanuvchi allowlistini talab qiladi', () => {
  const middleware = createAuthMiddleware({
    NODE_ENV: 'production',
    BOT_TOKEN: '123456:test-token',
    ALLOWED_TELEGRAM_USER_IDS: '123'
  });
  const response = {
    statusCode: null,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; }
  };
  let calledNext = false;

  middleware({ get: () => null }, response, () => { calledNext = true; });

  assert.equal(response.statusCode, 503);
  assert.match(response.payload.error, /aynan ikki/);
  assert.equal(calledNext, false);
});
