const crypto = require('crypto');

const DEFAULT_MAX_AGE_SECONDS = 24 * 60 * 60;

function timingSafeHexEqual(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
  } catch {
    return false;
  }
}

function validateTelegramInitData(initData, botToken, maxAgeSeconds = DEFAULT_MAX_AGE_SECONDS) {
  if (!initData || !botToken) {
    throw new Error('Telegram autentifikatsiya ma’lumoti yetishmayapti.');
  }

  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  if (!receivedHash) throw new Error('Telegram imzosi topilmadi.');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const entries = [...params.entries()].filter(([key]) => key !== 'hash');
  const createExpectedHash = ignoredKeys => {
    const dataCheckString = entries
      .filter(([key]) => !ignoredKeys.has(key))
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    return crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  };

  // Telegram klientlari yangi Ed25519 `signature` maydonini HMAC satriga
  // qo‘shish-qo‘shmaslikda farq qilishi mumkin. Ikkala rasmiy format ham bot
  // tokeni bilan qayta imzolanadi, shuning uchun xavfsizlik pasaymaydi.
  const expectedHashes = [
    createExpectedHash(new Set()),
    createExpectedHash(new Set(['signature']))
  ];

  if (!expectedHashes.some(expectedHash => timingSafeHexEqual(receivedHash, expectedHash))) {
    throw new Error('Telegram imzosi noto‘g‘ri.');
  }

  const authDate = Number(params.get('auth_date'));
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(authDate) || nowSeconds - authDate > maxAgeSeconds || authDate > nowSeconds + 60) {
    throw new Error('Telegram sessiyasi eskirgan. Mini App’ni qayta oching.');
  }

  let user;
  try {
    user = JSON.parse(params.get('user') || '{}');
  } catch {
    throw new Error('Telegram foydalanuvchi ma’lumoti o‘qilmadi.');
  }

  if (!user.id) throw new Error('Telegram foydalanuvchi ID topilmadi.');
  return normalizeTelegramUser(user);
}

function normalizeTelegramUser(user) {
  return {
    id: String(user.id),
    firstName: String(user.first_name || 'Foydalanuvchi').slice(0, 80),
    lastName: String(user.last_name || '').slice(0, 80),
    username: user.username ? String(user.username).slice(0, 80) : '',
    photoUrl: user.photo_url ? String(user.photo_url).slice(0, 1000) : '',
    languageCode: user.language_code ? String(user.language_code).slice(0, 16) : 'uz'
  };
}

function parseAllowedIds(raw) {
  return new Set(
    String(raw || '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean)
  );
}

function createAuthMiddleware(env = process.env) {
  const allowedIds = parseAllowedIds(env.ALLOWED_TELEGRAM_USER_IDS);
  const allowDevAuth = env.ALLOW_DEV_AUTH === 'true' && env.NODE_ENV !== 'production';

  return function telegramAuth(req, res, next) {
    try {
      if (env.NODE_ENV === 'production' && allowedIds.size !== 2) {
        return res.status(503).json({ error: 'Production uchun aynan ikki Telegram foydalanuvchi IDsi sozlanishi kerak.' });
      }

      const initData = req.get('x-telegram-init-data');
      let authUser;

      if (initData) {
        authUser = validateTelegramInitData(initData, env.BOT_TOKEN);
      } else if (allowDevAuth) {
        const devId = String(req.get('x-dev-user-id') || 'dev-user-1').slice(0, 80);
        const devName = String(req.get('x-dev-user-name') || (devId === 'dev-user-2' ? 'Sherik' : 'Abdukhamid')).slice(0, 80);
        authUser = {
          id: devId,
          firstName: devName,
          lastName: '',
          username: devId,
          photoUrl: '',
          languageCode: 'uz'
        };
      } else {
        return res.status(401).json({ error: 'Mini App’ni Telegram ichidan oching.' });
      }

      if (allowedIds.size > 0 && !allowedIds.has(authUser.id)) {
        return res.status(403).json({ error: 'Bu Mini App faqat ruxsat berilgan foydalanuvchilar uchun.' });
      }

      req.authUser = authUser;
      next();
    } catch (error) {
      res.status(401).json({ error: error.message || 'Telegram autentifikatsiyasi bajarilmadi.' });
    }
  };
}

module.exports = {
  createAuthMiddleware,
  normalizeTelegramUser,
  parseAllowedIds,
  validateTelegramInitData
};
