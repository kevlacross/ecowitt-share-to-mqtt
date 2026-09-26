/**
 * Adapter for Ecowitt dashboard share links.  This intentionally owns all
 * knowledge of the undocumented Web API; consumers receive only normalized
 * measurements.  Share tokens are bearer credentials and must never be logged.
 */
export class EcowittShareProvider {
  constructor({ fetchImpl = fetch, baseUrl = "https://www.ecowitt.net", timeoutMs = 15_000 } = {}) {
    this.fetch = fetchImpl;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.timeoutMs = timeoutMs;
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

  async request(path, fields) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetch(`${this.baseUrl}/${path}`, {
        method: "POST",
        headers: { "Accept-EcowittLang": "en", "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(fields), signal: controller.signal
      });
      if (!response.ok) throw new Error(`Ecowitt HTTP ${response.status}`);
      const payload = await response.json();
      if (payload.errcode !== "0" && payload.errcode !== 0) throw new Error(`Ecowitt rejected share link: ${payload.errmsg || "unknown error"}`);
      return payload;
    } finally { clearTimeout(timer); }
  }

  async listStations(shareUrl) {
    const { authorize } = this.parseShareUrl(shareUrl);
    const result = await this.request("index/get_device_list", { authorize });
    return (result.list || []).map(({ device_id, share_id, name, type }) => ({ deviceId: device_id, shareId: share_id, name, type }));
  }

  async fetchStation(shareUrl, explicitDeviceId = null) {
    const { authorize, deviceId } = this.parseShareUrl(shareUrl);
    const stations = await this.request("index/get_device_list", { authorize });
    const selected = (stations.list || []).find((entry) => entry.device_id === (explicitDeviceId || deviceId)) || (stations.list || [])[0];
    if (!selected) throw new Error("The share link exposes no weather station");
    const dashboard = await this.request("index/home", { authorize, device_id: selected.device_id });
    return { station: { id: selected.device_id, shareId: selected.share_id, name: selected.name, gatewayVersion: dashboard.version || null, utcOffsetSeconds: Number(dashboard.UTC_offset) || null }, measurements: normalizeDashboard(dashboard.data || {}) };
  }
}

export function normalizeDashboard(groups) {
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
        name: field.title_custom || field.title || field.name || fieldKey,
        unit: field.unit || null, value: numeric ?? raw, numeric: numeric !== null,
        observedText: field.time || null, metadata: { valueType: field.value_type || null, batteryType: field.batt_type || null }
      });
    }
  }
  return measurements;
}
