/** Coalesce manual/scheduled syncs and back off failures without reopening shares. */
export class SyncGate {
  constructor({ now = Date.now, retryMs = 60_000, maxRetryMs = 30 * 60_000 } = {}) {
    this.now = now;
    this.retryMs = retryMs;
    this.maxRetryMs = maxRetryMs;
    this.pending = new Map();
    this.failures = new Map();
  }
  reset(id) { this.failures.delete(id); }
  ready(id) { return !this.pending.has(id) && this.now() >= (this.failures.get(id)?.until || 0); }
  run(id, operation) {
    if (this.pending.has(id)) return this.pending.get(id);
    if (!this.ready(id)) return Promise.reject(new Error("Sync paused after an error; waiting before retrying Ecowitt"));
    const pending = Promise.resolve().then(operation).then(result => {
      this.failures.delete(id);
      return result;
    }, error => {
      const count = Math.min((this.failures.get(id)?.count || 0) + 1, 20);
      this.failures.set(id, { count, until: error.retryable === false ? Infinity : this.now() + Math.min(this.retryMs * 2 ** (count - 1), this.maxRetryMs) });
      throw error;
    }).finally(() => this.pending.delete(id));
    this.pending.set(id, pending);
    return pending;
  }
}
