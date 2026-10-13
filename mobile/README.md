# MedTrack Mobile — Android Medical Khata Book

A standalone, 100% offline Android khata ledger designed for physical medical shops and pharmacies. Built with React Native, Expo, and on-device SQLite.

---

## Setup & Running with Expo Go

1. **Install Dependencies:**
   Navigate to the `mobile` folder and install the required npm packages:
   ```bash
   cd mobile
   npm install
   ```

2. **Start the Expo Development Server:**
   ```bash
   npx expo start
   ```

3. **Run on your device:**
   Install the **Expo Go** app on your Android device from the Google Play Store, open it, and scan the QR code displayed in your terminal. Alternatively, press `a` in the terminal to launch on an active Android Emulator.

---

## Running Tests

The mobile project includes tests for database schema, logic, and state. Run them using Jest:
```bash
npm test
```

---

## Backup & Restore

MedTrack Mobile uses local SQLite storage (`expo-sqlite`). We provide a built-in backup and restore mechanism:
- **Backup before uninstalling:** **CRITICAL:** Your phone holds the only copy of the data. You MUST back up your data before uninstalling the app, reinstalling it, or clearing its data, otherwise the data will be lost forever!
- **Backup:** Go to the Settings screen in the app and tap "Backup Khata Data". This exports your complete SQLite database into a single JSON file and opens the native Android Share Sheet. You can save this file to Google Drive, email it to yourself, or share it via WhatsApp for safekeeping.
- **Restore:** Go to the Settings screen and tap "Restore Data". Select a previously generated JSON backup file from your device. The app will validate and restore the database state.
- **Keystore Backup:** If you build the app for production, Expo generates an Android Keystore. You should back it up using `eas credentials` so you don't lose the ability to update your app in the Play Store.

---

## Known Limits & Considerations

- **No Cloud Sync:** The mobile app is entirely offline-first and isolated. It operates independently of the MedTrack desktop web server.
- **Separate Data:** Mobile data and desktop web server data are completely separate. There is no automated synchronization between the desktop web version and the standalone Android app. Furthermore, **Expo Go and the built APK have completely separate data**. Data created while developing in Expo Go will not transfer over when you install the standalone APK.
- **Web Preview Broken:** The `w` (Web) preview option in the Expo CLI is currently broken. This is due to a known issue with `expo-sqlite` and WASM support on the web. Always use a physical Android device or an Android emulator for testing and development.
