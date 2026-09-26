# Ecowitt Share to MQTT

[![CI](https://github.com/kevlacross/ecowitt-share-to-mqtt/actions/workflows/ci.yml/badge.svg)](https://github.com/kevlacross/ecowitt-share-to-mqtt/actions/workflows/ci.yml)
[![Container image](https://img.shields.io/badge/GHCR-Container-2496ED?logo=docker&logoColor=white)](https://github.com/kevlacross/ecowitt-share-to-mqtt/pkgs/container/ecowitt-share-to-mqtt)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Bring an **Ecowitt station shared with you** into Home Assistant automatically — even when you do not own the gateway. This lightweight, self-hosted bridge reads the shared station dashboard, publishes the measurements to MQTT, and creates Home Assistant entities through MQTT Discovery.

Designed for Unraid, but equally happy with Docker Compose on any amd64 or arm64 host.

## What it does

```text
Ecowitt shared station  →  Ecowitt Share to MQTT  →  MQTT broker  →  Home Assistant
```

- Supports one or many shared stations, each with its own sync interval.
- Detects the measurements actually supplied by Ecowitt; no fixed sensor list is required.
- Lets you enable, disable and rename individual sensors before publishing.
- Uses meaningful German or English default names for recognised Ecowitt fields; your own sensor names always take priority.
- Creates one Home Assistant device per weather station with clean names, units and availability.
- Stores configuration and discovered sensors in SQLite under `/config`.
- Provides a small local web UI for stations, MQTT, monitoring and manual sync.
- Keeps one failed or offline station from interrupting the others.

## Quick start on Unraid

1. Install the container image `ghcr.io/kevlacross/ecowitt-share-to-mqtt:0.1.1` with the included Unraid template: [`templates/ecowitt-share-to-mqtt.xml`](templates/ecowitt-share-to-mqtt.xml).
2. Map `/config` to a persistent path, for example `/mnt/user/appdata/Ecowitt-share_to_MQTT/config`.
3. Map container port `8080` to an available host port, for example `8081`.
4. Open `http://UNRAID-IP:8081`.
5. Enter the MQTT broker details and use **Verbindung testen**.
6. Add an Ecowitt share URL, run **Station jetzt synchronisieren**, then select the discovered sensors.
7. Select **Deutsch** or **English** for the generated sensor names and synchronize once more. This never changes Home Assistant IDs or your own names.

Home Assistant will add the device and selected entities automatically when MQTT Discovery is enabled. The container does not need privileged mode or host networking.

## Docker Compose

Create a local `config` directory next to the compose file, then run:

```bash
docker compose up -d
```

For development from source, use `docker compose up --build -d`. Open `http://localhost:8080` afterwards.

```yaml
services:
  ecowitt-share-to-mqtt:
    image: ghcr.io/kevlacross/ecowitt-share-to-mqtt:0.1.1
    container_name: Ecowitt-share_to_MQTT
    ports:
      - "8080:8080"
    volumes:
      - ./config:/config
    restart: unless-stopped
```

## Home Assistant

Enable the built-in MQTT integration and leave MQTT Discovery enabled. By default, discovery is published below `homeassistant` and states below `ecowitt_share`.

Each station becomes its own device. Renaming a station, a sensor or the MQTT base topic does **not** change the Home Assistant `unique_id`, so existing dashboards and automations remain intact. Deleting a station removes its retained discovery entries. The selectable sensor language changes only automatically generated display names after the next sync; custom names always take priority.

Common measurements include temperature, humidity, pressure, wind, rain, UV, solar radiation, air quality, soil/leaf sensors, battery levels and signal strength. The actual entity list depends entirely on the station and sensors shared with you.

## Ecowitt shared-station access

Ecowitt's documented Cloud API requires the owner's gateway and API credentials, which normally are not available for a station shared with another user. This project therefore uses the same structured JSON requests as Ecowitt's shared-station dashboard:

1. A shared URL supplies a read-only share authorization and station identifier.
2. The isolated `EcowittShareProvider` requests structured station/dashboard data.
3. The provider converts Ecowitt's dynamic response into a normalized sensor model for the UI and MQTT layer.

No DOM or CSS scraping is used. Because this is an undocumented dashboard interface, it is deliberately kept in one provider adapter (`src/ecowitt-share-provider.js`) so it can be updated independently if Ecowitt changes it.

## Operations and reliability

| Topic | Behaviour |
| --- | --- |
| Sync interval | Per station; minimum 30 seconds, with custom intervals supported. |
| Resilience | HTTP timeouts, invalid-response handling and per-station error isolation. |
| MQTT | Connection test in the UI, automatic reconnect, last-will availability and clear status/error reporting. |
| Monitoring | Last successful sync, duration, sensor count, last error and last MQTT publication are shown in the UI. |
| Backup | Stop the container and copy `/config/ecowitt-share-to-mqtt.sqlite`. |
| Update | Back up `/config`, pull the new image, then restart. Existing configuration remains in `/config`. |

Useful commands:

```bash
docker logs Ecowitt-share_to_MQTT
docker pull ghcr.io/kevlacross/ecowitt-share-to-mqtt:0.1.1
```

If a share is revoked or expires, create a new share in Ecowitt and update that station; the other stations continue syncing.

## Security and privacy

A share URL is a read-only bearer credential. Treat it like a password:

- Never commit it, post it in an issue or include it in screenshots.
- The application masks secrets in the UI and never writes passwords, MQTT credentials or share tokens to logs.
- Keep the web UI on your trusted local network or protect it with your own reverse proxy/access control.
- Revoke and recreate the Ecowitt share immediately if it is exposed.

There is no telemetry and no external service dependency beyond Ecowitt and the MQTT broker you configure.

## Development

Node.js 22 or newer is required.

```powershell
npm test
$env:ECOWITT_SHARE_URL = 'https://www.ecowitt.net/home/share?authorize=...'
node src/poc.js
```

The POC prints structured measurements but intentionally does not echo the share token. Set `ECOWITT_DEVICE_ID` when a shared URL exposes more than one station.

## Releases and Unraid Community Applications

Releases use [Semantic Versioning](https://semver.org/). Pushing a tag such as `v0.1.0` builds and publishes amd64 and arm64 images to GitHub Container Registry through GitHub Actions.

The repository already contains the material needed for a future Community Applications submission: `ca_profile.xml`, `icon.svg` and the Unraid Docker template. Community Applications submission remains a separate step after ongoing real-world validation.

## License

Released under the [MIT License](LICENSE).
