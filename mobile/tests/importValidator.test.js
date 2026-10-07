const { validateBackupJson, verifyImport } = require('../src/utils/importValidator');

describe('importValidator', () => {
  const validBackup = {
    version: '1.0',
    exportedAt: '2026-10-06T10:00:00.000Z',
    customers: [
      { customer_id: 1, phone_number: '9999999999', name: 'Test Customer' }
    ],
    entries: [
      { entry_id: 1, customer_id: 1, entry_date: '2026-10-06T10:00:00.000Z', total_amount: 100, amount_paid: 0, due_amount: 100, note: 'test' }
    ],
    entryMedicines: [
      { id: 1, entry_id: 1, medicine_name: 'Med', price: 100, discount: 0 }
    ]
  };

  test('accepts a valid backup', () => {
    expect(validateBackupJson(JSON.stringify(validBackup))).toBe(true);
  });

  test('tolerates old backups missing discount and note', () => {
    const oldBackup = {
      version: '1.0',
      exportedAt: '2025-10-06T10:00:00.000Z',
      customers: [
        { customer_id: 1, phone_number: '9999999999', name: 'Test Customer' }
      ],
      entries: [
        { entry_id: 1, customer_id: 1, entry_date: '2025-10-06T10:00:00.000Z', total_amount: 100, amount_paid: 0, due_amount: 100 }
      ],
      entryMedicines: [
        { id: 1, entry_id: 1, medicine_name: 'Med', price: 100 }
      ]
    };
    expect(validateBackupJson(JSON.stringify(oldBackup))).toBe(true);
  });

  test('rejects server backup (SQLite format)', () => {
    const serverFileContent = 'SQLite format 3\x00\x01\x01\x00@  \x00\x00\x00\x00\x00';
    expect(() => validateBackupJson(serverFileContent)).toThrow("This backup came from the server and can't be restored on the mobile app.");
  });

  test('rejects server backup (JSON format)', () => {
    const serverJson = {
      version: '1.0',
      customers: [],
      entries: [],
      entry_medicine: [] // server marker
    };
    expect(() => validateBackupJson(JSON.stringify(serverJson))).toThrow("This backup came from the server and can't be restored on the mobile app.");
  });

  test('rejects corrupt JSON', () => {
    expect(() => validateBackupJson('{customers:[]')).toThrow("File is not valid JSON.");
  });

  test('rejects missing arrays', () => {
    const invalid = { ...validBackup };
    delete invalid.customers;
    expect(() => validateBackupJson(JSON.stringify(invalid))).toThrow("Missing or invalid customers array.");
  });

  test('rejects duplicate phone numbers', () => {
    const dupBackup = {
      ...validBackup,
      customers: [
        { customer_id: 1, phone_number: '9999999999', name: 'Test Customer 1' },
        { customer_id: 2, phone_number: '9999999999', name: 'Test Customer 2' }
      ]
    };
    expect(() => validateBackupJson(JSON.stringify(dupBackup))).toThrow("Duplicate phone number found: 9999999999");
  });

  test('rejects entries referencing missing customer', () => {
    const invalidBackup = {
      ...validBackup,
      entries: [
        { entry_id: 1, customer_id: 99, entry_date: '2026-10-06T10:00:00.000Z', total_amount: 100, amount_paid: 0, due_amount: 100 }
      ]
    };
    expect(() => validateBackupJson(JSON.stringify(invalidBackup))).toThrow("Entry references missing customer_id: 99");
  });

  test('rejects non-finite or negative amounts', () => {
    const invalidBackup = {
      ...validBackup,
      entries: [
        { entry_id: 1, customer_id: 1, entry_date: '2026-10-06T10:00:00.000Z', total_amount: -100, amount_paid: 0, due_amount: -100 }
      ]
    };
    expect(() => validateBackupJson(JSON.stringify(invalidBackup))).toThrow("Invalid total_amount on entry 1");
  });

  test('rejects bad dates', () => {
    const invalidBackup = {
      ...validBackup,
      entries: [
        { entry_id: 1, customer_id: 1, entry_date: 'not-a-date', total_amount: 100, amount_paid: 0, due_amount: 100 }
      ]
    };
    expect(() => validateBackupJson(JSON.stringify(invalidBackup))).toThrow("Invalid entry_date on entry 1");
  });
});

