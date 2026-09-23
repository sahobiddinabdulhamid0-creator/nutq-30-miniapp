# Nutq 30 — Keyingi Agent Uchun Qo‘llanma, Xatolar va Saboqlar

> **Versiya:** `2.5.0` (Productionga chiqarildi)
> **Oxirgi barqaror commit:** `3e28ee7` (va keyingisi)  
> **Production:** `https://nutq-30-miniapp.onrender.com/`  
> **Telegram Bot:** `@nutquzbot`  
> **Stack:** Node.js + Express 4, Vanilla CSS (3D Soft Glass Design System), Telegram WebApp SDK, Gemini 3.8/3.5, Cloudflare R2.

---

## 1. Oldingi Agentlar Qilgan Xatolar (Post-Mortem: Nimalar Noto‘g‘ri Bo‘lgan?)

Oldingi versiyalarda (`v2.3.x` va `Stitch` bilan ishlashda) jiddiy dizayn va arxitektura xatolari yuz bergan. Foydalanuvchi loyihani ochganda **"juda yomon o'qishga qiyin rasvo dizayn"** va **"o'zgarmadiku deyarli, commit qildim deploy qildim"** deb haqli e'tiroz bildirdi.

### 🔴 1-Xato: Tailwind CDN ni ko‘r-ko‘rona kiritish va CSS ziddiyati (Conflict)
- **Nima bo‘lgan:** Oldingi agent Google Stitch yoki tashqi HTML shablonlarini ko‘chirayotib `index.html` ga `<script src="https://cdn.tailwindcss.com"></script>` va inline Tailwind konfiguratsiyasini tashlab ketgan.
- **Oqibati:** Tailwind CDN o‘zining boshlang‘ich yengil foni (`#f5f9f8`) va qora matn ranglarini yuklagan. Ammo `app.css` da loyihaning o‘z qoidalari bo‘lgan. Ikkita qarama-qarshi dizayn tizimi bir-birini majaqlab tashlagan.

### 🔴 2-Xato: Telegram Dark Mode ni va kontrastni umuman tekshirmaslik
- **Nima bo‘lgan:** Foydalanuvchi Telegram ilovasini **Dark Mode (Qorong‘i rejim)**da ishlatadi. Telegram WebApp ochilganda avtomatik ravishda `document.documentElement` ga `.dark` sinfini qo‘shadi.
- **Oqibati:**
  1. `app.css` kartochkalarga to‘q kulrang/qora fon bergan (`rgba(13, 27, 40, 0.75)`).
  2. `screens.js` ichida esa Tailwind utility klasslari (`text-slate-900`, `text-slate-800`, `text-slate-600`) qotirib qo‘yilgan bo‘lgan.
  3. Natijada: **qora kartochka ichida qora matn** paydo bo‘lgan — "Natija" ekranidagi statistika butunlay ko‘rinmay qolgan!
  4. "Xarita" ekranida esa oq kartochka ustiga oq matn tushib, darslar yo‘qolib qolgan.

### 🔴 3-Xato: Telegram Webview keshining agressivligini bilmaslik
- **Nima bo‘lgan:** Foydalanuvchi kodni o‘zgartirib Renderga deploy qilganda ham telefonda hech narsa o‘zgarmagan.
- **Oqibati:** Telegram Webview ichki brauzeri `app.css` va `app.js` kabi statik fayllarni o‘z xotirasiga agressiv keshlab oladi. Agar:
  - `index.html` ichida versiya query parametri (`?v=2.4.1`) oshirilmasa;
  - `server.js` da statik fayllarga `Cache-Control: no-store, no-cache` berilmasa;
  - Foydalanuvchiga Telegram ichida `⋮ (uch nuqta) -> Sahifani yangilash (Reload Page)` bosish aytilmasa;
  telefon baribir eski buzuq faylni ko‘rsataveradi!

### 🔴 4-Xato: Versiyalarni hardcode qilish va CSP cheklovlari
- `server/server.js` da `/health` marshruti `'2.2.1'` deb hardcode qilingan bo‘lgan (garchi `package.json` yangilangan bo‘lsa ham).
- CSP sarlavhasida `connect-src` ichida `ws:` va `wss:` unutilgan bo‘lib, WebSocket jonli transkripsiyasi Telegram Webview da xavfsizlik blokirovkasiga uchrashi mumkin edi.

---

## 2. Qilingan O‘zgarishlar (v2.4.1 Yechimi)

1. **Tailwind CDN to‘liq olib tashlandi:**
   - `index.html` dan barcha Tailwind CDN skriptlari o‘chirildi.
   - Tashqi kutubxonalarga bog‘liqlik yo‘q qilindi, yuklanish tezlashdi.
2. **Sof va Yuqori Kontrastli Vanilla CSS Arxitekturasi (`public/css/app.css`):**
   - Tizim to‘liq CSS o‘zgaruvchilariga (`var(--bg)`, `var(--surface-card)`, `var(--text)`, `var(--text-subtle)`, `var(--primary)`) o‘tkazildi.
   - **Dark Mode (`html.dark`):** To‘q chuqur fon (`#090d13`), yarim shaffof zamonaviy quyuq shisha kartochkalar, oppoq va yorqin matnlar (`#ffffff`, `#f1f5f9`), zumrad rangli urg‘ular (`#10b981`).
   - **Light Mode:** Toza shaffof oq kartalar, chuqur to‘q ko‘k/qora aniq o‘qiluvchi matnlar (`#0f172a`).
   - `screens.js` dagi eski qolib ketgan utility klasslar (`text-slate-900`, `bg-white/40` va h.k.) universal tarzda CSS o‘zgaruvchilariga qayta bog‘landi.
