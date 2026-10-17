# MedTrack Mobile Release Notes

## Version 1.0.0 (Build 2)

- **Version**: 1.0.0
- **Android versionCode**: 2
- **Build ID**: `4714fe04-fab3-47f8-bbd6-66b5eb34718f`
- **Build Profile**: `preview` (standalone Android APK)
- **Git Commit Hash**: `660f0c5bcc2ce5d92af3c111c8b34208e66a2017`
- **Date**: 2026-10-16
- **Test Totals**: 22 test suites passed, 237 tests passed (0 failures)
- **EAS Build URL**: https://expo.dev/accounts/cherry_999/projects/medtrack-mobile/builds/4714fe04-fab3-47f8-bbd6-66b5eb34718f
- **APK Download**: https://expo.dev/artifacts/eas/s3759swmYoMAMSrkocG85KZMUgVBWciWid2g7A3pp-E.apk

### Summary of Changes in Build
- Fixed SDK 57 patch-level package alignment (`expo@~57.0.30`, `expo-sharing@~57.0.23`, `jest-expo@~57.0.6`).
- Configured clean `app.json` with splash screen, EAS project ID, and explicitly blocked `READ_EXTERNAL_STORAGE` and `WRITE_EXTERNAL_STORAGE` permissions (`tools:node="remove"`).
- Configured clean `eas.json` with `preview` (APK) and `production` (AAB) profiles.
- Cleaned up draft placeholders (`[REPLACE WITH LAWYER-REVIEWED TEXT]`) from user-facing Terms of Use and Privacy Policy in `AboutScreen`.

### Items Not Verifiable Without Physical Device Testing
1. **Local Notification Delivery & System Alarm Manager**:
   - Verification of 9:00 AM local notification triggering and system tray presentation using the monochrome icon (`android-icon-monochrome.png`) with color accent `#B9533F`.
   - Verification of the Android 13+ (`POST_NOTIFICATIONS`) permission prompt and channel configuration (`license-reminders`).
   - Verification of `RECEIVE_BOOT_COMPLETED` behavior: ensuring scheduled license expiry alarms are restored after device reboot.
2. **System Document Picker & Sharesheet Integration**:
   - Verification of `expo-sharing` invocation of the Android Sharesheet (exporting backup JSON to WhatsApp, Gmail, Drive, local storage).
   - Verification of `expo-document-picker` intent resolving and reading backup files across external storage and cloud providers.
3. **Adaptive Icon & Splash Screen Rendering**:
   - Visual inspection of the adaptive icon (foreground, background, and themed monochrome icon) across OEM Android launchers (Pixel, Samsung OneUI, MIUI/HyperOS, OxygenOS).
   - Visual verification of splash screen branding and resize mode on various device aspect ratios.
4. **Soft Keyboard Inset Adjustments**:
   - Real-world interaction with input forms (Add Customer, Add Purchase, Record Payment) with soft keyboard layout mode (`resize`).
5. **Native Phone Dialer Linking**:
   - Verification of `Linking.openURL('tel:...')` opening the device dialer app with customer phone number pre-filled.
