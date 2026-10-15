/**
 * Pure utility functions for MedTrack license-expiry tracking and local reminder scheduling.
 * NO React Native dependencies. Safe for Node, Jest, Web, and Native environments.
 */

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Parses a YYYY-MM-DD string as a LOCAL date at midnight (00:00:00.000).
 * Avoids `new Date('YYYY-MM-DD')` which parses as UTC.
 * Returns null for empty, malformed, or impossible calendar dates (e.g. 2027-02-31, non-leap Feb 29).
 */
export function parseLocalDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const d = new Date(year, month - 1, day, 0, 0, 0, 0);

  // Check rollover for invalid dates like 2027-02-31 or 2027-04-31
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return null;
  }

  return d;
}

/**
 * Formats a valid YYYY-MM-DD date as "D MMM YYYY" (e.g. "31 Dec 2027").
 */
export function formatLicenseDate(validityISO) {
  const parsed = parseLocalDate(validityISO);
  if (!parsed) return validityISO || '';
  const day = parsed.getDate();
  const month = MONTH_NAMES[parsed.getMonth()];
  const year = parsed.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Normalizes a reference date input (Date instance, YYYY-MM-DD string, or now) to local midnight.
 */
function normalizeToday(todayDate) {
  if (todayDate instanceof Date) {
    return new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate(), 0, 0, 0, 0);
  }
  if (typeof todayDate === 'string') {
    const p = parseLocalDate(todayDate);
    if (p) return p;
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

/**
 * Computes the license status.
 * @param {string} validityISO - Expiration date in YYYY-MM-DD
 * @param {Date|string} [todayDate] - Optional reference date
 * @returns {{ state: 'none' | 'ok' | 'expiring' | 'expired', daysLeft: number, daysOverdue: number, isExpiringToday: boolean }}
 */
export function getLicenseStatus(validityISO, todayDate) {
  const expiry = parseLocalDate(validityISO);
  if (!expiry) {
    return { state: 'none', daysLeft: 0, daysOverdue: 0, isExpiringToday: false };
  }

  const today = normalizeToday(todayDate);
  const diffMs = expiry.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays > 90) {
    return { state: 'ok', daysLeft: diffDays, daysOverdue: 0, isExpiringToday: false };
  }
  if (diffDays >= 1 && diffDays <= 90) {
    return { state: 'expiring', daysLeft: diffDays, daysOverdue: 0, isExpiringToday: false };
  }
  if (diffDays === 0) {
    return { state: 'expiring', daysLeft: 0, daysOverdue: 0, isExpiringToday: true };
  }

  return { state: 'expired', daysLeft: 0, daysOverdue: Math.abs(diffDays), isExpiringToday: false };
}

/**
 * Pre-expiry reminder cadence offsets (days before expiry date):
 * - Weekly from 90 to 31 days before: [90, 83, 76, 69, 62, 55, 48, 41, 34]
 * - Every 3 days from 30 to 8 days before: [30, 27, 24, 21, 18, 15, 12, 9]
 * - Daily from 7 days before through expiry day (0): [7, 6, 5, 4, 3, 2, 1, 0]
 */
export const PRE_EXPIRY_OFFSETS = [
  90, 83, 76, 69, 62, 55, 48, 41, 34,
  30, 27, 24, 21, 18, 15, 12, 9,
  7, 6, 5, 4, 3, 2, 1, 0
];

/**
 * Builds the list of future trigger dates (9:00 AM local time) for a license.
 * Skips triggers that have already passed relative to todayDate / now.
 * Capped at maxCount.
 * 
 * @param {string} validityISO - Expiry date in YYYY-MM-DD
 * @param {Date|string} [todayDate] - Reference date/time
 * @param {number} [maxCount=20] - Maximum number of reminders to schedule ahead
 * @returns {Date[]} Array of Date objects set to 9:00 AM local time, with attached daysLeft & daysOverdue
 */
export function buildReminderSchedule(validityISO, todayDate, maxCount = 20) {
  const expiry = parseLocalDate(validityISO);
  if (!expiry || maxCount <= 0) return [];

  let now;
  if (todayDate instanceof Date) {
    now = todayDate;
  } else if (typeof todayDate === 'string') {
    const p = parseLocalDate(todayDate);
    // If passed a date string without time, default reference to start of that day (00:00)
    now = p || new Date();
  } else {
    now = new Date();
  }

  const today = normalizeToday(todayDate);
  const diffDays = Math.round((expiry.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  const schedule = [];

  // 1. Pre-expiry cadence triggers (offsets from 90 down to 0)
  for (const offset of PRE_EXPIRY_OFFSETS) {
    if (schedule.length >= maxCount) break;

    const trigger = new Date(
      expiry.getFullYear(),
      expiry.getMonth(),
      expiry.getDate() - offset,
      9, 0, 0, 0
    );

    if (trigger.getTime() > now.getTime()) {
      trigger.daysLeft = offset;
      trigger.daysOverdue = 0;
      schedule.push(trigger);
    }
  }

  // 2. Post-expiry cadence triggers (daily from day 1 overdue onwards)
  // Determine starting point for post-expiry checks:
  // If already expired, start around today's offset; otherwise start at 1 day after expiry (-1 offset).
  let postOffset = diffDays < 0 ? Math.min(-1, diffDays) : -1;

  while (schedule.length < maxCount) {
    const trigger = new Date(
      expiry.getFullYear(),
      expiry.getMonth(),
      expiry.getDate() - postOffset,
      9, 0, 0, 0
    );

    if (trigger.getTime() > now.getTime()) {
      trigger.daysLeft = 0;
      trigger.daysOverdue = Math.abs(postOffset);
      schedule.push(trigger);
    }

    postOffset--;
    // Safety guard: do not generate more than 365 daily notifications into the future
    if (Math.abs(postOffset) > 400 + Math.abs(diffDays)) {
      break;
    }
  }

  return schedule.slice(0, maxCount);
}

/**
 * Returns formatted notification title and body for a trigger event.
 */
export function getNotificationDetails(licenseType, validityISO, triggerDate) {
  const licenseName = licenseType === 'pharmacist' ? 'Pharmacist Registration' : 'Drug License';
  const formattedDate = formatLicenseDate(validityISO);
  const status = getLicenseStatus(validityISO, triggerDate);

  if (status.daysOverdue > 0) {
    return {
      title: `${licenseName} Expired`,
      body: `${licenseName} expired on ${formattedDate}. Renew it and update the date.`,
    };
  }

  if (status.daysLeft === 0) {
    return {
      title: `${licenseName} Expires Today`,
      body: `${licenseName} expires today (${formattedDate}). Tap to update.`,
    };
  }

  return {
    title: `${licenseName} Expiring Soon`,
    body: `${licenseName} expires in ${status.daysLeft} ${status.daysLeft === 1 ? 'day' : 'days'} (${formattedDate}). Tap to update.`,
  };
}
