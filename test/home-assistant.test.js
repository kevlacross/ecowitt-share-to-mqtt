import test from "node:test";
import assert from "node:assert/strict";
import { homeAssistantMetadata, normalizedUnit } from "../src/home-assistant.js";

const sensor = (key, unit, value = "1") => ({ stableId: `ecowitt:test:${key}`, unit, value });

test("maps weather values to Home Assistant device and state classes", () => {
  assert.deepEqual(homeAssistantMetadata(sensor("baromrelin", "hPa")), { unit_of_measurement: "hPa", device_class: "atmospheric_pressure", state_class: "measurement" });
  assert.deepEqual(homeAssistantMetadata(sensor("tempf", "℃")), { unit_of_measurement: "°C", device_class: "temperature", state_class: "measurement" });
  assert.deepEqual(homeAssistantMetadata(sensor("dailyrainin", "mm")), { unit_of_measurement: "mm", device_class: "precipitation", state_class: "total" });
  assert.deepEqual(homeAssistantMetadata(sensor("rainratein", "mm/hr")), { unit_of_measurement: "mm/h", device_class: "precipitation_intensity", state_class: "measurement" });
  assert.deepEqual(homeAssistantMetadata(sensor("windgustmph", "km/h")), { unit_of_measurement: "km/h", device_class: "wind_speed", state_class: "measurement" });
});

test("leaves status values diagnostic rather than inventing a numeric class", () => {
  assert.deepEqual(homeAssistantMetadata(sensor("wh65batt", null, "Normal")), { unit_of_measurement: undefined, entity_category: "diagnostic" });
  assert.equal(normalizedUnit("º"), "°");
});
