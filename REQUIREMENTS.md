# MedTrack — System Requirements Specification (SRS)
## Customer Khata & Medicine Purchase History

**Document Version:** 2.0.0 (Core Scope)  
**Project Name:** MedTrack  
**Classification:** Core Functional Specification  
**Status:** Active  

---

## 1. System Overview

**MedTrack** is a digital khata (ledger) book designed strictly for high-speed retail pharmacy counter operations. Its core workflow is:
$$\text{Enter Phone Number} \longrightarrow \text{View Customer Details, Medicine Purchase History, and Current Due Balance}$$

### Core Features
- **Phone-Number-First Customer Search**: Immediate counter lookup by 10-digit mobile number (< 2s response, `/` shortcut).
- **Customer Khata Profile**: Full profile with computed live dues, visit history, and frequently bought medicines.
- **Counter Purchase Entry**: Fast repeatable medicine line items with past purchase autocomplete and live due computation.
- **Payment Collection**: Due clearance with instant balance derivation and overpayment safeguards.
- **Dues Report**: Store-wide receivables report filterable by village and sortable by outstanding amount.
- **Data Protection & Backups**: Automated database backups on startup and manual 1-click snapshot creation.

---

## 2. Core Data Model

```
+--------------------+        +---------------------+        +--------------------+
|     CUSTOMERS      | 1    * |       ENTRIES       | 1    * |   ENTRY_MEDICINE   |
|--------------------|--------|---------------------|--------|--------------------|
| customer_id (PK)   |        | entry_id (PK)       |        | id (PK)            |
| phone_number (UQ)  |        | customer_id (FK)    |        | entry_id (FK)      |
| name               |        | entry_date          |        | medicine_name      |
| village            |        | total_amount        |        | price              |
| address            |        | amount_paid         |        +--------------------+
| created_at         |        | due_amount          |
| updated_at         |        +---------------------+
+--------------------+
          | 1
          |
          | *
+--------------------+
|      PAYMENTS      |
|--------------------|
| payment_id (PK)    |
| customer_id (FK)   |
| pay_date           |
| amount             |
| note               |
+--------------------+
```

---

## 3. Functional Requirements

### 3.1 Customer Search & Registration
- **FR-1.1**: The search input field auto-focuses on load and accepts a 10-digit phone number.
- **FR-1.2**: Global keyboard shortcut `/` focuses the search bar from any screen.
- **FR-1.3**: Indexed lookup by 10-digit mobile number with fallback on customer name and village.
- **FR-1.4**: If the customer is not found, a "+ Add New Customer" form is presented requiring Name, Phone Number (10 digits enforced), and optional Village and Address.

### 3.2 Customer Khata Profile
- **FR-2.1 Customer Header**:
  - Displays Customer Name, Phone Number, Village, Address, and Last Visit date.
  - Displays a color-coded due badge:
    - `Green ("All Clear")`: Current due is ₹0.
    - `Amber ("₹X Due")`: Current due > ₹0.
- **FR-2.2 Zero-Error Due Accounting**:
  - Customer outstanding due is strictly computed dynamically:
    $$\text{Total Customer Due} = \sum (\text{entries.due\_amount}) - \sum (\text{payments.amount})$$
  - Due balance is never stored as an editable or manual column.
- **FR-2.3 Tab 1 — Purchase History**:
  - Reverse-chronological list of visits showing date, medicines taken, total amount, paid amount, and due created.
  - Line items can be expanded to inspect individual medicine prices.
  - Paginated at ~10 visits per page with navigation.
- **FR-2.4 Tab 2 — Recently Bought**:
  - Displays the last 5 distinct medicines purchased with repeat frequency count and days-ago markers.
- **FR-2.5 Tab 3 — Payment History**:
  - Displays all due-clearing payments with receipt ID, payment date, amount, and note.

### 3.3 Counter Purchase Entry
- **FR-3.1**: Repeatable medicine item rows (Medicine Name + Price, or one total amount).
- **FR-3.2**: Autocomplete suggestions populated from past `entry_medicine` records.
- **FR-3.3**: Cashier enters "Amount Paid Now", and the system auto-computes `due_amount = total_amount - amount_paid`.
- **FR-3.4**: Atomic SQLite transaction committing both the entry and line items simultaneously.

### 3.4 Payment Collection
- **FR-4.1**: Settle customer dues via Cash, UPI, or Bank transfer.
- **FR-4.2**: Overpayment warning safeguards if payment amount exceeds outstanding due.
- **FR-4.3**: Reduces customer due balance immediately upon submission.

### 3.5 Dues Report
- **FR-5.1**: Header metric cards showing Total Outstanding Dues, Total Debtor Customers, and Villages Represented.
- **FR-5.2**: Village dropdown filter and sorting by Due Amount, Name, or Village.
- **FR-5.3**: Clicking any row immediately opens the customer's khata profile.

### 3.6 Data Protection & Backups
- **FR-6.1**: Automated database backup on server startup saved to `server/db/backups/`.
- **FR-6.2**: Manual 1-click database backup button in header.

---

## 4. UI Standards
- Clean cards with subtle border treatments (`border-slate-200/90`).
- Single primary accent color (Tailwind `indigo-600` palette).
- Color-coded badges for dues (`emerald-50` / `emerald-700` for clear, `amber-50` / `amber-800` for dues).
- Non-intrusive toast notifications and accessible modal dialogs (no browser `alert()` or `confirm()`).
