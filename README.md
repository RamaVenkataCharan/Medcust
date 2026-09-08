# MedTrack — Medical Shop Khata Ledger

**MedTrack** is a digital khata (ledger) book for medical shops. Designed for counter speed, it tracks customer medicine purchases, maintains accurate dues derived strictly from transaction entries, and replaces physical paper books with sub-2-second phone lookup.

---

## 🚀 Key Features

- **Phone-Number-First Customer Search**:
  - Auto-focused search bar on load (`/` shortcut).
  - Instant phone lookup (< 2s) with fallback name and village search.
  - Quick "+ Add New Customer" overlay if no match found.
- **Zero-Error Due Calculation**:
  - Customer due is strictly computed as `SUM(entries.due_amount) - SUM(payments.amount)`.
  - Never stored as an editable field.
- **Customer Profile & 3 Core Tabs**:
  - **Header Card**: Customer name, phone, village, address, large color-coded due badge (`Green: All clear` vs `Amber: ₹X due`), last visit date ("Today", "5 days ago").
  - **Tab 1: Purchase History**: Reverse-chronological list of visits with comma-separated medicines, total amount, paid, due created. Click to expand line items with prices. Direct PDF bill print button.
  - **Tab 2: Recently Bought**: Last 5 distinct medicines with purchase frequency and days-ago badges (e.g. "Dolo 650mg Tablet — 3x bought, last 2 days ago").
  - **Tab 3: Payment History**: Log of all due-clearing payments with date, amount, and note.
- **20-Second Purchase Entry**:
  - Repeatable medicine rows with real-time autocomplete suggestions from past entries.
  - Live auto-summed total bill amount.
  - "Amount Paid Now" input with live due calculation banner.
  - Atomic SQLite database transaction (all-or-nothing commit).
  - Print PDF bill option.
- **Collect Payment / Due Clearance**:
  - Settle customer dues via Cash, UPI/GPay, or Bank transfer.
  - Overpayment warning safeguard with confirmation toggle.
  - Reduces due balance immediately.
- **Dues Report & Filtering**:
  - Header metric card showing **Total Outstanding Dues** across all customers.
  - Village filter dropdown and sorting by amount, name, or village.
  - Click any customer row to instantly open their khata profile.
- **Automated Daily Backups**:
  - Automatically backs up SQLite database on server startup to `server/db/backups/`.
  - Manual one-click backup button in header.

---

## 🛠️ Tech Stack

| Layer | Choice |
|---|---|
| **Frontend** | React 18 + Tailwind CSS (Indigo accent palette), built with Vite |
| **Backend** | Node.js + Express (REST API) |
| **Database** | SQLite via `better-sqlite3` (WAL mode, offline-first) |
| **PDF Generation** | PDFKit |
| **Port Target** | `localhost:3001` (frontend) & `localhost:4000` (API) |

---

## 📁 Database Schema

```sql
CREATE TABLE customers (
  customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  village TEXT,
  address TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE entries (
  entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
  entry_date TEXT DEFAULT CURRENT_TIMESTAMP,
  total_amount REAL NOT NULL,
  amount_paid REAL NOT NULL,
  due_amount REAL NOT NULL
);

CREATE TABLE entry_medicine (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL REFERENCES entries(entry_id),
  medicine_name TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0
);

CREATE TABLE payments (
  payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
  pay_date TEXT DEFAULT CURRENT_TIMESTAMP,
  amount REAL NOT NULL,
  note TEXT
);

CREATE INDEX idx_customers_phone ON customers(phone_number);
CREATE INDEX idx_entries_customer ON entries(customer_id);
CREATE INDEX idx_payments_customer ON payments(customer_id);
```

---

## ⚡ Quick Start Instructions

### 1. Start Backend Server
```bash
cd server
npm install
node server.js
```

To re-seed sample data anytime:
```bash
node db/seed.js
```

### 2. Start Frontend App
```bash
cd client
npm install
npm run dev
```

Open your browser at: **`http://localhost:3001`**
