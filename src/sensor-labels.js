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
  windspeedmph: { de: "Windgeschwindigkeit", en: "Wind speed" },
  windgust: { de: "Windböe", en: "Wind gust" },
  windgustmph: { de: "Windböe", en: "Wind gust" },
  winddir: { de: "Windrichtung", en: "Wind direction" },
  rainrate: { de: "Regenrate", en: "Rain rate" },
  rainratein: { de: "Regenrate", en: "Rain rate" },
  eventrain: { de: "Ereignisregen", en: "Event rain" },
  eventrainin: { de: "Ereignisregen", en: "Event rain" },
  dailyrain: { de: "Tagesregen", en: "Daily rain" },
  dailyrainin: { de: "Tagesregen", en: "Daily rain" },
  hourlyrainin: { de: "Stundenregen", en: "Hourly rain" },
  last24hrainin: { de: "Regen (letzte 24 Stunden)", en: "Rain (last 24 hours)" },
  weeklyrain: { de: "Wochenregen", en: "Weekly rain" },
  weeklyrainin: { de: "Wochenregen", en: "Weekly rain" },
  monthlyrain: { de: "Monatsregen", en: "Monthly rain" },
  monthlyrainin: { de: "Monatsregen", en: "Monthly rain" },
  yearlyrain: { de: "Jahresregen", en: "Yearly rain" },
  yearlyrainin: { de: "Jahresregen", en: "Yearly rain" },
  solarradiation: { de: "Solarstrahlung", en: "Solar radiation" },
  uv: { de: "UV-Index", en: "UV index" },
  uvi: { de: "UV-Index", en: "UV index" },
  dewpoint: { de: "Taupunkt", en: "Dew point" },
  drew_temp: { de: "Taupunkt außen", en: "Outdoor dew point" },
  drew_tempin: { de: "Taupunkt innen", en: "Indoor dew point" },
  feelslike: { de: "Gefühlte Temperatur", en: "Feels like" },
  sendible_temp: { de: "Gefühlte Temperatur außen", en: "Outdoor feels like" },
  sendible_tempin: { de: "Gefühlte Temperatur innen", en: "Indoor feels like" },
  sunrise_time: { de: "Sonnenaufgang", en: "Sunrise" },
  sunset_time: { de: "Sonnenuntergang", en: "Sunset" },
  moon4: { de: "Vollmond", en: "Full moon" },
  vpd: { de: "Dampfdruckdefizit", en: "Vapor pressure deficit" },
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
  const prefixRange = normalized.match(/^(max|min)_(daily|weekly|monthly|yearly)_(.+)$/);
  if (prefixRange) {
    const base = sensorLabel(prefixRange[3], "", language);
    const period = periodLabels[prefixRange[2]]?.[language] || periodLabels[prefixRange[2]].en;
    const suffix = prefixRange[1] === "min" ? "minimum" : "maximum";
    return language === "de" ? `${base} – ${period}${suffix}` : `${base} – ${period} ${suffix}`;
  }
  const range = normalized.match(/^(.+)_(daily|weekly|monthly|yearly)_(min|max)$/);
  if (range) {
    const base = sensorLabel(range[1], "", language);
    const period = periodLabels[range[2]]?.[language] || periodLabels[range[2]].en;
    const suffix = range[3] === "min" ? (language === "de" ? "minimum" : "minimum") : "maximum";
    return language === "de" ? `${base} – ${period}${suffix}` : `${base} – ${period} ${suffix}`;
  }
  const increment = normalized.match(/^(.+)_increment$/);
  if (increment) {
    const base = sensorLabel(increment[1], "", language);
    return language === "de" ? `${base} – Änderung` : `${base} – change`;
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
