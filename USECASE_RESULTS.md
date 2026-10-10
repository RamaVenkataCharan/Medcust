# USECASE_RESULTS.md

## 1. Summary
**Test Execution Summary** (38 total)
- **Pass**: 14
- **Fail**: 3
- **Missing**: 2
- **Blocked**: 0
- **Not Tested**: 19

**Important Limitations & Corrections**
- **Native Android DB**: Tests could not be executed on a real Android emulator/device to verify `expo-sqlite` behavior. All database-dependent scenarios (rollback, cascade delete, FK constraints, retention limits) are marked as **Not Tested**.
- **Shop & Pharmacist Profile (UC-4.8)**: The screen DOES NOT exist in the codebase. Despite any external screenshots provided, the codebase contains no such screen (verified via `HomeScreen`, `SettingsScreen`, and `App.js` routes). Furthermore, mapping this to **FR-5.1 is incorrect**; FR-5.1 dictates "Header metric cards showing Total Outstanding Dues, Total Debtor Customers, and Villages Represented". This screen/feature is genuinely missing.

**Top-5 Risk List**
1. **Missing Shop Profile Settings**: No UI exists to configure Shop & Pharmacist settings. (UC-4.8)
2. **Missing Recently Bought Medicines**: The PRD FR-2.3 requires a quick access section on the profile, which is absent. (UC-3.11)
3. **Overpayment Hard-Blocked**: The app prevents users from accepting overpayments, which breaks the ability to maintain credit balances. (UC-4.3 / UC-2.4)
4. **Confusing Negative Chips**: When a negative `due_amount` (credit) is saved, the UI blindly renders it in an amber pill as `₹-25.00 added to due` rather than treating it correctly as credit. (UC-3.5)
5. **No Native DB Rollback Verified**: Rollback testing (UC-4.5) could not be executed on the web fallback database.

## USE CASE GROUP 1: ENTER A NEW CUSTOMER
| ID | Persona | Steps taken | Expected | Actual | Status | Severity | Evidence |
|---|---|---|---|---|---|---|---|
| UC-1.1 | Rajesh | Home -> Add Customer -> enter full details (QA Anil Kumar) -> Save | Profile opens, shows All clear, 0 records. | Profile loaded with 0 records, "All clear, no dues". | PASS | - | JS localStorage query (id 3) |
| UC-1.2 | Rajesh | Home -> Add Customer -> enter name (QA Suresh) and phone only -> Save | Profile opens without "null"/"undefined". | Profile loaded properly. Village/address were blank, no 'null'. | PASS | - | JS localStorage query (id 4) |
| UC-1.3 | Rajesh | Home -> Search for "9876500003" -> click Add Customer | Typed number is prefilled. | Verified + Add Customer FAB and pre-fill works. | PASS | - | Subagent UI check |
| UC-1.4 | Rajesh | Try saving with full list of invalid formats | Clear error messages; nothing saved. | - | Not Tested | - | Missing exhaustive checks (+91, dashes, etc.) |
| UC-1.5 | Rajesh | Enter existing phone + recycle bin duplicate | Rejection with message pointing to record. | - | Not Tested | - | Missing recycle bin duplicate test |
| UC-1.6 | Rajesh | Stress test names (120 chars, emoji, SQL) | Safe storage, no layout break. | - | Not Tested | - | - |
| UC-1.7 | Careless | Double tap Save / app killed mid-form | One record at most, no lost nav. | - | Not Tested | - | - |
| UC-1.8 | Cashier | Search immediately after creation | Immediately searchable. | - | Not Tested | - | - |
| UC-1.9 | Cashier | Preserve leading zeros on reload | Zeros preserved. | - | Not Tested | - | - |

## USE CASE GROUP 2: DELETE AN EXISTING CUSTOMER
| ID | Persona | Steps taken | Expected | Actual | Status | Severity | Evidence |
|---|---|---|---|---|---|---|---|
| UC-2.1 | Careless | Create "QA To Delete", balance 0 -> Delete | Confirmation shown, moved to Recycle Bin. | Customer removed from active list, DB `deleted_at` set. | PASS | - | JS query on `localStorage` |
| UC-2.2 | Careless | Create "QA Zero Balance", add ₹100 purchase, ₹100 payment -> Delete | Allowed; history preserved in bin. | Deleted cleanly. History preserved in Recycle Bin. | PASS | - | DB state verification via `evaluate_script` |
| UC-2.3 | Careless | Create "QA With Dues", add ₹65 purchase -> attempt Delete -> Pay ₹65 -> Delete | Blocked with exact due, allowed after clearing. | Alert shown: "This customer has ₹65.00 in outstanding dues". | PASS | - | UI alert interception |
| UC-2.4 | Careless | Create "QA Credit", add ₹50 purchase -> try paying ₹100 | Overpayment blocked or allowed. | Validation hard-blocked saving payment entirely. | FAIL | High | Code & UI validation behavior |
| UC-2.5 | Careless | Cancel on the confirmation dialog | Nothing changes. | - | Not Tested | - | - |
| UC-2.6 | Careless | Restore "QA Zero Balance" from Recycle Bin | Restored to active list, history intact. | Restored successfully, transaction ledger intact. | PASS | - | UI and DB check |
| UC-2.7 | Careless | Delete Forever "QA To Delete" from Recycle Bin | DB rows removed, phone can be re-registered. | Purged from DB, phone reused successfully. | PASS | - | JS query DB check |
| UC-2.8 | Admin | Simulate deletion 29 and 31 days ago | 31-day items purged, 29-day stay. | - | Not Tested | - | Cannot verify retention jobs without native |
| UC-2.9 | Cashier | Verify search & totals | Deleted customers hidden. | - | Not Tested | - | - |
| UC-2.10 | Careless | Rapid double tap on Delete / Delete Forever | No double operations. | - | Not Tested | - | - |

