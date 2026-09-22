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
      <section class="screen stack-lg">
        ${devMode ? this.devSwitch(user.id) : ''}
        <div class="card primary hero-card stack">
          <span class="eyebrow" style="color:#99f6e4">Xush kelibsiz, ${firstName}</span>
          <h1>30 kunda ravonroq va ishonchliroq gapiring</h1>
          <p style="color:#d7fffa">Har kuni bitta qisqa dars, ikkita audio urinish va dalilli Gemini tahlili.</p>
        </div>

        <form class="stack-lg" onsubmit="App.submitOnboarding(event)">
          <fieldset>
            <legend>Asosiy maqsadingiz</legend>
            <div class="choice-grid">
              ${[
                ['ravonlik', 'Ravon gapirish'],
                ['parazit', 'Parazitlarni kamaytirish'],
                ['ishonch', 'Ishonchli gapirish'],
                ['intervyu', 'Intervyuga tayyorlanish'],
                ['talaffuz', 'Talaffuzni yaxshilash'],
                ['tuzilma', 'Fikrni tartiblash']
              ].map(([value, label], index) => `
                <label class="choice"><input type="radio" name="goal" value="${value}" ${index === 0 ? 'checked' : ''}> <span>${label}</span></label>
              `).join('')}
            </div>
          </fieldset>

          <fieldset>
            <legend>Hozirgi darajangiz</legend>
            <div class="choice-grid">
              <label class="choice"><input type="radio" name="level" value="boshlangich" checked> <span>Boshlang‘ich</span></label>
              <label class="choice"><input type="radio" name="level" value="orta"> <span>O‘rta</span></label>
              <label class="choice"><input type="radio" name="level" value="yuqori"> <span>Yuqori</span></label>
            </div>
          </fieldset>

          <div class="field">
            <label for="dailyMinutes">Kunlik mashq vaqti</label>
            <select id="dailyMinutes" name="dailyMinutes">
              <option value="10">10 daqiqa</option>
              <option value="15" selected>15 daqiqa</option>
              <option value="20">20 daqiqa</option>
            </select>
          </div>

          <button class="button" type="submit">1-kunni boshlash →</button>
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
            : 'Bugungi mashqni boshlash';
    const ctaAction = programComplete
      ? "App.navigate('progress')"
      : resume ? `App.resumeDay(${day})` : `App.navigate('lesson',{day:${day}})`;
    const modelLabel = capabilities?.configured ? `AI faol · ${escapeHtml(capabilities.analysisModel)}` : 'Gemini API sozlanmagan';
    const growth = activeDay?.growth;
    const elapsedPercent = activeDay
      ? Math.max(0, Math.min(100, Math.round((Date.now() - new Date(activeDay.startedAt).getTime()) / (new Date(activeDay.unlocksAt).getTime() - new Date(activeDay.startedAt).getTime()) * 100)))
      : 0;

    return `
      <section class="screen">
        ${devMode ? this.devSwitch(user.id) : ''}
        <div class="stack">
          <span class="eyebrow">Bugun · ${day}-kun</span>
          <h1>Assalomu alaykum, ${escapeHtml(user.profile.firstName)}!</h1>
          <p class="muted">Har kuni bitta aniq ko‘nikma ustida ishlaymiz.</p>
        </div>

        <div class="card stack">
          <div class="row-between"><strong>30 kunlik progress</strong><strong>${completed}/30</strong></div>
          <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
          <div class="stat-grid">
            <div class="stat"><strong>${progress.streakDays}</strong><small>kunlik streak</small></div>
            <div class="stat"><strong>${progress.latestScore ?? '—'}</strong><small>so‘nggi kun balli</small></div>
          </div>
        </div>

        ${activeDay ? `<div class="card stack">
          <div class="row-between"><strong>${day}-kun davom etmoqda</strong><span class="pill primary">${remainingTimeLabel(activeDay.unlocksAt)}</span></div>
          <div class="progress-track"><div class="progress-fill" style="width:${elapsedPercent}%"></div></div>
          <div class="stat-grid">
            <div class="stat"><strong>${activeDay.latestScore ?? '—'}</strong><small>joriy kun bali</small></div>
            <div class="stat"><strong>${growth == null ? '—' : `${growth > 0 ? '+' : ''}${growth}`}</strong><small>kunlik o‘sish</small></div>
            <div class="stat"><strong>${activeDay.attemptCount}</strong><small>audio urinish</small></div>
            <div class="stat"><strong>${activeDay.cyclesCompleted}</strong><small>to‘liq mashq</small></div>
          </div>
          <p class="small muted">Ballar qo‘shilmaydi. Kun bali — eng oxirgi tahlil qilingan urinish natijasi.</p>
          ${activeDay.lastSuggestedFocus ? `<div class="card soft"><strong>AI tavsiyasi:</strong><p class="small">${escapeHtml(activeDay.lastSuggestedFocus)}</p></div>` : ''}
        </div>` : ''}

        <article class="card hero-card stack-lg">
          <div class="row-between wrap">
            <span class="pill primary">${escapeHtml(lesson.stageName)}</span>
            <span class="pill">${lesson.durationMinutes} daqiqa · audio</span>
          </div>
          <div class="stack">
            <span class="eyebrow">${lesson.day}-kun</span>
            <h2>${escapeHtml(lesson.title)}</h2>
            <p class="muted">${escapeHtml(lesson.skill)}</p>
          </div>
          <div class="row wrap">${lesson.activeMetrics.map(metric => `<span class="metric-chip">${escapeHtml(metric.title)}</span>`).join('')}</div>
          <button class="button" type="button" onclick="${ctaAction}">${cta}</button>
        </article>

        <div class="card soft row-between">
          <div><strong>Gemini holati</strong><p class="small muted">${modelLabel}</p></div>
          <span class="pill ${capabilities?.configured ? 'success' : ''}">${capabilities?.configured ? 'Tayyor' : 'Sozlash kerak'}</span>
        </div>
      </section>`;
  },

  map(user, curriculum, stages) {
    return `
      <section class="screen">
        <div class="stack"><span class="eyebrow">Yo‘l xaritasi</span><h1>30 kunlik chellenj</h1><p class="muted">Har bir kun oldingi ko‘nikma ustiga quriladi.</p></div>
        ${stages.map(stage => `
          <div class="stack">
            <div class="section-title"><div><h2>${escapeHtml(stage.title)}</h2><p class="small muted">${escapeHtml(stage.description)}</p></div><span class="pill">${stage.from}–${stage.to}</span></div>
            <div class="day-list">
              ${curriculum.filter(day => day.stageId === stage.id).map(day => this.dayCard(user, day)).join('')}
            </div>
          </div>`).join('')}
      </section>`;
  },

  dayCard(user, lesson) {
    const complete = user.progress.completedDays.includes(lesson.day);
    const current = user.progress.currentDay === lesson.day;
    const unlocked = lesson.day <= user.progress.currentDay || complete;
    const statusClass = complete ? 'complete' : current ? 'current' : unlocked ? '' : 'locked';
    const status = complete ? '✓' : current ? 'Bugun' : unlocked ? 'Ochiq' : '🔒';
    const action = unlocked ? `onclick="App.navigate('lesson',{day:${lesson.day}})"` : 'disabled';
    return `
      <button class="day-card ${statusClass}" type="button" ${action}>
        <span class="day-number">${complete ? '✓' : lesson.day}</span>
        <span><strong>${escapeHtml(lesson.title)}</strong><small>${escapeHtml(lesson.skill)} · ${lesson.durationMinutes} daqiqa</small></span>
        <span class="pill">${status}</span>
      </button>`;
  },

  lesson(lesson, canPractice = false) {
    return `
      <section class="screen">
        <div class="row-between wrap"><span class="pill primary">${lesson.day}-kun · ${escapeHtml(lesson.stageName)}</span><span class="pill">${lesson.durationMinutes} daqiqa</span></div>
        <div class="stack"><h1>${escapeHtml(lesson.title)}</h1><p class="muted">${escapeHtml(lesson.skill)}</p></div>

        <button id="ttsButton" class="button secondary" type="button" onclick="App.playLessonAudio(${lesson.day})">▶ Audio darsni tinglash</button>
        <audio id="lessonAudio" class="hidden" controls></audio>

        <article class="card lesson-card"><div class="row"><span class="lesson-icon">1</span><h2>Nima?</h2></div><p>${escapeHtml(lesson.what)}</p></article>
        <article class="card lesson-card"><div class="row"><span class="lesson-icon">2</span><h2>Nega kerak?</h2></div><p>${escapeHtml(lesson.why)}</p></article>
        <article class="card lesson-card">
          <div class="row"><span class="lesson-icon">3</span><h2>Qanday qilinadi?</h2></div>
          <ol class="numbered-list">${lesson.how.map((step, index) => `<li><span>${index + 1}</span><p>${escapeHtml(step)}</p></li>`).join('')}</ol>
        </article>
        <article class="card lesson-card"><div class="row"><span class="lesson-icon">✓</span><h2>Yaxshi misol</h2></div><p class="quote">${escapeHtml(lesson.goodExample)}</p></article>
        <article class="card warning lesson-card"><div class="row"><span class="lesson-icon">!</span><h2>Ko‘p uchraydigan xato</h2></div><p>${escapeHtml(lesson.badExample)}</p></article>
        <article class="card soft lesson-card"><h3>Bugungi tekshiruv</h3><p>${escapeHtml(lesson.check)}</p></article>

        ${canPractice
          ? `<button class="button" type="button" onclick="App.navigate('prepare',{day:${lesson.day}})">Tayyorgarlikka o‘tish →</button>`
          : '<button class="button" type="button" disabled>Bu kun hali ochilmagan</button>'}
      </section>`;
  },

  prepare(lesson, attemptNumber = 1, selectedFocus = '') {
    return `
      <section class="screen">
        <div class="stack"><span class="eyebrow">${lesson.day}-kun · ${attemptNumber}-urinish</span><h1>Gapirishga tayyorlaning</h1><p class="muted">Yozuv faqat audio bo‘ladi. Matn o‘qimang — tayanch so‘zlardan foydalaning.</p></div>
        ${selectedFocus ? `<div class="card primary stack"><span class="eyebrow" style="color:#99f6e4">Bugungi bitta fokus</span><strong>${escapeHtml(selectedFocus)}</strong></div>` : ''}
        <div class="card stack"><span class="eyebrow">60 soniyalik qizish</span><h2>${escapeHtml(lesson.warmup)}</h2><button id="warmupButton" class="button secondary" type="button" onclick="App.startWarmup()">60 soniyani boshlash</button><strong id="warmupTimer" class="record-timer" style="font-size:30px">01:00</strong></div>
        <div class="card stack"><span class="eyebrow">Nutq mavzusi</span><h2>${escapeHtml(lesson.prompt)}</h2><div class="row wrap">${lesson.keywords.map(word => `<span class="pill primary">${escapeHtml(word)}</span>`).join('')}</div></div>
        <div class="card warning"><p class="small"><strong>Maxfiylik:</strong> yozuv qurilmangizda saqlanadi. “Tahlil qilish”ni bosganingizda audio Gemini API’ga yuboriladi, server audio faylni saqlamaydi.</p></div>
        <button class="button" type="button" onclick="App.openRecorder(${lesson.day},${attemptNumber})">Mikrofonni ochish →</button>
      </section>`;
  },

  record(lesson, attemptNumber, selectedFocus = '', liveAvailable = false) {
    const maxTime = Math.max(lesson.recommendedSeconds + 30, lesson.recommendedSeconds * 1.35);
    return `
      <section class="record-shell">
        <div class="row-between"><button class="button ghost compact" type="button" onclick="App.cancelRecording()">← Chiqish</button><span class="pill primary">${attemptNumber}-urinish</span></div>
        <div class="record-panel">
          <div class="stack"><span class="eyebrow" style="color:#99f6e4">${lesson.day}-kun · ${escapeHtml(lesson.title)}</span><h2>${escapeHtml(lesson.prompt)}</h2></div>
          <div class="keyword-row">${lesson.keywords.map(word => `<span>${escapeHtml(word)}</span>`).join('')}</div>
          ${selectedFocus ? `<p><strong>Fokus:</strong> ${escapeHtml(selectedFocus)}</p>` : ''}
          <div id="recordTimer" class="record-timer">00:00</div>
          <div id="waveform" class="waveform" aria-label="Ovoz darajasi">${Array.from({ length: 18 }, () => '<i></i>').join('')}</div>
          <button id="recordButton" class="record-button" type="button" onclick="App.toggleRecording(${Math.round(maxTime)})" aria-label="Yozishni boshlash">Yozish</button>
          <p id="recordHint">Tugmani bosing va tabiiy gapiring</p>
          ${liveAvailable ? '<div class="live-transcript"><span id="liveStatus">Jonli matn yozuv boshlanganda ulanadi</span><p id="liveTranscript"></p></div>' : ''}
        </div>
        <p class="small muted">Tavsiya: ${lesson.recommendedSeconds} soniya. Xato qilsangiz to‘xtamang; fikrni davom ettiring.</p>
      </section>`;
  },

  review(lesson, attemptNumber, recording) {
    return `
      <section class="screen">
        <div class="stack"><span class="eyebrow">${attemptNumber}-urinish yozildi</span><h1>Avval o‘zingiz eshiting</h1><p class="muted">Gemini tahlilidan oldin o‘z kuzatuvingizni yozing.</p></div>
        <div class="card stack"><audio controls src="${recording.audioUrl}"></audio><p class="small muted">Davomiyligi: ${recording.durationSeconds} soniya</p></div>
        <form class="stack-lg" onsubmit="App.analyzeCurrentRecording(event)">
          <div class="field"><label for="mainIdea">Asosiy fikrim nima edi?</label><textarea id="mainIdea" name="mainIdea" maxlength="500" placeholder="Bir jumlada yozing"></textarea></div>
          <div class="field"><label for="bestPart">Eng yaxshi chiqqan joy</label><textarea id="bestPart" name="bestPart" maxlength="500" placeholder="Aniq so‘z yoki vaqtni yozing"></textarea></div>
          <div class="field"><label for="improvePart">Qayerni yaxshilash kerak?</label><textarea id="improvePart" name="improvePart" maxlength="500" placeholder="Bitta aniq kuzatuv"></textarea></div>
          <button class="button" type="submit">Gemini bilan tahlil qilish →</button>
          <button class="button secondary" type="button" onclick="App.retryRecording()">Qayta yozish</button>
        </form>
      </section>`;
  },

  analysis(lesson, attempt) {
    const evaluation = attempt.evaluation;
    const isFirst = attempt.attemptNumber === 1;
    return `
      <section class="screen">
        <div class="stack"><span class="eyebrow">${attempt.attemptNumber}-urinish tahlili</span><h1>${evaluation.totalScore}/100</h1><p class="muted">Bu shaxsiy mashq balli, imtihon yoki klinik baho emas.</p></div>
        <div class="counter-grid">
          <div class="counter"><strong>${evaluation.fillerCount}</strong><small>parazit</small></div>
          <div class="counter"><strong>${evaluation.longPauseCount}</strong><small>uzoq pauza</small></div>
          <div class="counter"><strong>${evaluation.wpm}</strong><small>so‘z/daq</small></div>
        </div>
        <div class="card stack"><h2>Nutq matni</h2><p class="quote">${escapeHtml(evaluation.transcript)}</p></div>
        <div class="card stack"><h2>Bugungi mezonlar</h2><div class="score-list">${evaluation.metricScores.map(item => `
          <div class="score-row"><div class="row-between"><strong>${escapeHtml(metricName(item.metricId))}</strong><strong>${item.score}/10</strong></div><div class="score-bar"><span style="width:${item.score * 10}%"></span></div><p class="small muted">${escapeHtml(scoreDescriptor(item.score))}. ${escapeHtml(item.evidence)}</p></div>
        `).join('')}</div></div>
        <div class="card stack"><h2>Kuchli tomonlar</h2>${evaluation.strengths.map(text => `<p>✓ ${escapeHtml(text)}</p>`).join('')}</div>
        <div class="card warning stack"><h2>Keyingi o‘sish nuqtalari</h2>${evaluation.improvements.map(text => `<p>• ${escapeHtml(text)}</p>`).join('')}</div>
        <div class="card primary stack"><span class="eyebrow" style="color:#99f6e4">AI tavsiya qilgan bitta fokus</span><strong>${escapeHtml(evaluation.suggestedFocus)}</strong></div>
        <button class="button" type="button" onclick="${isFirst ? 'App.openFocusSelection()' : 'App.openComparison()'}">${isFirst ? 'Bitta fokus tanlash →' : 'Ikki urinishni solishtirish →'}</button>
      </section>`;
  },

  focus(lesson, attempt) {
    const suggested = attempt.evaluation.suggestedFocus;
    const options = [suggested, ...lesson.focusOptions].filter((item, index, list) => item && list.indexOf(item) === index).slice(0, 7);
    return `
      <section class="screen">
        <div class="stack"><span class="eyebrow">2-urinishga tayyorgarlik</span><h1>Faqat bittasini o‘zgartiring</h1><p class="muted">Bir vaqtning o‘zida bitta fokusni mashq qilish natijani aniqroq ko‘rsatadi.</p></div>
        <form class="stack-lg" onsubmit="App.startSecondAttempt(event)">
          <fieldset><legend>Fokusni tanlang</legend><div class="stack">${options.map((option, index) => `
            <label class="choice"><input type="radio" name="focus" value="${escapeHtml(option)}" ${index === 0 ? 'checked' : ''}><span>${index === 0 ? '<strong>AI tavsiyasi:</strong> ' : ''}${escapeHtml(option)}</span></label>
          `).join('')}<label class="choice"><input type="radio" name="focus" value="custom"><span>O‘z fokusim</span></label></div></fieldset>
          <div class="field"><label for="customFocus">O‘z fokusingiz (ixtiyoriy)</label><input id="customFocus" name="customFocus" type="text" maxlength="300" placeholder="Bitta aniq o‘zgarish"></div>
          <button class="button" type="submit">2-urinishga o‘tish →</button>
        </form>
      </section>`;
  },

  compare(lesson, attempt1, attempt2) {
    const diff = attempt2.evaluation.totalScore - attempt1.evaluation.totalScore;
    return `
      <section class="screen">
        <div class="stack"><span class="eyebrow">${lesson.day}-kun · mashq sikli</span><h1>Ikki urinishni solishtiring</h1><p class="muted">Ballar qo‘shilmaydi. Ikkinchi — ya’ni eng oxirgi urinish kunning joriy bali bo‘ladi.</p></div>
        <div class="compare-grid">
          <div class="attempt-card stack"><span class="eyebrow">1-urinish</span><strong>${attempt1.evaluation.totalScore}</strong><span class="small muted">${attempt1.evaluation.fillerCount} parazit · ${attempt1.evaluation.wpm} WPM</span></div>
          <div class="attempt-card stack"><span class="eyebrow">2-urinish</span><strong>${attempt2.evaluation.totalScore}</strong><span class="small muted">${attempt2.evaluation.fillerCount} parazit · ${attempt2.evaluation.wpm} WPM</span></div>
        </div>
        <div class="card primary stack"><span class="eyebrow" style="color:#99f6e4">Ball farqi</span><h1>${diff > 0 ? '+' : ''}${diff}</h1><p style="color:#d7fffa">Tanlangan fokus: ${escapeHtml(App.workout.selectedFocus)}</p></div>
        <form class="stack-lg" onsubmit="App.completeCurrentDay(event)">
          <fieldset><legend>Nima o‘zgardi?</legend><div class="choice-grid"><label class="choice"><input type="radio" name="comparison" value="yaxshilandi" checked><span>Yaxshilandi</span></label><label class="choice"><input type="radio" name="comparison" value="bir_xil"><span>Bir xil</span></label><label class="choice"><input type="radio" name="comparison" value="qiyinlashdi"><span>Qiyinlashdi</span></label></div></fieldset>
          <div class="field"><label for="reflection">Bugungi bitta yutug‘ingiz</label><textarea id="reflection" name="reflection" maxlength="800" placeholder="Masalan: Ikkinchi urinishda xulosani aniq tugatdim"></textarea></div>
          <button class="button" type="submit">Mashq siklini saqlash ✓</button>
        </form>
      </section>`;
  },

  completed(completion, progress) {
    const activeDay = progress.activeDay;
    const sameDayContinues = !completion.dayFinalized && activeDay?.day === completion.day;
    return `
      <section class="screen">
        <div class="card primary hero-card stack-lg" style="text-align:center">
          <span style="font-size:52px" aria-hidden="true">✓</span>
          <span class="eyebrow" style="color:#99f6e4">${completion.day}-kun · ${completion.sessionNumber || 1}-mashq tugadi</span>
          <h1>${completion.dailyLatestScore ?? completion.secondScore}/100</h1>
          <p style="color:#d7fffa">Kun boshidan o‘sish: ${(completion.dailyGrowth ?? completion.improvement) > 0 ? '+' : ''}${completion.dailyGrowth ?? completion.improvement} ball</p>
        </div>
        ${sameDayContinues
          ? `<div class="card stack"><span class="eyebrow">Kun hali davom etmoqda</span><h2>Keyingi kungacha ${remainingTimeLabel(activeDay.unlocksAt)}</h2><p class="muted">Shu darsni yana takrorlang. Yangi urinish bali oldingilariga qo‘shilmaydi — oxirgi natija kun bali bo‘ladi.</p>${activeDay.lastSuggestedFocus ? `<div class="card soft"><strong>Keyingi AI fokusi</strong><p class="small">${escapeHtml(activeDay.lastSuggestedFocus)}</p></div>` : ''}</div>`
          : completion.programCompleted
            ? `<div class="card stack"><h2>30 kun yakunlandi!</h2><p class="muted">1-kun va 30-kun natijasini progress sahifasida solishtiring.</p></div>`
            : `<div class="card stack"><span class="eyebrow">Yangi kun ochildi</span><h2>${completion.nextDay}-kunga o‘tishingiz mumkin</h2><p class="muted">Oldingi kun 24 soat va kamida bitta to‘liq mashqdan so‘ng yakunlandi.</p></div>`}
        ${sameDayContinues ? `<button class="button" type="button" onclick="App.repeatCurrentDay(${completion.day})">Shu kunni yana mashq qilish →</button>` : ''}
        <button class="button" type="button" onclick="App.navigate('home',{},false)">Bosh sahifaga qaytish</button>
      </section>`;
  },

  library(curriculum) {
    return `
      <section class="screen">
        <div class="stack"><span class="eyebrow">Bilimlar</span><h1>30 ta amaliy mikro-dars</h1><p class="muted">Istalgan ochilgan darsni qayta o‘qing yoki audio ko‘rinishda tinglang.</p></div>
        <div class="field"><label for="librarySearch">Darsni qidiring</label><input id="librarySearch" type="text" placeholder="Masalan: pauza yoki intervyu" oninput="Screens.filterLessons(this.value)"></div>
        <div id="lessonLibrary" class="day-list">${curriculum.map(lesson => `
          <button class="day-card library-item" type="button" data-search="${escapeHtml(`${lesson.title} ${lesson.skill}`.toLowerCase())}" onclick="App.navigate('lesson',{day:${lesson.day}})">
            <span class="day-number">${lesson.day}</span><span><strong>${escapeHtml(lesson.title)}</strong><small>${escapeHtml(lesson.skill)}</small></span><span>›</span>
          </button>`).join('')}</div>
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
        <div class="stack"><span class="eyebrow">Shaxsiy natija</span><h1>O‘zingiz bilan solishtiring</h1><p class="muted">Asosiy trend 1, 7, 15, 21 va 30-kun nazorat yozuvlari orqali ko‘rinadi.</p></div>
        <div class="stat-grid"><div class="stat"><strong>${progress.completedDays.length}</strong><small>bajarilgan kun</small></div><div class="stat"><strong>${progress.longestStreak}</strong><small>eng uzun streak</small></div><div class="stat"><strong>${progress.latestScore ?? '—'}</strong><small>so‘nggi ball</small></div><div class="stat"><strong>${progress.baselineScore ?? '—'}</strong><small>1-kun bazasi</small></div></div>
        ${activeDay && !activeDay.completed ? `<div class="card stack"><div class="row-between"><h2>${activeDay.day}-kun ichidagi o‘sish</h2><span class="pill primary">${remainingTimeLabel(activeDay.unlocksAt)}</span></div><div class="stat-grid"><div class="stat"><strong>${activeDay.firstScore ?? '—'}</strong><small>birinchi ball</small></div><div class="stat"><strong>${activeDay.latestScore ?? '—'}</strong><small>oxirgi ball</small></div><div class="stat"><strong>${activeDay.growth == null ? '—' : `${activeDay.growth > 0 ? '+' : ''}${activeDay.growth}`}</strong><small>o‘sish</small></div><div class="stat"><strong>${activeDay.attemptCount}</strong><small>urinish</small></div></div></div>` : ''}
        <div class="card stack"><h2>Nazorat kunlari</h2>${snapshots.length ? `<div class="timeline">${snapshots.map(item => `<div class="timeline-column"><strong>${item.score}</strong><div class="timeline-bar" style="height:${Math.max(4, item.score)}%"></div><small>${item.day}-kun</small></div>`).join('')}</div>` : '<p class="muted">1-kun tugagach birinchi nazorat natijasi chiqadi.</p>'}</div>
        <div class="card stack"><h2>Besh yo‘nalish</h2><div class="bar-chart">${pillars.map(pillar => { const score = skillScores[pillar.id]; return `<div class="bar-item"><span>${escapeHtml(pillar.title)}</span><div class="score-bar"><span style="width:${score == null ? 0 : score * 5}%"></span></div><strong>${score == null ? '—' : `${score}/20`}</strong></div>`; }).join('')}</div></div>
        <div class="card stack"><h2>So‘nggi mashqlar</h2>${user.completions.length ? user.completions.slice(-5).reverse().map(item => `<div class="row-between"><span>${item.day}-kun · ${item.sessionNumber || 1}-mashq</span><strong>${item.dailyLatestScore ?? item.secondScore}/100 <span class="small muted">(${(item.dailyGrowth ?? item.improvement) > 0 ? '+' : ''}${item.dailyGrowth ?? item.improvement})</span></strong></div>`).join('') : '<p class="muted">Hali yakunlangan mashq yo‘q.</p>'}</div>
      </section>`;
  },

  profile(user, devMode, capabilities) {
    return `
      <section class="screen">
        ${devMode ? this.devSwitch(user.id) : ''}
        <div class="card stack"><span class="avatar-button" style="display:grid;place-items:center">${escapeHtml(user.profile.firstName[0] || 'N')}</span><h1>${escapeHtml(user.profile.firstName)}</h1><p class="muted">${user.profile.username ? `@${escapeHtml(user.profile.username)}` : `ID: ${escapeHtml(user.id)}`}</p></div>
        <div class="card stack"><h2>Mashq sozlamalari</h2><div class="row-between"><span>Maqsad</span><strong>${escapeHtml(user.onboarding.goal || '—')}</strong></div><div class="row-between"><span>Daraja</span><strong>${escapeHtml(user.onboarding.level || '—')}</strong></div><div class="row-between"><span>Kunlik vaqt</span><strong>${user.onboarding.dailyMinutes || 15} daqiqa</strong></div></div>
        <div class="card stack"><h2>AI va maxfiylik</h2><p class="small">Audio faqat qurilmada saqlanadi. Tahlil vaqtida Gemini API’ga yuboriladi; server transkripsiya va natijani saqlaydi.</p><div class="row-between"><span>Nutq tahlili</span><span class="pill ${capabilities?.analysisAvailable ? 'success' : ''}">${capabilities?.analysisAvailable ? 'Faol' : 'Tekshirish kerak'}</span></div><div class="row-between"><span>Jonli transkripsiya</span><span class="pill ${capabilities?.liveTranscriptionAvailable ? 'success' : ''}">${capabilities?.liveTranscriptionAvailable ? 'Faol' : 'Tekshirish kerak'}</span></div><div class="row-between"><span>Audio dars TTS</span><span class="pill ${capabilities?.ttsAvailable ? 'success' : ''}">${capabilities?.ttsAvailable ? 'Faol' : 'Tekshirish kerak'}</span></div></div>
        <div class="card warning stack"><h2>Progressni boshidan boshlash</h2><p class="small">Faqat shu profilning progressi, transkripsiyalari va qurilmada saqlangan audiolari o‘chiriladi.</p><button class="button danger" type="button" onclick="App.confirmReset()">Progressni tozalash</button></div>
      </section>`;
  },

  error(title, message, action = "App.init()") {
    return `<section class="screen"><div class="card warning stack"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><button class="button" type="button" onclick="${action}">Qayta urinish</button></div></section>`;
  }
};

window.Screens = Screens;
