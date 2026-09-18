# MedTrack (Medcust) — Project Status & Gap Analysis Report

**Document Date:** September 2026  
**Document Version:** 2.1.0  
**Project Lead / Maintainer:** Rama Venkata Charan  
**Overall Completion:** **85% (Core Scope Production-Ready | Integrations & Mobile Hardening Remaining)**

---

## Executive Summary

**MedTrack** is a specialized retail pharmacy digital khata (ledger) system engineered for high-speed counter operations. It replaces paper credit books with sub-2-second customer phone lookups, dynamic zero-error due derivations, and 100% data safety.

The project currently consists of three main subsystems:
1. **Backend Server (`/server`)**: Node.js + Express REST API backed by an atomic SQLite WAL database with automated snapshots and thermal PDF generation.
2. **Web Desktop Countertop (`/client`)**: React 18 + Vite + Tailwind countertop cashier app with keyboard shortcuts, multi-line medicine billing, and ledger reports.
3. **Mobile App (`/mobile`)**: Standalone, 100% offline-first Android application built with React Native (Expo) and `expo-sqlite`, independent of the backend.

---

## 📈 Subsystem Completion Scorecard

```
┌──────────────────────────────────────┬─────────────┬──────────────────────────────────────────┐
│ Subsystem / Component                │  Completion │ Primary Status                           │
├──────────────────────────────────────┼─────────────┼──────────────────────────────────────────┤
│ 1. Core Ledger & Accounting Engine   │    100%     │ Production-Ready (Zero-Error Derivation) │
│ 2. Backend REST API (`/server`)      │     95%     │ Production-Ready (39/39 Tests Passing)   │
│ 3. Web Countertop Client (`/client`) │     90%     │ Production-Ready (Feature-Complete)      │
│ 4. Mobile Android App (`/mobile`)    │     75%     │ Offline-Ready (Pending Native Tests)     │
│ 5. Automated Testing & QA            │     70%     │ Server Tested (Mobile Tests Pending)     │
│ 6. Integrations & Hardware Add-ons   │     20%     │ PDF done; Thermal & WhatsApp planned     │
│ 7. DevOps, Packaging & CI/CD         │     45%     │ Local dev ready; CI/Builds needed        │
└──────────────────────────────────────┴─────────────┴──────────────────────────────────────────┘
```

**Overall Estimated Project Completion:** **~85%**

---

## ✅ What Has Been Completed

### 1. Core Ledger & Data Integrity (100%)
- **Mathematical Invariant:** Customer outstanding due balance is computed dynamically on read:
  $$\text{Due} = \sum (\text{entries.due\_amount}) - \sum (\text{payments.amount})$$
  No manual or editable due columns exist, eliminating phantom balances.
- **Atomic Transactions:** Multi-item purchase visits and payment settlements commit atomically within single SQLite transactions (`better-sqlite3` and `expo-sqlite`).
- **High Concurrency:** Database operates in WAL (Write-Ahead Logging) mode with performance indexes on `phone_number`, `customer_id`, and `entry_id`.
- **Accounting Guardrails:** Rejects entries with zero/negative amounts, payments exceeding dues without explicit confirmation, or visits without medicine line items.

### 2. Backend REST API (`/server`) (95%)
- **Customer Management (`/api/customers`)**: Exact 10-digit phone indexing, partial phone matching, name/village search fallback.
- **Purchase Entries (`/api/entries`)**: Multi-row medicine purchase capture with price mapping and auto due calculation.
- **Payment Settlements (`/api/payments`)**: Due clearance with support for Cash, UPI/GPay, and Bank Transfers.
- **Autocomplete Engine (`/api/medicines`)**: Distinct past medicine lookups for sub-second counter suggestions.
- **Ledger Analytics (`/api/reports`)**: Store-wide receivables report, debtor counts, village filtering, and metrics.
- **PDF Generation (`/api/bills/:entryId/pdf`)**: Real-time thermal-style bill PDF generation via PDFKit.
- **Data Protection (`backupService.js`)**:
  - Automatic timestamped backup on server boot in `server/db/backups/`.
  - Manual 1-click snapshot creation with integrity verification.
  - Backup restore endpoint with roll-back safety.
  - Complete customer khata CSV export.
  - PIN authentication guard (`server/config.js`) protecting backup and restore endpoints.
