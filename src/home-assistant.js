const units = new Map([
  ["℃", "°C"], ["º", "°"], ["mm/hr", "mm/h"], ["mm/h", "mm/h"],
  ["km/hr", "km/h"], ["W/m2", "W/m²"]
]);

const accumulatedRain = /(?:eventrain|dailyrain|weeklyrain|monthlyrain|yearlyrain|hourlyrain|last24hrain)/;
const temperature = /(?:^tempf$|^tempinf$|^drew_temp|^sendible_temp|windchill)/;
const humidity = /humidity/;

export function normalizedUnit(unit) {
  return units.get(String(unit || "").trim()) || unit || undefined;
}

export function homeAssistantMetadata(sensor) {
  const key = String(sensor.stableId || "").split(":").at(-1).toLowerCase();
  const unit = normalizedUnit(sensor.unit);
  const numeric = Number.isFinite(Number(sensor.value));
  const result = { unit_of_measurement: unit };
  if (/batt|signal|rssi/.test(key)) return { ...result, entity_category: "diagnostic" };
  if (!numeric) return result;

  if (/barom/.test(key) && !/increment/.test(key)) return { ...result, device_class: "atmospheric_pressure", state_class: "measurement" };
  if (temperature.test(key) && !/increment/.test(key)) return { ...result, device_class: "temperature", state_class: "measurement" };
  if (humidity.test(key)) return { ...result, device_class: "humidity", state_class: "measurement" };
  if (accumulatedRain.test(key)) return { ...result, device_class: "precipitation", state_class: "total" };
  if (/rainrate/.test(key)) return { ...result, device_class: "precipitation_intensity", state_class: "measurement" };
  if (/^windspeed|^windgust/.test(key)) return { ...result, device_class: "wind_speed", state_class: "measurement" };
  if (/^winddir/.test(key)) return { ...result, device_class: "wind_direction", state_class: "measurement" };
  if (/solarradiation/.test(key)) return { ...result, device_class: "irradiance", state_class: "measurement" };
  if (/^(uv|uvi)$/.test(key)) return { ...result, device_class: "uv_index", state_class: "measurement" };
  if (/^pm25/.test(key)) return { ...result, device_class: "pm25", state_class: "measurement" };
  if (/^co2/.test(key)) return { ...result, device_class: "carbon_dioxide", state_class: "measurement" };
  return { ...result, state_class: "measurement" };
}
