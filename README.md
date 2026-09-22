# Nutq 30

Telegram Mini App ichida ishlaydigan, ikki foydalanuvchi uchun 30 kunlik audio nutq mashq platformasi.

## Asosiy oqim

Har bir kun:

1. qisqa mikro-dars;
2. Gemini TTS orqali audio dars;
3. nafas yoki artikulyatsiya tayyorgarligi;
4. birinchi audio urinish;
5. foydalanuvchining o‘z kuzatuvi;
6. Gemini audio transkripsiyasi va dalilli tahlili;
7. bitta fokus tanlash;
8. ikkinchi urinish;
9. ikki urinishni solishtirish;
10. progressni saqlash.

Audio fayllar serverda saqlanmaydi. Ular brauzerning IndexedDB bazasida, qurilmada qoladi. Serverda transkripsiya, ball, tavsiya va progress saqlanadi.

## Lokal ishga tushirish

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Brauzerda `http://localhost:3000` manzilini oching. Telegram tashqarisida development rejimida yuqorida `1-profil` va `2-profil` tugmalari chiqadi. Ularning progressi alohida saqlanadi.

## Muhit o‘zgaruvchilari

- `GEMINI_API_KEY` — Google AI Studio API kaliti.
- `GEMINI_ANALYSIS_MODEL` — standart: `gemini-3.8-flash`.
- `GEMINI_TTS_MODEL` — standart: `gemini-3.1-flash-tts-preview`.
- `BOT_TOKEN` — BotFather bergan bot tokeni.
- `ALLOWED_TELEGRAM_USER_IDS` — vergul bilan ajratilgan ikki Telegram ID.
- `MINI_APP_URL` — Telegram ochadigan HTTPS Mini App manzili.
- `PUBLIC_URL` — Render yoki Cloudflare orqali tashqi HTTPS manzil.
- `TELEGRAM_WEBHOOK_SECRET` — tasodifiy uzun maxfiy satr.
- `DATA_DIR` — persistent disk papkasi. Render uchun masalan `/var/data/nutq30`.

Haqiqiy tokenlar `.env` faylida turadi va GitHub’ga yuborilmaydi.

## Tekshirish

```powershell
npm run check
npm test
```

## Telegram xavfsizligi

Frontend `Telegram.WebApp.initData` qiymatini serverga yuboradi. Server bot token orqali HMAC-SHA-256 imzoni va `auth_date`ni tekshiradi. `initDataUnsafe` autentifikatsiya sifatida ishlatilmaydi.

Productionda `ALLOW_DEV_AUTH=false` bo‘lishi shart. Faqat ikki foydalanuvchi kirishi uchun ularning Telegram raqamli IDlari `ALLOWED_TELEGRAM_USER_IDS`ga yoziladi.

## Render deployment

`render.yaml` boshlang‘ich konfiguratsiyani beradi. JSON baza ishlatilgani uchun Render persistent disk ulanishi zarur. Keyinchalik xohlasangiz `UserStore` PostgreSQL adapteriga almashtirilishi mumkin.

Bot token, Render service va yakuniy domen tayyor bo‘lgach:

1. environment qiymatlari Render’ga yoziladi;
2. persistent disk `/var/data/nutq30`ga ulanadi;
3. `MINI_APP_URL` va `PUBLIC_URL` belgilanadi;
4. server ishga tushganda bot menu tugmasi va webhook avtomatik sozlanadi;
5. BotFather’da Main Mini App manzili tasdiqlanadi.

