# 💊 MedTrack (Medcust) — Medical Shop Khata Ledger

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![React Native](https://img.shields.io/badge/React_Native-Expo_SDK_57-000020?logo=expo&logoColor=white)](https://expo.dev)
[![SQLite](https://img.shields.io/badge/Database-SQLite_WAL-003B57?logo=sqlite&logoColor=white)](https://sqlite.org)
[![Tests](https://img.shields.io/badge/Tests-60%2F60_Passing-brightgreen?logo=checkmarx&logoColor=white)](server/tests/core_tests.js)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

> **High-speed digital khata (credit ledger) and billing system built specifically for retail medical shops and pharmacies.**  
> Built for physical counter speed: instant phone-number search (< 2s), zero-error balance calculation, 20-second visit billing, and 100% offline-first resilience.

---

## 📖 Table of Contents

- [The Problem & The Solution](#-the-problem--the-solution)
- [System Architecture](#-system-architecture)
- [Key Features](#-key-features)
  - [1. Phone-Number-First Search](#1-phone-number-first-search)
  - [2. Customer Khata Profile & 3 Core Tabs](#2-customer-khata-profile--3-core-tabs)
  - [3. 20-Second Counter Billing Entry](#3-20-second-counter-billing-entry)
  - [4. Due Settlement & Overpayment Guard](#4-due-settlement--overpayment-guard)
  - [5. Dues & Village Ledger Reports](#5-dues--village-ledger-reports)
  - [6. Customer Recycle Bin & Audit](#6-customer-recycle-bin--audit)
  - [7. Standalone Mobile App (Android / Expo)](#7-standalone-mobile-app-android--expo)
  - [8. Data Safety & Daily Backups](#8-data-safety--daily-backups)
- [Tech Stack](#-tech-stack)
- [Database Schema & Ledger Rules](#-database-schema--ledger-rules)
- [Quick Start Guide](#-quick-start-guide)
  - [Prerequisites](#prerequisites)
  - [Option A: Running Desktop Web App (Client + Server)](#option-a-running-desktop-web-app-client--server)
  - [Option B: Running the Mobile App (Expo Go / Android)](#option-b-running-the-mobile-app-expo-go--android)
  - [Running Unit & Integration Tests](#running-unit--integration-tests)
- [Counter Keyboard Shortcuts](#-counter-keyboard-shortcuts)
- [Directory Structure](#-directory-structure)
- [Detailed Documentation](#-detailed-documentation)
- [License](#-license)

---

## 🎯 The Problem & The Solution

In retail pharmacies and medical shops, a substantial portion of medicine purchases—especially for chronic ailments like diabetes, BP, and cardiac care—are made on credit (*khata* or *udhaar*).

| Traditional Practice | Pain Point | MedTrack Solution |
|---|---|---|
| **Physical Paper Khata Books** | Takes 1–3 minutes to flip through pages; vulnerable to tears, water spills, and frequent arithmetic calculation mistakes. | **< 2s lookup** by phone number, auto-calculated balances, and searchable visit history. |
| **Heavyweight Pharmacy ERPs** | 10+ clicks, complex batch/expiry fields, slow navigation that creates long counter queues during rush hours. | **20-second transaction recording** with instant medicine name autocomplete and 1-click thermal receipts. |
| **Cloud-Only Web Apps** | Stops working when local broadband or cellular connection drops. | **100% Offline-First**: Local SQLite database with atomic transactions and zero cloud lock-in. |

---

## 🏗️ System Architecture

MedTrack is built as a modular ecosystem offering both countertop web billing and a standalone mobile application:

```
                            MedTrack Ecosystem
                                    │
       ┌────────────────────────────┼────────────────────────────┐
       ▼                            ▼                            ▼
┌───────────────────┐      ┌───────────────────┐      ┌───────────────────┐
│   Desktop Web     │      │   Local Server    │      │    Mobile App     │
│     (client/)     │      │     (server/)     │      │     (mobile/)     │
├───────────────────┤      ├───────────────────┤      ├───────────────────┤
│ • React 18 + Vite │ HTTP │ • Node.js Express │      │ • React Native    │
│ • Tailwind CSS    ├─────►│ • SQLite (WAL)    │      │ • Expo SDK 57     │
│ • Counter UI POS  │ :4000│ • PDFKit Engine   │      │ • Local SQLite DB │
│ • Global '/' Keys │      │ • Daily Auto-Sync │      │ • 100% Offline    │
│ • Instant Search  │      │ • 60 Unit Tests   │      │ • Share Sheet JSON│
└───────────────────┘      └───────────────────┘      └───────────────────┘
```

- **`client/` (Web Counter POS):** Fast desktop web interface optimized for counter cashiers with keyboard shortcuts and responsive design.
- **`server/` (Local Node API):** High-reliability local backend with atomic SQLite transactions, PDF bill generator, and automatic daily database backups.
- **`mobile/` (Standalone Android App):** 100% standalone offline Android app using `expo-sqlite` on physical devices with native JSON backup sharing.

---

## 🚀 Key Features

### 1. Phone-Number-First Search
- **Instant Lookup (< 200ms):** Mobile number is the primary identifier for customers.
- **Global Shortcut:** Press `/` anywhere in the app to immediately focus the customer search bar.
- **Fallback Search:** Search seamlessly by customer name or village if the phone number is not immediately available.
- **Quick Registration:** Add a new customer in seconds directly from the search dropdown.

### 2. Customer Khata Profile & 3 Core Tabs
- **Customer Overview Card:** Shows name, phone number, village, address, last visit date (e.g., *"Today"*, *"3 days ago"*), and a dynamic color-coded status badge:
  - 🟢 **Emerald Badge:** `"All Clear"` (₹0 balance)
  - 🟠 **Amber Badge:** `"₹X Due"` (outstanding balance)
- **Tab 1: Purchase History:** Complete chronological log of visits. Displays total amount, amount paid, and due generated. Expand any visit to see individual medicine line items, unit prices, discounts, and reprint PDF receipts.
- **Tab 2: Frequently Bought:** Top 5 distinct medicines purchased by the customer with repeat visit counts and last-purchased recency (e.g., *"Telma 40mg — 4x bought, last 3 days ago"*).
- **Tab 3: Payment History:** Audit trail of all partial and full payments with timestamps, payment mode (Cash, UPI, Bank), and cashier notes.

### 3. 20-Second Counter Billing Entry
- **Rapid Item Entry:** Dynamic line items with real-time medicine autocomplete suggestions learned from past entries.
- **Item-Level Discounts & Prices:** Enter quantity, unit price, and discounts per medicine.
- **Live Calculation Banner:** Real-time formula displays: `Total - Paid = Remaining Due`.
- **Atomic SQLite Commits:** Multi-item purchases and dues are saved atomically—either all items succeed or nothing changes.
- **1-Click Thermal PDF Receipt:** Clean, printable receipt with shop name, drug license number, and customer information.

### 4. Due Settlement & Overpayment Guard
- Settle outstanding balances via **Cash**, **UPI / GPay / PhonePe**, or **Bank Transfer**.
- **Overpayment Guardrail:** Alerts the cashier if the entered payment amount exceeds the customer's total due balance, requiring explicit confirmation before proceeding.
- Live due balance recalculation updates immediately across all screens.

### 5. Dues & Village Ledger Reports
- **Receivables Dashboard:** Instant overview of total outstanding shop dues and active debtor count.
- **Village Filtering:** Filter customer dues by village or locality to plan recovery rounds.
- **Multi-Column Sorting:** Sort debtor tables by highest due amount, customer name, or village.
- **Data Export:** Export the entire khata report to CSV with a single click.

### 6. Customer Recycle Bin & Audit
- **Soft Deletion with Safety Lock:** Customers with an active due balance (> ₹0) or credit balance cannot be deleted.
- **Recycle Bin Management:** Soft-deleted customers are safely stored in the Recycle Bin for 30 days without breaking historic ledger links.
- **One-Click Restore:** Accidental deletions can be restored instantly with their entire purchase history intact.
- **Permanent Purge & Auto-Cleanup:** Records older than 30 days are automatically purged safely during server boot.

### 7. Standalone Mobile App (Android / Expo)
- **Zero Cloud Dependence:** Works anywhere without Wi-Fi or cellular connectivity using on-device `expo-sqlite`.
- **Shop Profile Customization:** Configure shop name, drug license number, phone, and address for receipts.
- **One-Tap Backup & Sharing:** Generates a complete JSON backup and opens the native Android Share Sheet to backup via WhatsApp, Google Drive, or Email.
- **APK & EAS Ready:** Configured for local APK building and Google Play distribution via Expo Application Services (`eas.json`).

### 8. Data Safety & Daily Backups
- **Automated Boot Snapshot:** Creates a timestamped SQLite database copy in `server/db/backups/` upon server startup.
- **Manual Snapshot:** Download instant SQLite snapshots directly from the web header.
- **Atomic WAL Mode:** Uses SQLite Write-Ahead Logging (`WAL`) to prevent database corruption even during abrupt power cuts.

---

## 🛠️ Tech Stack

| Domain | Technology | Purpose |
|---|---|---|
| **Web Frontend** | React 18, Vite 6, Tailwind CSS 3 | Fast, modern desktop counter UI |
| **Icons & UI** | Lucide React, Canvas Confetti | Clean icons & celebration on cleared dues |
| **Backend API** | Node.js, Express 4 | REST API with atomic transaction control |
| **Desktop Database** | SQLite via `better-sqlite3` | Offline-first, sub-millisecond local queries |
| **Mobile App** | React Native 0.86, Expo SDK 57 | Native Android mobile application |
| **Mobile Database** | `expo-sqlite` (Synchronous API) | Pure offline native on-device storage |
| **Receipt Engine** | PDFKit | Formatted thermal-style bills |
| **Testing** | Node test runner (Custom Suite) | 60 automated unit & regression tests |

---

## 🗄️ Database Schema & Ledger Rules

### Core Tables

```sql
-- Customers Master
CREATE TABLE customers (
  customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  village TEXT,
  address TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT DEFAULT NULL
);

-- Purchase Visits
CREATE TABLE entries (
  entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
  entry_date TEXT DEFAULT CURRENT_TIMESTAMP,
  total_amount REAL NOT NULL,
  amount_paid REAL NOT NULL,
  due_amount REAL NOT NULL
);

-- Medicine Line Items
CREATE TABLE entry_medicine (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL REFERENCES entries(entry_id),
  medicine_name TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  discount REAL DEFAULT 0
);

-- Payment Settlements
CREATE TABLE payments (
  payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
  pay_date TEXT DEFAULT CURRENT_TIMESTAMP,
  amount REAL NOT NULL,
  note TEXT
);
```

### The Non-Negotiable Due Calculation Rule

> **Customer due is never stored as an editable static number.**  
> It is strictly computed on demand from the transaction ledger:
>
> $$\text{Customer Due} = \sum(\text{entries.due\_amount}) - \sum(\text{payments.amount})$$
>
> This guarantees mathematical consistency and prevents balance desynchronization.

---

## ⚡ Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org) (v18.0 or higher recommended)
- `npm` (comes with Node.js)
- Optional for mobile: [Expo Go app](https://expo.dev/go) on your Android device

---

### Option A: Running Desktop Web App (Client + Server)

#### Step 1: Start the Backend Server
```bash
# Navigate to the server folder
cd server

# Install dependencies
npm install

# Start the server (runs on port 4000)
npm start
```
*(Optional) To populate demo customers, purchase visits, and medicines:*
```bash
npm run seed
```

#### Step 2: Start the Web Client
Open a new terminal window:
```bash
# Navigate to the client folder
cd client

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```

Open your browser at: **`http://localhost:3001`** (or the port displayed in your terminal).

---

### Option B: Running the Mobile App (Expo Go / Android)

```bash
# Navigate to the mobile folder
cd mobile

# Install dependencies
npm install

# Start Expo dev server
npm start
```

- **On a physical Android phone:** Open the **Expo Go** app and scan the QR code displayed in your terminal.
- **On an Android Emulator:** Press `a` in the terminal to launch on the connected emulator.
- **On Web Browser (preview):** Press `w` in the terminal to preview in your browser.

---

### Running Unit & Integration Tests

The project includes an automated test suite verifying customer phone search, dynamic due calculation, multi-line purchase entries, payment settlements, autocomplete, database backups, and the customer recycle bin lifecycle:

```bash
cd server
npm test
```

Expected result:
```
====================================================
  Running MedTrack Core Scope Tests
  Target: Customer & Medicine Search (Khata only)
====================================================
...
====================================================
  Tests Passed: 60
  Tests Failed: 0
====================================================
```

---

## ⌨️ Counter Keyboard Shortcuts

| Shortcut | Action | Where It Works |
|---|---|---|
| `/` | Focus Customer Phone Search bar | Anywhere on Desktop Web |
| `Escape` | Close active modal / overlay | Modals & dropdowns |
| `Tab` | Jump between medicine name, quantity, price | Purchase Entry modal |
| `Enter` | Submit / Add medicine row | Form inputs |

---

## 📁 Directory Structure

```
Medcust/
├── client/                     # Desktop Web App (React 18 + Vite + Tailwind CSS)
│   ├── src/
│   │   ├── components/         # Modals, Profile, PurchaseEntry, DuesReport, Header
│   │   ├── services/api.js     # REST client talking to local server
│   │   └── App.jsx             # Main dashboard layout & search state
│   └── package.json
│
├── server/                     # Local API Server (Node.js + Express + SQLite)
│   ├── db/                     # SQLite schema, migrations, seed data, and daily backups
│   ├── routes/                 # Express REST endpoints (customers, entries, payments, etc.)
│   ├── services/               # PDF generator & database backup engines
│   ├── tests/                  # 60 automated unit & regression tests
│   ├── server.js               # Server entry point
│   └── package.json
│
├── mobile/                     # Standalone Android App (React Native + Expo SDK 57)
│   ├── src/
│   │   ├── db/database.js      # On-device native expo-sqlite integration
│   │   ├── screens/            # Home, CustomerLedger, NewVisit, DuesSummary, Settings
│   │   └── services/           # JSON khata backup & Android share sheet exporter
│   ├── app.json                # Expo mobile configuration & permissions
│   ├── eas.json                # EAS Build profiles (preview APK, production AAB)
│   └── package.json
│
├── docs/                       # Technical Specifications & PRD
│   ├── PRD_AND_UI_SPECIFICATION.md   # Comprehensive Product Requirements Document
│   └── index.md
│
├── DEVELOPMENT_STATUS.md       # Development progress, milestones & test execution report
├── SYSTEM_DOCUMENTATION.md      # In-depth architectural & API specifications
├── LICENSE                     # Apache 2.0 Open Source License
├── package.json                # Root package with helper scripts
└── README.md                   # This file
```

---

## 📚 Detailed Documentation

For in-depth architectural specifications and product requirements, refer to:
- [Product Requirements Document (PRD) & UI Specifications](docs/PRD_AND_UI_SPECIFICATION.md)
- [System Architecture & API Documentation](SYSTEM_DOCUMENTATION.md)
- [Development Status & Quality Assurance Report](DEVELOPMENT_STATUS.md)

---

## 📄 License

This project is licensed under the **Apache License 2.0**. See the [LICENSE](LICENSE) file for complete details.
