const config = require('../config');

function getStartOfMonthISO(timeZone = config.TIMEZONE, referenceDate = new Date()) {
  const d = new Date(referenceDate);
  const dLocal = new Date(d.toLocaleString('en-US', { timeZone }));
  const y = dLocal.getFullYear();
  const m = dLocal.getMonth();
  
  // Create UTC date assuming local time is UTC
  const localMidnightUtc = new Date(Date.UTC(y, m, 1));
  
  // Calculate offset between local and UTC
  const offsetString = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' }).format(localMidnightUtc);
  
  // offsetString is e.g. "GMT+5:30" or "GMT-4" or "GMT"
  const match = offsetString.match(/GMT([+-])(\d{1,2}):?(\d{2})?/);
  if (match) {
    const sign = match[1] === '+' ? -1 : 1;
    const hrs = parseInt(match[2], 10);
    const mins = match[3] ? parseInt(match[3], 10) : 0;
    const offsetMs = sign * (hrs * 60 + mins) * 60 * 1000;
    return new Date(localMidnightUtc.getTime() + offsetMs).toISOString();
  }
  return localMidnightUtc.toISOString();
}

function getMinus30DaysISO() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString();
}

module.exports = {
  getStartOfMonthISO,
  getMinus30DaysISO,
};
