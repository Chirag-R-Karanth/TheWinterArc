# Winter Arc — Android companion

Kotlin, native. Reads Health Connect, queues locally in SQLite, posts hourly to
the Go backend over Tailscale with a long-lived API key.

## Prereqs

- Android Studio (Koala+) with SDK 35.
- Health Connect app installed on the device
  (`com.google.android.apps.healthdata`).
- Backend reachable over Tailscale; server URL + API key entered in the app.

## Build

```bash
# from this directory
./gradlew assembleDebug
```

Open the project in Android Studio and press Run. The first sync requires the
Health Connect permission grant button on the status screen.

## Behavior contract

- Health Connect reads are backfilled from `Prefs.lastSyncMs`, so desktop
  downtime loses nothing.
- Records are written to `pending.db` before any network call.
- A queue entry is deleted only after the backend returns HTTP 200 for it.
- Sync runs hourly via WorkManager; failures reschedule (WorkManager backs off
  automatically).
- Points of note: `usesCleartextTraffic` is enabled for plain-HTTP Tailscale
  dev; switch the server URL to https:// when TLS is in front.