# MedTrack Mobile — Android Medical Khata Book

A pure, simple medical-shop khata book for Android built with **React Native (Expo)** and **local on-device SQLite (`expo-sqlite`)**. 

100% offline — no server, no cloud, no internet dependency.

---

## Features

- **Instant Search:** Auto-focused search by customer mobile number or name.
- **Index-Card Profiles:** Quick customer view showing name, phone, village, and a quiet, non-intrusive due indicator (`₹X due` or `All clear`).
- **Khata Ledger:** Chronological visit history detailing medicines bought, prices, and payments.
- **Distinct Due-Clearing Payments:** Payments without purchases render cleanly with a sage badge ("₹200 Payment Received") rather than empty rows.
- **Multi-Medicine Purchase Entry:** Quickly add multiple medicines per visit with prices and optional amount paid now. Automatically calculates due.
- **Disaster Recovery Backup:** One-tap export that packages your complete SQLite khata into a JSON backup and opens the Android system share sheet (Google Drive, WhatsApp, Files).
- **Timezone-Safe:** Converted automatically to device local time so late-night purchases never shift dates.

---

## How to Run Locally

1. Navigate to the `mobile` folder:
   ```bash
   cd mobile
   ```

2. Start the Expo development server:
   ```bash
   npx expo start
   ```

3. Scan the QR code using the **Expo Go** app on your Android device (or press `a` for Android Emulator).

---

## Building for Android (Play Store & APK)

The app is pre-configured with Expo Application Services (EAS):

1. Install EAS CLI:
   ```bash
   npm install -g eas-cli
   ```

2. Login to your Expo account:
   ```bash
   eas login
   ```

3. Build a standalone Android APK (for direct installation / testing):
   ```bash
   eas build -p android --profile preview
   ```

4. Build an Android App Bundle (.aab) for Google Play Console submission:
   ```bash
   eas build -p android --profile production
   ```

---

## Play Store Checklist

1. **Package Name:** Configured in `app.json` as `com.medtrack.mobile`. *(Note: This identifier is permanent and cannot be changed after first publish).*
2. **Privacy Policy:** Ready in `PRIVACY_POLICY.md`. Host on GitHub Pages or a public gist and link in your Play Console listing.
3. **Account:** Google Play Console developer account ($25 one-time fee).
