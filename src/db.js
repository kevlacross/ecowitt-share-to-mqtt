import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

export function openDatabase(file = process.env.CONFIG_DB || "/config/ecowitt-share-to-mqtt.sqlite") {
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS stations (id TEXT PRIMARY KEY, name TEXT NOT NULL, share_url TEXT NOT NULL, device_id TEXT, enabled INTEGER NOT NULL DEFAULT 1, interval_seconds INTEGER NOT NULL DEFAULT 60, last_success TEXT, last_error TEXT, last_duration_ms INTEGER, sensor_count INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS sensors (station_id TEXT NOT NULL, stable_id TEXT NOT NULL, name TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, custom_name TEXT, unit TEXT, value TEXT, updated_at TEXT, PRIMARY KEY(station_id, stable_id), FOREIGN KEY(station_id) REFERENCES stations(id) ON DELETE CASCADE);`);
  const json = (value) => JSON.stringify(value);
  return {
    getSetting(key, fallback = null) { const row = db.prepare("SELECT value FROM settings WHERE key=?").get(key); return row ? JSON.parse(row.value) : fallback; },
    setSetting(key, value) { db.prepare("INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key, json(value)); },
    stations() { return db.prepare("SELECT id,name,device_id AS deviceId,enabled,interval_seconds AS intervalSeconds,last_success AS lastSuccess,last_error AS lastError,last_duration_ms AS lastDurationMs,sensor_count AS sensorCount FROM stations ORDER BY name").all().map(x => ({...x, enabled: !!x.enabled})); },
    station(id) { return db.prepare("SELECT * FROM stations WHERE id=?").get(id); },
    saveStation(input) { const id = input.id || randomUUID(), shareUrl=input.shareUrl||input.share_url, deviceId=input.deviceId||input.device_id||null, interval=input.intervalSeconds||input.interval_seconds; db.prepare(`INSERT INTO stations(id,name,share_url,device_id,enabled,interval_seconds) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,share_url=excluded.share_url,device_id=excluded.device_id,enabled=excluded.enabled,interval_seconds=excluded.interval_seconds`).run(id,input.name,shareUrl,deviceId,input.enabled!==false?1:0,Math.max(30,Number(interval)||60)); return id; },
    deleteStation(id) { db.prepare("DELETE FROM stations WHERE id=?").run(id); },
    updateResult(id, { error=null, durationMs=null, count=null }) { db.prepare("UPDATE stations SET last_success=CASE WHEN ? IS NULL THEN ? ELSE last_success END,last_error=?,last_duration_ms=?,sensor_count=COALESCE(?,sensor_count) WHERE id=?").run(error, new Date().toISOString(), error, durationMs, count, id); },
    upsertSensors(stationId, values) { const stmt = db.prepare("INSERT INTO sensors(station_id,stable_id,name,unit,value,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(station_id,stable_id) DO UPDATE SET name=excluded.name,unit=excluded.unit,value=excluded.value,updated_at=excluded.updated_at"); for (const s of values) stmt.run(stationId,s.stableId,s.name,s.unit, String(s.value),new Date().toISOString()); },
    sensors(id) { return db.prepare("SELECT stable_id AS stableId,name,enabled,custom_name AS customName,unit,value,updated_at AS updatedAt FROM sensors WHERE station_id=? ORDER BY name").all(id).map(x=>({...x,enabled:!!x.enabled})); },
    setSensor(stationId, stableId, patch) { db.prepare("UPDATE sensors SET enabled=?, custom_name=? WHERE station_id=? AND stable_id=?").run(patch.enabled!==false?1:0,patch.customName||null,stationId,stableId); },
    close() { db.close(); }
  };
}
