const App = {
  currentScreen: 'boot',
  screenParams: {},
  history: [],
  user: null,
  content: null,
  capabilities: null,
  devMode: false,
  recorder: null,
  liveTranscriber: null,
  warmupInterval: null,
  dayRefreshTimer: null,
  ttsUrl: null,
  workout: {
    day: null,
    selectedFocus: '',
    currentAttemptNumber: 1,
    currentRecording: null,
    attempt1: null,
    attempt2: null
  },

  async init() {
    this.renderLoading('Platforma yuklanmoqda…', 'Profil va 30 kunlik darslar tayyorlanmoqda.');
    try {
      const [session, content] = await Promise.all([
        Api.get('/api/session'),
        Api.get('/api/curriculum')
      ]);
      this.user = session.user;
      this.devMode = session.devMode;
      this.content = content;
      this.scheduleDayRefresh();
      try {
        this.capabilities = await Api.get('/api/capabilities');
      } catch (error) {
        this.capabilities = { configured: false, analysisAvailable: false, liveTranscriptionAvailable: false, ttsAvailable: false };
        console.warn('Gemini holatini tekshirib bo‘lmadi:', error.message);
      }
      this.updateIdentity();
      this.closeLoading();
      if (!this.user.onboarding.completed) {
        this.render('onboarding', {}, false);
      } else {
        this.rebuildWorkout(this.user.progress.currentDay);
        this.render('home', {}, false);
      }
    } catch (error) {
      this.closeLoading();
      this.main().innerHTML = Screens.error('Ilova yuklanmadi', error.message);
      this.setChrome(false, false);
    }
  },

  main() { return document.getElementById('mainViewport'); },

  updateIdentity() {
    const initial = this.user?.profile?.firstName?.[0]?.toUpperCase() || 'N';
    const el = document.getElementById('avatarInitial');
    if (el) el.textContent = initial;
  },

  scheduleDayRefresh() {
    clearTimeout(this.dayRefreshTimer);
    const activeDay = this.user?.progress?.activeDay;
    if (!activeDay || activeDay.completed || activeDay.cyclesCompleted < 1) return;
    const delay = new Date(activeDay.unlocksAt).getTime() - Date.now();
    if (!Number.isFinite(delay)) return;
    this.dayRefreshTimer = setTimeout(() => this.refreshDayState(), Math.max(500, Math.min(delay + 600, 2_147_000_000)));
  },

  async refreshDayState() {
    if (!this.user || this.recorder?.isRecording) return;
    try {
      const previousDay = this.user.progress.currentDay;
      const session = await Api.get('/api/session');
      this.user = session.user;
      this.devMode = session.devMode;
      this.scheduleDayRefresh();
      if (this.user.progress.currentDay !== previousDay && !this.workout.currentRecording) {
        this.history = [];
        this.rebuildWorkout(this.user.progress.currentDay);
        this.render('home', {}, false);
        this.toast(`${this.user.progress.currentDay}-kun ochildi.`, 'info');
      }
    } catch (error) {
      console.warn('Kun holatini yangilab bo‘lmadi:', error.message);
    }
  },

  canPractice(day) {
    return day === this.user.progress.currentDay && !this.user.progress.programCompletedAt;
  },

  getLesson(day) {
    return this.content.curriculum.find(item => item.day === Number(day));
  },

  navigate(screen, params = {}, push = true) {
    if (!this.user || !this.content) return;
    TelegramApp.haptic('light');
    if (push && this.currentScreen !== 'boot' && this.currentScreen !== screen) {
      this.history.push({ screen: this.currentScreen, params: this.screenParams });
    }
    this.render(screen, params, false);
  },

  render(screen, params = {}, push = false) {
    if (push) this.history.push({ screen: this.currentScreen, params: this.screenParams });
    this.currentScreen = screen;
    this.screenParams = params;
    const day = Number(params.day || this.workout.day || this.user?.progress?.currentDay || 1);
    const lesson = this.getLesson(day);
    let html = '';

    switch (screen) {
      case 'onboarding': html = Screens.onboarding(this.user, this.devMode); break;
      case 'home': html = Screens.home(this.user, this.content.curriculum, this.capabilities, this.devMode); break;
      case 'map': html = Screens.map(this.user, this.content.curriculum, this.content.stages); break;
      case 'lesson': html = Screens.lesson(lesson, this.canPractice(day)); break;
      case 'prepare':
        this.ensureWorkout(day);
        html = Screens.prepare(lesson, params.attemptNumber || this.workout.currentAttemptNumber, this.workout.selectedFocus);
        break;
      case 'record': html = Screens.record(lesson, this.workout.currentAttemptNumber, this.workout.selectedFocus, this.capabilities?.liveTranscriptionAvailable); break;
      case 'review': html = Screens.review(lesson, this.workout.currentAttemptNumber, this.workout.currentRecording); break;
      case 'analysis': {
        const attempt = params.attempt || (this.workout.currentAttemptNumber === 1 ? this.workout.attempt1 : this.workout.attempt2);
        html = Screens.analysis(lesson, attempt);
        break;
      }
      case 'focus': html = Screens.focus(lesson, this.workout.attempt1); break;
      case 'compare': html = Screens.compare(lesson, this.workout.attempt1, this.workout.attempt2); break;
      case 'completed': html = Screens.completed(params.completion, this.user.progress); break;
      case 'library': html = Screens.library(this.user, this.content.curriculum); break;
      case 'progress': html = Screens.progress(this.user, this.content.pillars); break;
      case 'profile': html = Screens.profile(this.user, this.devMode, this.capabilities); break;
      default: html = Screens.home(this.user, this.content.curriculum, this.capabilities, this.devMode);
    }

    this.main().innerHTML = html;
    window.scrollTo({ top: 0, behavior: 'instant' });
    const immersive = ['onboarding', 'lesson', 'prepare', 'record', 'review', 'analysis', 'focus', 'compare', 'completed'].includes(screen);
    this.setChrome(!immersive, screen !== 'onboarding' && screen !== 'home');
    this.updateNav();
  },

  setChrome(showMainChrome, showBack) {
    document.getElementById('appHeader')?.classList.toggle('hidden', !showMainChrome);
    document.getElementById('bottomNav')?.classList.toggle('hidden', !showMainChrome);
    this.main()?.classList.toggle('immersive', !showMainChrome);
    TelegramApp.showBackButton(showBack);
  },

  updateNav() {
    document.querySelectorAll('#bottomNav button').forEach(button => {
      button.classList.toggle('active', button.dataset.route === this.currentScreen);
    });
  },

  goBack() {
    if (this.recorder?.isRecording) return this.cancelRecording();
    clearInterval(this.warmupInterval);
    if (this.history.length) {
      const previous = this.history.pop();
      this.render(previous.screen, previous.params, false);
    } else {
      this.render('home', {}, false);
    }
  },

  ensureWorkout(day) {
    if (this.workout.day !== day) {
      this.workout = { day, selectedFocus: '', currentAttemptNumber: 1, currentRecording: null, attempt1: null, attempt2: null };
      this.rebuildWorkout(day);
    }
  },

  pendingAttempts(day) {
    const activeDay = this.user.progress.activeDay;
    const cycle = activeDay?.day === day ? activeDay.activeCycle : null;
    if (!cycle) return [];
    const attemptIds = new Set([cycle.firstAttemptId, cycle.secondAttemptId].filter(Boolean));
    return this.user.attempts.filter(item => attemptIds.has(item.id));
  },

  rebuildWorkout(day) {
    this.workout = { day, selectedFocus: '', currentAttemptNumber: 1, currentRecording: null, attempt1: null, attempt2: null };
    const pending = this.pendingAttempts(day);
    this.workout.attempt1 = [...pending].reverse().find(item => item.attemptNumber === 1) || null;
    this.workout.attempt2 = [...pending].reverse().find(item => item.attemptNumber === 2) || null;
    const activeDayFocus = this.user.progress.activeDay?.day === day
      ? this.user.progress.activeDay.lastSuggestedFocus
      : '';
    this.workout.selectedFocus = this.workout.attempt2?.selectedFocus || activeDayFocus || '';
  },

  getResumeState(day) {
    const pending = this.pendingAttempts(day);
    const first = [...pending].reverse().find(item => item.attemptNumber === 1);
    const second = [...pending].reverse().find(item => item.attemptNumber === 2);
    if (first && second) return 'compare';
    if (first) return 'focus';
    return null;
  },

  resumeDay(day) {
    this.rebuildWorkout(day);
    if (this.workout.attempt2) return this.render('compare', { day }, true);
    if (this.workout.attempt1) return this.render('focus', { day }, true);
    this.render('lesson', { day }, true);
  },

  repeatCurrentDay(day) {
    this.rebuildWorkout(day);
    this.render('prepare', { day, attemptNumber: 1 }, true);
  },

  async submitOnboarding(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      goal: form.get('goal'),
      level: form.get('level'),
      dailyMinutes: Number(form.get('dailyMinutes')),
      aiConsent: true
    };
    this.renderLoading('Profil yaratilmoqda…', 'Progress 1-kundan boshlanadi.');
    try {
      const result = await Api.post('/api/onboarding', payload);
      this.user = result.user;
      this.scheduleDayRefresh();
      this.workout.day = 1;
      TelegramApp.haptic('success');
      this.closeLoading();
      this.render('home', {}, false);
    } catch (error) {
      this.closeLoading();
      this.toast(error.message, 'error');
    }
  },

  async switchDevUser(id) {
    Api.switchDevUser(id);
    this.history = [];
    this.workout = { day: null, selectedFocus: '', currentAttemptNumber: 1, currentRecording: null, attempt1: null, attempt2: null };
    await this.init();
  },

  async playLessonAudio(day) {
    const button = document.getElementById('ttsButton');
    const audio = document.getElementById('lessonAudio');
    if (!audio || !button) return;
    if (audio.src) {
      if (audio.paused) await audio.play(); else audio.pause();
      return;
    }
    button.disabled = true;
    button.textContent = 'Audio dars yaratilmoqda…';
    try {
      const blob = await Api.request(`/api/tts/day/${day}`, { method: 'POST' });
      if (this.ttsUrl) URL.revokeObjectURL(this.ttsUrl);
      this.ttsUrl = URL.createObjectURL(blob);
      audio.src = this.ttsUrl;
      audio.classList.remove('hidden');
      button.textContent = '▶ Audio darsni tinglash';
      await audio.play();
    } catch (error) {
      button.textContent = '▶ Audio darsni tinglash';
      this.toast(error.message, 'error');
    } finally {
      button.disabled = false;
    }
  },

  startWarmup() {
    clearInterval(this.warmupInterval);
    let remaining = 60;
    const timer = document.getElementById('warmupTimer');
    const button = document.getElementById('warmupButton');
    if (!timer || !button) return;
    button.disabled = true;
    this.warmupInterval = setInterval(() => {
      remaining -= 1;
      timer.textContent = AudioSpeechRecorder.formatTime(remaining);
      if (remaining <= 0) {
        clearInterval(this.warmupInterval);
        button.disabled = false;
        button.textContent = 'Tayyor ✓';
        TelegramApp.haptic('success');
      }
    }, 1000);
  },

  openRecorder(day, attemptNumber) {
    clearInterval(this.warmupInterval);
    this.ensureWorkout(day);
    this.workout.currentAttemptNumber = attemptNumber;
    this.workout.currentRecording = null;
    this.recorder?.cancel();
    this.liveTranscriber?.stop();
    this.recorder = new AudioSpeechRecorder();
    this.liveTranscriber = this.capabilities?.liveTranscriptionAvailable
      ? new GeminiLiveTranscriber({
          onTranscript: text => {
            const transcript = document.getElementById('liveTranscript');
            if (transcript) transcript.textContent = text;
          },
          onStatus: status => {
            const label = document.getElementById('liveStatus');
            if (!label) return;
            label.textContent = {
              connecting: 'Jonli transkripsiya ulanmoqda…',
              ready: 'Jonli transkripsiya faol',
              unavailable: 'Jonli matn vaqtincha ishlamadi; audio yozuv davom etadi'
            }[status] || '';
          }
        })
      : null;
    this.recorder.onPcm = bytes => this.liveTranscriber?.sendPcm(bytes);
    this.recorder.onTick = (seconds, formatted) => {
      const timer = document.getElementById('recordTimer');
      if (timer) timer.textContent = formatted;
    };
    this.recorder.onVolume = level => {
      document.querySelectorAll('#waveform i').forEach((bar, index) => {
        const variation = .45 + ((index * 7) % 9) / 12;
        bar.style.height = `${Math.max(8, Math.round(level * 48 * variation))}px`;
      });
    };
    this.recorder.onLimit = () => this.stopRecording();
    this.render('record', { day }, true);
  },

  async toggleRecording(maxSeconds) {
    if (this.recorder?.isRecording) return this.stopRecording();
    const button = document.getElementById('recordButton');
    const hint = document.getElementById('recordHint');
    try {
      await this.recorder.start({ maxSeconds });
      this.liveTranscriber?.start().catch(error => {
        console.warn('Jonli transkripsiya ishga tushmadi:', error.message);
        this.liveTranscriber?.onStatus?.('unavailable');
      });
      button?.classList.add('recording');
      if (button) { button.textContent = 'To‘xtatish'; button.setAttribute('aria-label', 'Yozishni to‘xtatish'); }
      if (hint) hint.textContent = 'Yozilmoqda… Fikrni oxirigacha ayting';
      TelegramApp.haptic('medium');
    } catch (error) {
      this.toast(error.message, 'error');
    }
  },

  async stopRecording() {
    if (!this.recorder?.isRecording) return;
    try {
      const result = await this.recorder.stop();
      this.liveTranscriber?.stop();
      const tempKey = `${this.user.id}:temp:${this.workout.day}:${this.workout.currentAttemptNumber}`;
      await AudioStore.put(tempKey, result.blob);
      this.workout.currentRecording = { ...result, tempKey };
      TelegramApp.haptic('success');
      this.render('review', { day: this.workout.day }, false);
    } catch (error) {
      this.toast(error.message, 'error');
    }
  },

  retryRecording() {
    const attemptNumber = this.workout.currentAttemptNumber;
    this.workout.currentRecording = null;
    this.openRecorder(this.workout.day, attemptNumber);
  },

  cancelRecording() {
    if (this.recorder?.isRecording) {
      return this.openDialog('Yozuvni bekor qilasizmi?', 'Hozirgi audio saqlanmaydi.', () => {
        this.recorder.cancel();
        this.liveTranscriber?.stop();
        this.render('prepare', { day: this.workout.day, attemptNumber: this.workout.currentAttemptNumber }, false);
      });
    }
    this.liveTranscriber?.stop();
    this.render('prepare', { day: this.workout.day, attemptNumber: this.workout.currentAttemptNumber }, false);
  },

  async analyzeCurrentRecording(event) {
    event.preventDefault();
    const recording = this.workout.currentRecording;
    if (!recording?.blob) return this.toast('Audio yozuv topilmadi.', 'error');
    const values = new FormData(event.currentTarget);
    const selfReview = {
      mainIdea: values.get('mainIdea') || '',
      bestPart: values.get('bestPart') || '',
      improvePart: values.get('improvePart') || ''
    };
    const payload = new FormData();
    payload.append('audio', recording.blob, `nutq-${this.workout.day}-${this.workout.currentAttemptNumber}.webm`);
    payload.append('day', String(this.workout.day));
    payload.append('attemptNumber', String(this.workout.currentAttemptNumber));
    payload.append('durationSeconds', String(recording.durationSeconds));
    payload.append('selectedFocus', this.workout.selectedFocus || '');
    payload.append('selfReview', JSON.stringify(selfReview));

    this.renderLoading('Gemini nutqni tahlil qilmoqda…', 'Transkripsiya, parazitlar, pauza va bugungi mezonlar tekshirilmoqda.');
    try {
      const result = await Api.postForm('/api/attempts/analyze', payload);
      const finalKey = `${this.user.id}:${result.attempt.id}`;
      await AudioStore.put(finalKey, recording.blob);
      await AudioStore.delete(recording.tempKey);
      result.attempt.audioKey = finalKey;
      result.attempt.audioUrl = recording.audioUrl;
      this.user = result.user;
      this.rebuildWorkout(this.workout.day);
      this.workout.currentAttemptNumber = result.attempt.attemptNumber;
      if (result.attempt.attemptNumber === 1) this.workout.attempt1 = result.attempt;
      else this.workout.attempt2 = result.attempt;
      this.closeLoading();
      TelegramApp.haptic('success');
      this.render('analysis', { day: this.workout.day, attempt: result.attempt }, false);
    } catch (error) {
      this.closeLoading();
      this.toast(error.message, 'error');
    }
  },

  openFocusSelection() { this.render('focus', { day: this.workout.day }, true); },

  startSecondAttempt(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const chosen = values.get('focus');
    const custom = String(values.get('customFocus') || '').trim();
    if (chosen === 'custom' && !custom) return this.toast('O‘z fokusingizni yozing.', 'warning');
    this.workout.selectedFocus = chosen === 'custom' ? custom : chosen;
    this.workout.currentAttemptNumber = 2;
    this.render('prepare', { day: this.workout.day, attemptNumber: 2 }, true);
  },

  openComparison() { this.render('compare', { day: this.workout.day }, true); },

  async completeCurrentDay(event) {
    event.preventDefault();
    if (!this.workout.attempt1 || !this.workout.attempt2) return this.toast('Ikki urinish ham kerak.', 'error');
    const values = new FormData(event.currentTarget);
    this.renderLoading('Mashq saqlanmoqda…', 'Kunlik oxirgi ball va o‘sish yangilanmoqda.');
    try {
      const result = await Api.post(`/api/days/${this.workout.day}/complete`, {
        attempt1Id: this.workout.attempt1.id,
        attempt2Id: this.workout.attempt2.id,
        selectedFocus: this.workout.selectedFocus,
        comparison: values.get('comparison'),
        reflection: values.get('reflection') || ''
      });
      this.user = result.user;
      this.scheduleDayRefresh();
      this.closeLoading();
      TelegramApp.haptic('success');
      this.render('completed', { day: result.completion.day, completion: result.completion }, false);
    } catch (error) {
      this.closeLoading();
      this.toast(error.message, 'error');
    }
  },

  confirmReset() {
    this.openDialog('Progress boshidan boshlansinmi?', 'Faqat shu profilning barcha natijalari va qurilmada saqlangan audiolari o‘chadi.', () => this.resetProgress());
  },

  async resetProgress() {
    this.closeDialog();
    this.renderLoading('Progress tozalanmoqda…', 'Faqat joriy profil o‘zgartiriladi.');
    try {
      const userId = this.user.id;
      const result = await Api.post('/api/progress/reset', {});
      await AudioStore.removeByUser(userId);
      this.user = result.user;
      this.scheduleDayRefresh();
      this.history = [];
      this.workout = { day: null, selectedFocus: '', currentAttemptNumber: 1, currentRecording: null, attempt1: null, attempt2: null };
      this.closeLoading();
      this.render('onboarding', {}, false);
    } catch (error) {
      this.closeLoading();
      this.toast(error.message, 'error');
    }
  },

  renderLoading(title, text) {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) return;
    document.getElementById('loadingTitle').textContent = title;
    document.getElementById('loadingText').textContent = text;
    overlay.classList.remove('hidden');
  },
  closeLoading() { document.getElementById('loadingOverlay')?.classList.add('hidden'); },

  openDialog(title, text, onConfirm) {
    document.getElementById('dialogTitle').textContent = title;
    document.getElementById('dialogText').textContent = text;
    const confirmButton = document.getElementById('dialogConfirm');
    confirmButton.onclick = () => { this.closeDialog(); onConfirm(); };
    document.getElementById('dialogOverlay').classList.remove('hidden');
  },
  closeDialog() { document.getElementById('dialogOverlay')?.classList.add('hidden'); },

  toast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const text = document.getElementById('toastText');
    if (!toast || !text) return;
    text.textContent = message;
    toast.style.background = type === 'error' ? '#991b1b' : type === 'warning' ? '#9a3412' : '#172033';
    toast.classList.remove('hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => toast.classList.add('hidden'), 4200);
    if (type === 'error' || type === 'warning') TelegramApp.haptic(type);
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') App.refreshDayState();
});
window.App = App;
