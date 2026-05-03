# Cinepi Remote Bridge

Run this on the Pi so a phone on the same LAN can control the TV app.

## Start

```bash
npm run remote:bridge
```

Default port: `8099`

## Use from phone

1. Open `http://<pi-ip>:8099` on mobile.
2. On TV app, open Settings and copy the shown pairing code.
3. Enter code on mobile and tap Connect.
4. Use D-pad buttons to control the app.

## Notes

- This bridge is LAN-local and intentionally separate from your hosted backend.
- If you need another port, set `REMOTE_BRIDGE_PORT`.
