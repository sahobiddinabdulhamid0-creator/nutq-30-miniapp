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

function drillReviewState(drillId, sessions = []) {
  const history = sessions.filter(item => item.drillId === drillId);
  if (!history.length) return { count: 0, due: true, label: 'Yangi' };
  // Extra practice before a review is due does not advance the spacing schedule.
  const qualifying = [];
  for (const item of history) {
    const time = new Date(item.completedAt).getTime();
    if (!Number.isFinite(time)) continue;
    const previous = qualifying[qualifying.length - 1];
    const gap = previous ? [1, 3, 7][Math.min(qualifying.length - 1, 2)] * 86400000 : 0;
    if (!previous || time >= new Date(previous.completedAt).getTime() + gap) qualifying.push(item);
  }
  if (!qualifying.length) return { count: history.length, due: true, label: 'Takrorlash' };
  const latest = qualifying[qualifying.length - 1];
  const gapDays = [1, 3, 7][Math.min(qualifying.length - 1, 2)];
  const dueAt = new Date(latest.completedAt).getTime() + gapDays * 86400000;
  if (!Number.isFinite(dueAt)) return { count: history.length, due: true, label: 'Takrorlash' };
  const due = Date.now() >= dueAt;
  return { count: history.length, due, label: due ? 'Takrorlash vaqti' : `${new Date(dueAt).toLocaleDateString('uz-UZ')} da` };
}

