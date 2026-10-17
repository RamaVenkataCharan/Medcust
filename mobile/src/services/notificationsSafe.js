/**
 * Safe lazy loader and runtime compatibility wrapper for expo-notifications.
 * Ensures the app never crashes at startup in Expo Go, Web, or when
 * native notification modules are unavailable.
 */

import { Platform } from 'react-native';

let cachedNotifications = undefined;
let testMockModule = undefined;

/**
 * For testing: explicitly inject a mock module or null.
 */
export function setNotificationsMockForTesting(mock) {
  testMockModule = mock;
  cachedNotifications = mock;
}

/**
 * For testing: resets the cached module.
 */
export function resetNotificationsSafeForTesting() {
  testMockModule = undefined;
  cachedNotifications = undefined;
}

/**
 * Checks whether the app is running inside Expo Go.
 * Uses expo-constants executionEnvironment === 'storeClient' or appOwnership === 'expo'.
 */
export function isExpoGoEnvironment() {
  try {
    const Constants = require('expo-constants')?.default || require('expo-constants');
    if (!Constants) return false;
    return Boolean(
      Constants.executionEnvironment === 'storeClient' ||
      Constants.appOwnership === 'expo'
    );
  } catch (e) {
    return false;
  }
}

/**
 * Lazily loads the expo-notifications module.
 * Returns null without requiring the package when Platform.OS === 'web',
 * when running in Expo Go, or in the Jest environment unless a test injects a mock.
 * Otherwise does require('expo-notifications') inside a try/catch and returns null if it throws.
 * Caches the result and never throws.
 */
export function getNotificationsSafe() {
  if (cachedNotifications !== undefined) {
    return cachedNotifications;
  }

  // 1. Explicit mock injected by test
  if (testMockModule !== undefined) {
    cachedNotifications = testMockModule;
    return cachedNotifications;
  }

  // 2. Web environment is not supported
  if (Platform.OS === 'web') {
    cachedNotifications = null;
    return null;
  }

  // 3. Expo Go environment lacks native background / FCM modules
  if (isExpoGoEnvironment()) {
    cachedNotifications = null;
    return null;
  }

  // 4. Jest test environment: return module only if a test injected a mock
  const isJest = typeof jest !== 'undefined' || Boolean(process.env.JEST_WORKER_ID);
  if (isJest) {
    if (typeof jest !== 'undefined' && typeof jest.requireMock === 'function') {
      try {
        const mod = jest.requireMock('expo-notifications');
        if (mod) {
          cachedNotifications = mod;
          return mod;
        }
      } catch (e) {
        // Module is not mocked in this test
      }
    }
    cachedNotifications = null;
    return null;
  }

  // 5. Native APK runtime: load safely inside try/catch
  try {
    const mod = require('expo-notifications');
    cachedNotifications = mod || null;
    return cachedNotifications;
  } catch (err) {
    cachedNotifications = null;
    return null;
  }
}

/**
 * Returns true if local notifications are supported in the current environment.
 */
export function isNotificationSupported() {
  return getNotificationsSafe() !== null;
}

export default getNotificationsSafe;
