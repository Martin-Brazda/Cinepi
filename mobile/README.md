# Stream Player Mobile

React Native (Expo Router) app scaffolded to roughly mirror the existing `client` web app:

- Home (featured, continue watching, recommendations, catalog)
- Search
- Browse (paged)
- My List
- Settings (auth + profile selection)
- Show details + episode list
- Player route (stream URL resolution via `/scrape`)

## Setup

1. Install dependencies:

   ```bash
   cd mobile
   npm install
   ```

2. Set API base URL (optional; defaults to `http://localhost:3434/api/v1`):

   ```bash
   export EXPO_PUBLIC_API_BASE_URL="http://<your-host>:3434/api/v1"
   ```

3. Run:

   ```bash
   npm run start
   ```

## Notes

- This is intentionally a close functional scaffold, not a pixel-for-pixel copy of the web UI.
- The player screen currently resolves and displays the stream URL; plug in your preferred RN player package (e.g. `expo-video` or `react-native-video`) for playback.
