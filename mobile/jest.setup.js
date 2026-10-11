// Eagerly trigger lazy globals from expo winter runtime before tests run
try {
  if (typeof globalThis.fetch === 'function') {
    // triggered getter
  }
} catch (e) {
  // ignore
}