- **Test Suite (`server/tests/core_tests.js`)**: 39 out of 39 tests passing (100% pass rate).

### 3. Web Desktop Countertop Client (`/client`) (90%)
- **Counter Speed Search (`SearchBar.jsx`)**:
  - Global keyboard shortcut (`/`) focuses phone lookup from any page.
  - Strict 10-digit Indian mobile validation with fallback to name and village.
  - Modal prompt to add new customer if not found.
- **Customer Khata Profile (`CustomerProfile.jsx`)**:
  - Color-coded due indicator badge (`Emerald` for ₹0 Clear, `Amber` for Outstanding).
  - **Tab 1: Purchase History:** Chronological visits, expandable medicine items, and one-click PDF bill reprint.
  - **Tab 2: Frequently Bought:** Top 5 medicines with repeat visit counts and recency indicators.
  - **Tab 3: Payment History:** Audit list of all settlements with receipt IDs and notes.
- **Counter Purchase Entry (`EntryForm.jsx`)**:
  - Dynamic repeatable medicine rows with autocomplete dropdown.
  - Live due calculation banner displaying `Total - Paid = Due` as cashier types.
- **Payment Collection Modal (`PaymentForm.jsx`)**:
  - Quick amount fill buttons, method selector, and overpayment safeguard confirmation.
- **Store Receivables Report (`DuesReport.jsx`)**:
  - Metric summary cards (Total Dues, Total Debtors, Unique Villages).
  - Village filter dropdown and sorting by due amount, customer name, or village.
- **Backup & Security Modal (`BackupModal.jsx`, `PinLockModal.jsx`)**:
  - PIN verification dialog, backup listing, one-click manual backup, restore confirmation, and CSV download.

### 4. Mobile Android App (`/mobile`) (75%)
- **100% Offline-First Architecture**: Operates with local `expo-sqlite`, requiring zero server communication or internet connection.
- **Screens Implemented**:
  - `HomeScreen.js`: Instant search by phone/name, quick metrics, customer cards with due badges.
  - `CustomerProfileScreen.js`: 3 tabs (Purchases, Frequent Medicines, Payments), customer info header, direct payment settlement modal.
  - `AddCustomerScreen.js`: 10-digit phone validation, name, village, and address fields.
  - `AddPurchaseScreen.js`: Dynamic multi-line medicine entry, local database autocomplete suggestions, real-time balance computation.
- **Disaster Recovery**: One-tap JSON Khata backup export using Android Share Sheet (`expo-sharing` + `expo-file-system`).
- **Store Configuration**: `app.json`, `eas.json` configured for Android package `com.medtrack.mobile`, with `PRIVACY_POLICY.md` included for Google Play compliance.

---

## ⚠️ What We Are Missing (Gaps & Incomplete Work)

The following items represent outstanding gaps, missing features, and technical debt that need completion for full production release:

### 🔴 Critical & High-Priority Gaps

1. **Mobile App: JSON Backup Restore / Import Feature**
   - *Current State:* The mobile app has an *Export* feature that shares a JSON snapshot via Android Share Sheet, but **no Import/Restore screen or logic** exists to read a JSON backup file and restore the local SQLite database.
   - *Risk:* If a user switches phones or uninstalls the app, they cannot restore their backup without manual developer intervention.
   - *Required Action:* Build a "Restore from Backup" file-picker in mobile settings using `expo-document-picker` to parse and insert the JSON backup into `expo-sqlite`.

2. **Mobile App: Automated Test Suite**
   - *Current State:* Server has 39/39 passing tests in `server/tests/core_tests.js`. Mobile has **0 automated unit or integration tests**.
   - *Risk:* Regressions in `mobile/src/db/database.js` due calculation or transaction logic can go unnoticed during Expo upgrades.
   - *Required Action:* Add Jest + React Native Testing Library or an on-device test runner targeting SQLite database operations and balance derivations on mobile.

