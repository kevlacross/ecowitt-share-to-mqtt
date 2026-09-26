# Ecowitt-share_to_MQTT

> **Development status: local test build.** A live public shared station has passed the POC. Test with your own share link and broker before any publication.

## Verified access method

The official Ecowitt Cloud API v3 requires an application key, user API key and gateway MAC/IMEI; it is not suitable as the primary path for a station merely shared with another account. A share link is a bearer capability and does not expose those credentials.

The current Ecowitt share dashboard uses two structured, form-encoded JSON calls:

1. `POST https://www.ecowitt.net/index/get_device_list` with `authorize=<share-token>` lists every station exposed by a share.
2. `POST https://www.ecowitt.net/index/home` with `authorize=<share-token>&device_id=<id>` returns the live dashboard data.

The provider in `src/ecowitt-share-provider.js` isolates this undocumented endpoint. It converts the dynamically returned sensor groups to a stable normalized model and never uses DOM/CSS scraping.

## Run the POC

Node.js 22 or newer is required.

```powershell
$env:ECOWITT_SHARE_URL = 'https://www.ecowitt.net/home/share?authorize=...'
node src/poc.js
```

For a multi-station share, optionally set `ECOWITT_DEVICE_ID` to select one station. The output intentionally contains data values but never echoes the share token.

```powershell
npm test
```

## Phase gate

The local app includes a SQLite database under `/config`, individual per-station intervals (minimum 30 seconds), MQTT reconnect, last-will availability and Home Assistant MQTT Discovery. Each discovered sensor has a stable ID based on the Ecowitt field and station UUID; changing its visible name or base topic does not change its Home Assistant `unique_id`.

## Docker / Unraid

For a local build:

```powershell
docker compose up --build -d
```

Open `http://UNRAID-IP:8080`, enter MQTT settings, test the connection, add a share URL and press **Jetzt synchronisieren**. Select sensors after the first sync. Only selected sensors are published and discovered.

For Unraid, use `templates/ecowitt-share-to-mqtt.xml` with the GHCR image after the first release is published. Map `/config` to `/mnt/user/appdata/Ecowitt-share_to_MQTT`; do not use privileged mode.

## Operations

- Logs: `docker logs Ecowitt-share_to_MQTT`
- Backup: stop the container and copy `/config/ecowitt-share-to-mqtt.sqlite`.
- Updates: back up `/config`, pull/build the new image, then start it again.
- If a share is revoked or expires, create a replacement in Ecowitt and update the station. The error is shown per station; other stations continue syncing.

## Releases and Community Applications

Releases follow Semantic Versioning. A GitHub tag such as `v0.1.0` builds multi-architecture images for GHCR through GitHub Actions. The Community Applications submission files are `ca_profile.xml`, `icon.svg`, and `templates/ecowitt-share-to-mqtt.xml`. Run the CA portal validation before submitting the application.

## Security

A share URL acts like a read-only bearer credential. Do not commit it, paste it into logs, or include it in screenshots. Rotate/revoke it in Ecowitt if exposed.