const Screens = {
  /* ------------------------------------------------------------------------ */
  /* ONBOARDING SCREEN                                                        */
  /* ------------------------------------------------------------------------ */
  onboarding(user, devMode) {
    const firstName = escapeHtml(user.profile.firstName);
    return `
      <section class="screen">
        ${devMode ? this.devSwitch(user.id) : ''}
        
        <div class="glass-card-elevated stack-lg">
          <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full glass-emerald-pill text-xs font-bold uppercase tracking-wider w-fit">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 live-pulse"></span>
            <span>Xush kelibsiz, ${firstName}</span>
          </div>
          <div class="stack-sm">
            <h1 class="font-headline text-2xl font-bold tracking-tight text-slate-900">30 kun nutqingizni mashq qiling va o‘zgarishni tekshiring</h1>
            <p class="muted leading-relaxed">Har kuni 1 ta mikro-dars, 2 ta audio urinish va dalilli AI tahlili.</p>
          </div>
        </div>

        <form class="stack-lg" onsubmit="App.submitOnboarding(event)">
          <fieldset>
            <legend class="font-headline text-sm font-bold text-slate-900 mb-2.5">Asosiy maqsadingiz</legend>
            <div class="choice-grid">
              ${[
                ['ravonlik', 'Ravon gapirish', 'graphic_eq'],
                ['parazit', 'Parazit so‘z nazorati', 'filter_alt'],
                ['ishonch', 'Ishonchli va vazmin', 'bolt'],
                ['intervyu', 'Intervyu va muzokara', 'work'],
                ['talaffuz', 'Talaffuz va diksiya', 'record_voice_over'],
                ['tuzilma', 'Fikrni aniq tartiblash', 'account_tree']
              ].map(([value, label, icon], index) => `
                <label class="choice ${index === 0 ? 'border-primary/40' : ''}">
                  <input type="radio" name="goal" value="${value}" ${index === 0 ? 'checked' : ''}>
                  <span class="material-symbols-outlined text-primary text-[19px]">${icon}</span>
                  <span>${label}</span>
                </label>
              `).join('')}
            </div>
          </fieldset>

          <fieldset>
            <legend class="font-headline text-sm font-bold text-slate-900 mb-2.5">Hozirgi darajangiz</legend>
            <div class="choice-grid">
              <label class="choice"><input type="radio" name="level" value="boshlangich" checked> <span>Boshlang‘ich</span></label>
              <label class="choice"><input type="radio" name="level" value="orta"> <span>O‘rta daraja</span></label>
              <label class="choice"><input type="radio" name="level" value="yuqori"> <span>Yuqori daraja</span></label>
            </div>
          </fieldset>

          <div class="field">
            <label for="dailyMinutes" class="font-headline text-sm font-bold text-slate-900">Kunlik mashq vaqti</label>
            <select id="dailyMinutes" name="dailyMinutes">
              <option value="10">10 daqiqa (tezkor mashq)</option>
              <option value="15" selected>15 daqiqa (tavsiya etiladi)</option>
              <option value="20">20 daqiqa (chuqur mashq)</option>
            </select>
          </div>

          <button class="button cta-3d-tactile" type="submit">
            <span>1-kunni boshlash</span>
            <span class="material-symbols-outlined text-[20px]">arrow_forward</span>
          </button>
        </form>
      </section>`;
  },

  /* ------------------------------------------------------------------------ */
  /* DEV PROFILE SWITCHER                                                     */
  /* ------------------------------------------------------------------------ */
  devSwitch(activeId) {
    return `
      <div class="dev-switch" aria-label="Lokal test profili">
        <button class="${activeId === 'dev-user-1' ? 'active' : ''}" type="button" onclick="App.switchDevUser('dev-user-1')">1-profil (Jasur)</button>
        <button class="${activeId === 'dev-user-2' ? 'active' : ''}" type="button" onclick="App.switchDevUser('dev-user-2')">2-profil (Madina)</button>
      </div>`;
  },

  /* ------------------------------------------------------------------------ */
  /* HOME SCREEN (Matches Stitch home_glass.png & home_glass.html)            */
  /* ------------------------------------------------------------------------ */
  home(user, curriculum, capabilities, devMode) {
    const progress = user.progress;
    const day = Math.min(progress.currentDay, 30);
    const lesson = curriculum.find(item => item.day === day) || curriculum[0];
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
    const modelLabel = capabilities?.analysisAvailable ? 'Audio tahlil tayyor' : 'Audio tahlil mavjud emas';
    const growth = activeDay?.growth;
    const streak = progress.streakDays || 0;
    const nextMilestone = [7, 15, 21, 30].find(value => value > completed);
    const activeCycle = activeDay?.activeCycle;
    const latestCompletion = [...user.completions].reverse().find(item => item.day === day);
    const firstAttemptId = activeCycle?.firstAttemptId || latestCompletion?.attempt1Id;
    const secondAttemptId = activeCycle ? activeCycle.secondAttemptId : latestCompletion?.attempt2Id;
    const homeAttempt1 = user.attempts.find(item => item.id === firstAttemptId);
    const homeAttempt2 = user.attempts.find(item => item.id === secondAttemptId);

    return `
      <section class="screen pb-4">
        ${devMode ? this.devSwitch(user.id) : ''}

        <!-- 1. Profile Greeting & 3D Glass Streak Capsule -->
        <section class="flex items-center justify-between pt-1">
          <div class="flex items-center space-x-3">
            <div class="relative w-12 h-12 rounded-full p-[2px] bg-gradient-to-tr from-primary-container via-teal-300 to-amber-400 shadow-sm shrink-0">
              <div class="w-full h-full rounded-full bg-white flex items-center justify-center font-headline font-extrabold text-primary text-lg">
                ${escapeHtml(user.profile.firstName[0] || 'N')}
              </div>
              <span class="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full"></span>
            </div>
            <div>
              <h1 class="font-headline text-[22px] font-extrabold text-slate-900 tracking-tight leading-tight">Salom, ${escapeHtml(user.profile.firstName)}!</h1>
              <p class="text-[12.5px] text-slate-500 font-medium">Bugungi odatiy mashg‘ulot</p>
            </div>
          </div>
          
          <!-- 3D Glass Streak Badge -->
          <div class="glass-pill px-3 py-1.5 rounded-full flex items-center space-x-1.5 border border-white/80 shadow-sm active:scale-95 transition-transform cursor-pointer" onclick="App.navigate('progress')">
            <span class="text-base select-none">🔥</span>
            <span class="text-[12px] font-bold text-amber-700 font-headline">${streak} kun</span>
          </div>
        </section>

        <!-- 2. Glass Progress Capsule -->
        <section class="glass-surface rounded-2xl p-3.5">
          <div class="flex justify-between items-center mb-2">
            <div class="flex items-center space-x-2">
              <span class="w-2 h-2 rounded-full bg-primary-container animate-pulse"></span>
              <span class="text-[12.5px] font-bold text-primary-container font-headline">${completed} / 30 kun</span>
            </div>
            <span class="text-[11.5px] text-slate-500 font-medium">${percent}% yakunlandi</span>
          </div>
          <!-- Animated glowing bar track -->
          <div class="relative w-full h-2.5 bg-slate-200/60 rounded-full overflow-hidden p-[1px]">
            <div class="h-full rounded-full bg-gradient-to-r from-primary via-teal-500 to-teal-300 relative shadow-[0_0_12px_rgba(15,118,110,0.5)] transition-all duration-500" style="width: ${percent}%">
              <div class="absolute right-0 top-0 bottom-0 w-2 bg-white rounded-full opacity-90 blur-[1px]"></div>
            </div>
          </div>
          <div class="mt-2.5 flex items-center justify-between text-slate-500 text-[11.5px]">
            <div class="flex items-center space-x-1">
              <span class="material-symbols-outlined text-[14px] text-primary">flag</span>
              <span>${nextMilestone ? `Keyingi marra: ${nextMilestone}-kun` : '30 kun yakunlandi'}</span>
            </div>
            <span class="font-semibold text-primary">${nextMilestone ? `${nextMilestone - completed} kun` : 'Tayyor'}</span>
          </div>
        </section>

        <!-- 3. 3D Hero Focal Card ("Bugungi Fokus • ${day}-KUN") -->
        <section class="glass-card-elevated rounded-[26px] p-5 relative overflow-hidden">
          <div class="absolute -top-12 -right-12 w-36 h-36 bg-teal-300/25 rounded-full blur-2xl pointer-events-none"></div>
          
          <div class="flex items-center justify-between mb-3">
            <div class="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-primary-soft border border-primary/20">
              <span class="w-1.5 h-1.5 rounded-full bg-primary-container"></span>
              <span class="text-[11px] font-bold text-primary-container uppercase tracking-wider">${day}-KUN • MIKRO-DARS</span>
            </div>
            <span class="text-[11.5px] text-slate-500 font-semibold">${escapeHtml(lesson.stageName || 'Asosiy')}</span>
          </div>

          <h2 class="font-headline text-[21px] font-bold text-slate-900 leading-snug">
            ${escapeHtml(lesson.title)}
          </h2>
          <p class="mt-1.5 text-[13px] text-slate-600 leading-relaxed">
            ${escapeHtml(lesson.skill)}
          </p>

          <!-- Today's speaking cues -->
          <div class="mt-4 py-2 px-2.5 rounded-xl bg-slate-100/70 border border-white/80 flex items-center justify-between gap-1 shadow-inner">
            ${lesson.keywords.map((word, index) => `
              <div class="flex-1 text-center py-1.5 px-1 rounded-lg bg-white/90 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <span class="text-[10px] uppercase font-bold text-primary-container block">${index + 1}-tayanch</span>
                <span class="text-[11px] text-slate-800 font-medium truncate block">${escapeHtml(word)}</span>
              </div>`).join('')}
          </div>

          <!-- Meta indicators -->
          <div class="mt-3.5 flex items-center space-x-3 text-slate-500 text-[12px]">
            <div class="flex items-center space-x-1">
              <span class="material-symbols-outlined text-[15px] text-slate-400">timer</span>
              <span>${lesson.durationMinutes || 10} daqiqa dars</span>
            </div>
            <span class="text-slate-300">•</span>
            <div class="flex items-center space-x-1">
              <span class="material-symbols-outlined text-[15px] text-slate-400">mic</span>
              <span>2 ta audio urinish</span>
            </div>
          </div>

          <!-- Flagship 54px 3D Tactile CTA Button -->
          <button class="mt-4 w-full h-[54px] button cta-3d-tactile rounded-2xl flex items-center justify-between px-5 text-white active:scale-[0.98] transition-all group" type="button" onclick="${ctaAction}">
            <div class="flex items-center space-x-3">
              <div class="w-9 h-9 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
                <span class="material-symbols-outlined text-[20px] text-white material-symbols-fill">mic</span>
              </div>
              <span class="font-headline text-[15.5px] font-bold tracking-tight">${cta}</span>
            </div>
            <span class="material-symbols-outlined text-[21px] text-white/90 group-hover:translate-x-1 transition-transform">chevron_right</span>
          </button>
        </section>

        <!-- 4. Actual audio attempts for the current or most recent cycle -->
        <section class="mt-1 stack-sm">
          <h3 class="font-headline text-[14.5px] font-bold text-slate-800">Bugungi audio urinishlar</h3>
          <div class="grid grid-cols-2 gap-3">
            ${[homeAttempt1, homeAttempt2].map((attempt, index) => `
              <div class="glass-surface stack-sm">
                <strong>${index + 1}-urinish</strong>
                <span class="glass-pill ${attempt ? 'primary' : ''}">${attempt ? `${attempt.evaluation.totalScore}/100` : 'Yozilmagan'}</span>
                <small class="muted">${attempt ? `${attempt.durationSeconds} soniya · ${attempt.evaluation.fillerCount ?? '—'} parazit` : index === 1 && homeAttempt1 ? 'Fokus tanlang va qayta yozing' : 'Bugungi darsda yoziladi'}</small>
              </div>`).join('')}
          </div>
          ${homeAttempt1 && homeAttempt2 ? `<p class="muted small">Ikki urinish farqi: ${homeAttempt2.evaluation.totalScore - homeAttempt1.evaluation.totalScore > 0 ? '+' : ''}${homeAttempt2.evaluation.totalScore - homeAttempt1.evaluation.totalScore} ball. Bu bir mashq ichidagi o‘zgarish.</p>` : ''}
        </section>

        <!-- 5. Quick Voice Warm-Up Glass Widget (Tez aytish • Diksiya) -->
        <section class="mt-1">
          <div class="glass-surface rounded-2xl p-3.5 flex items-center justify-between border border-white/80 shadow-sm cursor-pointer active:scale-[0.99] transition-transform" onclick="App.navigate('library')">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 rounded-xl bg-amber-100/80 text-amber-800 flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-[20px]">graphic_eq</span>
              </div>
              <div>
                <span class="text-[10px] uppercase font-bold text-amber-800 tracking-wider block">Mustaqil mashqlar</span>
                <p class="text-[12.5px] text-slate-800 font-semibold line-clamp-1">
                  Bugun bitta ko‘nikmani 3–5 daqiqada sinang
                </p>
              </div>
            </div>
            <span class="text-[11.5px] font-bold text-primary flex items-center shrink-0 pl-2">
              Mashq ➔
            </span>
          </div>
        </section>

        <!-- 6. Status Footer -->
        <div class="flex items-center justify-between px-2 pt-1 text-[11.5px] text-slate-400">
          <span class="flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full ${capabilities?.configured ? 'bg-emerald-500' : 'bg-amber-400'}"></span>
            <span>${modelLabel}</span>
          </span>
          <span>Nutq 30 v2.5</span>
        </div>
      </section>`;
  },

  /* ------------------------------------------------------------------------ */
  /* ROADMAP / MAP SCREEN                                                     */
  /* ------------------------------------------------------------------------ */
  map(user, curriculum, stages) {
    const completedDays = user.progress.completedDays.length;
    return `
      <section class="screen">
        <div class="stack-sm">
          <span class="eyebrow">Yo‘l xaritasi</span>
          <h1 class="text-2xl font-bold tracking-tight text-slate-900">30 kunlik nutq sayohati</h1>
          <p class="muted">5 bosqich, 30 amaliy qadam. Har bir dars yangi nutqiy ko‘nikma beradi.</p>
        </div>

        <!-- Milestone Badges in Glass -->
        <div class="grid grid-cols-3 gap-2">
          <div class="glass-surface p-3 rounded-2xl text-center stack-sm">
            <span class="text-2xl">🥉</span>
            <strong class="text-xs font-headline text-slate-900">15-kun</strong>
            <span class="text-[10.5px] text-slate-500">${completedDays >= 15 ? '✓ Erishildi' : 'O‘rta marra'}</span>
          </div>
          <div class="glass-surface p-3 rounded-2xl text-center stack-sm">
            <span class="text-2xl">🥈</span>
            <strong class="text-xs font-headline text-slate-900">21-kun</strong>
            <span class="text-[10.5px] text-slate-500">${completedDays >= 21 ? '✓ Erishildi' : 'Odat shakllandi'}</span>
          </div>
          <div class="glass-surface p-3 rounded-2xl text-center stack-sm">
            <span class="text-2xl">🏆</span>
            <strong class="text-xs font-headline text-slate-900">30-kun</strong>
            <span class="text-[10.5px] text-slate-500">${completedDays >= 30 ? '✓ Erishildi' : 'Notiq diplomi'}</span>
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
              <span class="glass-pill primary text-xs">${stage.from}–${stage.to}-kun</span>
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
        <span class="glass-pill ${current ? 'primary' : ''}">
          ${complete ? 'Tugallandi' : current ? 'Bugun' : unlocked ? 'Ochiq' : '🔒'}
        </span>
      </button>`;
  },

  /* ------------------------------------------------------------------------ */
  /* LESSON SCREEN                                                            */
  /* ------------------------------------------------------------------------ */
  lesson(lesson, canPractice = false) {
    return `
      <section class="screen">
        <div class="flex items-center justify-between wrap gap-2">
          <span class="glass-pill primary">${lesson.day}-kun · ${escapeHtml(lesson.stageName)}</span>
          <span class="glass-pill"><span class="material-symbols-outlined text-[14px]">timer</span> ${lesson.durationMinutes} daqiqa</span>
        </div>

        <div class="stack-sm">
          <h1 class="text-2xl font-bold tracking-tight text-slate-900">${escapeHtml(lesson.title)}</h1>
          <p class="muted leading-relaxed">${escapeHtml(lesson.skill)}</p>
        </div>

        <!-- Audio TTS dars mini-player -->
        <button id="ttsButton" class="button secondary flex items-center justify-center gap-2" type="button" onclick="App.playLessonAudio(${lesson.day})">
          <span class="material-symbols-outlined text-[20px] text-primary material-symbols-fill">play_arrow</span>
          <span>Audio darsni tinglash</span>
        </button>
        <audio id="lessonAudio" class="hidden w-full mt-2" controls></audio>

        <!-- 3 Step Micro-Lesson Structure -->
        <article class="glass-surface lesson-card">
          <div class="flex items-center gap-2 text-primary font-headline font-bold">
            <span class="lesson-icon">1</span>
            <h2>Nima bu?</h2>
          </div>
          <p class="leading-relaxed text-slate-700 text-sm">${escapeHtml(lesson.what)}</p>
        </article>

        <article class="glass-surface lesson-card">
          <div class="flex items-center gap-2 text-primary font-headline font-bold">
            <span class="lesson-icon">2</span>
            <h2>Nega kerak?</h2>
          </div>
          <p class="leading-relaxed text-slate-700 text-sm">${escapeHtml(lesson.why)}</p>
        </article>

        <article class="glass-surface lesson-card">
          <div class="flex items-center gap-2 text-primary font-headline font-bold">
            <span class="lesson-icon">3</span>
            <h2>Qanday bajariladi?</h2>
          </div>
          <ol class="numbered-list">
            ${lesson.how.map((step, index) => `
              <li>
                <span>${index + 1}</span>
                <p class="text-slate-700 text-sm leading-snug">${escapeHtml(step)}</p>
              </li>
            `).join('')}
          </ol>
        </article>

        <!-- Examples in Glass -->
        <article class="glass-surface lesson-card border-l-4 border-l-emerald-500">
          <div class="flex items-center gap-2 text-emerald-800 font-headline font-bold">
            <span class="material-symbols-outlined text-emerald-600">check_circle</span>
            <h2>Yaxshi misol</h2>
          </div>
          <p class="quote text-slate-800 text-sm">${escapeHtml(lesson.goodExample)}</p>
        </article>

        <article class="glass-surface lesson-card border-l-4 border-l-amber-500 bg-amber-50/40">
          <div class="flex items-center gap-2 text-amber-900 font-headline font-bold">
            <span class="material-symbols-outlined text-amber-600">error</span>
            <h2>Ko‘p uchraydigan xato</h2>
          </div>
          <p class="text-slate-700 text-sm">${escapeHtml(lesson.badExample)}</p>
        </article>

        <article class="glass-surface lesson-card">
          <div class="flex items-center gap-2 text-slate-800 font-headline font-bold">
            <span class="material-symbols-outlined text-primary">task_alt</span>
            <h3>Bugungi tekshiruv</h3>
          </div>
          <p class="small muted">${escapeHtml(lesson.check)}</p>
        </article>

        <!-- Bottom Action CTA -->
        ${canPractice
          ? `<button class="button cta-3d-tactile" type="button" onclick="App.navigate('prepare',{day:${lesson.day}})">
               <span>Tayyorgarlikka o‘tish</span>
               <span class="material-symbols-outlined">arrow_forward</span>
             </button>`
          : '<button class="button" type="button" disabled>Bu dars hozir faqat o‘qish uchun ochiq</button>'}
      </section>`;
  },

  /* ------------------------------------------------------------------------ */
  /* PREPARE SCREEN                                                           */
  /* ------------------------------------------------------------------------ */
  prepare(lesson, attemptNumber = 1, selectedFocus = '') {
    return `
      <section class="screen">
        <div class="stack-sm">
          <span class="eyebrow">${lesson.day}-kun · ${attemptNumber}-urinish</span>
          <h1 class="text-2xl font-bold tracking-tight text-slate-900">Gapirishga tayyorlaning</h1>
          <p class="muted">Matn yozmang va o‘qimang. Faqat tayanch so‘zlarga qarab erkin gapiring.</p>
        </div>

        ${selectedFocus ? `
          <div class="glass-card-elevated stack-sm bg-gradient-to-r from-teal-500/10 to-emerald-500/10 border-teal-300">
            <span class="eyebrow text-teal-800">Bugungi bitta fokus</span>
            <strong class="text-base text-teal-950 font-headline">${escapeHtml(selectedFocus)}</strong>
          </div>
        ` : ''}

        <!-- 60s Warmup -->
        <div class="glass-surface stack-sm">
          <div class="flex items-center justify-between">
            <span class="eyebrow">60 soniyalik qizish</span>
            <span class="material-symbols-outlined text-primary">self_improvement</span>
          </div>
          <h2 class="text-base font-bold text-slate-900">${escapeHtml(lesson.warmup)}</h2>
          <div class="flex items-center justify-between pt-2">
            <button id="warmupButton" class="button secondary compact" type="button" onclick="App.startWarmup()">
              <span class="material-symbols-outlined text-[18px]">play_arrow</span>
              <span>Taymerni boshlash</span>
            </button>
            <strong id="warmupTimer" class="font-headline text-2xl font-bold text-primary tnum">01:00</strong>
          </div>
        </div>

        <!-- Topic & Prompt -->
        <div class="glass-surface stack">
          <div class="flex items-center justify-between">
            <span class="eyebrow">Nutq mavzusi</span>
            <span class="glass-pill"><span class="material-symbols-outlined text-[13px]">timer</span> ${lesson.recommendedSeconds}s</span>
          </div>
          <h2 class="text-lg font-bold text-slate-900 leading-snug">${escapeHtml(lesson.prompt)}</h2>
          <div class="flex items-center gap-1.5 wrap pt-1">
            ${lesson.keywords.map(word => `<span class="glass-pill primary">${escapeHtml(word)}</span>`).join('')}
          </div>
        </div>

        <!-- Privacy note in glass -->
        <div class="p-3 rounded-2xl glass-card-subtle text-xs text-slate-600 flex items-start gap-2">
          <span class="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5">lock</span>
          <p>Yozuv xavfsiz audio formatda saqlanadi. Gemini API faqat nutq maromi va sifatini dalilli baholaydi.</p>
        </div>

        <!-- Primary 54px 3D CTA -->
        <button class="button cta-3d-tactile" type="button" onclick="App.openRecorder(${lesson.day},${attemptNumber})">
          <span class="material-symbols-outlined text-[20px] text-white material-symbols-fill">mic</span>
          <span>Mikrofonni ochish</span>
        </button>
      </section>`;
  },

  /* ------------------------------------------------------------------------ */
  /* RECORD SCREEN (Matches Stitch studio_glass.png & studio_glass.html)       */
  /* ------------------------------------------------------------------------ */
  record(lesson, attemptNumber, selectedFocus = '', liveAvailable = false) {
    const maxTime = Math.max(lesson.recommendedSeconds + 30, Math.round(lesson.recommendedSeconds * 1.35));
    return `
      <section class="record-shell">
        <!-- Top Studio Header -->
        <header class="flex items-center justify-between pt-1">
          <button class="w-10 h-10 rounded-full glass-studio-card flex items-center justify-center text-slate-300 hover:text-white active:scale-95 transition-all" type="button" onclick="App.cancelRecording()" aria-label="Yopish">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>

          <!-- Center Status Pill -->
          <div class="glass-pill px-3.5 py-1.5 rounded-full flex items-center gap-2 border border-white/20 bg-slate-900/60 text-white">
            <span class="relative flex h-2 w-2">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
            <span class="text-[12px] font-semibold tracking-wide font-headline">${lesson.day}-KUN • JONLI YOZUV</span>
          </div>

          <button class="w-10 h-10 rounded-full glass-studio-card flex items-center justify-center text-slate-300 active:scale-95 transition-all" type="button" aria-label="Audio">
            <span class="material-symbols-outlined text-[19px]">mic</span>
          </button>
        </header>

        <!-- Digital Timer & Pacing Metric -->
        <section class="flex flex-col items-center text-center mt-1">
          <div class="flex items-baseline justify-center gap-1.5">
            <span id="recordTimer" class="font-headline font-extrabold text-[44px] leading-tight text-white tracking-tight drop-shadow-[0_4px_18px_rgba(45,212,191,0.35)] tnum">
              00:00
            </span>
            <span class="font-headline font-medium text-[20px] text-teal-300/60 tnum">
              / ~${lesson.recommendedSeconds}s
            </span>
          </div>

          <!-- Pacing reminder; actual rate is measured after analysis -->
          <div class="glass-pill px-3 py-1 rounded-full flex items-center gap-2 border border-emerald-400/30 bg-emerald-950/40 mt-1">
            <span class="material-symbols-outlined text-emerald-300 text-[16px]">speed</span>
            <span class="text-[11.5px] font-semibold text-emerald-200">
              Marom: <span class="text-white font-bold">shoshilmasdan, ravshan gapiring</span>
            </span>
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"></span>
          </div>
        </section>

        <!-- 3D Liquid Soundwave Glass Card -->
        <section class="glass-studio-card rounded-[28px] p-4 relative overflow-hidden">
          <div class="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>

          <div class="flex items-center justify-between text-[11px] font-medium text-slate-300 mb-3 px-1 w-full">
            <div class="flex items-center gap-1.5 text-teal-300">
              <span class="material-symbols-outlined text-[14px]">graphic_eq</span>
              <span>Ovoz quvvati: <strong class="text-white font-semibold">-12 dB</strong></span>
            </div>
            <div class="glass-pill px-2.5 py-0.5 rounded-full text-[10.5px] text-slate-200 border-white/15 bg-white/5">
              48 kHz • Shovqinsiz
            </div>
          </div>

          <!-- 28 Dynamic Amplitude Bars -->
          <div id="waveform" class="waveform" aria-label="Ovoz to‘lqinlari">
            ${Array.from({ length: 28 }, (_, i) => `<i class="wave-bar" style="height:${Math.max(6, (i % 5) * 8 + 8)}px"></i>`).join('')}
          </div>
        </section>

        <!-- Teleprompter Glass Card -->
        <section class="glass-studio-card rounded-[24px] p-4 text-left w-full">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-1.5">
              <span class="material-symbols-outlined text-teal-400 text-[16px]">lightbulb</span>
              <span class="text-[11px] font-bold uppercase tracking-wider text-teal-300">Nutq Rejasi</span>
            </div>
            <span class="text-[10.5px] text-slate-400 font-semibold">${attemptNumber}-urinish</span>
          </div>

          <div class="p-3 rounded-xl bg-teal-950/40 border border-teal-400/50 shadow-sm mb-2">
            <span class="text-[10px] font-bold text-teal-300 uppercase block">1. Niyat (Ayni damda)</span>
            <p class="text-[13px] font-semibold text-white mt-0.5 leading-snug">«${escapeHtml(lesson.prompt)}»</p>
          </div>

          <div class="flex items-center gap-1.5 wrap">
            ${lesson.keywords.map(word => `<span class="px-2 py-0.5 rounded-full bg-white/10 text-[11px] text-slate-200">${escapeHtml(word)}</span>`).join('')}
          </div>

          ${selectedFocus ? `
            <div class="mt-2 text-[11px] text-teal-300">
              <strong>Fokus:</strong> ${escapeHtml(selectedFocus)}
            </div>
          ` : ''}

          ${liveAvailable ? `
            <div class="live-transcript mt-3 text-left">
              <span id="liveStatus">Jonli transkripsiya...</span>
              <p id="liveTranscript"></p>
            </div>
          ` : ''}
        </section>

        <!-- Bottom Recording Controls -->
        <section class="flex flex-col items-center gap-3">
          <div class="flex items-center justify-center gap-6">
            <button class="w-12 h-12 rounded-full glass-studio-card flex items-center justify-center text-slate-300 active:scale-90 transition-transform" type="button" onclick="App.cancelRecording()" title="Bekor qilish">
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>

            <!-- 76px 3D Tactile Glowing Trigger -->
            <button id="recordButton" class="record-button" type="button" onclick="App.toggleRecording(${Math.round(maxTime)})" aria-label="Yozishni boshlash">
              <span class="material-symbols-outlined text-[32px] text-white material-symbols-fill">mic</span>
            </button>

            <button class="w-12 h-12 rounded-full glass-studio-card flex items-center justify-center text-slate-300 active:scale-90 transition-transform" type="button" onclick="App.retryRecording()" title="Qaytadan">
              <span class="material-symbols-outlined text-[20px]">replay</span>
            </button>
          </div>

          <p id="recordHint" class="text-[12px] text-slate-400 font-medium text-center">
            Tugmani bosing va 60 soniya erkin gapiring
          </p>
        </section>
      </section>`;
  },

  /* ------------------------------------------------------------------------ */
  /* REVIEW SCREEN                                                            */
  /* ------------------------------------------------------------------------ */
  review(lesson, attemptNumber, recording) {
    return `
      <section class="screen">
        <div class="stack-sm">
          <span class="eyebrow">${attemptNumber}-urinish yozildi</span>
          <h1 class="text-2xl font-bold tracking-tight text-slate-900">O‘z nutqingizni tinglang</h1>
          <p class="muted">Tahlildan oldin o‘zingizni xolis baholash nutq ko‘nikmasini 2 barobar tezroq o‘stiradi.</p>
        </div>

        <div class="glass-card-elevated stack-sm">
          <audio class="w-full rounded-xl" controls src="${recording.audioUrl}"></audio>
          <div class="flex justify-between items-center text-xs text-slate-500 pt-1">
            <span>Davomiyligi: ${recording.durationSeconds} soniya</span>
            <span class="text-emerald-700 font-semibold">✓ Audio muvaffaqiyatli yozildi</span>
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

          <button class="button cta-3d-tactile" type="submit">
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

  /* ------------------------------------------------------------------------ */
  /* ANALYSIS SCREEN (Matches Stitch eval_glass.png & eval_glass.html)        */
  /* ------------------------------------------------------------------------ */
  analysis(lesson, attempt) {
    if (!attempt?.evaluation) return this.error('Tahlil tayyor emas', 'Avval audio yozib tahlil qiling.', "App.navigate('home')");
    const evaluation = attempt.evaluation;
    const isFirst = attempt.attemptNumber === 1;

    return `
      <section class="screen">
        <!-- Top bar -->
        <div class="flex items-center justify-between pt-1">
          <div>
            <span class="eyebrow">${attempt.attemptNumber}-urinish tahlili</span>
            <h1 class="font-headline text-3xl font-extrabold tracking-tight text-primary tnum">
              ${evaluation.totalScore}<span class="text-lg text-slate-400 font-normal">/100</span>
            </h1>
          </div>
          <span class="glass-pill primary text-xs">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 live-pulse"></span>
            ${attempt.attemptNumber}/2 Urinish
          </span>
        </div>

        <!-- 3 Glass Metric Counter Cards -->
        <section class="grid grid-cols-3 gap-2.5">
          <!-- Metric 1: Parazitlar -->
          <div class="glass-card-subtle rounded-2xl p-3 flex flex-col justify-between">
            <div class="flex items-center justify-between text-slate-500 mb-1">
              <span class="text-[10px] font-bold uppercase tracking-wider font-headline">Parazitlar</span>
              <span class="material-symbols-outlined text-[15px] text-teal-700">filter_alt</span>
            </div>
            <div class="flex items-baseline gap-1 my-0.5">
              <span class="text-[24px] font-black font-headline text-slate-900 leading-none tnum">${evaluation.fillerCount}</span>
              <span class="text-[11px] font-medium text-slate-400">ta</span>
            </div>
            <div class="mt-1">
              <span class="inline-block px-1.5 py-0.5 rounded-md text-[9px] font-bold text-emerald-800 bg-emerald-100/90 border border-emerald-200">
                ${evaluation.fillerCount} ta qayd
              </span>
            </div>
          </div>

          <!-- Metric 2: Uzoq Pauzalar -->
          <div class="glass-card-subtle rounded-2xl p-3 flex flex-col justify-between">
            <div class="flex items-center justify-between text-slate-500 mb-1">
              <span class="text-[10px] font-bold uppercase tracking-wider font-headline">Pauzalar</span>
              <span class="material-symbols-outlined text-[15px] text-amber-600">timer</span>
            </div>
            <div class="flex items-baseline gap-1 my-0.5">
              <span class="text-[24px] font-black font-headline text-slate-900 leading-none tnum">${evaluation.longPauseCount}</span>
              <span class="text-[11px] font-medium text-slate-400">ta</span>
            </div>
            <div class="mt-1">
              <span class="inline-block px-1.5 py-0.5 rounded-md text-[9px] font-bold text-amber-800 bg-amber-100/90 border border-amber-200">
                2s+ pauza
              </span>
            </div>
          </div>

          <!-- Metric 3: Nutq Tempi -->
          <div class="glass-card-subtle rounded-2xl p-3 flex flex-col justify-between">
            <div class="flex items-center justify-between text-slate-500 mb-1">
              <span class="text-[10px] font-bold uppercase tracking-wider font-headline">Nutq Tempi</span>
              <span class="material-symbols-outlined text-[15px] text-teal-700">speed</span>
            </div>
            <div class="flex items-baseline gap-0.5 my-0.5">
              <span class="text-[22px] font-black font-headline text-slate-900 leading-none tnum">${evaluation.wpm}</span>
              <span class="text-[10px] font-medium text-slate-500">s/d</span>
            </div>
            <div class="mt-1">
              <span class="inline-block px-1.5 py-0.5 rounded-md text-[9px] font-bold text-teal-800 bg-teal-100/90 border border-teal-200">
                so‘z/daq
              </span>
            </div>
          </div>
        </section>

        <!-- Transcript Card with Quote styling -->
        <div class="glass-surface stack-sm">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-bold text-slate-900">Nutq matni va dalillar</h2>
            <span class="material-symbols-outlined text-teal-700 text-[18px]">subject</span>
          </div>
          <p class="quote text-sm text-slate-800 leading-relaxed">${escapeHtml(evaluation.transcript)}</p>
        </div>

        <!-- Rubric Scores -->
        <div class="glass-surface stack">
          <div class="flex items-center justify-between pb-2 border-b border-slate-100">
            <h2 class="text-sm font-bold text-slate-900">10 ballik mezonlar bahosi</h2>
            <span class="text-xs text-slate-400">Gemini AI</span>
          </div>
          <div class="score-list">
            ${evaluation.metricScores.map(item => `
              <div class="score-row">
                <div class="row-between text-xs">
                  <strong class="text-slate-800 font-semibold">${escapeHtml(metricName(item.metricId))}</strong>
                  <strong class="text-primary font-bold">${item.score}/10</strong>
                </div>
                <div class="score-bar">
                  <span style="width:${item.score * 10}%"></span>
                </div>
                <p class="text-[11.5px] text-slate-500 leading-tight">${escapeHtml(scoreDescriptor(item.score))}. ${escapeHtml(item.evidence)}</p>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Strengths & Growth Points -->
        <div class="glass-surface stack-sm border-l-4 border-l-emerald-500">
          <h2 class="text-sm font-bold text-emerald-800 flex items-center gap-1.5">
            <span class="material-symbols-outlined text-emerald-600 text-[18px]">verified</span>
            <span>Kuchli tomonlar</span>
          </h2>
          ${evaluation.strengths.map(text => `<p class="text-xs text-slate-700 flex items-start gap-1.5"><span class="text-emerald-600 font-bold">✓</span> <span>${escapeHtml(text)}</span></p>`).join('')}
        </div>

        <div class="glass-surface stack-sm border-l-4 border-l-amber-500 bg-amber-50/30">
          <h2 class="text-sm font-bold text-amber-900 flex items-center gap-1.5">
            <span class="material-symbols-outlined text-amber-600 text-[18px]">lightbulb</span>
            <span>O‘sish nuqtalari</span>
          </h2>
          ${evaluation.improvements.map(text => `<p class="text-xs text-slate-700 flex items-start gap-1.5"><span class="text-amber-600 font-bold">•</span> <span>${escapeHtml(text)}</span></p>`).join('')}
        </div>

        <!-- Suggested Focus Hero Pill -->
        <div class="glass-card-elevated stack-sm bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-transparent border-teal-300">
          <span class="eyebrow text-teal-800">AI tavsiya qilgan bitta fokus</span>
          <strong class="text-[15px] text-teal-950 font-headline leading-snug">${escapeHtml(evaluation.suggestedFocus)}</strong>
        </div>

        <!-- Primary CTA -->
        <button class="button cta-3d-tactile" type="button" onclick="${isFirst ? 'App.openFocusSelection()' : 'App.openComparison()'}">
          <span>${isFirst ? 'Bitta fokus tanlash' : 'Ikki urinishni solishtirish'}</span>
          <span class="material-symbols-outlined">arrow_forward</span>
        </button>
      </section>`;
  },

  /* ------------------------------------------------------------------------ */
  /* FOCUS SELECTION SCREEN                                                   */
  /* ------------------------------------------------------------------------ */
  focus(lesson, attempt) {
    const suggested = attempt.evaluation.suggestedFocus;
    const options = [suggested, ...lesson.focusOptions].filter((item, index, list) => item && list.indexOf(item) === index).slice(0, 6);
    return `
      <section class="screen">
        <div class="stack-sm">
          <span class="eyebrow">2-urinishga tayyorgarlik</span>
          <h1 class="text-2xl font-bold tracking-tight text-slate-900">Faqat bittasini o‘zgartiring</h1>
          <p class="muted">Bir vaqtning o‘zida bitta jihatni o‘zgartirsangiz, ikki urinish farqini aniqroq ko‘rasiz.</p>
        </div>

        <form class="stack-lg" onsubmit="App.startSecondAttempt(event)">
          <fieldset>
            <legend class="font-headline text-sm font-bold text-slate-900 mb-2.5">Fokusni tanlang</legend>
            <div class="stack">
              ${options.map((option, index) => `
                <label class="choice ${index === 0 ? 'border-primary/50 bg-teal-50/40' : ''}">
                  <input type="radio" name="focus" value="${escapeHtml(option)}" ${index === 0 ? 'checked' : ''}>
                  <span>${index === 0 ? '<strong class="text-primary">AI tavsiyasi:</strong> ' : ''}${escapeHtml(option)}</span>
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

          <button class="button cta-3d-tactile" type="submit">
            <span>2-urinishni boshlash</span>
            <span class="material-symbols-outlined">arrow_forward</span>
          </button>
        </form>
      </section>`;
  },

  /* ------------------------------------------------------------------------ */
  /* COMPARE SCREEN (Matches Stitch eval_glass.png dual-attempt view)         */
  /* ------------------------------------------------------------------------ */
  compare(lesson, attempt1, attempt2) {
    if (!attempt1?.evaluation || !attempt2?.evaluation) {
      return this.error('Taqqoslash tayyor emas', 'Avval ikkala audio urinishni tahlil qiling.', "App.navigate('home')");
    }
    const first = attempt1.evaluation;
    const second = attempt2.evaluation;
    const scoreDiff = second.totalScore - first.totalScore;
    const fillerRate = item => item.wordCount > 0 ? Math.round(item.fillerCount / item.wordCount * 100) : null;
    const metricChanges = lesson.activeMetrics.map(metric => {
      const before = (first.metricScores || []).find(item => item.metricId === metric.id);
      const after = (second.metricScores || []).find(item => item.metricId === metric.id);
      return before && after ? { title: metric.title, before: before.score, after: after.score } : null;
    }).filter(Boolean);

    return `
      <section class="screen">
        <div class="stack-sm">
          <span class="eyebrow">${lesson.day}-kun · Ikki urinish</span>
          <h1>Natijani dalil bilan solishtiring</h1>
          <p class="muted">Bu farq bitta mashq ichidagi o‘zgarish. Uzoq muddatli natija uchun nazorat kunlarini ko‘ring.</p>
        </div>

        <div class="glass-card-elevated stack-sm">
          <span class="eyebrow">AI ballari farqi</span>
          <strong class="text-3xl tnum">${scoreDiff > 0 ? '+' : ''}${scoreDiff} ball</strong>
          <p class="muted small">${first.totalScore}/100 → ${second.totalScore}/100. Baholarni audio va transkripsiya bilan tekshiring.</p>
        </div>

        <div class="grid grid-cols-2 gap-3">
          ${[attempt1, attempt2].map((attempt, index) => `
            <div class="glass-surface stack-sm">
              <h2>${index + 1}-urinish</h2>
              <strong class="text-2xl tnum">${attempt.evaluation.totalScore}/100</strong>
              <p class="muted small">${attempt.durationSeconds} soniya · ${attempt.evaluation.fillerCount} parazit</p>
              <button class="button secondary" type="button" data-attempt-id="${escapeHtml(attempt.id)}" onclick="App.playAttemptAudio(this.dataset.attemptId)">Audioni tinglash</button>
            </div>`).join('')}
        </div>
        <audio id="attemptAudio" class="hidden" controls></audio>

        <div class="glass-surface stack-sm">
          <h2>Kuzatilgan ko‘rsatkichlar</h2>
          <div class="checkpoint-row"><strong>Parazitlar / 100 so‘z</strong><span>${fillerRate(first) ?? '—'} → ${fillerRate(second) ?? '—'}</span></div>
          <div class="checkpoint-row"><strong>Ikki soniyadan uzun pauzalar</strong><span>${first.longPauseCount} → ${second.longPauseCount}</span></div>
          <div class="checkpoint-row"><strong>So‘z / daqiqa</strong><span>${first.wpm} → ${second.wpm}. Tezroq gapirish har doim yaxshiroq emas.</span></div>
        </div>

        <div class="glass-surface stack-sm">
          <h2>Bugungi mezonlar</h2>
          ${metricChanges.map(item => `<div class="checkpoint-row"><strong>${escapeHtml(item.title)}</strong><span>${item.before}/10 → ${item.after}/10</span></div>`).join('')}
          <p class="muted small">AI bahosi subyektiv bo‘lishi mumkin. O‘zgargan mezon dalilini ikki tahlil matnida qayta ko‘ring.</p>
        </div>

        <div class="glass-surface stack-sm">
          <h2>Tanlangan fokus</h2>
          <p>${escapeHtml(App.workout.selectedFocus || attempt2.selectedFocus || 'Fokus saqlanmagan')}</p>
        </div>

        <form class="stack-lg" onsubmit="App.completeCurrentDay(event)">
          <fieldset>
            <legend class="font-headline text-sm font-bold text-slate-900 mb-2">O‘zingiz qanday eshitdingiz?</legend>
            <div class="choice-grid">
              <label class="choice"><input type="radio" name="comparison" value="yaxshilandi" required> <span>Yaxshilandi</span></label>
              <label class="choice"><input type="radio" name="comparison" value="bir_xil"> <span>Bir xil</span></label>
              <label class="choice"><input type="radio" name="comparison" value="qiyinlashdi"> <span>Qiyinlashdi</span></label>
            </div>
          </fieldset>
          <div class="field"><label for="reflection">Bugungi asosiy xulosangiz</label><textarea id="reflection" name="reflection" maxlength="800" placeholder="Aniq eshitilgan farqni yozing"></textarea></div>
          <button class="button cta-3d-tactile" type="submit">Mashq siklini saqlash</button>
        </form>
      </section>`;
  },

  /* ------------------------------------------------------------------------ */
  /* ------------------------------------------------------------------------ */
  /* COMPLETED SCREEN                                                         */
  /* ------------------------------------------------------------------------ */
  completed(completion, progress) {
    const activeDay = progress.activeDay;
    const sameDayContinues = !completion.dayFinalized && activeDay?.day === completion.day;
    return `
      <section class="screen">
        <div class="glass-card-elevated stack-lg text-center">
          <div class="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center shadow-sm">
            <span class="material-symbols-outlined text-3xl font-bold">verified</span>
          </div>
          <div class="stack-sm">
            <span class="eyebrow">${completion.day}-kun · ${completion.sessionNumber || 1}-mashq tugadi</span>
            <h1 class="text-4xl font-extrabold text-primary font-headline tnum">
              ${completion.dailyLatestScore ?? completion.secondScore}<span class="text-lg text-slate-400 font-normal">/100</span>
            </h1>
            <p class="text-sm font-semibold text-emerald-700">
              Ball farqi: ${(completion.dailyGrowth ?? completion.improvement) >= 0 ? '+' : ''}${completion.dailyGrowth ?? completion.improvement} ball
            </p>
          </div>
        </div>

        ${sameDayContinues ? `
          <div class="glass-surface stack-sm">
            <div class="flex items-center justify-between">
              <strong class="text-sm font-headline text-slate-900">Bugungi kun ochiq</strong>
              <span class="glass-pill primary text-xs">${remainingTimeLabel(activeDay.unlocksAt)}</span>
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
          <div class="glass-surface stack-sm text-center">
            <h2 class="text-lg font-bold text-slate-900">30 kunlik sayohat yakunlandi!</h2>
            <p class="muted small">1-kun va 30-kun natijalarini natijalar sahifasida solishtiring.</p>
          </div>
        ` : `
          <div class="glass-surface stack-sm">
            <span class="eyebrow">Yangi kun ochildi</span>
            <h2 class="text-lg font-bold text-slate-900">${completion.nextDay}-kunga o‘tishingiz mumkin</h2>
            <p class="muted small">Oldingi kun 24 soat va to‘liq mashqdan so‘ng muvaffaqiyatli yakunlandi.</p>
          </div>
        `}

        ${sameDayContinues ? `
          <button class="button secondary" type="button" onclick="App.repeatCurrentDay(${completion.day})">
            <span class="material-symbols-outlined">replay</span>
            <span>Shu kunni yana mashq qilish</span>
          </button>
        ` : ''}

        <button class="button cta-3d-tactile" type="button" onclick="App.navigate('home',{},false)">
          <span>Bosh sahifaga qaytish</span>
        </button>
      </section>`;
  },

  /* ------------------------------------------------------------------------ */
  /* LIBRARY / DICTIONARY SCREEN                                              */
  /* ------------------------------------------------------------------------ */
  library(user, curriculum, drills = [], pillars = []) {
    const currentDay = user.progress.currentDay;
    const sessions = user.drillSessions || [];
    const unlockedDrills = drills.filter(item => item.unlockDay <= currentDay);
    const scores = user.attempts?.[user.attempts.length - 1]?.evaluation?.pillarScores || {};
    const weakPillar = Object.keys(scores).sort((a, b) => scores[a] - scores[b])[0];
    const recommended = unlockedDrills.find(item => item.pillar === weakPillar && drillReviewState(item.id, sessions).due)
      || unlockedDrills.find(item => drillReviewState(item.id, sessions).due) || unlockedDrills[0];
    const pillarName = id => pillars.find(item => item.id === id)?.title || id;
    return `
      <section class="screen">
        <div class="stack-sm">
          <span class="eyebrow">Bilim va mashq zali</span>
          <h1 class="text-2xl font-bold tracking-tight text-slate-900">Har bir ko‘nikmani mashq qiling</h1>
          <p class="muted">Usulni yoddan eslang, ovoz chiqarib sinang va real suhbatda qo‘llang.</p>
        </div>

        ${recommended ? `<div class="glass-card-elevated stack-sm">
          <span class="eyebrow">Bugungi tavsiya</span>
          <h2>${escapeHtml(recommended.title)}</h2>
          <p class="muted small">${escapeHtml(pillarName(recommended.pillar))} · ${recommended.minutes} daqiqa · ${escapeHtml(drillReviewState(recommended.id, sessions).label)}</p>
          <button class="button" type="button" onclick="App.navigate('drill',{id:'${recommended.id}'})">Mashqni ochish</button>
        </div>` : ''}

        <div class="stack-sm"><h2>Mustaqil mashqlar</h2><p class="muted small">1, 3 va 7 kundan keyin takrorlash eslatiladi. Belgilar o‘z kuzatuvingizdir.</p></div>
        <div class="day-list">
          ${unlockedDrills.map(drill => {
            const state = drillReviewState(drill.id, sessions);
            return `<button class="day-card" type="button" onclick="App.navigate('drill',{id:'${drill.id}'})">
              <span class="day-number"><span class="material-symbols-outlined">${state.due ? 'exercise' : 'task_alt'}</span></span>
              <span><strong>${escapeHtml(drill.title)}</strong><small>${escapeHtml(pillarName(drill.pillar))} · ${drill.minutes} daqiqa · ${escapeHtml(state.label)}</small></span>
              <span class="glass-pill">${state.count}×</span>
            </button>`;
          }).join('')}
        </div>

        <div class="stack-sm"><h2>30 kunlik darslar</h2><p class="muted small">Avval o‘tilgan bilimlarni qayta ko‘ring.</p></div>

        <!-- Search Bar in Glass -->
        <div class="relative">
          <input id="librarySearch" type="text" placeholder="Dars yoki ko‘nikmani qidiring…" oninput="Screens.filterLessons(this.value)">
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
                <span class="glass-pill">${unlocked ? '›' : '🔒'}</span>
              </button>`;
          }).join('')}
        </div>
      </section>`;
  },

  drill(user, drill, pillars = []) {
    if (!drill || drill.unlockDay > user.progress.currentDay) return this.error('Mashq ochilmadi', 'Bu mashq hali mavjud emas.', "App.navigate('library')");
    const pillar = pillars.find(item => item.id === drill.pillar)?.title || drill.pillar;
    const state = drillReviewState(drill.id, user.drillSessions || []);
    return `<section class="screen">
      <div class="flex items-center justify-between wrap gap-2"><span class="glass-pill primary">${escapeHtml(pillar)}</span><span class="glass-pill">${drill.minutes} daqiqa</span></div>
      <div class="stack-sm"><h1>${escapeHtml(drill.title)}</h1><p class="muted">${escapeHtml(state.label)} · ${state.count} marta bajarilgan</p></div>
      <article class="glass-surface stack-sm"><span class="eyebrow">1. Esga tushiring</span><h2>Usul</h2><p>${escapeHtml(drill.method)}</p><p class="muted small">Namuna: ${escapeHtml(drill.example)}</p></article>
      <article class="glass-surface stack-sm"><span class="eyebrow">2. Ovoz chiqarib ayting</span><h2>${escapeHtml(drill.prompt)}</h2><p class="muted small">Bir marta odatdagidek, keyin usulni qo‘llab takrorlang. Iloji bo‘lsa telefoningizga yozib qayta eshiting.</p><button id="drillStart" class="button secondary" type="button" onclick="App.startDrillTimer()">Mashqni boshlash</button><strong id="drillTimer" class="tnum" role="timer">0 soniya</strong></article>
      <article class="glass-surface stack-sm"><span class="eyebrow">3. Tekshiring</span><h2>${escapeHtml(drill.check)}</h2><p class="muted small">Real hayotda: ${escapeHtml(drill.transfer)}</p></article>
      <form class="glass-surface stack practice-form" onsubmit="App.saveDrill(event,'${drill.id}')">
        <h2>Mashq qaydi</h2>
        <label class="drill-check"><input type="checkbox" name="drillCheck"> Usulni qaramasdan esladim</label>
        <label class="drill-check"><input type="checkbox" name="drillCheck"> Ikki marta ovoz chiqarib aytdim</label>
        <label class="drill-check"><input type="checkbox" name="drillCheck"> Tekshiruv savoliga aniq javob topdim</label>
        <label class="stack-sm"><span>Qanday farq sezildi?</span><textarea name="reflection" maxlength="400" rows="3" placeholder="Masalan: ikkinchi aytishda parazitlar 4 tadan 2 taga tushdi"></textarea></label>
        <button class="button" type="submit">Qaydni saqlash</button>
        <p class="muted small">Bu o‘z kuzatuvingiz. Audio asosidagi ball kunlik darsda alohida hisoblanadi.</p>
      </form>
    </section>`;
  },

  filterLessons(query) {
    const normalized = String(query || '').trim().toLowerCase();
    document.querySelectorAll('.library-item').forEach(item => {
      item.hidden = normalized && !item.dataset.search.includes(normalized);
    });
  },

  /* ------------------------------------------------------------------------ */
  /* PROGRESS SCREEN                                                          */
  /* ------------------------------------------------------------------------ */
  progress(user, pillars) {
    const progress = user.progress;
    const activeDay = progress.activeDay;
    const skillScores = progress.skillScores || {};
    const snapshots = progress.snapshots || [];
    const checkpoints = [1, 7, 30].map(day => ({
      day,
      attempt: user.attempts.find(item => item.day === day && item.attemptNumber === 1)
    }));
    const baseline = checkpoints[0].attempt?.evaluation;

    return `
      <section class="screen">
        <div class="stack-sm">
          <span class="eyebrow">Shaxsiy Natijalar</span>
          <h1 class="text-2xl font-bold tracking-tight text-slate-900">Nutq ko‘nikmalari o‘sishi</h1>
          <p class="muted">Mashq qaydlari, bir xil topshiriqdagi nazorat yozuvlari va real suhbat kuzatuvlari.</p>
        </div>

        <div class="glass-surface stack-sm">
          <h2>Taqqoslanadigan nazorat</h2>
          <p class="muted small">1-, 7- va 30-kunda bir xil tanishtirish vazifasining birinchi audio urinishlari. Ikkinchi urinishdagi mashq ta’siri bu hisobga kirmaydi.</p>
          ${checkpoints.map(({ day, attempt }) => {
            const evaluation = attempt?.evaluation;
            if (!evaluation) return `<div class="checkpoint-row"><strong>${day}-kun</strong><span class="muted">Hali yozilmagan</span></div>`;
            const fillerRate = evaluation.wordCount > 0 ? Math.round(evaluation.fillerCount / evaluation.wordCount * 100) : null;
            const delta = baseline && day !== 1 ? evaluation.totalScore - baseline.totalScore : null;
            return `<div class="checkpoint-row"><strong>${day}-kun · ${evaluation.totalScore}/100</strong><span>${delta == null ? 'Boshlang‘ich' : `${delta > 0 ? '+' : ''}${delta} ball`} · ${fillerRate == null ? '—' : `${fillerRate}/100 so‘z parazit`} · ${evaluation.wpm || '—'} so‘z/daq</span><button class="button secondary" type="button" data-attempt-id="${escapeHtml(attempt.id)}" onclick="App.playAttemptAudio(this.dataset.attemptId)">Audioni tinglash</button></div>`;
          }).join('')}
          <audio id="attemptAudio" class="hidden" controls></audio>
          <p class="muted small">Ball AI bahosi; uning o‘zgarishi yakka o‘zi real hayotdagi mahoratni isbotlamaydi. Bir xil qurilma va sharoitda yozing, audio va tinglovchi fikrini ham solishtiring.</p>
        </div>

        <div class="glass-surface stack-sm">
          <h2>Real suhbatda sinash</h2>
          <p class="muted small">Mashqdan keyin bir ko‘nikmani ishda yoki kundalik suhbatda qo‘llang. Odamning kuzatilgan javobini yozing; ism yoki maxfiy ma’lumot kiritmang.</p>
          <form class="stack-sm practice-form" onsubmit="App.saveFieldReport(event)">
            <label class="stack-xs"><span>Vaziyat</span><input name="situation" required maxlength="160" placeholder="Masalan: jamoa yig‘ilishida taklif berdim"></label>
            <label class="stack-xs"><span>Qo‘llangan ko‘nikma</span><input name="skill" required maxlength="100" placeholder="Masalan: fikr–sabab–misol–xulosa"></label>
            <label class="stack-xs"><span>Tinglovchi reaksiyasi</span><textarea name="evidence" required maxlength="400" rows="3" placeholder="Nima dedi yoki qildi? Taxmin emas, ko‘rganingizni yozing."></textarea></label>
            <label class="stack-xs"><span>Natija</span><select name="outcome" required><option value="">Tanlang</option><option value="tushundi">Fikrni tushundi</option><option value="qayta_soradi">Qayta so‘radi</option><option value="amal_qildi">Keyingi harakatni qildi</option><option value="noma_lum">Hali noma’lum</option></select></label>
            <label class="stack-xs"><span>Keyingi safar nima qilasiz?</span><input name="nextStep" maxlength="200" placeholder="Bitta aniq tuzatish"></label>
            <button class="button" type="submit">Kuzatuvni saqlash</button>
          </form>
          ${(user.fieldReports || []).length ? `<div class="stack-sm"><h3>Oxirgi kuzatuvlar</h3>${user.fieldReports.slice(-3).reverse().map(item => `<div class="checkpoint-row"><strong>${escapeHtml(item.situation)}</strong><span>${escapeHtml(item.skill)} · ${escapeHtml(item.evidence)}</span></div>`).join('')}</div>` : '<p class="muted small">Hali real suhbat qaydi yo‘q.</p>'}
        </div>

        <!-- Stat Overview in Glass -->
        <div class="stat-grid">
          <div class="glass-surface stat">
            <strong class="text-slate-900 tnum">${progress.completedDays.length}</strong>
            <small>bajarilgan kun</small>
          </div>
          <div class="glass-surface stat">
            <strong class="text-slate-900 tnum">${progress.longestStreak}</strong>
            <small>eng uzun streak</small>
          </div>
          <div class="glass-surface stat">
            <strong class="text-primary tnum">${progress.latestScore ?? '—'}</strong>
            <small>so‘nggi ball</small>
          </div>
          <div class="glass-surface stat">
            <strong class="text-slate-900 tnum">${progress.baselineScore ?? '—'}</strong>
            <small>1-kun bazasi</small>
          </div>
        </div>

        <!-- Active Day Growth (if ongoing) -->
        ${activeDay && !activeDay.completed ? `
          <div class="glass-surface stack-sm">
            <div class="flex items-center justify-between pb-1 border-b border-slate-100">
              <h2 class="text-sm font-bold text-slate-900">${activeDay.day}-kun ichidagi o‘sish</h2>
              <span class="glass-pill primary text-xs">${remainingTimeLabel(activeDay.unlocksAt)}</span>
            </div>
            <div class="grid grid-cols-3 gap-2 pt-1 text-center">
              <div class="p-2 rounded-xl bg-slate-100/70">
                <span class="text-xs text-slate-500 block">1-urinish</span>
                <strong class="text-base text-slate-800 tnum">${activeDay.firstScore ?? '—'}</strong>
              </div>
              <div class="p-2 rounded-xl bg-slate-100/70">
                <span class="text-xs text-slate-500 block">Oxirgi</span>
                <strong class="text-base text-slate-800 tnum">${activeDay.latestScore ?? '—'}</strong>
              </div>
              <div class="p-2 rounded-xl bg-emerald-100/70">
                <span class="text-xs text-emerald-800 block">O‘sish</span>
                <strong class="text-base text-emerald-800 tnum">${activeDay.growth == null ? '—' : `${activeDay.growth > 0 ? '+' : ''}${activeDay.growth}`}</strong>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Milestone Timeline (1, 7, 15, 21, 30 kun) -->
        <div class="glass-surface stack-sm">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-bold text-slate-900">Nazorat kunlari</h2>
            <span class="text-xs text-slate-400">Mashq ballari</span>
          </div>
          ${snapshots.length ? `
            <div class="timeline">
              ${snapshots.map(item => `
                <div class="timeline-column">
                  <strong class="text-xs text-primary tnum">${item.score}</strong>
                  <div class="timeline-bar" style="height:${Math.max(6, item.score)}%"></div>
                  <small class="text-slate-400">${item.day}-kun</small>
                </div>
              `).join('')}
            </div>
          ` : '<p class="muted small py-4 text-center">1-kun to‘liq yakunlangach birinchi ball ko‘rinadi.</p>'}
          <p class="muted small">Bu kunlardagi mavzu va mezonlar turlicha; yuqoridagi nazorat bilan alohida ko‘ring.</p>
        </div>

        <!-- 5 Speech Pillars Balance -->
        <div class="glass-surface stack">
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
                  <strong class="text-xs text-right text-slate-900 tnum">${score == null ? '—' : `${score}/20`}</strong>
                </div>`;
            }).join('')}
          </div>
        </div>

        <!-- Recent Sessions History -->
        <div class="glass-surface stack-sm">
          <h2 class="text-sm font-bold text-slate-900 pb-1 border-b border-slate-100">So‘nggi mashqlar</h2>
          ${user.completions.length ? user.completions.slice(-5).reverse().map(item => `
            <div class="flex items-center justify-between py-1.5 border-b border-slate-100/60 last:border-0 text-xs">
              <span class="font-medium text-slate-800">${item.day}-kun mashqi</span>
              <strong class="text-slate-900 tnum">${item.dailyLatestScore ?? item.secondScore}/100 <span class="font-normal text-emerald-600">(${(item.dailyGrowth ?? item.improvement) >= 0 ? '+' : ''}${item.dailyGrowth ?? item.improvement})</span></strong>
            </div>
          `).join('') : '<p class="muted small text-center py-2">Hali yakunlangan mashqlar mavjud emas.</p>'}
        </div>
      </section>`;
  },

  /* ------------------------------------------------------------------------ */
  /* PROFILE SCREEN                                                           */
  /* ------------------------------------------------------------------------ */
  profile(user, devMode, capabilities) {
    return `
      <section class="screen">
        ${devMode ? this.devSwitch(user.id) : ''}

        <!-- User Profile Card in Glass -->
        <div class="glass-card-elevated stack-sm">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary to-teal-400 text-white font-headline text-xl font-bold flex items-center justify-center shadow-md">
              ${escapeHtml(user.profile.firstName[0] || 'N')}
            </div>
            <div>
              <h1 class="text-xl font-bold text-slate-900">${escapeHtml(user.profile.firstName)}</h1>
              <p class="text-xs text-slate-500">${user.profile.username ? `@${escapeHtml(user.profile.username)}` : `ID: ${escapeHtml(user.id)}`}</p>
            </div>
          </div>
          <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full glass-emerald-pill text-xs font-semibold w-fit mt-1">
            <span class="material-symbols-outlined text-[15px] text-emerald-600">verified</span>
            <span>Faol Notiq • 30 kunlik dasturda</span>
          </div>
        </div>

        <!-- Practice Settings -->
        <div class="glass-surface stack-sm">
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
        <div class="glass-surface stack-sm">
          <h2 class="text-sm font-bold text-slate-900 pb-1 border-b border-slate-100">AI va Maxfiylik</h2>
          <p class="text-[12px] text-slate-500 leading-snug">
            Audio fayllaringiz faqat qurilmangizda saqlanadi. Tahlil vaqtida Gemini API faqat audio signalni tahlil qilib xulosa beradi.
          </p>
          <div class="flex items-center justify-between text-xs pt-1">
            <span class="text-slate-600">Nutq tahlili (Gemini 2.5)</span>
            <span class="glass-pill ${capabilities?.analysisAvailable ? 'success' : ''}">${capabilities?.analysisAvailable ? 'Faol' : 'Tekshirish'}</span>
          </div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-600">Jonli transkripsiya</span>
            <span class="glass-pill ${capabilities?.liveTranscriptionAvailable ? 'success' : ''}">${capabilities?.liveTranscriptionAvailable ? 'Faol' : 'Nofaol'}</span>
          </div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-600">Audio dars TTS</span>
            <span class="glass-pill ${capabilities?.ttsAvailable ? 'success' : ''}">${capabilities?.ttsAvailable ? 'Faol' : 'Nofaol'}</span>
          </div>
        </div>

        <!-- Reset Danger Zone -->
        <div class="glass-surface stack-sm border-l-4 border-l-amber-500 bg-amber-50/20">
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

  /* ------------------------------------------------------------------------ */
  /* ERROR SCREEN                                                             */
  /* ------------------------------------------------------------------------ */
  error(title, message, action = "App.init()") {
    return `
      <section class="screen">
        <div class="glass-surface stack-sm text-center py-6 border-l-4 border-l-rose-500">
          <span class="material-symbols-outlined text-rose-500 text-4xl mx-auto">error</span>
          <h1 class="text-lg font-bold text-slate-900">${escapeHtml(title)}</h1>
          <p class="small muted">${escapeHtml(message)}</p>
          <button class="button compact mt-2 mx-auto" type="button" onclick="${action}">
            <span>Qayta urinish</span>
          </button>
        </div>
      </section>`;
  }
};

window.Screens = Screens;
