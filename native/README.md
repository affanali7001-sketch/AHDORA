# AHDORA — Native App (Expo / React Native)

The real native AHDORA app (not the Capacitor web wrap).
Built with Expo SDK 58, React Native, TypeScript.

## Run it (preview on your phone)

1. `npm install`
2. `npx expo start`
3. Scan the QR with **Expo Go**.

## Login

Uses the same live API as the web app:
`https://ahdora-f85f76ceea58.herokuapp.com`

## What's inside

24 screens: Welcome, Login, 8-step Onboarding, Home, Dashboard,
Quran Book (real mushaf pages via AlQuran Cloud), Life Ayahs, Duas,
Salah, Prayer times, Salah Calendar, Study, Focus (Pomodoro), Tasbeeh,
Sleep, Challenges, Friends, Hijri, Mosque, Notifications, Analytics,
Profile.

- Continuous tilawat audio (EveryAyah) + Urdu tarjuma audio
  (ur.khan edition, 64 kbps only — 128 kbps returns 403).
- App Block + uninstall protection are settings UI only inside
  Expo Go — they need a real native build to actually work.

## Notes

- `app.json` has `"jsEngine": "jsc"` (plain JS bundle, half the size
  of the Hermes bundle — faster to download on slow data).
- API base URL is in `src/lib/api.ts`.
- The default Expo template images (`assets/*.png` — app icon, splash,
  favicon) are not included here; the app runs fine without them.
  Add your own icon/splash in `assets/` when ready.
