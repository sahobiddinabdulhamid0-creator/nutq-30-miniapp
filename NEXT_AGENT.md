# Nutq 30 — keyingi agent uchun qisqa ko‘rsatma

## Nima ishlayapti

- Production: `https://nutq-30-miniapp.onrender.com/`
- Health / cron GET: `https://nutq-30-miniapp.onrender.com/health`
- Telegram bot: `@nutquzbot`
- Stack: Node.js + Express, Render, Cloudflare R2, Telegram Mini App, Gemini API.
- Joriy production commit: `df03e49` (`v2.2.1`).

## Bot oqimi

1. Render serveri ishga tushganda `server/botService.js` global Telegram menu tugmasi va webhookni sozlaydi.
2. Webhook manzili: `/api/telegram/webhook`. U `TELEGRAM_WEBHOOK_SECRET` sarlavhasini tekshiradi.
3. Foydalanuvchi botga `/start` yuborsa, bot Mini App’ni ochadigan inline tugma jo‘natadi.
4. Telegram foydalanuvchi botga avval o‘zi `/start` yubormagan bo‘lsa, bot unga birinchi bo‘lib xabar jo‘nata olmaydi. Bu ayniqsa ikkinchi foydalanuvchi uchun muhim.
5. API so‘rovlari `x-telegram-init-data` bilan tekshiriladi. Productionda `ALLOWED_TELEGRAM_USER_IDS` aynan ikki IDdan iborat bo‘lishi shart. Bu tekshiruvni chetlab o‘tmang.

## Kunlik mashq qoidasi

- Har foydalanuvchining progressi alohida; R2 dagi `production/users.json` ichida saqlanadi.
- Onboardingdan keyin 1-kun boshlanadi va 24 soat ochiq qoladi.
- Keyingi kun faqat 24 soat o‘tgach **va** kamida bitta server tasdiqlagan `1-urinish → 2-urinish` sikli tugagach ochiladi.
- Kun ichida siklni qayta bajarish mumkin. Ballar yig‘ilmaydi: `latestScore` oxirgi tahlil natijasi, `bestScore` eng yuqori natija, `growth` esa birinchi urinishdan farq.
- `activeCycle` server tomonidan boshqariladi; client yuborgan urinish tartibiga ishonilmaydi. Ikkinchi urinish saqlanmaguncha yangi urinish bloklanadi.
- Eski v2.2.0 dan yarim qolgan urinishlar yangilanishda avtomatik tiklanadi.

## AI oqimi

- Asosiy nutq tahlili: `gemini-3.8-flash`.
- Asosiy model 10 soniyada javob bermasa zaxira: `gemini-3.5-flash-lite`.
- Qo‘shimcha transkripsiya zaxirasi: `gemini-3.5-transcribe`.
- Jonli transkripsiya: `gemini-3.5-transcribe-live`.
- TTS mavjud. Gemini uchun foydalanuvchiga alohida consent oynasi ko‘rsatilmaydi.

## O‘zgartirish va deploy

1. Hech qachon kalit/tokenlarni kodga, READMEga yoki javobga yozmang. Render environment variables va lokal `.env` dan foydalaning.
2. Tekshiruv: `npm run check` va `npm test`.
3. `main` ga commit/push qiling, keyin Render service’ni deploy qiling.
4. Deploydan keyin `/health` versiyasini, Telegram webhook holatini va ruxsat berilgan foydalanuvchining `/api/session` holatini tekshiring.
5. Frontend assetlari keshlangan bo‘lishi mumkin; `public/index.html` dagi `?v=` versiyasini yangi relizda oshiring.

