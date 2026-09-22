const Api = {
  devUserId: localStorage.getItem('nutq30.devUserId') || 'dev-user-1',

  headers(extra = {}) {
    const headers = { ...extra };
    if (TelegramApp.initData) {
      headers['X-Telegram-Init-Data'] = TelegramApp.initData;
    } else {
      headers['X-Dev-User-Id'] = this.devUserId;
      headers['X-Dev-User-Name'] = this.devUserId === 'dev-user-2' ? 'Sherik' : 'Abdukhamid';
    }
    return headers;
  },

  async request(url, options = {}) {
    const headers = this.headers(options.headers || {});
    const response = await fetch(url, { ...options, headers });
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : await response.blob();
    if (!response.ok) {
      const error = new Error(data?.error || `Server xatosi: ${response.status}`);
      error.status = response.status;
      error.requestId = data?.requestId;
      throw error;
    }
    return data;
  },

  get(url) { return this.request(url); },
  post(url, body) {
    return this.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
  },
  postForm(url, formData) {
    return this.request(url, { method: 'POST', body: formData });
  },
  switchDevUser(id) {
    this.devUserId = id;
    localStorage.setItem('nutq30.devUserId', id);
  }
};

window.Api = Api;

