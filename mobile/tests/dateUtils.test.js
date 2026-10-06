const { formatLocalDateTime, getCurrentLocalIso, getDateLabel } = require('../src/utils/dateUtils');

describe('dateUtils', () => {
  const originalDate = global.Date;

  afterEach(() => {
    global.Date = originalDate;
  });

  it('formatLocalDateTime formats dates correctly', () => {
    const mockDate = new Date('2026-10-06T12:00:00.000Z');
    jest.spyOn(global, 'Date').mockImplementation(function(...args) {
      if (args.length) return new originalDate(...args);
      return mockDate;
    });

    const formatted = formatLocalDateTime('2026-10-06T12:00:00.000Z');
    expect(formatted).toContain('Today');
  });

  it('getDateLabel formats correctly', () => {
    const mockDate = new Date('2026-10-06T12:00:00.000Z');
    jest.spyOn(global, 'Date').mockImplementation(function(...args) {
      if (args.length) return new originalDate(...args);
      return mockDate;
    });

    const label = getDateLabel('2026-10-06T12:00:00.000Z');
    expect(label).toBe('Today');
  });
});
