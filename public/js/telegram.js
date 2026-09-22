const TelegramApp = {
  webApp: window.Telegram?.WebApp || null,
  get isAvailable() { return Boolean(this.webApp?.initData); },
  get initData() { return this.webApp?.initData || ''; },
  get unsafeUser() { return this.webApp?.initDataUnsafe?.user || null; },

  init() {
    if (!this.webApp) return;
    try {
      this.webApp.ready();
      this.webApp.expand();
      this.webApp.setHeaderColor('secondary_bg_color');
      this.webApp.setBackgroundColor('bg_color');
      this.webApp.enableClosingConfirmation?.();
      this.applyTheme();
      this.webApp.onEvent?.('themeChanged', () => this.applyTheme());
      this.webApp.BackButton?.onClick(() => window.App?.goBack());
    } catch (error) {
      console.warn('Telegram Mini App ishga tushirish xatosi:', error);
    }
  },

  applyTheme() {
    const dark = this.webApp?.colorScheme === 'dark';
    document.documentElement.classList.toggle('dark', dark);
    document.body?.classList.toggle('dark', dark);
  },

  showBackButton(show) {
    try {
      if (!this.webApp?.BackButton) return;
      if (show) this.webApp.BackButton.show();
      else this.webApp.BackButton.hide();
    } catch {}
  },

  haptic(type = 'light') {
    try {
      if (!this.webApp?.HapticFeedback) return;
      if (type === 'success' || type === 'error' || type === 'warning') {
        this.webApp.HapticFeedback.notificationOccurred(type);
      } else {
        this.webApp.HapticFeedback.impactOccurred(type);
      }
    } catch {}
  }
};

TelegramApp.init();
window.TelegramApp = TelegramApp;

