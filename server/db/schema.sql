-- MedTrack Khata Ledger Schema
-- Digital Khata (Ledger) Book for Medical Shop: Pure customer dues tracking with medicine purchase history

CREATE TABLE IF NOT EXISTS customers (
  customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  village TEXT,
  address TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS entries (
  entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
  entry_date TEXT DEFAULT CURRENT_TIMESTAMP,
  total_amount REAL NOT NULL,
  amount_paid REAL NOT NULL,
  due_amount REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS entry_medicine (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL REFERENCES entries(entry_id),
  medicine_name TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS payments (
  payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
  pay_date TEXT DEFAULT CURRENT_TIMESTAMP,
  amount REAL NOT NULL,
  note TEXT
);

-- Indexes for sub-second search and queries
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone_number);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_entries_customer ON entries(customer_id);
CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_entry_medicine_entry ON entry_medicine(entry_id);
CREATE INDEX IF NOT EXISTS idx_entry_medicine_name ON entry_medicine(medicine_name);

-- ══════════════════════════════════════════════════════════
-- AI Revenue Recovery System — Phase 2 Tables
-- ══════════════════════════════════════════════════════════

-- Recovery cases — one per delinquent customer account
-- State machine: NEW → CONTACTED → PROMISED → RECOVERED
--                                  → PARTIAL
--                                  → PROMISE_BROKEN → (back to CONTACTED queue)
CREATE TABLE IF NOT EXISTS cases (
  case_id TEXT PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
  total_due REAL NOT NULL,
  amount_recovered REAL NOT NULL DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'NEW'
    CHECK(state IN ('NEW','CONTACTED','PROMISED','PARTIAL','RECOVERED','PROMISE_BROKEN')),
  priority_score REAL DEFAULT 0,
  promise_pay_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Call logs — one row per outbound call attempt (append-only for audit)
CREATE TABLE IF NOT EXISTS call_logs (
  call_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(case_id),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  outcome TEXT CHECK(outcome IN (
    'NO_ANSWER','REFUSED','PROMISED','ESCALATED_TO_HUMAN','DISCONNECTED','COMPLETED'
  )),
  transcript_ref TEXT,
  sentiment_score REAL,
  ai_disclosed_at_start INTEGER NOT NULL DEFAULT 0,
  compliance_flags TEXT NOT NULL DEFAULT '[]',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Payment events — one row per webhook received (append-only for audit)
CREATE TABLE IF NOT EXISTS payment_events (
  event_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(case_id),
  provider TEXT NOT NULL CHECK(provider IN ('razorpay','cashfree')),
  amount REAL NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('INITIATED','SUCCESS','FAILED')),
  received_at TEXT NOT NULL,
  raw_payload_ref TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Audit trail — append-only log of all state changes (tamper-evident)
CREATE TABLE IF NOT EXISTS audit_trail (
  audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  old_state TEXT,
  new_state TEXT,
  details TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- DND blocklist (optional — for local DND checks)
CREATE TABLE IF NOT EXISTS dnd_blocklist (
  phone_number TEXT PRIMARY KEY,
  added_at TEXT DEFAULT CURRENT_TIMESTAMP,
  source TEXT DEFAULT 'manual'
);

-- Recovery system indexes
CREATE INDEX IF NOT EXISTS idx_cases_customer ON cases(customer_id);
CREATE INDEX IF NOT EXISTS idx_cases_state ON cases(state);
CREATE INDEX IF NOT EXISTS idx_cases_priority ON cases(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_cases_promise_deadline ON cases(promise_pay_by);
CREATE INDEX IF NOT EXISTS idx_call_logs_case ON call_logs(case_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_started ON call_logs(started_at);
CREATE INDEX IF NOT EXISTS idx_payment_events_case ON payment_events(case_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_status ON payment_events(status);
CREATE INDEX IF NOT EXISTS idx_audit_trail_entity ON audit_trail(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_created ON audit_trail(created_at);

-- ══════════════════════════════════════════════════════════
-- Courtesy Due Reminder Engine Tables
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS reminder_settings (
  customer_id INTEGER PRIMARY KEY REFERENCES customers(customer_id),
  reminders_enabled INTEGER NOT NULL DEFAULT 1,   -- pharmacist can disable per customer
  paused_until TEXT                                -- optional temporary pause (e.g. known financial hardship)
);

CREATE TABLE IF NOT EXISTS reminder_log (
  reminder_id TEXT PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
  channel TEXT NOT NULL,              -- 'whatsapp' | 'sms' | 'courtesy_call'
  message_text TEXT NOT NULL,
  payment_link TEXT,
  due_amount_at_send REAL NOT NULL,
  scheduled_stage TEXT NOT NULL,      -- e.g. 'T+3', 'T+7', 'T+14', 'MANUAL', 'COURTESY_CALL'
  sent_at TEXT DEFAULT CURRENT_TIMESTAMP,
  delivery_status TEXT,               -- 'SENT' | 'DELIVERED' | 'FAILED' | 'READ'
  provider_message_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_reminder_log_customer ON reminder_log(customer_id);
CREATE INDEX IF NOT EXISTS idx_reminder_log_sent ON reminder_log(sent_at);
CREATE INDEX IF NOT EXISTS idx_reminder_log_stage ON reminder_log(customer_id, scheduled_stage);