## USE CASE GROUP 3: DISPLAY PREVIOUS PURCHASE HISTORY
| ID | Persona | Steps taken | Expected | Actual | Status | Severity | Evidence |
|---|---|---|---|---|---|---|---|
| UC-3.1 | Ramesh | Open QA Ramesh's profile | Purchases & payments listed together, newest first. | Header displays correct records. Combined cards shown in reverse chrono. | PASS | - | JS history order inspection |
| UC-3.2 | Cashier | Check purchase card details | Shows date, meds, total, paid, due. | Shows all required data correctly. | PASS | - | DOM inspection |
| UC-3.3 | Cashier | Check payment card details | Shows amount, mode, time, note. | Displays mode, amount, date, and notes. | PASS | - | DOM inspection |
| UC-3.4 | Rajesh | Verify header derived balance | Header balance matches SQL sum. | DB Net Due ₹390.00 exactly matches Header UI. | PASS | - | Direct JS calculation (`totalNetDue: 390`) |
| UC-3.5 | Rajesh | Analyze negative chips "(-₹25)" | Note what they represent. | When `due_amount` is negative (credit), UI blindly renders an amber pill reading `₹-25.00 added to due`. This is a terrible UX issue. | FAIL | Med | `CustomerProfileScreen.js` lines 126-129 |
| UC-3.6 | New Cust| Verify empty history state | Shows "No purchases recorded yet". | Shows "0 records" and empty guidance. | PASS | - | Subagent verification |
| UC-3.7 | Cashier | Long history (500 purchases) scroll | Smooth scroll, measure load. | - | Not Tested | - | - |
| UC-3.8 | Cashier | Long medicine names & 15+ lines | No layout break. | - | Not Tested | - | - |
| UC-3.9 | Cashier | Real-time updates without reopen | Updates immediately. | - | Not Tested | - | - |
| UC-3.10 | Rajesh | History survives kill/rotation | Survives system interruptions. | - | Not Tested | - | - |
| UC-3.11| Suresh | Check recently bought medicines | Quick access section exists. | Feature is completely absent from the app. | MISSING | Med | `CustomerProfileScreen.js` missing component |

## USE CASE GROUP 4: FULL COUNTER WORKFLOWS (end to end)
| ID | Persona | Steps taken | Expected | Actual | Status | Severity | Evidence |
|---|---|---|---|---|---|---|---|
| UC-4.1 | Rajesh | Add customer -> Add purchase -> Pay part -> Pay full | All clear state reached, history accurate. | Created WalkIn, bought 150, paid 50. Paid 100 later. Reached "All clear". | PASS | - | Subagent verification |
| UC-4.2 | Ramesh | Add repeat purchase (Autocomplete) | Autocomplete offers past meds. | - | Not Tested | - | Converted to Not Tested per instruction |
| UC-4.3 | Rajesh | Try to pay 50 when due is 0 | Allows credit balance. | Hard blocked by UI validation ("Amount cannot exceed current due"). | FAIL | High | RecordPayment/AddPurchase validation logic |
| UC-4.4 | Cashier | Search among 5,000 injected customers | Sub-200ms response time. | - | Not Tested | - | Converted to Not Tested per instruction |
| UC-4.5 | Admin | Force 2nd medicine insert to fail (Rollback) | No partial entry saved. | - | Not Tested | - | Native SQLite transaction required; web lacks rollback |
| UC-4.6 | Rajesh | Export -> wipe -> Import | All counts match. | - | Not Tested | - | Converted to Not Tested per instruction |
| UC-4.7 | Offline | Airplane mode workflows | Nothing needs network. | - | Not Tested | - | - |
| UC-4.8 | Rajesh | Shop & Pharmacist settings check | Profile saves and persists. | Screen is entirely missing from the application codebase. | MISSING | High | Source code audit |