describe('verifyImport', () => {
  const expected = {
    customers: [{ customer_id: 1, phone_number: '123' }],
    entries: [
      { entry_id: 1, customer_id: 1, total_amount: 100, amount_paid: 0, due_amount: 100 },
      { entry_id: 2, customer_id: 1, total_amount: 0, amount_paid: 20, due_amount: -20 } // Payment
    ],
    entryMedicines: [{ id: 1, entry_id: 1, medicine_name: 'Med', price: 100, discount: 0 }]
  };

  test('accepts matching expected and actual', () => {
    // deep copy to avoid reference issues
    const actual = JSON.parse(JSON.stringify(expected));
    expect(verifyImport(expected, actual)).toBe(true);
  });

  test('rejects row count mismatch', () => {
    const actual = JSON.parse(JSON.stringify(expected));
    actual.customers.push({ customer_id: 2, phone_number: '456' });
    expect(() => verifyImport(expected, actual)).toThrow(/Customer count mismatch/);
  });

  test('rejects per-customer due mismatch', () => {
    const actual = JSON.parse(JSON.stringify(expected));
    // simulate DB returning wrong due_amount or missing an entry
    actual.entries[1].due_amount = -10; // Only 10 paid instead of 20
    expect(() => verifyImport(expected, actual)).toThrow(/due mismatch: expected 80, got 90/);
  });
});

describe('Per-row due validation', () => {
  const baseBackup = {
    version: '1.0',
    customers: [{ customer_id: 1, phone_number: '9999999999', name: 'Test' }],
    entries: [],
    entryMedicines: []
  };

  test('rejects tampered due_amount', () => {
    const backup = { ...baseBackup, entries: [
      { entry_id: 1, customer_id: 1, total_amount: 100, amount_paid: 0, due_amount: 50 } // Tampered: should be 100
    ]};
    expect(() => validateBackupJson(JSON.stringify(backup))).toThrow('Tampered due_amount on entry 1');
  });

  test('accepts discounted purchase (fractional)', () => {
    // 100 - 10% discount = 90. total_amount=90, paid=25.50, due=64.50
    const backup = { ...baseBackup, entries: [
      { entry_id: 1, customer_id: 1, total_amount: 90, amount_paid: 25.50, due_amount: 64.50 }
    ]};
    expect(validateBackupJson(JSON.stringify(backup))).toBe(true);
  });

  test('accepts payment row (total=0)', () => {
    const backup = { ...baseBackup, entries: [
      { entry_id: 1, customer_id: 1, total_amount: 0, amount_paid: 50, due_amount: -50 }
    ]};
    expect(validateBackupJson(JSON.stringify(backup))).toBe(true);
  });

  test('accepts float rounding differences within tolerance (0.01)', () => {
    // total = 100.33, paid = 50.11, expected due = 50.22
    // what if due_amount is 50.221 or 50.219 (float math artifact)?
    const backup = { ...baseBackup, entries: [
      { entry_id: 1, customer_id: 1, total_amount: 100.33, amount_paid: 50.11, due_amount: 50.225 }
    ]};
    expect(validateBackupJson(JSON.stringify(backup))).toBe(true);
    
    const backupFail = { ...baseBackup, entries: [
      { entry_id: 2, customer_id: 1, total_amount: 100.33, amount_paid: 50.11, due_amount: 50.24 } // > 0.01
    ]};
    expect(() => validateBackupJson(JSON.stringify(backupFail))).toThrow('Tampered due_amount on entry 2');
  });

  test('tolerates missing due_amount in old backups', () => {
    const backup = { ...baseBackup, entries: [
      { entry_id: 1, customer_id: 1, total_amount: 100, amount_paid: 0 } // no due_amount
    ]};
    expect(validateBackupJson(JSON.stringify(backup))).toBe(true);
  });
});