3. **Mobile App: Physical Android Device / Expo Go Sign-off**
   - *Current State:* Verified via web preview adapter (`localhost:8081`), but native SQLite behavior on real Android hardware needs smoke testing.
   - *Required Action:* Execute physical Android device walkthrough using Expo Go or an APK build to verify `expo-sqlite` and `expo-sharing` native dialogs.

4. **Customer Record Editing & De-duplication (Web & Mobile)**
   - *Current State:* Customers can be created, but there is no UI to edit customer information (e.g. correct spelling of a name, update village/phone) or merge duplicate accounts.
   - *Required Action:* Add an "Edit Customer" modal and an API endpoint `PUT /api/customers/:id` (and corresponding mobile SQLite query).

---

### 🟡 Medium-Priority Feature Additions (Roadmap)

5. **Direct Bluetooth Thermal Printer Integration (ESC/POS)**
   - *Current State:* Web generates thermal-styled PDFs via PDFKit, which requires standard browser printing. Mobile has no printing capability.
   - *Desired Feature:* Direct Bluetooth/USB thermal printing (58mm / 80mm ESC/POS) for instant counter receipt slips on both Mobile and Web.

6. **WhatsApp Quick-Share (`wa.me`)**
   - *Current State:* No direct messaging integration.
   - *Desired Feature:* A one-click WhatsApp button on both Web and Mobile to send an instant ledger balance summary or payment receipt directly to the customer's phone via `https://wa.me/91XXXXXXXXXX?text=...`.

7. **Search Debouncing on Mobile**
   - *Current State:* `mobile/src/screens/HomeScreen.js` triggers a database query on every single keystroke.
   - *Desired Improvement:* Wrap phone/name input with a 200ms debounce hook (`useDebounce`) to prevent UI stutter on devices with thousands of records.

8. **Web Client & API Authentication / Access Control**
   - *Current State:* The desktop server is an open REST API on the local LAN. Only the backup/restore modal has PIN protection.
   - *Desired Feature:* Optional Cashier / Admin role login with a session PIN so only authorized staff can record discounts or view store-wide dues reports.

---

### 🟢 Low-Priority / Operational & DevOps Improvements

9. **1-Click Desktop Counter Launcher (Windows)**
   - *Current State:* Running the web app requires opening two terminals (`cd server && node server.js` and `cd client && npm run dev`).
   - *Desired Feature:* A single Windows batch script (`start-medtrack.bat`) or an Electron / Tauri wrapper to launch the server and open the browser automatically.

10. **CI/CD Pipeline (GitHub Actions)**
    - *Current State:* Tests are run manually from the terminal.
    - *Desired Feature:* A `.github/workflows/test.yml` workflow to automatically execute `node tests/core_tests.js` on every commit and PR.

11. **Standalone Production Android APK / AAB Build**
    - *Current State:* Configured for EAS (`eas.json`), but no production release `.apk` or `.aab` has been compiled and placed in releases.
    - *Desired Feature:* Run `eas build -p android --profile production` to generate a standalone signed APK for store distribution or direct side-loading.

12. **Cloud Sync / Remote Backup (Optional)**
    - *Current State:* All data is strictly local (counter SQLite or mobile SQLite).
    - *Desired Feature:* Optional end-to-end encrypted backup upload to Google Drive or S3 for merchants who want cloud disaster recovery.

---

## 📋 Comprehensive Feature Status Matrix

