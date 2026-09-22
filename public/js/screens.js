function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function metricName(metricId) {
  return App.content?.metrics?.[metricId]?.title || metricId;
}

function scoreDescriptor(score) {
  if (score <= 2) return 'Ko‘nikma hali ko‘rinmadi';
  if (score <= 5) return 'Bor, lekin barqaror emas';
  if (score <= 8) return 'Ko‘p qismda yaxshi';
  return 'Tabiiy va barqaror';
}

function remainingTimeLabel(unlocksAt) {
  const remaining = Math.max(0, new Date(unlocksAt).getTime() - Date.now());
  if (remaining <= 0) return '24 soat yakunlandi';
  const totalMinutes = Math.ceil(remaining / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours} soat ${minutes} daqiqa` : `${minutes} daqiqa`;
}

const Screens = {
  onboarding(user, devMode) {
    const firstName = escapeHtml(user.profile.firstName);
    return `
      <section class="screen">
        ${devMode ? this.devSwitch(user.id) : ''}
        <div class="card hero-card stack">
          <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-fixed text-primary text-xs font-bold uppercase tracking-wider">
            <span class="w-1.5 h-1.5 rounded-full bg-primary"></span>
            <span>Xush kelibsiz, ${firstName}</span>
          </div>
          <h1 class="font-headline text-2xl font-bold tracking-tight">30 kunda ravonroq va ishonchliroq gapiring</h1>
          <p class="muted">Har kuni bitta qisqa dars, ikkita audio urinish va dalilli Gemini tahlili.</p>
        </div>

        <form class="stack-lg" onsubmit="App.submitOnboarding(event)">
          <fieldset>
            <legend class="font-headline text-sm font-bold mb-2">Asosiy maqsadingiz</legend>
            <div class="choice-grid">
              ${[
                ['ravonlik', 'Ravon gapirish', 'graphic_eq'],
                ['parazit', 'Parazitlarni yo‘qotish', 'filter_alt'],
                ['ishonch', 'Ishonchli gapirish', 'bolt'],
                ['intervyu', 'Intervyuga tayyorgarlik', 'work'],
                ['talaffuz', 'Talaffuz va diksiya', 'record_voice_over'],
                ['tuzilma', 'Fikrni tartiblash', 'account_tree']
              ].map(([value, label, icon], index) => `
                <label class="choice">
                  <input type="radio" name="goal" value="${value}" ${index === 0 ? 'checked' : ''}>
                  <span class="material-symbols-outlined text-primary text-[18px]">${icon}</span>
                  <span>${label}</span>
                </label>
              `).join('')}
            </div>
          </fieldset>

          <fieldset>
            <legend class="font-headline text-sm font-bold mb-2">Hozirgi darajangiz</legend>
            <div class="choice-grid">
              <label class="choice"><input type="radio" name="level" value="boshlangich" checked> <span>Boshlang‘ich</span></label>
              <label class="choice"><input type="radio" name="level" value="orta"> <span>O‘rta</span></label>
              <label class="choice"><input type="radio" name="level" value="yuqori"> <span>Yuqori</span></label>
            </div>
          </fieldset>

          <div class="field">
            <label for="dailyMinutes">Kunlik mashq vaqti</label>
            <select id="dailyMinutes" name="dailyMinutes">
              <option value="10">10 daqiqa (tezkor)</option>
              <option value="15" selected>15 daqiqa (tavsiya etiladi)</option>
              <option value="20">20 daqiqa (chuqur)</option>
            </select>
          </div>

          <button class="button" type="submit">
            <span>1-kunni boshlash</span>
            <span class="material-symbols-outlined">arrow_forward</span>
          </button>
        </form>
      </section>`;
  },

  devSwitch(activeId) {
    return `
      <div class="dev-switch" aria-label="Lokal test profili">
        <button class="${activeId === 'dev-user-1' ? 'active' : ''}" type="button" onclick="App.switchDevUser('dev-user-1')">1-profil</button>
        <button class="${activeId === 'dev-user-2' ? 'active' : ''}" type="button" onclick="App.switchDevUser('dev-user-2')">2-profil</button>
      </div>`;
  },

  home(user, curriculum, capabilities, devMode) {
    const progress = user.progress;
    const day = Math.min(progress.currentDay, 30);
    const lesson = curriculum.find(item => item.day === day);
    const completed = progress.completedDays.length;
    const percent = Math.round(completed / 30 * 100);
    const activeDay = progress.activeDay?.day === day ? progress.activeDay : null;
    const resume = App.getResumeState(day);
    const programComplete = Boolean(progress.programCompletedAt);
    const cta = programComplete
      ? '30 kunlik natijani ko‘rish'
      : resume === 'focus'
        ? 'Bitta fokus tanlash'
        : resume === 'compare'
          ? 'Natijani taqqoslash'
          : activeDay?.cyclesCompleted > 0
            ? 'Bugungi darsni yana takrorlash'
            : 'Mashqni boshlash';
    const ctaAction = programComplete
      ? "App.navigate('progress')"
      : resume ? `App.resumeDay(${day})` : `App.navigate('lesson',{day:${day}})`;
    const modelLabel = capabilities?.configured ? `Gemini faol` : 'API sozlanmagan';
    const growth = activeDay?.growth;
    const streak = progress.streakDays || 0;

    return `
      <section class="screen">
        ${devMode ? this.devSwitch(user.id) : ''}

        <!-- 1. Minimalist Top Header Greeting -->
        <div class="flex items-center justify-between pt-1">
          <div>
            <h1 class="font-headline text-2xl font-bold tracking-tight">Salom, ${escapeHtml(user.profile.firstName)}!</h1>
            <p class="small muted mt-0.5">Bugungi amaliy nutq mashqi tayyor</p>
          </div>
          <div class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 shadow-sm">
            <span class="text-sm leading-none">🔥</span>
            <span class="font-headline text-xs font-bold">${streak} kun</span>
          </div>
        </div>

        <!-- 2. Clean 1-Line Progress Bar -->
        <div class="card stack-sm py-3 px-4">
          <div class="flex justify-between items-center text-xs font-semibold">
            <span class="text-slate-800">${completed} / 30 kun</span>
            <span class="text-primary font-bold">${percent}% yakunlandi</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${percent}%"></div>
          </div>
        </div>

        <!-- 3. ONE Hero Focal Card (Bugungi Fokus) -->
        <article class="hero-card stack-lg">
          <div class="flex items-center justify-between wrap gap-2">
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-soft text-primary-dark text-xs font-bold uppercase tracking-wider">
              <span class="w-1.5 h-1.5 rounded-full bg-primary"></span>
              <span>BUGUNGI FOKUS • ${day}-KUN</span>
            </div>
            <span class="pill">${escapeHtml(lesson.stageName)}</span>
          </div>

          <div class="stack-sm">
            <h2 class="text-xl font-bold tracking-tight text-slate-900">${escapeHtml(lesson.title)}</h2>
            <p class="muted leading-relaxed">${escapeHtml(lesson.skill)}</p>
          </div>

          <div class="flex items-center gap-2 wrap">
            <span class="pill"><span class="material-symbols-outlined text-[15px]">timer</span> ${lesson.durationMinutes} daqiqa</span>
            <span class="pill"><span class="material-symbols-outlined text-[15px]">mic</span> 2 urinish</span>
            ${lesson.activeMetrics.slice(0, 2).map(metric => `<span class="pill">${escapeHtml(metric.title)}</span>`).join('')}
          </div>

          <!-- Dominant 54px Primary CTA -->
          <button class="button" type="button" onclick="${ctaAction}">
            <span class="material-symbols-outlined text-[22px] material-symbols-fill">mic</span>
            <span>${cta}</span>
          </button>
        </article>

        <!-- 4. Glanceable Today Workout Snapshot (if activeDay) -->
        ${activeDay ? `
          <div class="card stack">
            <div class="flex items-center justify-between pb-2 border-b border-slate-100">
              <div class="flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                <strong class="text-sm">${day}-kun jarayoni</strong>
              </div>
              <span class="pill primary text-xs">${remainingTimeLabel(activeDay.unlocksAt)}</span>
            </div>

            <div class="grid grid-cols-2 gap-2.5">
              <div class="p-3 rounded-xl bg-slate-50 border border-slate-200/70 stack-sm">
                <span class="text-xs text-slate-500 font-medium">1-urinish</span>
                <div class="flex items-baseline gap-1">
                  <strong class="text-xl font-headline font-bold text-slate-900">${activeDay.firstScore ?? '—'}</strong>
                  <span class="text-xs text-slate-400 font-normal">ball</span>
                </div>
              </div>
              <div class="p-3 rounded-xl bg-slate-50 border border-slate-200/70 stack-sm">
                <span class="text-xs text-slate-500 font-medium">Oxirgi natija</span>
                <div class="flex items-baseline gap-1">
                  <strong class="text-xl font-headline font-bold text-slate-900">${activeDay.latestScore ?? '—'}</strong>
                  ${growth != null ? `<span class="text-xs font-bold text-emerald-600">(${growth > 0 ? '+' : ''}${growth})</span>` : ''}
                </div>
              </div>
            </div>

            ${activeDay.lastSuggestedFocus ? `
              <div class="p-3 rounded-xl bg-teal-50/70 border border-teal-100 text-teal-900 text-xs leading-relaxed">
                <strong>AI tavsiya qilgan fokus:</strong> ${escapeHtml(activeDay.lastSuggestedFocus)}
              </div>
            ` : ''}
          </div>
        ` : ''}

        <!-- 5. Status Footer -->
        <div class="flex items-center justify-between px-2 py-1 text-xs text-slate-400">
          <span class="flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full ${capabilities?.configured ? 'bg-emerald-500' : 'bg-amber-400'}"></span>
            <span>${modelLabel}</span>
          </span>
          <span>Nutq 30 v2.3</span>
        </div>
      </section>`;
  },

  map(user, curriculum, stages) {
    const completedDays = user.progress.completedDays.length;
    return `
      <section class="screen">
        <div class="stack-sm">
          <span class="eyebrow">Yo‘l xaritasi</span>
          <h1>30 kunlik nutq sayohati</h1>
          <p class="muted">5 bosqich, 30 amaliy qadam. Har bir dars yangi ko‘nikma beradi.</p>
        </div>

        <!-- Milestone Badges -->
        <div class="grid grid-cols-3 gap-2">
          <div class="p-3 rounded-xl bg-surface border border-slate-200/80 text-center stack-sm shadow-sm">
            <span class="text-xl">🥉</span>
            <strong class="text-xs font-headline">15-kun</strong>
            <span class="text-[11px] text-slate-500">${completedDays >= 15 ? '✓ Erishildi' : 'O‘rta marra'}</span>
          </div>
          <div class="p-3 rounded-xl bg-surface border border-slate-200/80 text-center stack-sm shadow-sm">
            <span class="text-xl">🥈</span>
            <strong class="text-xs font-headline">21-kun</strong>
            <span class="text-[11px] text-slate-500">${completedDays >= 21 ? '✓ Erishildi' : 'Odat shakllandi'}</span>
          </div>
          <div class="p-3 rounded-xl bg-surface border border-slate-200/80 text-center stack-sm shadow-sm">
            <span class="text-xl">🏆</span>
            <strong class="text-xs font-headline">30-kun</strong>
            <span class="text-[11px] text-slate-500">${completedDays >= 30 ? '✓ Erishildi' : 'Notiq diplomi'}</span>
          </div>
        </div>

        <!-- Stages List -->
        ${stages.map((stage, idx) => `
          <div class="stack-sm">
            <div class="flex items-center justify-between px-1">
              <div>
                <h2 class="text-base font-bold text-slate-900">${idx + 1}-bosqich: ${escapeHtml(stage.title)}</h2>
                <p class="text-xs text-slate-500">${escapeHtml(stage.description)}</p>
              </div>
              <span class="pill primary text-xs">${stage.from}–${stage.to}-kun</span>
            </div>
            <div class="day-list">
              ${curriculum.filter(day => day.stageId === stage.id).map(day => this.dayCard(user, day)).join('')}
            </div>
          </div>
        `).join('')}
      </section>`;
  },

  dayCard(user, lesson) {
    const complete = user.progress.completedDays.includes(lesson.day);
    const current = user.progress.currentDay === lesson.day;
    const unlocked = lesson.day <= user.progress.currentDay || complete;
    const statusClass = complete ? 'complete' : current ? 'current' : unlocked ? '' : 'locked';
    const action = unlocked ? `onclick="App.navigate('lesson',{day:${lesson.day}})"` : 'disabled';

    return `
      <button class="day-card ${statusClass}" type="button" ${action}>
        <span class="day-number">
          ${complete ? '<span class="material-symbols-outlined text-emerald-600 text-[20px]">check</span>' : lesson.day}
        </span>
        <div>
          <strong>${escapeHtml(lesson.title)}</strong>
          <small>${escapeHtml(lesson.skill)} · ${lesson.durationMinutes} daqiqa</small>
        </div>
        <span class="pill ${current ? 'primary' : ''}">
          ${complete ? 'Tugallandi' : current ? 'Bugun' : unlocked ? 'Ochiq' : '🔒'}
        </span>
      </button>`;
  },

  lesson(lesson, canPractice = false) {
    return `
      <section class="screen">
        <div class="flex items-center justify-between wrap gap-2">
          <span class="pill primary">${lesson.day}-kun · ${escapeHtml(lesson.stageName)}</span>
          <span class="pill"><span class="material-symbols-outlined text-[14px]">timer</span> ${lesson.durationMinutes} daqiqa</span>
        </div>

        <div class="stack-sm">
          <h1 class="text-2xl font-bold tracking-tight">${escapeHtml(lesson.title)}</h1>
          <p class="muted leading-relaxed">${escapeHtml(lesson.skill)}</p>
        </div>

        <!-- Audio TTS dars mini-player -->
        <button id="ttsButton" class="button secondary flex items-center justify-center gap-2" type="button" onclick="App.playLessonAudio(${lesson.day})">
          <span class="material-symbols-outlined text-[20px] text-primary material-symbols-fill">play_arrow</span>
          <span>Audio darsni tinglash</span>
        </button>
        <audio id="lessonAudio" class="hidden w-full mt-2" controls></audio>

        <!-- 3 Step Micro-Lesson Structure -->
        <article class="card lesson-card">
          <div class="flex items-center gap-2 text-primary font-headline font-bold">
            <span class="lesson-icon">1</span>
            <h2>Nima bu?</h2>
          </div>
          <p class="leading-relaxed text-slate-700">${escapeHtml(lesson.what)}</p>
        </article>

        <article class="card lesson-card">
          <div class="flex items-center gap-2 text-primary font-headline font-bold">
            <span class="lesson-icon">2</span>
            <h2>Nega kerak?</h2>
          </div>
          <p class="leading-relaxed text-slate-700">${escapeHtml(lesson.why)}</p>
        </article>

        <article class="card lesson-card">
          <div class="flex items-center gap-2 text-primary font-headline font-bold">
            <span class="lesson-icon">3</span>
            <h2>Qanday bajariladi?</h2>
          </div>
          <ol class="numbered-list">
            ${lesson.how.map((step, index) => `
              <li>
                <span>${index + 1}</span>
                <p class="text-slate-700 leading-snug">${escapeHtml(step)}</p>
              </li>
            `).join('')}
          </ol>
        </article>

        <!-- Misollar -->
        <article class="card lesson-card">
          <div class="flex items-center gap-2 text-emerald-700 font-headline font-bold">
            <span class="material-symbols-outlined text-emerald-600">check_circle</span>
            <h2>Yaxshi misol</h2>
          </div>
          <p class="quote text-slate-800">${escapeHtml(lesson.goodExample)}</p>
        </article>

        <article class="card warning lesson-card">
          <div class="flex items-center gap-2 text-amber-800 font-headline font-bold">
            <span class="material-symbols-outlined text-amber-600">error</span>
            <h2>Ko‘p uchraydigan xato</h2>
          </div>
          <p class="text-slate-700">${escapeHtml(lesson.badExample)}</p>
        </article>

        <article class="card soft lesson-card">
          <div class="flex items-center gap-2 text-slate-800 font-headline font-bold">
            <span class="material-symbols-outlined text-primary">task_alt</span>
            <h3>Bugungi tekshiruv</h3>
          </div>
          <p class="small muted">${escapeHtml(lesson.check)}</p>
        </article>

        <!-- Bottom Action CTA -->
        ${canPractice
          ? `<button class="button" type="button" onclick="App.navigate('prepare',{day:${lesson.day}})">
               <span>Tayyorgarlikka o‘tish</span>
               <span class="material-symbols-outlined">arrow_forward</span>
             </button>`
          : '<button class="button" type="button" disabled>Bu dars hozir faqat o‘qish uchun ochiq</button>'}
      </section>`;
  },

  prepare(lesson, attemptNumber = 1, selectedFocus = '') {
    return `
      <section class="screen">
        <div class="stack-sm">
          <span class="eyebrow">${lesson.day}-kun · ${attemptNumber}-urinish</span>
          <h1 class="text-2xl font-bold tracking-tight">Gapirishga tayyorlaning</h1>
          <p class="muted">Matn yozmang va o‘qimang. Faqat tayanch so‘zlarga qarab erkin gapiring.</p>
        </div>

        ${selectedFocus ? `
          <div class="card primary stack-sm">
            <span class="eyebrow" style="color:#99f6e4">Bugungi bitta fokus</span>
            <strong class="text-base text-white">${escapeHtml(selectedFocus)}</strong>
          </div>
        ` : ''}

        <!-- 60s Warmup -->
        <div class="card stack-sm">
          <div class="flex items-center justify-between">
            <span class="eyebrow">60 soniyalik qizish</span>
            <span class="material-symbols-outlined text-primary">self_improvement</span>
          </div>
          <h2 class="text-base font-bold">${escapeHtml(lesson.warmup)}</h2>
          <div class="flex items-center justify-between pt-2">
            <button id="warmupButton" class="button secondary compact" type="button" onclick="App.startWarmup()">
              <span class="material-symbols-outlined text-[18px]">play_arrow</span>
              <span>Taymerni boshlash</span>
            </button>
            <strong id="warmupTimer" class="font-headline text-2xl font-bold text-primary tnum">01:00</strong>
          </div>
        </div>

        <!-- Topic & Prompt -->
        <div class="card stack">
          <div class="flex items-center justify-between">
            <span class="eyebrow">Nutq mavzusi</span>
            <span class="pill"><span class="material-symbols-outlined text-[13px]">timer</span> ${lesson.recommendedSeconds}s</span>
          </div>
          <h2 class="text-lg font-bold leading-snug">${escapeHtml(lesson.prompt)}</h2>
          <div class="flex items-center gap-1.5 wrap pt-1">
            ${lesson.keywords.map(word => `<span class="pill primary">${escapeHtml(word)}</span>`).join('')}
          </div>
        </div>

        <!-- Privacy note -->
        <div class="p-3 rounded-xl bg-slate-100/80 text-xs text-slate-600 flex items-start gap-2">
          <span class="material-symbols-outlined text-slate-500 text-[18px] shrink-0 mt-0.5">lock</span>
          <p>Yozuv xavfsiz audio formatda qurilmangizda saqlanadi. Tahlil vaqtida Gemini API faqat nutq sifatini baholaydi.</p>
        </div>

        <!-- Primary CTA -->
        <button class="button" type="button" onclick="App.openRecorder(${lesson.day},${attemptNumber})">
          <span class="material-symbols-outlined text-[20px] material-symbols-fill">mic</span>
          <span>Mikrofonni ochish</span>
        </button>
      </section>`;
  },

  record(lesson, attemptNumber, selectedFocus = '', liveAvailable = false) {
    const maxTime = Math.max(lesson.recommendedSeconds + 30, lesson.recommendedSeconds * 1.35);
    return `
      <section class="record-shell">
        <!-- Top Studio Bar -->
        <div class="flex items-center justify-between">
          <button class="button ghost compact flex items-center gap-1" type="button" onclick="App.cancelRecording()">
            <span class="material-symbols-outlined text-[18px]">arrow_back</span>
            <span>Chiqish</span>
          </button>
          <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold shadow-sm">
            <span class="w-2 h-2 rounded-full bg-rose-600 animate-pulse"></span>
            <span>Jonli yozuv • ${attemptNumber}-urinish</span>
          </div>
          <span class="pill text-xs"><span class="material-symbols-outlined text-[14px]">mic</span> Audio</span>
        </div>

        <!-- Center Recording Panel -->
        <div class="record-panel stack-lg">
          <div class="stack-sm text-center">
            <span class="eyebrow">${lesson.day}-kun · ${escapeHtml(lesson.title)}</span>
            <h2 class="text-lg font-bold text-slate-900">${escapeHtml(lesson.prompt)}</h2>
          </div>

          <div class="keyword-row">
            ${lesson.keywords.map(word => `<span>${escapeHtml(word)}</span>`).join('')}
          </div>

          ${selectedFocus ? `
            <div class="inline-block px-3 py-1.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 text-xs font-semibold">
              <strong>Fokus:</strong> ${escapeHtml(selectedFocus)}
            </div>
          ` : ''}

          <!-- Digital Timer -->
          <div class="stack-sm items-center">
            <div id="recordTimer" class="record-timer">00:00</div>
            <span class="text-xs text-slate-400">Tavsiya: ~${lesson.recommendedSeconds} soniya</span>
          </div>

          <!-- Real-time Waveform -->
          <div id="waveform" class="waveform" aria-label="Ovoz darajasi">
            ${Array.from({ length: 24 }, () => '<i></i>').join('')}
          </div>

          <!-- Tactile Record Trigger -->
          <div class="flex flex-col items-center gap-2 pt-2">
            <button id="recordButton" class="record-button" type="button" onclick="App.toggleRecording(${Math.round(maxTime)})" aria-label="Yozishni boshlash">
              Yozish
            </button>
            <p id="recordHint" class="text-xs text-slate-500 font-medium">Tugmani bosing va erkin gapiring</p>
          </div>

          ${liveAvailable ? `
            <div class="live-transcript">
              <span id="liveStatus">Jonli transkripsiya ulanmoqda…</span>
              <p id="liveTranscript"></p>
            </div>
          ` : ''}
        </div>

        <!-- Pedagogical Hint -->
        <p class="text-xs text-center text-slate-400 leading-snug">
          Shoshilmang: fikrlar orasida 1 soniya xotirjam pauza qiling. Xato qilsangiz to‘xtamang, davom eting.
        </p>
      </section>`;
  },

  review(lesson, attemptNumber, recording) {
    return `
      <section class="screen">
        <div class="stack-sm">
          <span class="eyebrow">${attemptNumber}-urinish yozildi</span>
          <h1 class="text-2xl font-bold tracking-tight">Avval o‘zingiz eshiting</h1>
          <p class="muted">Tahlildan oldin o‘z nutqingizni xolis baholash ko‘nikmani 2 barobar tez o‘stiradi.</p>
        </div>

        <div class="card stack-sm">
          <audio class="w-full" controls src="${recording.audioUrl}"></audio>
          <div class="flex justify-between items-center text-xs text-slate-500 pt-1">
            <span>Davomiyligi: ${recording.durationSeconds} soniya</span>
            <span class="text-emerald-600 font-medium">✓ Audio yozildi</span>
          </div>
        </div>

        <form class="stack-lg" onsubmit="App.analyzeCurrentRecording(event)">
          <div class="field">
            <label for="mainIdea">Asosiy fikrim nima edi?</label>
            <textarea id="mainIdea" name="mainIdea" maxlength="500" placeholder="Bir jumlada ifodalang…"></textarea>
          </div>

          <div class="field">
            <label for="bestPart">Eng yaxshi chiqqan joyi</label>
            <textarea id="bestPart" name="bestPart" maxlength="500" placeholder="Aniq so‘z, ibora yoki vazmin pauza…"></textarea>
          </div>

          <div class="field">
            <label for="improvePart">Qayerni yaxshilash kerak?</label>
            <textarea id="improvePart" name="improvePart" maxlength="500" placeholder="Bitta aniq o‘zgartirmoqchi bo‘lgan jihat…"></textarea>
          </div>

          <button class="button" type="submit">
            <span>Gemini bilan tahlil qilish</span>
            <span class="material-symbols-outlined">auto_awesome</span>
          </button>
          <button class="button secondary" type="button" onclick="App.retryRecording()">
            <span class="material-symbols-outlined text-[18px]">replay</span>
            <span>Qaytadan yozish</span>
          </button>
        </form>
      </section>`;
  },

  analysis(lesson, attempt) {
    const evaluation = attempt.evaluation;
    const isFirst = attempt.attemptNumber === 1;
    return `
      <section class="screen">
        <!-- Header -->
        <div class="flex items-center justify-between">
          <div>
            <span class="eyebrow">${attempt.attemptNumber}-urinish tahlili</span>
            <h1 class="font-headline text-3xl font-extrabold tracking-tight text-primary">${evaluation.totalScore}<span class="text-base text-slate-400 font-normal">/100</span></h1>
          </div>
          <span class="pill primary text-xs">AI Dalilli Tahlil</span>
        </div>

        <!-- 3 Evidence Counters -->
        <div class="counter-grid">
          <div class="counter">
            <strong class="text-slate-900">${evaluation.fillerCount}</strong>
            <small>parazit so‘z</small>
          </div>
          <div class="counter">
            <strong class="text-slate-900">${evaluation.longPauseCount}</strong>
            <small>uzoq pauza</small>
          </div>
          <div class="counter">
            <strong class="text-slate-900">${evaluation.wpm}</strong>
            <small>so‘z/daqiqada</small>
          </div>
        </div>

        <!-- Transcript Card -->
        <div class="card stack-sm">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-bold text-slate-900">Nutq matni</h2>
            <span class="material-symbols-outlined text-slate-400 text-[18px]">subject</span>
          </div>
          <p class="quote text-sm text-slate-700 leading-relaxed">${escapeHtml(evaluation.transcript)}</p>
        </div>

        <!-- Mezonlar / Rubric Scores -->
        <div class="card stack">
          <div class="flex items-center justify-between pb-2 border-b border-slate-100">
            <h2 class="text-sm font-bold text-slate-900">Bugungi asosiy mezonlar</h2>
            <span class="text-xs text-slate-400">10 ballik mezon</span>
          </div>
          <div class="score-list">
            ${evaluation.metricScores.map(item => `
              <div class="score-row">
                <div class="row-between text-xs">
                  <strong class="text-slate-800">${escapeHtml(metricName(item.metricId))}</strong>
                  <strong class="text-primary">${item.score}/10</strong>
                </div>
                <div class="score-bar">
                  <span style="width:${item.score * 10}%"></span>
                </div>
                <p class="text-[12px] text-slate-500 leading-tight">${escapeHtml(scoreDescriptor(item.score))}. ${escapeHtml(item.evidence)}</p>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Strengths & Improvements -->
        <div class="card stack-sm">
          <h2 class="text-sm font-bold text-emerald-800 flex items-center gap-1.5">
            <span class="material-symbols-outlined text-emerald-600 text-[18px]">verified</span>
            <span>Kuchli tomonlar</span>
          </h2>
          ${evaluation.strengths.map(text => `<p class="text-xs text-slate-700 flex items-start gap-1.5"><span class="text-emerald-600 font-bold">✓</span> <span>${escapeHtml(text)}</span></p>`).join('')}
        </div>

        <div class="card warning stack-sm">
          <h2 class="text-sm font-bold text-amber-900 flex items-center gap-1.5">
            <span class="material-symbols-outlined text-amber-600 text-[18px]">lightbulb</span>
            <span>O‘sish nuqtalari</span>
          </h2>
          ${evaluation.improvements.map(text => `<p class="text-xs text-slate-700 flex items-start gap-1.5"><span class="text-amber-600 font-bold">•</span> <span>${escapeHtml(text)}</span></p>`).join('')}
        </div>

        <!-- Suggested Focus -->
        <div class="card primary stack-sm">
          <span class="eyebrow" style="color:#99f6e4">AI tavsiya qilgan bitta fokus</span>
          <strong class="text-base text-white leading-snug">${escapeHtml(evaluation.suggestedFocus)}</strong>
        </div>

        <!-- Primary CTA -->
        <button class="button" type="button" onclick="${isFirst ? 'App.openFocusSelection()' : 'App.openComparison()'}">
          <span>${isFirst ? 'Bitta fokus tanlash' : 'Ikki urinishni solishtirish'}</span>
          <span class="material-symbols-outlined">arrow_forward</span>
        </button>
      </section>`;
  },

  focus(lesson, attempt) {
    const suggested = attempt.evaluation.suggestedFocus;
    const options = [suggested, ...lesson.focusOptions].filter((item, index, list) => item && list.indexOf(item) === index).slice(0, 6);
    return `
      <section class="screen">
        <div class="stack-sm">
          <span class="eyebrow">2-urinishga tayyorgarlik</span>
          <h1 class="text-2xl font-bold tracking-tight">Faqat bittasini o‘zgartiring</h1>
          <p class="muted">Bir vaqtning o‘zida faqat 1 ta jihatga diqqat qaratish nutq sifatini sezilarli oshiradi.</p>
        </div>

        <form class="stack-lg" onsubmit="App.startSecondAttempt(event)">
          <fieldset>
            <legend class="font-headline text-sm font-bold mb-2">Fokusni tanlang</legend>
            <div class="stack">
              ${options.map((option, index) => `
                <label class="choice ${index === 0 ? 'border-teal-400 bg-teal-50/50' : ''}">
                  <input type="radio" name="focus" value="${escapeHtml(option)}" ${index === 0 ? 'checked' : ''}>
                  <span>${index === 0 ? '<strong class="text-teal-700">AI tavsiyasi:</strong> ' : ''}${escapeHtml(option)}</span>
                </label>
              `).join('')}
              <label class="choice">
                <input type="radio" name="focus" value="custom">
                <span>O‘z fokusimni kiritish</span>
              </label>
            </div>
          </fieldset>

          <div class="field">
            <label for="customFocus">O‘z fokusingiz (ixtiyoriy)</label>
            <input id="customFocus" name="customFocus" type="text" maxlength="300" placeholder="Masalan: gap oxirida ovozni tushirish">
          </div>

          <button class="button" type="submit">
            <span>2-urinishni boshlash</span>
            <span class="material-symbols-outlined">arrow_forward</span>
          </button>
        </form>
      </section>`;
  },

  compare(lesson, attempt1, attempt2) {
    const diff = attempt2.evaluation.totalScore - attempt1.evaluation.totalScore;
    const fillerDiff = attempt1.evaluation.fillerCount - attempt2.evaluation.fillerCount;

    return `
      <section class="screen">
        <div class="stack-sm">
          <span class="eyebrow">${lesson.day}-kun · Yakuniy natija</span>
          <h1 class="text-2xl font-bold tracking-tight">Ikki urinishni solishtiring</h1>
          <p class="muted">Ikkinchi urinish — kunning yakuniy natijasi hisoblanadi.</p>
        </div>

        <!-- Dual Attempt Comparison Hero Card -->
        <div class="card stack-sm">
          <div class="flex items-start justify-between pb-3 border-b border-slate-100">
            <div>
              <span class="text-xs text-slate-500 uppercase tracking-wider block mb-0.5">O‘sish ko‘rsatkichi</span>
              <div class="flex items-baseline gap-2">
                <span class="font-headline text-3xl font-extrabold text-primary tnum">${attempt2.evaluation.totalScore}<span class="text-sm font-normal text-slate-400">/100</span></span>
                <span class="text-sm font-semibold text-slate-400 line-through tnum">${attempt1.evaluation.totalScore} ball</span>
              </div>
            </div>
            <div class="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-sm">
              <span class="material-symbols-outlined text-[16px] text-emerald-600">trending_up</span>
              <span>${diff >= 0 ? `+${diff}` : diff} ball o‘sish</span>
            </div>
          </div>

          <!-- Side by Side Metrics -->
          <div class="grid grid-cols-2 gap-2 pt-2">
            <div class="p-3 rounded-xl bg-slate-50 border border-slate-200/80 stack-sm">
              <span class="text-xs text-slate-500 font-semibold">1-urinish</span>
              <strong class="text-xl font-headline font-bold text-slate-900">${attempt1.evaluation.totalScore}</strong>
              <span class="text-xs text-slate-500">${attempt1.evaluation.fillerCount} parazit · ${attempt1.evaluation.wpm} WPM</span>
            </div>
            <div class="p-3 rounded-xl bg-teal-50/70 border border-teal-200/80 stack-sm">
              <span class="text-xs text-teal-700 font-semibold">2-urinish</span>
              <strong class="text-xl font-headline font-bold text-teal-900">${attempt2.evaluation.totalScore}</strong>
              <span class="text-xs text-teal-700">${attempt2.evaluation.fillerCount} parazit · ${attempt2.evaluation.wpm} WPM</span>
            </div>
          </div>
        </div>

        ${fillerDiff > 0 ? `
          <div class="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
            <span class="material-symbols-outlined text-emerald-600 text-[20px]">filter_alt</span>
            <span>Parazit so‘zlar <strong>${fillerDiff} taga kamaydi</strong>! Ajoyib natija.</span>
          </div>
        ` : ''}

        <div class="card soft stack-sm">
          <span class="text-xs text-slate-500 font-medium">Mashq qilingan fokus:</span>
          <strong class="text-sm text-slate-800">${escapeHtml(App.workout.selectedFocus || 'Erkin nutq')}</strong>
        </div>

        <form class="stack-lg" onsubmit="App.completeCurrentDay(event)">
          <fieldset>
            <legend class="font-headline text-sm font-bold mb-2">Natija qanday bo‘ldi?</legend>
            <div class="choice-grid">
              <label class="choice"><input type="radio" name="comparison" value="yaxshilandi" checked> <span>Yaxshilandi</span></label>
              <label class="choice"><input type="radio" name="comparison" value="bir_xil"> <span>Bir xil</span></label>
              <label class="choice"><input type="radio" name="comparison" value="qiyinlashdi"> <span>Qiyinlashdi</span></label>
            </div>
          </fieldset>

          <div class="field">
            <label for="reflection">Bugungi asosiy xulosangiz</label>
            <textarea id="reflection" name="reflection" maxlength="800" placeholder="Masalan: Ikkinchi urinishda pauza qilish orqali parazit so‘zlarni to‘xtatdim…"></textarea>
          </div>

          <button class="button" type="submit">
            <span class="material-symbols-outlined">check</span>
            <span>Mashq siklini saqlash</span>
          </button>
        </form>
      </section>`;
  },

  completed(completion, progress) {
    const activeDay = progress.activeDay;
    const sameDayContinues = !completion.dayFinalized && activeDay?.day === completion.day;
    return `
      <section class="screen">
        <div class="card hero-card stack-lg text-center">
          <div class="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center shadow-sm">
            <span class="material-symbols-outlined text-3xl font-bold">verified</span>
          </div>
          <div class="stack-sm">
            <span class="eyebrow">${completion.day}-kun · ${completion.sessionNumber || 1}-mashq tugadi</span>
            <h1 class="text-4xl font-extrabold text-primary tnum">${completion.dailyLatestScore ?? completion.secondScore}<span class="text-base text-slate-400 font-normal">/100</span></h1>
            <p class="text-sm font-semibold text-emerald-600">
              O‘sish: ${(completion.dailyGrowth ?? completion.improvement) >= 0 ? '+' : ''}${completion.dailyGrowth ?? completion.improvement} ball
            </p>
          </div>
        </div>

        ${sameDayContinues ? `
          <div class="card stack-sm">
            <div class="flex items-center justify-between">
              <strong class="text-sm">Bugungi kun ochiq</strong>
              <span class="pill primary text-xs">${remainingTimeLabel(activeDay.unlocksAt)}</span>
            </div>
            <p class="muted small leading-relaxed">
              Xohlasangiz shu darsni yana takrorlang. Ballar qo‘shilmaydi — eng oxirgi natija kun bali bo‘lib saqlanadi.
            </p>
            ${activeDay.lastSuggestedFocus ? `
              <div class="p-3 rounded-xl bg-teal-50 text-xs text-teal-900 mt-1">
                <strong>Keyingi fokus:</strong> ${escapeHtml(activeDay.lastSuggestedFocus)}
              </div>
            ` : ''}
          </div>
        ` : completion.programCompleted ? `
          <div class="card stack-sm text-center">
            <h2 class="text-lg font-bold">30 kunlik sayohat yakunlandi!</h2>
            <p class="muted small">1-kun va 30-kun natijalarini natijalar sahifasida solishtiring.</p>
          </div>
        ` : `
          <div class="card stack-sm">
            <span class="eyebrow">Yangi kun ochildi</span>
            <h2 class="text-lg font-bold">${completion.nextDay}-kunga o‘tishingiz mumkin</h2>
            <p class="muted small">Oldingi kun 24 soat va to‘liq mashqdan so‘ng muvaffaqiyatli yakunlandi.</p>
          </div>
        `}

        ${sameDayContinues ? `
          <button class="button secondary" type="button" onclick="App.repeatCurrentDay(${completion.day})">
            <span class="material-symbols-outlined">replay</span>
            <span>Shu kunni yana mashq qilish</span>
          </button>
        ` : ''}

        <button class="button" type="button" onclick="App.navigate('home',{},false)">
          <span>Bosh sahifaga qaytish</span>
        </button>
      </section>`;
  },

  library(user, curriculum) {
    const currentDay = user.progress.currentDay;
    return `
      <section class="screen">
        <div class="stack-sm">
          <span class="eyebrow">Bilimlar va Iboralar Banki</span>
          <h1 class="text-2xl font-bold tracking-tight">30 ta amaliy mikro-dars</h1>
          <p class="muted">Ochilgan darslarni qayta ko‘rib chiqing yoki tezkor audio mashqlarni bajaring.</p>
        </div>

        <!-- Search Bar -->
        <div class="relative">
          <input id="librarySearch" type="text" placeholder="Dars yoki ko‘nikmani qidiring…" oninput="Screens.filterLessons(this.value)">
        </div>

        <!-- Weekly Speech Formula Card -->
        <div class="card hero-card stack-sm">
          <div class="flex items-center justify-between">
            <span class="eyebrow">Haftalik Kontrast Formula</span>
            <span class="pill primary text-xs">Amaliy qolip</span>
          </div>
          <h2 class="text-base font-bold text-slate-900">"Xo‘sh" so‘zi o‘rniga 1.5s ongli sukut</h2>
          <p class="small muted leading-relaxed">
            Fikrlarni ulashda parazit tovush chiqarmang — xotirjam nafas oling va pauza qiling. Bu nutqingizga vazminlik va ishonch bag‘ishlaydi.
          </p>
        </div>

        <!-- 5-min Vocal Gym Card -->
        <div class="card stack-sm">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-bold text-slate-900">5 daqiqalik Vokal Zali (Sur'at mashqi)</h2>
            <span class="material-symbols-outlined text-primary text-[18px]">speed</span>
          </div>
          <div class="grid grid-cols-3 gap-2 pt-1">
            <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <strong class="text-sm font-headline text-slate-800">80 WPM</strong>
              <small class="block text-[11px] text-slate-500">Vazmin</small>
            </div>
            <div class="p-2.5 rounded-xl bg-teal-50 border border-teal-200 text-center">
              <strong class="text-sm font-headline text-teal-800">120 WPM</strong>
              <small class="block text-[11px] text-teal-600">Me'yorda</small>
            </div>
            <div class="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-center">
              <strong class="text-sm font-headline text-amber-800">160 WPM</strong>
              <small class="block text-[11px] text-amber-600">Dinamik</small>
            </div>
          </div>
        </div>

        <!-- Lessons Day List -->
        <div id="lessonLibrary" class="day-list">
          ${curriculum.map(lesson => {
            const unlocked = lesson.day <= currentDay;
            return `
              <button class="day-card library-item ${unlocked ? '' : 'locked'}" type="button" data-search="${escapeHtml(`${lesson.title} ${lesson.skill}`.toLowerCase())}" ${unlocked ? `onclick="App.navigate('lesson',{day:${lesson.day}})"` : 'disabled'}>
                <span class="day-number">${lesson.day}</span>
                <div>
                  <strong>${escapeHtml(lesson.title)}</strong>
                  <small>${unlocked ? escapeHtml(lesson.skill) : 'Hali qulflangan'}</small>
                </div>
                <span class="pill">${unlocked ? '›' : '🔒'}</span>
              </button>`;
          }).join('')}
        </div>
      </section>`;
  },

  filterLessons(query) {
    const normalized = String(query || '').trim().toLowerCase();
    document.querySelectorAll('.library-item').forEach(item => {
      item.hidden = normalized && !item.dataset.search.includes(normalized);
    });
  },

  progress(user, pillars) {
    const progress = user.progress;
    const activeDay = progress.activeDay;
    const skillScores = progress.skillScores || {};
    const snapshots = progress.snapshots || [];

    return `
      <section class="screen">
        <div class="stack-sm">
          <span class="eyebrow">Shaxsiy Natijalar</span>
          <h1>Nutq ko‘nikmalari o‘sishi</h1>
          <p class="muted">Har bir kunlik mashq orqali nutqingiz barqaror rivojlanadi.</p>
        </div>

        <!-- Stat Overview -->
        <div class="stat-grid">
          <div class="stat">
            <strong class="text-slate-900">${progress.completedDays.length}</strong>
            <small>bajarilgan kun</small>
          </div>
          <div class="stat">
            <strong class="text-slate-900">${progress.longestStreak}</strong>
            <small>eng uzun streak</small>
          </div>
          <div class="stat">
            <strong class="text-primary">${progress.latestScore ?? '—'}</strong>
            <small>so‘nggi ball</small>
          </div>
          <div class="stat">
            <strong class="text-slate-900">${progress.baselineScore ?? '—'}</strong>
            <small>1-kun bazasi</small>
          </div>
        </div>

        <!-- Active Day Growth (if ongoing) -->
        ${activeDay && !activeDay.completed ? `
          <div class="card stack-sm">
            <div class="flex items-center justify-between pb-1 border-b border-slate-100">
              <h2 class="text-sm font-bold text-slate-900">${activeDay.day}-kun ichidagi o‘sish</h2>
              <span class="pill primary text-xs">${remainingTimeLabel(activeDay.unlocksAt)}</span>
            </div>
            <div class="grid grid-cols-3 gap-2 pt-1 text-center">
              <div class="p-2 rounded-lg bg-slate-50">
                <span class="text-xs text-slate-500 block">1-urinish</span>
                <strong class="text-base text-slate-800">${activeDay.firstScore ?? '—'}</strong>
              </div>
              <div class="p-2 rounded-lg bg-slate-50">
                <span class="text-xs text-slate-500 block">Oxirgi</span>
                <strong class="text-base text-slate-800">${activeDay.latestScore ?? '—'}</strong>
              </div>
              <div class="p-2 rounded-lg bg-emerald-50">
                <span class="text-xs text-emerald-700 block">O‘sish</span>
                <strong class="text-base text-emerald-800">${activeDay.growth == null ? '—' : `${activeDay.growth > 0 ? '+' : ''}${activeDay.growth}`}</strong>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Milestone Timeline (1, 7, 15, 21, 30 kun) -->
        <div class="card stack-sm">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-bold text-slate-900">Nazorat kunlari</h2>
            <span class="text-xs text-slate-400">Dinamika</span>
          </div>
          ${snapshots.length ? `
            <div class="timeline">
              ${snapshots.map(item => `
                <div class="timeline-column">
                  <strong class="text-xs text-primary">${item.score}</strong>
                  <div class="timeline-bar" style="height:${Math.max(6, item.score)}%"></div>
                  <small class="text-slate-400">${item.day}-kun</small>
                </div>
              `).join('')}
            </div>
          ` : '<p class="muted small py-4 text-center">1-kun to‘liq yakunlangach birinchi nazorat grafigi ko‘rinadi.</p>'}
        </div>

        <!-- 5 Speech Pillars Balance -->
        <div class="card stack">
          <div class="flex items-center justify-between pb-1 border-b border-slate-100">
            <h2 class="text-sm font-bold text-slate-900">Besh asosiy yo‘nalish</h2>
            <span class="text-xs text-slate-400">20 ballik tizim</span>
          </div>
          <div class="bar-chart">
            ${pillars.map(pillar => {
              const score = skillScores[pillar.id];
              return `
                <div class="bar-item">
                  <span class="text-xs font-semibold text-slate-700">${escapeHtml(pillar.title)}</span>
                  <div class="score-bar">
                    <span style="width:${score == null ? 0 : score * 5}%"></span>
                  </div>
                  <strong class="text-xs text-right text-slate-900">${score == null ? '—' : `${score}/20`}</strong>
                </div>`;
            }).join('')}
          </div>
        </div>

        <!-- Recent Sessions History -->
        <div class="card stack-sm">
          <h2 class="text-sm font-bold text-slate-900 pb-1 border-b border-slate-100">So‘nggi mashqlar</h2>
          ${user.completions.length ? user.completions.slice(-5).reverse().map(item => `
            <div class="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0 text-xs">
              <span class="font-medium text-slate-800">${item.day}-kun mashqi</span>
              <strong class="text-slate-900">${item.dailyLatestScore ?? item.secondScore}/100 <span class="font-normal text-emerald-600">(${(item.dailyGrowth ?? item.improvement) >= 0 ? '+' : ''}${item.dailyGrowth ?? item.improvement})</span></strong>
            </div>
          `).join('') : '<p class="muted small text-center py-2">Hali yakunlangan mashqlar mavjud emas.</p>'}
        </div>
      </section>`;
  },

  profile(user, devMode, capabilities) {
    return `
      <section class="screen">
        ${devMode ? this.devSwitch(user.id) : ''}

        <!-- User Profile Card -->
        <div class="card hero-card stack-sm">
          <div class="flex items-center gap-3">
            <span class="w-12 h-12 rounded-2xl bg-primary-soft text-primary-dark font-headline text-xl font-bold flex items-center justify-center">
              ${escapeHtml(user.profile.firstName[0] || 'N')}
            </span>
            <div>
              <h1 class="text-xl font-bold text-slate-900">${escapeHtml(user.profile.firstName)}</h1>
              <p class="text-xs text-slate-500">${user.profile.username ? `@${escapeHtml(user.profile.username)}` : `ID: ${escapeHtml(user.id)}`}</p>
            </div>
          </div>
          <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold w-fit mt-1">
            <span class="material-symbols-outlined text-[15px] text-primary">verified</span>
            <span>Faol Notiq • 30 kunlik dasturda</span>
          </div>
        </div>

        <!-- Practice Settings -->
        <div class="card stack-sm">
          <h2 class="text-sm font-bold text-slate-900 pb-1 border-b border-slate-100">Mashq sozlamalari</h2>
          <div class="flex items-center justify-between text-xs py-1">
            <span class="text-slate-500">Maqsad</span>
            <strong class="text-slate-800">${escapeHtml(user.onboarding.goal || 'Ravon gapirish')}</strong>
          </div>
          <div class="flex items-center justify-between text-xs py-1">
            <span class="text-slate-500">Daraja</span>
            <strong class="text-slate-800">${escapeHtml(user.onboarding.level || 'Boshlang‘ich')}</strong>
          </div>
          <div class="flex items-center justify-between text-xs py-1">
            <span class="text-slate-500">Kunlik reja</span>
            <strong class="text-slate-800">${user.onboarding.dailyMinutes || 15} daqiqa</strong>
          </div>
        </div>

        <!-- AI & Privacy -->
        <div class="card stack-sm">
          <h2 class="text-sm font-bold text-slate-900 pb-1 border-b border-slate-100">AI va Maxfiylik</h2>
          <p class="text-[12px] text-slate-500 leading-snug">
            Audio fayllaringiz faqat qurilmangizda saqlanadi. Tahlil vaqtida Gemini API faqat audio signalni tahlil qilib xulosa beradi.
          </p>
          <div class="flex items-center justify-between text-xs pt-1">
            <span class="text-slate-600">Nutq tahlili (Gemini)</span>
            <span class="pill ${capabilities?.analysisAvailable ? 'success' : ''}">${capabilities?.analysisAvailable ? 'Faol' : 'Tekshirish'}</span>
          </div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-600">Jonli transkripsiya</span>
            <span class="pill ${capabilities?.liveTranscriptionAvailable ? 'success' : ''}">${capabilities?.liveTranscriptionAvailable ? 'Faol' : 'Nofaol'}</span>
          </div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-600">Audio dars TTS</span>
            <span class="pill ${capabilities?.ttsAvailable ? 'success' : ''}">${capabilities?.ttsAvailable ? 'Faol' : 'Nofaol'}</span>
          </div>
        </div>

        <!-- Reset Danger Zone -->
        <div class="card warning stack-sm">
          <h2 class="text-sm font-bold text-amber-900">Progressni qayta boshlash</h2>
          <p class="text-[12px] text-slate-600 leading-snug">
            Faqat shu profilning progressi, tahlil xulosalari va qurilmada saqlangan audiolari o‘chiriladi.
          </p>
          <button class="button danger compact mt-1" type="button" onclick="App.confirmReset()">
            <span>Progressni tozalash</span>
          </button>
        </div>
      </section>`;
  },

  error(title, message, action = "App.init()") {
    return `
      <section class="screen">
        <div class="card warning stack-sm text-center py-6">
          <span class="material-symbols-outlined text-rose-500 text-4xl mx-auto">error</span>
          <h1 class="text-lg font-bold">${escapeHtml(title)}</h1>
          <p class="small muted">${escapeHtml(message)}</p>
          <button class="button compact mt-2 mx-auto" type="button" onclick="${action}">
            <span>Qayta urinish</span>
          </button>
        </div>
      </section>`;
  }
};

window.Screens = Screens;
