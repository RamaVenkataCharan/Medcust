/**
 * Pure utility functions for the 14-day backup reminder logic.
 * Zero React Native dependencies. Safe for Node, Jest, Web, and Native.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Calculates calendar or elapsed days between two dates.
 */
export function getDaysSince(isoStringOrDate, referenceDate = new Date()) {
  if (!isoStringOrDate) return Infinity;
  const target = isoStringOrDate instanceof Date ? isoStringOrDate : new Date(isoStringOrDate);
  if (isNaN(target.getTime())) return Infinity;

  const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const diffMs = now.getTime() - target.getTime();
  return diffMs / MS_PER_DAY;
}

/**
 * Determines whether the backup reminder banner should be shown.
 *
 * Rules:
 * 1. If an export occurred in the last 14 days: do NOT show (returns false).
 * 2. If no export has occurred in the last 14 days (or never):
 *    - If user dismissed the reminder less than 14 days ago: do NOT show (returns false).
 *    - If user dismissed 14+ days ago or never dismissed: SHOW (returns true).
 *
 * @param {string|Date|null} lastExportedAt - Timestamp when backup was last successfully exported
 * @param {string|Date|null} dismissedAt - Timestamp when user dismissed the reminder
 * @param {Date|string} [referenceDate=new Date()] - Reference timestamp (defaults to now)
 * @returns {boolean} Whether to show the banner
 */
export function shouldShowBackupReminder(lastExportedAt, dismissedAt, referenceDate = new Date()) {
  const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);

  // 1. If exported recently (< 14 days), do not show
  if (lastExportedAt) {
    const daysSinceExport = getDaysSince(lastExportedAt, now);
    if (daysSinceExport < 14) {
      return false;
    }
  }

  // 2. If dismissed recently (< 14 days after dismissal), do not show
  if (dismissedAt) {
    const dismissDate = dismissedAt instanceof Date ? dismissedAt : new Date(dismissedAt);
    const exportDate = lastExportedAt ? (lastExportedAt instanceof Date ? lastExportedAt : new Date(lastExportedAt)) : null;

    // Only consider dismissal if it happened after the last export
    if (!exportDate || dismissDate.getTime() > exportDate.getTime()) {
      const daysSinceDismiss = getDaysSince(dismissDate, now);
      if (daysSinceDismiss < 14) {
        return false;
      }
    }
  }

  // 14+ days since export (or never exported), and 14+ days since dismissal (or never dismissed)
  return true;
}