| Module | Feature | Status | Notes / Missing Elements |
|---|---|:---:|---|
| **Ledger Math** | Live Balance Derivation | ✅ Complete | Dynamic formula; verified by test suite |
| **Ledger Math** | Multi-Item Atomic Commit | ✅ Complete | Both SQLite engines support atomic rollbacks |
| **Ledger Math** | Overpayment Guardrail | ✅ Complete | Prompts cashier before settling excess balance |
| **Search** | 10-Digit Mobile Lookup | ✅ Complete | Sub-2-second indexed queries |
| **Search** | Global `/` Shortcut | ✅ Complete | Web countertop global hotkey implemented |
| **Search** | Search Debounce | 🟡 Incomplete | Present on Web; **missing on Mobile** |
| **Customer** | Khata Profile & Badges | ✅ Complete | Emerald/Amber status badges working |
| **Customer** | Purchase History & Drilldown | ✅ Complete | Collapsible line items & price breakdown |
| **Customer** | Frequently Bought Medicines | ✅ Complete | Top 5 items with frequency count & recency |
| **Customer** | Edit Customer Details | ❌ Missing | No edit/update UI or endpoint for existing records |
| **Billing** | Multi-Line Entry + Autocomplete | ✅ Complete | Dynamic row additions with suggestions |
| **Billing** | Real-time Balance Preview | ✅ Complete | Interactive `total - paid = due` banner |
| **Billing** | PDF Receipt Generation | ✅ Complete | Thermal bill via PDFKit on Web backend |
| **Billing** | Mobile PDF / Receipt Share | ❌ Missing | No receipt generation on mobile app |
| **Billing** | Bluetooth Thermal Printer | ❌ Missing | ESC/POS hardware integration not yet built |
| **Settlement** | Payment Modes (Cash/UPI/Bank) | ✅ Complete | Settle dues with instant balance reduction |
| **Settlement** | WhatsApp Payment Receipt | ❌ Missing | `wa.me` shortcut URL integration pending |
| **Reports** | Store Receivables Report | ✅ Complete | Metrics, debtor count, village filtering |
| **Data Safety**| Automated Startup Backups | ✅ Complete | Web server creates backup on every boot |
| **Data Safety**| Web Manual Backup & Restore | ✅ Complete | Verified with PIN security modal |
| **Data Safety**| Web CSV Khata Export | ✅ Complete | Downloads complete ledger CSV |
| **Data Safety**| Mobile JSON Backup Export | ✅ Complete | Shares `.json` via Android Share Sheet |
| **Data Safety**| Mobile Backup Restore/Import | ❌ Missing | **No UI or parser to import backup on mobile** |
| **Testing** | Backend Core Tests (39/39) | ✅ Complete | 100% pass rate in Node.js test runner |
| **Testing** | Mobile Native Unit Tests | ❌ Missing | **0 automated tests in `/mobile`** |
| **Testing** | Real Android Hardware Sign-off| 🟡 Pending | Web adapter verified; device test pending |
| **DevOps** | 1-Click Windows Desktop Starter| ❌ Missing | Needs `.bat` or electron shortcut script |
| **DevOps** | GitHub Actions CI Workflow | ❌ Missing | Needs automated CI test runner |
| **DevOps** | Signed Android Release APK | 🟡 Ready | EAS configured; build command not yet executed |

---

## 🗓️ Recommended Priority Action Plan

### Sprint 1: Mobile Completeness & Reliability (Immediate)
1. **Implement Mobile JSON Restore:** Add an "Import / Restore Backup" button in mobile settings using `expo-document-picker` to restore customer and entry data.
2. **Add Mobile Search Debounce:** Prevent redundant database hits in `HomeScreen.js`.
3. **Add Mobile Test Runner:** Implement basic unit tests for `mobile/src/db/database.js` functions.
4. **Physical Device Walkthrough:** Run on a physical Android phone via Expo Go to verify all camera/file sharing permissions.

### Sprint 2: Usability & Core Polish
1. **Customer Edit / Update Feature:** Allow counter operators to update phone numbers, names, or addresses.
2. **WhatsApp Sharing Link:** Add a one-tap WhatsApp button on web and mobile to send bill summaries.
3. **Windows 1-Click Runner:** Create a `start-counter.bat` script that starts both backend and frontend concurrently for non-technical shopkeepers.

### Sprint 3: Hardware & Release
1. **Bluetooth Thermal Receipt Printing:** Implement ESC/POS printing over Bluetooth for mobile.
2. **Generate Release APK / AAB:** Build the standalone Android production APK via EAS.
3. **Set up GitHub Actions CI:** Automate test execution on code pushes.
