import {
  parseLocalDate,
  formatLicenseDate,
  getLicenseStatus,
  buildReminderSchedule,
  getNotificationDetails,
  PRE_EXPIRY_OFFSETS,
} from '../src/utils/licenseReminders';

describe('licenseReminders pure utility tests', () => {
  describe('parseLocalDate', () => {
    test('parses valid YYYY-MM-DD as local date at midnight', () => {
      const d = parseLocalDate('2027-10-15');
      expect(d).not.toBeNull();
      expect(d.getFullYear()).toBe(2027);
      expect(d.getMonth()).toBe(9); // 0-indexed October
      expect(d.getDate()).toBe(15);
      expect(d.getHours()).toBe(0);
      expect(d.getMinutes()).toBe(0);
      expect(d.getSeconds()).toBe(0);
    });

    test('validates leap year 2028-02-29 as valid', () => {
      const d = parseLocalDate('2028-02-29');
      expect(d).not.toBeNull();
      expect(d.getFullYear()).toBe(2028);
      expect(d.getMonth()).toBe(1);
      expect(d.getDate()).toBe(29);
    });

    test('invalidates non-leap year 2027-02-29', () => {
      expect(parseLocalDate('2027-02-29')).toBeNull();
    });

    test('invalidates impossible calendar dates (e.g. 2027-02-31, 2027-04-31)', () => {
      expect(parseLocalDate('2027-02-31')).toBeNull();
      expect(parseLocalDate('2027-04-31')).toBeNull();
      expect(parseLocalDate('2027-06-31')).toBeNull();
    });

    test('returns null for empty, null, undefined, and non-date strings', () => {
      expect(parseLocalDate('')).toBeNull();
      expect(parseLocalDate(null)).toBeNull();
      expect(parseLocalDate(undefined)).toBeNull();
      expect(parseLocalDate('invalid')).toBeNull();
      expect(parseLocalDate('15-10-2027')).toBeNull();
    });
  });

  describe('formatLicenseDate', () => {
    test('formats valid ISO dates into D MMM YYYY', () => {
      expect(formatLicenseDate('2027-12-31')).toBe('31 Dec 2027');
      expect(formatLicenseDate('2026-01-05')).toBe('5 Jan 2026');
      expect(formatLicenseDate('2028-08-15')).toBe('15 Aug 2028');
    });

    test('returns raw input or empty string for invalid dates', () => {
      expect(formatLicenseDate('')).toBe('');
      expect(formatLicenseDate(null)).toBe('');
      expect(formatLicenseDate('invalid')).toBe('invalid');
    });
  });

  describe('getLicenseStatus', () => {
    const fixedToday = new Date(2026, 9, 15, 12, 0, 0, 0); // 15 Oct 2026

    test('returns "none" state for empty or invalid date', () => {
      expect(getLicenseStatus('', fixedToday)).toEqual({
        state: 'none',
        daysLeft: 0,
        daysOverdue: 0,
        isExpiringToday: false,
      });
      expect(getLicenseStatus(null, fixedToday).state).toBe('none');
    });

    test('returns "ok" when more than 90 days away', () => {
      // 120 days after 15 Oct 2026 is 12 Feb 2027
      const status = getLicenseStatus('2027-02-12', fixedToday);
      expect(status.state).toBe('ok');
      expect(status.daysLeft).toBe(120);
      expect(status.daysOverdue).toBe(0);
      expect(status.isExpiringToday).toBe(false);
    });

    test('returns "expiring" when between 1 and 90 days away', () => {
      // 45 days after 15 Oct 2026 is 29 Nov 2026
      const status45 = getLicenseStatus('2026-11-29', fixedToday);
      expect(status45.state).toBe('expiring');
      expect(status45.daysLeft).toBe(45);
      expect(status45.daysOverdue).toBe(0);
      expect(status45.isExpiringToday).toBe(false);

      // 90 days exactly
      const status90 = getLicenseStatus('2027-01-13', fixedToday);
      expect(status90.state).toBe('expiring');
      expect(status90.daysLeft).toBe(90);

      // 1 day away
      const status1 = getLicenseStatus('2026-10-16', fixedToday);
      expect(status1.state).toBe('expiring');
      expect(status1.daysLeft).toBe(1);
    });

    test('returns "expiring" with isExpiringToday: true on expiry date itself', () => {
      const status = getLicenseStatus('2026-10-15', fixedToday);
      expect(status.state).toBe('expiring');
      expect(status.daysLeft).toBe(0);
      expect(status.daysOverdue).toBe(0);
      expect(status.isExpiringToday).toBe(true);
    });

    test('returns "expired" with daysOverdue for past dates', () => {
      // 1 day expired
      const status1 = getLicenseStatus('2026-10-14', fixedToday);
      expect(status1.state).toBe('expired');
      expect(status1.daysLeft).toBe(0);
      expect(status1.daysOverdue).toBe(1);
      expect(status1.isExpiringToday).toBe(false);

      // 100 days expired
      const status100 = getLicenseStatus('2026-07-07', fixedToday);
      expect(status100.state).toBe('expired');
      expect(status100.daysLeft).toBe(0);
      expect(status100.daysOverdue).toBe(100);
    });
  });

  describe('buildReminderSchedule', () => {
    test('cadence offsets are correctly configured', () => {
      // Weekly from 90 to 31 days before (step 7)
      const weekly = [90, 83, 76, 69, 62, 55, 48, 41, 34];
      // Every 3 days from 30 to 8 days before (step 3)
      const every3 = [30, 27, 24, 21, 18, 15, 12, 9];
      // Daily from 7 to 0
      const daily = [7, 6, 5, 4, 3, 2, 1, 0];

      expect(PRE_EXPIRY_OFFSETS).toEqual([...weekly, ...every3, ...daily]);
    });

    test('generates reminders set to 9:00 AM local time', () => {
      const refDate = new Date(2026, 9, 15, 8, 0, 0, 0); // 15 Oct 2026, 8:00 AM
      const validity = '2026-11-15'; // 31 days ahead
      const schedule = buildReminderSchedule(validity, refDate, 10);

      expect(schedule.length).toBeGreaterThan(0);
      for (const item of schedule) {
        expect(item.getHours()).toBe(9);
        expect(item.getMinutes()).toBe(0);
        expect(item.getSeconds()).toBe(0);
      }
    });

    test('skips triggers that have already passed', () => {
      // If today is 15 Oct 2026, 10:00 AM and expiry is 15 Oct 2026 (today), 9:00 AM today is past
      const refDate = new Date(2026, 9, 15, 10, 0, 0, 0);
      const schedule = buildReminderSchedule('2026-10-15', refDate, 5);
      // The first scheduled trigger must be tomorrow (16 Oct) or later at 9:00 AM
      expect(schedule.length).toBe(5);
      expect(schedule[0].getTime()).toBeGreaterThan(refDate.getTime());
      expect(schedule[0].getDate()).toBe(16);
    });

    test('caps at requested maxCount', () => {
      const refDate = new Date(2026, 0, 1, 0, 0, 0, 0);
      const schedule = buildReminderSchedule('2026-06-01', refDate, 15);
      expect(schedule.length).toBe(15);
    });

    test('returns empty array for invalid date', () => {
      expect(buildReminderSchedule('', new Date(), 20)).toEqual([]);
      expect(buildReminderSchedule(null, new Date(), 20)).toEqual([]);
    });

    test('continues daily after expiry for already expired licenses', () => {
      const refDate = new Date(2026, 9, 15, 8, 0, 0, 0); // 15 Oct 2026
      const schedule = buildReminderSchedule('2026-09-01', refDate, 5); // expired 44 days ago
      expect(schedule.length).toBe(5);
      // First reminder is today 15 Oct at 9:00 AM
      expect(schedule[0].getDate()).toBe(15);
      expect(schedule[0].getHours()).toBe(9);
      // Next reminder is tomorrow 16 Oct at 9:00 AM
      expect(schedule[1].getDate()).toBe(16);
    });
  });

  describe('getNotificationDetails', () => {
    test('returns correct details for Drug License expiring soon', () => {
      const trigger = new Date(2026, 9, 1, 9, 0, 0, 0);
      const details = getNotificationDetails('shop', '2026-11-15', trigger);
      expect(details.title).toBe('Drug License Expiring Soon');
      expect(details.body).toContain('Drug License expires in 45 days (15 Nov 2026)');
    });

    test('returns correct details for Pharmacist Registration expiring today', () => {
      const trigger = new Date(2026, 9, 15, 9, 0, 0, 0);
      const details = getNotificationDetails('pharmacist', '2026-10-15', trigger);
      expect(details.title).toBe('Pharmacist Registration Expires Today');
      expect(details.body).toContain('Pharmacist Registration expires today (15 Oct 2026)');
    });

    test('returns correct details for expired Drug License', () => {
      const trigger = new Date(2026, 9, 20, 9, 0, 0, 0);
      const details = getNotificationDetails('shop', '2026-10-15', trigger);
      expect(details.title).toBe('Drug License Expired');
      expect(details.body).toContain('Drug License expired on 15 Oct 2026');
    });
  });
});
