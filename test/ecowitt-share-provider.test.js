import test from "node:test";
import assert from "node:assert/strict";
import { EcowittShareProvider, normalizeDashboard } from "../src/ecowitt-share-provider.js";
import { sensorLabel } from "../src/sensor-labels.js";

test("parses share link without leaking its token", () => {
  const provider = new EcowittShareProvider();
  assert.deepEqual(provider.parseShareUrl("https://www.ecowitt.net/home/share?authorize=ABC123&device_id=device"), { authorize: "ABC123", deviceId: "device" });
  assert.throws(() => provider.parseShareUrl("https://example.test/home/share?authorize=ABC123"));
});

test("uses localized, meaningful labels while retaining stable IDs", () => {
  assert.equal(sensorLabel("baromabs_increment", "Absolute", "de"), "Absoluter Luftdruck – Änderung");
  assert.equal(sensorLabel("dailyrain", "Daily", "en"), "Daily rain");
  assert.equal(sensorLabel("baromabsin_daily_max", "Daily max", "de"), "Absoluter Luftdruck – Tagesmaximum");
  assert.equal(sensorLabel("max_daily_tempf", "Daily max", "de"), "Außentemperatur – Tagesmaximum");
  assert.equal(sensorLabel("dailyrainin", "Daily", "de"), "Tagesregen");
  assert.equal(sensorLabel("baromabsin_increment", "Absolute", "de"), "Absoluter Luftdruck – Änderung");
  assert.equal(sensorLabel("soilmoisture2", "", "de"), "Bodenfeuchte 2");
  const value = normalizeDashboard({ rain: { data: { dailyrain: { name: "dailyrain", title: "Daily", value: "0", unit: "mm" } } } }, "de")[0];
  assert.equal(value.name, "Tagesregen");
  assert.equal(value.stableId, "ecowitt:rain:dailyrain");
});

test("normalizes dynamic groups, decimal commas and non-numeric battery state", () => {
  const values = normalizeDashboard({ outdoor: { data: { tempf: { name: "tempf", title_custom: "Temperature", value: "19,7", unit: "°C", time: "now" } } }, batt: { data: { wh65batt: { value: "Normal", unit: "", batt_type: "Normal" } } } });
  assert.equal(values[0].value, 19.7);
  assert.equal(values[0].stableId, "ecowitt:outdoor:tempf");
  assert.equal(values[1].value, "Normal");
});
