# Archive Health Connect via the existing companion and USB

Run this on the desktop with Python 3 and Android Platform Tools (`adb`). Use the existing **Winter Arc** companion compatible with `origin/main` and a phone with Health Connect data. The companion reads Health Connect on the phone and pushes to the desktop; `adb` only forwards the HTTP connection.

1. On the desktop, from the directory containing `healthconnect_receiver.py`:

   ```sh
   python -c 'import secrets; print(secrets.token_hex(32))'
   python healthconnect_receiver.py --port 8765
   ```

   Generate the key once in a private terminal, keep it in a password manager, and use it at the hidden prompt each time you start the receiver. Keep the receiver running. Use a dedicated key, not your existing backend key.

2. Enable USB debugging on the phone, connect it by USB, unlock it and approve the desktop's debugging prompt. In another terminal:

   ```sh
   adb devices -l
   adb -d reverse tcp:8765 tcp:8765
   adb -d reverse --list
   ```

   The device should show as `device`, not `unauthorized` or `offline`. `-d` selects the single USB device; if multiple are attached, replace `-d` with `-s SERIAL` in the reverse commands. Recreate the mapping after reconnecting if it is gone.

3. Open **Winter Arc** on the phone. Tap **Grant Health Connect access** and grant the available steps, heart-rate and sleep read permissions. Set **Server URL** to `http://127.0.0.1:8765` and **API key** to the same generated key. Tap **Save & sync now**. This saves the destination and enqueues immediate Android work; the button does not wait for upload. Keep the phone connected and the receiver running while it works. Reopening the activity refreshes the last-sync and queue display.

4. Verify arrival by comparing the number of archived payloads before and after syncing (requires the `sqlite3` command-line tool; run on the desktop):

   ```sh
   data_dir=${XDG_DATA_HOME:-$HOME/.local/share}
   case "$data_dir" in /*) ;; *) data_dir="$HOME/.local/share" ;; esac
   sqlite3 -readonly "$data_dir/winterarc-healthconnect/companion.sqlite3" \
     'SELECT count(*) FROM companion_payloads;'
   ```

   No increase can also mean there were no new records or all posts were exact retries. If the queue does not drain, check the USB mapping, desktop listener, exact URL/key and Health Connect permissions. The receiver does not log requests, payloads or keys.

5. When finished, run `adb -d reverse --remove tcp:8765` and stop the receiver with Ctrl-C. Restore the app's previous destination and key if you want it to resume syncing there. The companion uses one queue and last-sync cursor across destinations: accepted items leave the queue and may not later reach the previous backend.

## Archive and limits

- The receiver accepts authenticated JSON `POST /api/v1/metrics` on IPv4 loopback only. It accepts one connection at a time, caps bodies at 16 KiB and applies a ten-second connection deadline. The companion treats only HTTP 200 as an ACK. The receiver sends it after SQLite commit, including for identical bytes already archived. A changed payload with the same `sourceKey` is archived separately; this is not semantic deduplication.
- `companion.sqlite3` holds exact request bodies in `companion_payloads.payload`, plus desktop receipt time. The archive lives outside Git under the absolute XDG data home (default `~/.local/share`), with directory mode `0700` and file mode `0600`. It is not encrypted by the receiver and grows with distinct posts. For a simple backup, stop the receiver and keep a private copy of the database outside Git.
- These are raw **companion payloads**, not raw Health Connect records: steps are summed for the read window (overlapping totals must not be added), heart rate is averaged per record (value omitted if unavailable), and sleep is session duration in hours without stages. Wire timestamps are UTC to whole seconds. The existing reader makes one read request per record type without following pagination tokens. The existing cursor and phone permissions govern available history; this is not a complete historical export or a desktop-initiated pull.
- The archive is standalone. It neither populates the V2 Store/dashboard nor reports a provider connection there. No Android build or source change is needed for a compatible installed companion.
