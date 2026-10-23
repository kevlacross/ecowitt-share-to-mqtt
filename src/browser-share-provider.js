import { EcowittShareProvider, normalizeDashboard } from './ecowitt-share-provider.js';

export function requestFields(request) {
  const body = request.postData() || '';
  const fields = new URLSearchParams(body);
  // Ecowitt's frontend currently submits FormData, not URL-encoded forms.
  for (const match of body.matchAll(/name="(authorize|device_id)"\r?\n(?:[^\r\n]+\r?\n)*\r?\n([^\r\n]*)/g)) fields.set(match[1], match[2]);
  return fields;
}

const stopped = message => Object.assign(new Error(message), { retryable: false });

/** One live page per share/device. Never polls the API or silently reloads a page. */
export class BrowserShareProvider extends EcowittShareProvider {
  constructor({ launchBrowser, startupTimeoutMs = 60_000, staleMs = 10 * 60_000, now = Date.now, onUpdate = () => {}, ...options } = {}) {
    super(options);
    this.launchBrowser = launchBrowser || (async () => {
      const { chromium } = await import('playwright');
      return chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
    });
    this.startupTimeoutMs = startupTimeoutMs;
    this.staleMs = staleMs;
    this.now = now;
    this.onUpdate = onUpdate;
    this.sessions = new Map();
    this.browserPromise = null;
    this.closing = false;
  }

  async request() { throw stopped('Direct HTTP polling is disabled in browser mode'); }

  sessionKey(authorize, deviceId) { return `${this.shareKey(authorize)}:${deviceId || ''}`; }

  async browser() {
    if (this.browserPromise) {
      const previous = await this.browserPromise.catch(() => null);
      if (!previous || previous.isConnected?.() === false) this.browserPromise = null;
    }
    if (!this.browserPromise) {
      this.browserPromise = this.launchBrowser().then(browser => {
        browser.on('disconnected', () => {
          if (!this.closing) for (const session of this.sessions.values()) this.fail(session, 'Browser disconnected; explicit reopening required');
        });
        return browser;
      }).catch(() => { throw stopped('Browser could not start; explicit reopening required'); });
    }
    return this.browserPromise;
  }

  fail(session, message) {
    session.error = stopped(message);
    session.status = 'paused';
    session.rejectFirst?.(session.error);
  }

  diagnostics(shareUrl) {
    const data = super.diagnostics(shareUrl);
    let authorize;
    try { ({ authorize } = this.parseShareUrl(shareUrl)); } catch { return { ...data, counterKind: 'browser_page_open_attempts', sessionStatus: 'invalid_link' }; }
    const sessions = [...this.sessions.values()].filter(s => s.authorize === authorize);
    return { ...data, counterKind: 'browser_page_open_attempts', sessionStatus: sessions[0]?.receivedAt && this.now() - Date.parse(sessions[0].receivedAt) > this.staleMs ? 'stale' : sessions[0]?.status || 'not_open', lastBrowserUpdate: sessions[0]?.receivedAt || null };
  }

  async open(shareUrl, explicitDeviceId) {
    const { authorize, deviceId } = this.parseShareUrl(shareUrl);
    const wanted = explicitDeviceId || deviceId;
    const key = this.sessionKey(authorize, wanted);
    if (this.sessions.has(key)) return this.sessions.get(key);
    const session = { authorize, wanted, key, status: 'opening', navigations: 0, latest: null, receivedAt: null, error: null, stations: [] };
    session.first = new Promise((resolve, reject) => { session.resolveFirst = resolve; session.rejectFirst = reject; });
    // Keep rejected initializations observed even when no caller is currently waiting.
    session.first.catch(() => {});
    this.sessions.set(key, session);
    session.start = this.start(session, shareUrl).catch(() => {
      if (!session.error) this.fail(session, 'Browser page could not open; explicit reopening required');
    });
    return session;
  }

