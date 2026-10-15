/**
 * Legal and safety notice constants for MedTrack.
 * These texts can be replaced by lawyer-approved wording without modifying UI screens.
 */

export const LEGAL_TEXT_VERSION = '1.0.0';

export const APP_NAME = 'MedTrack';
export const APP_TAGLINE = 'Medical Khata Book';

export const TERMS_OF_USE_TEXT = `[REPLACE WITH LAWYER-REVIEWED TEXT]

1. Purpose and "As Is" Basis
MedTrack is an offline customer credit ledger designed for retail pharmacies and medical stores. The application is provided "as is" and "as available" without warranty of any kind, express or implied.

2. Verification of Bills and Balances
The user must independently verify all bills, customer ledgers, discounts, payments, and due balances before relying on them or settling transactions with customers.

3. License Reminders Disclaimer
Drug license and pharmacist registration expiry reminders are provided solely as an offline convenience and do not constitute a legal, regulatory, or compliance guarantee. The user remains solely responsible for tracking renewal deadlines and complying with applicable pharmacy regulations.

4. Customer Data Responsibility
The shop owner is solely responsible for all customer names, phone numbers, addresses, and transaction data entered into the application.

5. Data Storage and Backup Responsibility
All data is stored exclusively on this local device and is never transmitted to the developer. The user is solely responsible for regularly exporting and securely retaining off-device backups. Loss of or damage to the device may result in unrecoverable data loss if backups are not maintained.`;

export const PRIVACY_POLICY_TEXT = `[REPLACE WITH LAWYER-REVIEWED TEXT]

1. Local-Only Storage
All data entered into MedTrack (including customer details, credit transactions, payments, and license dates) is stored exclusively on this device. No data is ever sent to the developer, external servers, or third parties.

2. No Remote Telemetry or Tracking
The application does not include any analytics SDKs, advertising frameworks, crash-reporting trackers, or remote network calls.

3. Local Notifications
Notification permissions are used solely to schedule local offline reminders on this device at 9:00 AM for license validity dates. No push tokens or remote servers are involved.

4. User-Controlled Backups
Backup files are generated and stored locally on your device in standard JSON format. When you choose to share a backup, you control the destination.`;

export const FIRST_LAUNCH_NOTICE = {
  title: 'Important Safety & Privacy Notice',
  summaryText: `Welcome to MedTrack. Please review these essential safety and operational terms before using the app:

• Customer Credit Ledger "As Is": MedTrack is an offline credit ledger. You must independently verify all bills, prices, and customer balances.
• Local-Only Storage: All data is stored only on this device and is never sent to the developer.
• You Are Responsible for Backups: Because your data is only on this phone, you are responsible for regularly exporting backups from Settings.
• Reminders Are a Convenience: License and registration reminders are an offline convenience, not a regulatory compliance guarantee.
• Customer Data: You are solely responsible for all customer information you enter into the app.`,
  backupWarningTitle: 'Backup Warning',
  backupWarningText: 'Your data is stored ONLY on this phone. If this device is lost, stolen, or damaged, your data cannot be recovered without a backup. Export backups regularly to external storage.',
  buttonText: 'I understand',
};
