const labels = {
  tempf: { de: "Außentemperatur", en: "Outdoor temperature" },
  tempinf: { de: "Innentemperatur", en: "Indoor temperature" },
  humidity: { de: "Außenluftfeuchtigkeit", en: "Outdoor humidity" },
  humidityin: { de: "Innenluftfeuchtigkeit", en: "Indoor humidity" },
  baromabsin: { de: "Absoluter Luftdruck", en: "Absolute pressure" },
  baromabs: { de: "Absoluter Luftdruck", en: "Absolute pressure" },
  baromrelin: { de: "Relativer Luftdruck", en: "Relative pressure" },
  baromrel: { de: "Relativer Luftdruck", en: "Relative pressure" },
  baromabs_increment: { de: "Absoluter Luftdruck – Änderung", en: "Absolute pressure change" },
  baromrelin_increment: { de: "Relativer Luftdruck – Änderung", en: "Relative pressure change" },
  windspeed: { de: "Windgeschwindigkeit", en: "Wind speed" },
  windgust: { de: "Windböe", en: "Wind gust" },
  winddir: { de: "Windrichtung", en: "Wind direction" },
  rainrate: { de: "Regenrate", en: "Rain rate" },
  eventrain: { de: "Ereignisregen", en: "Event rain" },
  dailyrain: { de: "Tagesregen", en: "Daily rain" },
  weeklyrain: { de: "Wochenregen", en: "Weekly rain" },
  monthlyrain: { de: "Monatsregen", en: "Monthly rain" },
  yearlyrain: { de: "Jahresregen", en: "Yearly rain" },
  solarradiation: { de: "Solarstrahlung", en: "Solar radiation" },
  uv: { de: "UV-Index", en: "UV index" },
  uvi: { de: "UV-Index", en: "UV index" },
  dewpoint: { de: "Taupunkt", en: "Dew point" },
  feelslike: { de: "Gefühlte Temperatur", en: "Feels like" },
  windchill: { de: "Windchill", en: "Wind chill" },
  pm25: { de: "PM2.5", en: "PM2.5" },
  pm25_24h: { de: "PM2.5 (24 h)", en: "PM2.5 (24 h)" },
  co2: { de: "CO₂", en: "CO₂" },
  co2_24h: { de: "CO₂ (24 h)", en: "CO₂ (24 h)" },
  co2_24h_avg: { de: "CO₂ (24-h-Mittelwert)", en: "CO₂ (24 h average)" },
  battery: { de: "Batteriestatus", en: "Battery status" },
  wh65batt: { de: "Außensensor – Batterie", en: "Outdoor sensor battery" },
  wh40batt: { de: "Regenmesser – Batterie", en: "Rain gauge battery" },
  wh57batt: { de: "Blitzsensor – Batterie", en: "Lightning sensor battery" },
  wh68batt: { de: "Wind-/Außensensor – Batterie", en: "Wind/outdoor sensor battery" },
  wh25batt: { de: "Innenkonsole – Batterie", en: "Indoor console battery" }
};

const periodLabels = {
  daily: { de: "Tages", en: "Daily" }, weekly: { de: "Wochen", en: "Weekly" },
  monthly: { de: "Monats", en: "Monthly" }, yearly: { de: "Jahres", en: "Yearly" }
};

function fallback(fieldKey) {
  return String(fieldKey)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function sensorLabel(fieldKey, sourceTitle, language = "de") {
  const normalized = String(fieldKey).trim().toLowerCase().replace(/[\s-]+/g, "_");
  const range = normalized.match(/^(.+)_(daily|weekly|monthly|yearly)_(min|max)$/);
  if (range) {
    const base = sensorLabel(range[1], "", language);
    const period = periodLabels[range[2]]?.[language] || periodLabels[range[2]].en;
    const suffix = range[3] === "min" ? (language === "de" ? "minimum" : "minimum") : "maximum";
    return language === "de" ? `${base} – ${period}${suffix}` : `${base} – ${period} ${suffix}`;
  }
  const channel = normalized.match(/^(soilmoisture|soilbatt|leafwetness|leafbatt|temp|humidity|tf_batt)(\d+)$/);
  if (channel) {
    const number = channel[2];
    const channelLabels = {
      soilmoisture: { de: `Bodenfeuchte ${number}`, en: `Soil moisture ${number}` },
      soilbatt: { de: `Bodensensor ${number} – Batterie`, en: `Soil sensor ${number} battery` },
      leafwetness: { de: `Blattfeuchte ${number}`, en: `Leaf wetness ${number}` },
      leafbatt: { de: `Blattsensor ${number} – Batterie`, en: `Leaf sensor ${number} battery` },
      temp: { de: `Zusatztemperatur ${number}`, en: `Extra temperature ${number}` },
      humidity: { de: `Zusatzluftfeuchtigkeit ${number}`, en: `Extra humidity ${number}` },
      tf_batt: { de: `Zusatzsensor ${number} – Batterie`, en: `Extra sensor ${number} battery` }
    };
    return channelLabels[channel[1]][language] || channelLabels[channel[1]].en;
  }
  const translated = labels[normalized]?.[language] || labels[normalized]?.en;
  if (translated) return translated;
  const usableSourceTitle = String(sourceTitle || "").trim();
  if (usableSourceTitle && !/^(daily|weekly|monthly|yearly) (min|max)$/i.test(usableSourceTitle)) return usableSourceTitle;
  return fallback(fieldKey);
}