  async start(session, shareUrl) {
    const browser = await this.browser();
    if (session.disposing) return;
    session.context = await browser.newContext({ locale: 'en-US', serviceWorkers: 'block' });
    if (session.disposing) { await session.context.close(); return; }
    const page = session.page = await session.context.newPage();
    page.on('crash', () => this.fail(session, 'Browser page crashed; explicit reopening required'));
    page.on('close', () => { if (!this.closing && !session.disposing) this.fail(session, 'Browser page closed; explicit reopening required'); });
    page.on('popup', popup => { popup.close().catch(() => {}); });
    await session.context.route('**/*', async route => {
      const request = route.request();
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
        if (session.navigations || !this.isShareDocument(request.url(), session.authorize)) {
          this.fail(session, 'Page attempted to reload or leave the share; navigation blocked to preserve openings');
          return route.abort();
        }
        // Persist before sending: an unsuccessful navigation can still consume an opening.
        this.record(session.authorize, 'initializations');
        session.navigations++;
      }
      const url = new URL(request.url());
      if (url.origin === this.baseUrl && url.pathname === '/index/home') this.record(session.authorize, 'measurementRequests');
      return route.continue();
    });
    page.on('response', response => this.accept(session, response).catch(() => {
      this.fail(session, 'Could not decode the page measurement response; page kept open');
    }));
    const url = new URL(shareUrl);
    if (session.wanted) url.searchParams.set('device_id', session.wanted);
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: this.startupTimeoutMs });
  }

  isShareDocument(value, authorize) {
    try { const url = new URL(value); return url.origin === this.baseUrl && url.pathname === '/home/share' && url.searchParams.get('authorize') === authorize; }
    catch { return false; }
  }

  async accept(session, response) {
    const url = new URL(response.url());
    if (url.origin !== this.baseUrl || !['/index/get_device_list', '/index/home'].includes(url.pathname)) return;
    const request = response.request();
    const fields = requestFields(request);
    if (fields.get('authorize') !== session.authorize) return;
    if (session.error) return;
    if (!response.ok()) { session.status = 'waiting'; return; }
    const payload = await response.json();
    if (payload.error || (payload.errcode !== 0 && payload.errcode !== '0')) {
      this.fail(session, 'Ecowitt rejected the open share; page kept open without automatic reload');
      return;
    }
    if (url.pathname === '/index/get_device_list') {
      session.stations = payload.list || [];
      if (!session.stations.length) this.fail(session, 'Share exposes no station; page kept open without automatic reload');
      return;
    }
    const deviceId = fields.get('device_id');
    if (session.wanted && deviceId !== session.wanted) return;
    if (!payload.data || typeof payload.data !== 'object') return;
    session.latest = { payload, deviceId };
    session.receivedAt = new Date(this.now()).toISOString();
    session.status = 'live';
    session.resolveFirst(session.latest);
    this.onUpdate(session.authorize);
  }

  async fetchStation(shareUrl, explicitDeviceId = null, language = 'de') {
    const session = await this.open(shareUrl, explicitDeviceId);
    if (session.error) throw session.error;
    if (!session.latest) {
      let timer;
      try {
        await Promise.race([session.first, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Waiting for measurements in the open browser page; no reload attempted')), this.startupTimeoutMs); })]);
      } finally { clearTimeout(timer); }
    }
    if (session.error) throw session.error;
    if (this.now() - Date.parse(session.receivedAt) > this.staleMs) throw new Error('Open browser page has not delivered fresh measurements; no reload attempted');
    const { payload, deviceId } = session.latest;
    const selected = session.stations.find(s => s.device_id === deviceId);
    return { station: { id: deviceId, shareId: selected?.share_id || null, name: selected?.name || '', gatewayVersion: payload.version || null, utcOffsetSeconds: Number(payload.UTC_offset) || null }, measurements: normalizeDashboard(payload.data, language), receivedAt: session.receivedAt };
  }

  async release(shareUrl, explicitDeviceId = null) {
    const { authorize, deviceId } = this.parseShareUrl(shareUrl);
    const key = this.sessionKey(authorize, explicitDeviceId || deviceId);
    const session = this.sessions.get(key);
    if (!session) return;
    session.disposing = true;
    this.fail(session, 'Browser session closed');
    await session.context?.close();
    this.sessions.delete(key);
  }

  async close() {
    this.closing = true;
    for (const session of this.sessions.values()) this.fail(session, 'Shutting down');
    if (this.browserPromise) await (await this.browserPromise.catch(() => null))?.close();
  }
}