3. **Kesh va Versiyalash Tartibga Solindi:**
   - `package.json` -> `2.4.1`.
   - `public/index.html` -> `/css/app.css?v=2.4.1`.
   - `server/server.js` -> `express.static` va SPA fallback uchun qat'iy `Cache-Control: no-store, no-cache, must-revalidate` sarlavhalari o‘rnatildi.
   - `/health` endi to‘g‘ridan-to‘g‘ri `package.json` versiyasini dinamik qaytaradi.
   - CSP sarlavhasiga `connect-src 'self' ... ws: wss:` qo‘shildi.

---

## 3. Keyingi Agent Uchun Oltin Qoidalar (Golden Rules)

Har qanday keyingi o‘zgarish kiritishdan oldin ushbu qoidalarni yodda tuting:

### 1. Hech qachon tashqi CSS kutubxonasi yoki CDN qo‘shmang
Ushbu loyiha uchun `public/css/app.css` yagona dizayn manbai hisoblanadi. Yangi komponent kerak bo‘lsa, uni mavjud CSS o‘zgaruvchilari (`var(--surface-card)`, `var(--text)`, `var(--radius-lg)` va h.k.) asosida yarating. Inline qora ranglar (`#000`, `text-black`) yozmang!

### 2. Har doim Dark va Light Mode ni, ayniqsa 390px mobil ekranda tekshiring
Foydalanuvchilar Telegramni asosan Dark modeda ishlatadi. Har qanday matn (sarlavha, kichik izoh, badge, statistika raqami) orqa fon bilan kamida WCAG AA (4.5:1) kontrastiga ega bo‘lishi shart:
- To‘q fonda -> Matn oq yoki juda yorqin (`#ffffff` / `#f8fafc`).
- Oq fonda -> Matn to‘q kulrang yoki qora (`#0f172a` / `#1e293b`).

### 3. Har qanday frontend yangilanishida versiyani oshiring
Frontendga (`app.css`, `app.js`, `screens.js`) o‘zgartirish kiritgach:
1. `package.json` dagi versiyani oshiring (masalan `2.4.2`).
2. `public/index.html` dagi `app.css?v=2.4.2` va `app.js?v=2.4.2` ni oshiring.
3. Foydalanuvchiga: **"Telegramda yuqoridagi 3 ta nuqta ⋮ -> Sahifani yangilash (Reload Page) qiling"** deb eslatib turing.

### 4. Xavfsizlik va Auth qoidalarini buzmang
- Productionda `ALLOWED_TELEGRAM_USER_IDS` aynan ikki foydalanuvchi ID sidan iborat bo‘lishi shart.
- Hech qachon tokenlarni, Gemini API kalitlarini yoki R2 ma'lumotlarini gitga yoki ommaviy javobga chiqarmang.

### 5. Har qanday pushdan oldin testlarni tekshiring
```bash
npm run check
npm test
```
Barcha testlar o‘tishi shart (v2.5.0 da 19 ta).

---

## 4. Muhim Fayllar Xaritasi

- `public/css/app.css` — Barcha dizayn tokenlari, 3D Soft Glass effektlari, Dark/Light mode va komponentlar stili.
- `public/index.html` — Mini App boshlang‘ich skeleti, meta-teglar va kesh versiyalari.
- `public/js/screens.js` — Barcha ekranlar (Bosh sahifa, Xarita, Natija, Mashq zali, Lug‘at) render funksiyalari.
- `public/js/app.js` — Telegram WebApp o‘zaro aloqasi, dars sikli boshqaruvi va audio yozish oqimi.
- `server/server.js` — Express server, xavfsizlik (CSP), kesh boshqaruvi, R2 integratsiyasi va API marshrutlari.
- `server/geminiService.js` — Gemini 3.8/3.5 nutq tahlili, metrikalar va audio qayta ishlash.
- `tests/*.test.js` — 19 ta avtomatlashtirilgan unit va integratsion testlar.

## 5. v2.5.0 — o‘quv va natija tizimi

- `server/practiceContent.js`: besh yo‘nalishdagi 15 ta mustaqil mashq; har birida usul, namuna, kuzatiladigan tekshiruv va real suhbat topshirig‘i bor.
- `public/js/screens.js`: mashq zali, 1/3/7 kunlik takrorlash eslatmasi, bir xil topshiriqdagi 1-/7-/30-kun birinchi yozuvlari va real suhbat qaydlari. Eski maketdagi soxta ball, vaqt, nutq tezligi va ishlamaydigan audio tugmalari olib tashlandi.
- `server/userStore.js`: mashq va real suhbat qaydlari foydalanuvchi bo‘yicha saqlanadi. Eski profillar ochilganda yangi maydonlar qo‘shiladi. 1-/7-/30-kun birinchi urinishlari 300 ta urinish chegarasidan keyin ham qoladi.
- `server/geminiService.js`: so‘z soni transkripsiyadan, tezlik esa yozuv davomiyligidan qayta hisoblanadi. AI balli xolis yakuniy baho deb taqdim etilmaydi.
- `LEARNING_DESIGN.md`: ilmiy tayanch, o‘lchov chegaralari va ikki mustaqil tinglovchi bilan pilot tekshiruv tartibi.
- `npm run check` va `npm test`: 19/19 test o‘tgan. 390 px mobil light/dark ekranlar Chrome CDP orqali ko‘rib chiqilgan; lokal API da mashq va real suhbat qaydini saqlash tekshirilgan.
