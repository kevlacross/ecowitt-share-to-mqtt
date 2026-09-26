# Changelog

All notable changes use [Semantic Versioning](https://semver.org/).

## 0.1.2 - 2026-09-26

- Added Home Assistant-native MQTT Discovery metadata for recognised weather measurements.
- Normalized units and marked diagnostic battery/signal entities appropriately.

## 0.1.1 - 2026-09-26

- Localized generated sensor names in German and English, selectable in the WebUI.
- Added meaningful names for live shared-station measurements, including pressure, rain, min/max values, wind, solar data, sunrise/sunset and battery status.
- Kept MQTT topics and Home Assistant `unique_id` values stable while improving display names.

## 0.1.0 - 2026-09-26

- Initial private-test release.
- Ecowitt shared-link provider with dynamic sensor discovery.
- MQTT state publishing and Home Assistant MQTT Discovery.
- Persistent SQLite configuration, local WebUI and Unraid template.
