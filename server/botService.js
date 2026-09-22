async function telegramBotCall(method, payload, token = process.env.BOT_TOKEN) {
  if (!token) throw new Error('BOT_TOKEN sozlanmagan.');
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(`Telegram Bot API ${method}: ${data.description || response.status}`);
  }
  return data.result;
}

async function handleTelegramUpdate(update) {
  const message = update?.message;
  if (!message?.chat?.id || !message.text) return;
  if (!message.text.startsWith('/start')) return;

  const miniAppUrl = process.env.MINI_APP_URL || process.env.PUBLIC_URL;
  if (!miniAppUrl) return;

  await telegramBotCall('sendMessage', {
    chat_id: message.chat.id,
    text: 'Nutq 30 — har kuni bitta qisqa audio mashq, ikkita urinish va aniq tahlil. Boshlash uchun tugmani bosing.',
    reply_markup: {
      inline_keyboard: [[{
        text: '🎙 Nutq 30’ni ochish',
        web_app: { url: miniAppUrl }
      }]]
    }
  });
}

async function configureTelegramBot() {
  const token = process.env.BOT_TOKEN;
  const miniAppUrl = process.env.MINI_APP_URL || process.env.PUBLIC_URL;
  const publicUrl = process.env.PUBLIC_URL;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!token || !miniAppUrl) return { configured: false };

  await telegramBotCall('setChatMenuButton', {
    menu_button: {
      type: 'web_app',
      text: 'Nutq 30',
      web_app: { url: miniAppUrl }
    }
  });

  if (publicUrl && secret) {
    const webhookUrl = `${publicUrl.replace(/\/$/, '')}/api/telegram/webhook`;
    await telegramBotCall('setWebhook', {
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ['message']
    });
  }

  return { configured: true };
}

module.exports = {
  configureTelegramBot,
  handleTelegramUpdate,
  telegramBotCall
};
