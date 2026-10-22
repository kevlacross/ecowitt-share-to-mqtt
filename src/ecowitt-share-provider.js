import { createHash } from "node:crypto";
import { sensorLabel } from "./sensor-labels.js";

/**
 * Adapter for Ecowitt dashboard share links.  This intentionally owns all
 * knowledge of the undocumented Web API; consumers receive only normalized
 * measurements.  Share tokens are bearer credentials and must never be logged.
 */
export class EcowittShareProvider {
  constructor({ fetchImpl = fetch, baseUrl = "https://www.ecowitt.net", timeoutMs = 15_000, savedStations = {}, saveStations = () => {}, savedActivity = {}, saveActivity = () => {} } = {}) {
    this.fetch = fetchImpl;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.timeoutMs = timeoutMs;
    this.stationLists = new Map(Object.entries(savedStations));
    this.pendingLists = new Map();
    this.saveStations = saveStations;
    this.activity = savedActivity;
    this.saveActivity = saveActivity;
  }

  parseShareUrl(value) {
    const url = new URL(value);
    if (url.hostname !== "www.ecowitt.net" || url.pathname !== "/home/share") {
      throw new Error("Expected an Ecowitt share URL (https://www.ecowitt.net/home/share?authorize=...)");
    }
    const authorize = url.searchParams.get("authorize");
    if (!authorize || !/^[A-Za-z0-9_-]{4,200}$/.test(authorize)) throw new Error("Share URL has no valid authorize token");
    return { authorize, deviceId: url.searchParams.get("device_id") || null };
  }

  shareKey(authorize) {
    return createHash("sha256").update(`${this.baseUrl}\0${authorize}`).digest("hex");
  }

  record(authorize, counter) {
    const key = this.shareKey(authorize);
    const value = this.activity[key] ||= { since: new Date().toISOString(), initializations: 0, measurementRequests: 0 };
    value[counter]++;
    // Count attempts before sending: a timeout may still consume an upstream opening.
    this.saveActivity(this.activity);
  }

  diagnostics(shareUrl) {
    try {
      const { authorize } = this.parseShareUrl(shareUrl);
      const key = this.shareKey(authorize);
      return { ...(this.activity[key] || { since: null, initializations: 0, measurementRequests: 0 }),
        selectionSaved: this.stationLists.has(key), remainingOpenings: null };
    } catch { return { since: null, initializations: 0, measurementRequests: 0, remainingOpenings: null }; }
  }

  async request(path, fields) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      this.record(fields.authorize, path === "index/get_device_list" ? "initializations" : "measurementRequests");
      const response = await this.fetch(`${this.baseUrl}/${path}`, {
        method: "POST",
        headers: { "Accept-EcowittLang": "en", "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(fields), signal: controller.signal
      });
      if (!response.ok) throw new Error(`Ecowitt HTTP ${response.status}`);
      const payload = await response.json();
      if (payload.error) throw new Error("Ecowitt share is unavailable; check its expiry and remaining openings");
      if (payload.errcode !== "0" && payload.errcode !== 0) throw new Error(`Ecowitt rejected share link: ${payload.errmsg || "unknown error"}`);
      return payload;
    } finally { clearTimeout(timer); }
  }

  // Like the Ecowitt page, resolve the share only once and keep its selected
  // stations. Do not expire or automatically rediscover a failing share: doing
  // so may spend another limited opening without fixing the actual problem.
  async stationsFor(authorize) {
    const key = this.shareKey(authorize);
    if (this.stationLists.has(key)) {
      const list = this.stationLists.get(key);
      if (!list.length) throw unavailableShare();
      return list;
    }
    if (this.pendingLists.has(key)) return this.pendingLists.get(key);
    const pending = (async () => {
      const result = await this.request("index/get_device_list", { authorize });
      const list = (result.list || []).map(({ device_id, share_id, name, type }) => ({ device_id, share_id, name, type }));
      this.stationLists.set(key, list);
      try { this.saveStations(Object.fromEntries(this.stationLists)); }
      catch (error) { this.stationLists.delete(key); throw error; }
      if (!list.length) throw unavailableShare();
      return list;
    })();
    this.pendingLists.set(key, pending);
    try { return await pending; } finally { this.pendingLists.delete(key); }
  }

  async listStations(shareUrl) {
    const { authorize } = this.parseShareUrl(shareUrl);
    const list = await this.stationsFor(authorize);
    return list.map(({ device_id, share_id, name, type }) => ({ deviceId: device_id, shareId: share_id, name, type }));
  }

  async fetchStation(shareUrl, explicitDeviceId = null, language = "de") {
    const { authorize, deviceId } = this.parseShareUrl(shareUrl);
    const stations = { list: await this.stationsFor(authorize) };
    const selected = (stations.list || []).find((entry) => entry.device_id === (explicitDeviceId || deviceId)) || (stations.list || [])[0];
    if (!selected) throw new Error("The share link exposes no weather station");
    const dashboard = await this.request("index/home", { authorize, device_id: selected.device_id });
    return { station: { id: selected.device_id, shareId: selected.share_id, name: selected.name, gatewayVersion: dashboard.version || null, utcOffsetSeconds: Number(dashboard.UTC_offset) || null }, measurements: normalizeDashboard(dashboard.data || {}, language) };
  }
}

function unavailableShare() {
  return Object.assign(new Error("The share link exposes no weather station; polling paused for this link. Check its expiry and remaining openings, then supply a new share link."), { retryable: false });
}

export function normalizeDashboard(groups, language = "de") {
  const measurements = [];
  for (const [groupKey, group] of Object.entries(groups)) {
    if (!group || typeof group !== "object" || !group.data || typeof group.data !== "object") continue;
    for (const [fieldKey, field] of Object.entries(group.data)) {
      if (!field || typeof field !== "object" || field.value === undefined || field.value === null || field.value === "--") continue;
      const raw = String(field.value).trim();
      const numeric = /^-?[0-9]+([.,][0-9]+)?$/.test(raw) ? Number(raw.replace(",", ".")) : null;
      measurements.push({
        stableId: `ecowitt:${groupKey}:${field.name || fieldKey}`,
        group: groupKey, key: field.name || fieldKey,
        name: sensorLabel(field.name || fieldKey, field.title_custom || field.title, language),
        unit: field.unit || null, value: numeric ?? raw, numeric: numeric !== null,
        observedText: field.time || null, metadata: { valueType: field.value_type || null, batteryType: field.batt_type || null }
      });
    }
  }
  return measurements;
}
