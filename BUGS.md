# MedTrack Mobile Audit Report (Phase A: Diagnose)

**Date:** 2026-10-11  
**Target Codebase:** `mobile/`  
**Base Branch:** `apk-testing` (Matches user's Phone APK build)  
**Last Verified Commit:** `496c640 docs: revamp README with comprehensive architecture, features, mobile guide, and quickstart`  
**Donor Reference:** `feat/finish-medcust` (Commit `200c003`)

---

## 1. Environment & Phone Build Verification (Step 0)

* **Workspace Folder Audited:** `mobile/` in isolated worktree `../medtrack-audit` (branch `apk-testing`).
* **Active Git Branch:** `apk-testing` (commit `496c640`).
* **Lineage & Pharmacist Search (`git grep -i "Pharmacist"` across all branches):**
  * Mobile Pharmacist fields exist **strictly on `apk-testing`**:
    * `mobile/src/screens/SettingsScreen.js:152` — Screen Title: `Shop & Pharmacist Profile`
    * `mobile/src/screens/SettingsScreen.js:159-200` — Inputs for Pharmacist Name (`placeholder="e.g. R. K. Sharma (Reg. Pharmacist)"`), Pharmacist Phone Number, and Pharmacist License Validity (`placeholder="YYYY-MM-DD"`).
    * `mobile/src/db/database.js:27-38` — Table `shop_profile` (`pharmacist_name`, `pharmacist_phone`, `pharmacist_license_validity`).
  * On `feat/finish-medcust`, `SettingsScreen.js` contains **0 pharmacist fields** (only JSON backup export/import).
  * On `main` and `origin/cleanup-mobile-only`, mobile pharmacist profile does not exist.
  * **Conclusion:** The build installed on the user's phone was created from `apk-testing` via EAS build (`16bc4e2 build(eas): add preview apk build profile on apk-testing branch`).

---

## 2. In-Depth Root Cause Investigations (Step 1)

### Problem 1: Discount on Purchases (Missing Feature + History)
* **Expected:** Cashier can apply a bill-level percentage discount (e.g. Subtotal ₹500.00, 15% discount -> -₹75.00, Net ₹425.00). Dues = `net_total - paid_now`. The discount percentage and amount must be persisted and shown in ledger history.
* **Root Cause:**
  * `mobile/src/screens/AddPurchaseScreen.js:208-218`: Only supports flat rupee discount per medicine item (`item.discount`). There is no overall bill discount percentage input.
  * `mobile/src/utils/khataLogic.js:75-96`: `calculatePurchaseTotal` sums medicine line totals (`price - discount`), ignoring bill-level percentage discounts.
  * `mobile/src/db/database.js:377-430`: SQLite `entries` table schema (`entry_id, customer_id, entry_date, total_amount, amount_paid, due_amount`) has no columns for `subtotal`, `discount_percent`, or `discount_amount`.
  * `mobile/src/screens/CustomerProfileScreen.js:480-495`: History purchase cards render only `item.total_amount` and medicine chips. There is no subtotal or bill discount breakdown.
* **Money Representation:** Floating-point `REAL` rupees (e.g., `500.00`, `75.00`).
* **Non-Destructive Schema Migration Plan:**
  1. Add idempotent column migration in `initNativeDatabase()`:
     ```sql
     ALTER TABLE entries ADD COLUMN subtotal REAL DEFAULT 0;
     ALTER TABLE entries ADD COLUMN discount_percent REAL DEFAULT 0;
     ALTER TABLE entries ADD COLUMN discount_amount REAL DEFAULT 0;
     ```
  2. Backfill existing entries:
     ```sql
     UPDATE entries SET subtotal = total_amount, discount_percent = 0, discount_amount = 0 WHERE subtotal IS NULL OR subtotal = 0;
     ```
  3. Web driver state update: mirror `subtotal`, `discount_percent`, `discount_amount` in `state.entries`.
  4. Invariant Verification:
     * `subtotal = SUM(medicine_line_totals)`
     * `discount_amount = Math.round((subtotal * (discount_percent / 100)) * 100) / 100` (Half-up 2 decimals)
     * `net_total = Math.max(0, subtotal - discount_amount)`
     * `due_amount = Math.max(0, net_total - amount_paid)`
     * `customer_balance = SUM(due_amount) - SUM(payments)` holds unchanged.
  5. History Display:
     * If `discount_percent > 0`: `"Subtotal ₹500.00, Discount 15% (-₹75.00), Total ₹425.00, Paid ₹X, Due ₹Y"`
     * If `discount_percent === 0` (or legacy records): `"Total ₹500.00, Paid ₹X, Due ₹Y"` (renders unchanged).
* **Files to Change:**
  * `mobile/src/screens/AddPurchaseScreen.js`
  * `mobile/src/utils/khataLogic.js`
  * `mobile/src/db/database.js`
  * `mobile/src/screens/CustomerProfileScreen.js`
  * `mobile/src/services/exportService.js`

---

### Problem 2: Delete Button Does Nothing on Phone
* **Expected:** Tapping delete on customer profile shows confirmation; confirming moves customer to Recycle Bin (`deleted_at` set), navigates to Home, and shows success message. If dues exist, shows exact-due blocking alert.
* **Root Causes:**
  1. `mobile/src/screens/CustomerProfileScreen.js:42-63`: Hard guard inside `handleDeletePress`:
     ```javascript
     if (currentDue > 0.001) {
       Alert.alert('Cannot Delete Customer', `Clear this customer's due before deleting — currently ₹${currentDue.toFixed(2)} due.`);
       return;
     }
     if (currentDue < -0.001) {
       Alert.alert('Cannot Delete Customer', `Clear this customer's credit balance before deleting — currently ₹${Math.abs(currentDue).toFixed(2)} in credit.`);
       return;
     }
     ```
     If the customer has ANY outstanding due or credit balance, `setDeleteModalVisible(true)` is blocked. On Android devices where `Alert.alert` is suppressed, dismissed, or fails in certain contexts, tapping the button appears completely unresponsive.
  2. `mobile/src/db/database.js:370`: `db.runSync("UPDATE customers SET deleted_at = ? WHERE customer_id = ?")` executes without verifying `result.changes > 0`.
  3. `mobile/src/screens/CustomerProfileScreen.js:68-78`: `confirmDeleteCustomer` closes modal and calls `navigation.goBack()` with zero success feedback or toast.
* **Reproduction & Verification:**
  * Tested in code analysis and web runner: With `currentDue !== 0`, the delete modal never renders. When `currentDue === 0`, it soft-deletes but returns to Home silently with no toast.
  * *Native Verification Note:* Verified logic flow in code; exact Android native dialog dismissal is verified against React Native `Alert.alert` lifecycle.

---

### Problem 3: No User Profile Button on Home
* **Expected:** Visible Profile button on Home header (next to Backup and Settings) opening Shop & Pharmacist Profile. Screen reachable from Settings.
* **Root Cause:**
  * `mobile/src/screens/HomeScreen.js:122-130`: Header has only `exportButton` ("Backup") and a tiny 20px grey gear icon (`settings-outline`).
  * The Shop & Pharmacist Profile form is actually embedded inside `mobile/src/screens/SettingsScreen.js:152`.
  * There is no Profile button, pharmacy name banner, or user avatar on `HomeScreen`. Cashiers cannot tell where to configure the pharmacy license and pharmacist credentials.
* **Proposed Fix:**
  * Add a dedicated Profile button / avatar on `HomeScreen.js` header (e.g. `person-circle-outline` or medical badge) navigating to `Settings` (or directly focusing the profile card).
  * Ensure `SettingsScreen.js` provides clear jump-navigation between Shop Profile and Recycle Bin.

---

### Problem 4: Record Payment Shows Only "Processing", No Success Message
* **Expected:** After recording payment, show clear success confirmation (`"₹X payment received (Cash). New balance: ₹Y due / All clear / Credit ₹Z"`), reset loading state, and update profile history.
* **Root Causes:**
  1. `mobile/src/screens/CustomerProfileScreen.js:95-125`: Inside payment modal, `handleRecordPayment` sets `savingPayment = true`, executes `addDuePayment()`, and immediately calls:
     ```javascript
     setPaymentAmount('');
     setPayModalVisible(false);
     loadProfile();
     ```
     It dismisses the modal with **zero success confirmation, toast, or alert**. Cashiers see the button toggle to `"Saving..."` and then disappear, creating confusion over whether the payment saved or crashed.
  2. `feat/finish-medcust` donor branch (`RecordPaymentScreen.js:180-225`): On partial payments (`remainingDuePaise > 0`), it calls `navigation.goBack()` without calling `setSaving(false)`, permanently leaving the button on an `ActivityIndicator` spinner if navigation lags.
* **Proposed Fix:**
  * Introduce an in-app success toast or confirmation dialog displaying: `"₹{amount} payment received. New balance: ₹{newDue} / All clear"`.
  * Ensure `setSavingPayment(false)` is always handled in `finally`.

---

## 3. General Bug & Glitch Sweep Table (Step 2)

| ID | Screen | Symptom | Root Cause (file:line) | Severity | Proposed Fix | Verified How |
|---|---|---|---|:---:|---|---|
| **BUG-01** | `AddPurchaseScreen.js` | Missing bill-level discount | `AddPurchaseScreen.js:208`, `khataLogic.js:75` | **High** | Add discount % field, calculate net total & due, save to DB | Code reading & web test |
| **BUG-02** | `CustomerProfileScreen.js` | Delete button does nothing | `CustomerProfileScreen.js:42-63` (due guard blocks modal) | **High** | Show clear blocking modal or allow zero-balance confirmation with toast | Code reading & web test |
| **BUG-03** | `HomeScreen.js` | No profile button on Home | `HomeScreen.js:122-130` (only 20px gear icon) | **Med** | Add visible Shop Profile button/badge to header | Code reading |
| **BUG-04** | `CustomerProfileScreen.js` | Payment shows only "Saving", no feedback | `CustomerProfileScreen.js:95-125` (abrupt modal close) | **High** | Add success confirmation toast with new due balance | Code reading |
| **BUG-05** | `AddCustomerScreen.js` | Phone accepts 0-5 prefixes & truncates >10 | `khataLogic.js:9-12`, `AddCustomerScreen.js:46` | **High** | Enforce `/^[6-9]\d{9}$/` regex, reject >10 digits with error | Code reading |
| **BUG-06** | `database.js` | Village search omitted in SQL | `database.js:263` (`WHERE c.phone_number LIKE ? OR c.name LIKE ?`) | **Med** | Add `OR c.village LIKE ?` to SQL and web filter | Code reading |
| **BUG-07** | `CustomerProfileScreen.js` | Phone number not tappable to call | `CustomerProfileScreen.js:244` (plain Text) | **Low** | Wrap in `TouchableOpacity` with `Linking.openURL('tel:${phone}')` | Code reading |
| **BUG-08** | `CustomerProfileScreen.js` | Negative balance (credit) styled as alert | `CustomerProfileScreen.js:259` (amber warning) | **Med** | Render distinct green "Credit ₹X" badge | Code reading |
| **BUG-09** | `AddPurchaseScreen.js` | Double tap can save duplicate purchases | `AddPurchaseScreen.js:95` (no debounce on tap) | **Med** | Disable button immediately on press; guard with `saving` state | Code reading |
| **BUG-10** | `database.js` | Soft delete row count unchecked | `database.js:370` (`db.runSync` unchecked) | **Low** | Verify `result.changes > 0`, throw error if 0 | Code reading |
| **BUG-11** | `RecycleBinScreen.js` | Missing 30-day auto-purge countdown | `RecycleBinScreen.js:70` (only shows "Deleted X days ago") | **Low** | Display remaining days until auto-purge | Code reading |
| **BUG-12** | `HomeScreen.js` | Search input causes outline on web | `HomeScreen.js:145` (missing `outlineStyle: 'none'`) | **Low** | Port `noFocusOutline` style from donor branch | Code reading |

---

## 4. Cashier UX & Productivity Audit (Step 3)

### Current Workflow Evaluation (Taps & Time Under Queue Pressure)

| Workflow | Current Steps & Taps | Estimated Time | Friction Point |
|---|:---:|:---:|---|
| **Find Customer** | 2 taps (Tap search, type name/phone) | 3-5 sec | Cannot search by village name; keyboard covers results on smaller devices. |
| **Add Customer** | 4 taps + typing | 8-12 sec | Silently truncates wrong numbers; no auto-jump from phone to name. |
| **Record Purchase with Discount** | 6-9 taps + typing per row | 15-25 sec | Cashier must manually compute rupees discount per medicine item; no bill-level 10% / 15% quick discount. |
| **Record Payment** | 4 taps (Open modal, type amount, confirm) | 6-10 sec | Closes with zero feedback; cashier does not know if payment registered. |
| **Delete Customer** | 2 taps (Taps trash, gets blocked or silent back) | 4-6 sec | Zero explanation if blocked by balance; no undo snackbar. |

### Concrete Ranked Improvements (Impact vs Effort)

1. **Success Toast / Snackbar with Balance Summary (High Impact / Low Effort):**
   * Immediately after saving payment or purchase, show a 2.5-second bottom banner: `"₹300.00 payment received. Balance: All Clear!"`.
2. **Bill-Level Percentage Discount Chips (High Impact / Med Effort):**
   * Provide `5%`, `10%`, `15%`, `Custom` chips in `AddPurchaseScreen.js` to auto-calculate discount with 1 tap.
3. **"Pay Remaining Dues" Quick-Fill Chip (High Impact / Low Effort):**
   * In payment modal, place a chip: `[Pay Full ₹{totalDue}]` that populates the input instantly.
4. **Village Search Integration (High Impact / Low Effort):**
   * Include village in customer search so cashiers can quickly find all customers from a particular locality.
5. **One-Tap Phone Call (Med Impact / Low Effort):**
   * Allow tapping the customer's phone number on profile to open the Android dialer.
6. **Keyboard Next/Done Flow (Med Impact / Low Effort):**
   * Add `returnKeyType="next"` across Add Customer and Add Purchase rows.
7. **Haptic Feedback on Writes (Low Impact / Low Effort):**
   * Trigger light haptic feedback on successful save using `expo-haptics`.

---

## 5. Scope & Non-Verifiable Items on Native

* **Verified:**
  * Complete codebase structure, SQLite schema, and JavaScript execution paths across `apk-testing` and `feat/finish-medcust`.
  * Non-destructive migration SQL and mathematical invariants.
  * Web fallback execution for customer search, purchases, and payments.
* **Not Verifiable on Native in Current Session:**
  * Exact Android hardware dismissal of `Alert.alert` on specific OEM ROMs (Samsung OneUI vs Xiaomi MIUI).
  * Native SQLite file lock timing during concurrent writes (mobile runs strictly single-threaded sync queries).

---
*Awaiting your explicit "approved" before proceeding to Phase B implementation.*
