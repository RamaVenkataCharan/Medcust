import { shouldShowBackupReminder, getDaysSince } from '../src/utils/backupReminder';

describe('backupReminder pure utility tests', () => {
  const baseDate = new Date('2026-10-15T12:00:00.000Z');

  describe('getDaysSince', () => {
    test('returns Infinity for empty or invalid dates', () => {
      expect(getDaysSince(null, baseDate)).toBe(Infinity);
      expect(getDaysSince('', baseDate)).toBe(Infinity);
      expect(getDaysSince('invalid-date', baseDate)).toBe(Infinity);
    });

    test('calculates correct elapsed days', () => {
      const fiveDaysAgo = new Date('2026-10-10T12:00:00.000Z');
      expect(getDaysSince(fiveDaysAgo, baseDate)).toBe(5);
    });
  });

  describe('shouldShowBackupReminder', () => {
    test('returns true when no export has ever happened and never dismissed', () => {
      expect(shouldShowBackupReminder(null, null, baseDate)).toBe(true);
      expect(shouldShowBackupReminder('', '', baseDate)).toBe(true);
    });

    test('returns false when backup was exported less than 14 days ago', () => {
      const threeDaysAgo = '2026-10-12T12:00:00.000Z';
      expect(shouldShowBackupReminder(threeDaysAgo, null, baseDate)).toBe(false);

      const thirteenDaysAgo = '2026-10-02T12:00:00.000Z';
      expect(shouldShowBackupReminder(thirteenDaysAgo, null, baseDate)).toBe(false);
    });

    test('returns true when backup was exported 14 or more days ago and not dismissed', () => {
      const fourteenDaysAgo = '2026-10-01T12:00:00.000Z';
      expect(shouldShowBackupReminder(fourteenDaysAgo, null, baseDate)).toBe(true);

      const twentyDaysAgo = '2026-09-25T12:00:00.000Z';
      expect(shouldShowBackupReminder(twentyDaysAgo, null, baseDate)).toBe(true);
    });

    test('returns false when dismissed less than 14 days ago', () => {
      // Never exported, but dismissed 4 days ago
      const fourDaysAgo = '2026-10-11T12:00:00.000Z';
      expect(shouldShowBackupReminder(null, fourDaysAgo, baseDate)).toBe(false);

      // Exported 20 days ago, but dismissed 2 days ago
      const twentyDaysAgo = '2026-09-25T12:00:00.000Z';
      const twoDaysAgo = '2026-10-13T12:00:00.000Z';
      expect(shouldShowBackupReminder(twentyDaysAgo, twoDaysAgo, baseDate)).toBe(false);
    });

    test('reappears (returns true) after 14 more days have passed since dismissal', () => {
      // Never exported, dismissed 15 days ago
      const fifteenDaysAgo = '2026-09-30T12:00:00.000Z';
      expect(shouldShowBackupReminder(null, fifteenDaysAgo, baseDate)).toBe(true);

      // Exported 40 days ago, dismissed 14.5 days ago
      const fortyDaysAgo = '2026-09-05T12:00:00.000Z';
      const fourteenDaysHalfAgo = '2026-10-01T00:00:00.000Z';
      expect(shouldShowBackupReminder(fortyDaysAgo, fourteenDaysHalfAgo, baseDate)).toBe(true);
    });

    test('new export resets the cycle and hides reminder even if previously dismissed', () => {
      const twentyDaysAgo = '2026-09-25T12:00:00.000Z';
      const recentExport = '2026-10-14T12:00:00.000Z'; // 1 day ago
      expect(shouldShowBackupReminder(recentExport, twentyDaysAgo, baseDate)).toBe(false);
    });
  });
});
