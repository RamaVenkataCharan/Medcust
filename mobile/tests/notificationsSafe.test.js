import { Platform } from 'react-native';
import {
  getNotificationsSafe,
  isNotificationSupported,
  isExpoGoEnvironment,
  setNotificationsMockForTesting,
  resetNotificationsSafeForTesting,
} from '../src/services/notificationsSafe';
import {
  setupNotificationChannelAsync,
  cancelAllLicenseNotificationsAsync,
  getNotificationPermissionStatusAsync,
  requestNotificationPermissionAsync,
  rescheduleAllLicenseReminders,
  registerNotificationResponseListener,
} from '../src/services/licenseNotifications';

describe('notificationsSafe service and licenseNotifications integration', () => {
  const origPlatform = Platform.OS;

  beforeEach(() => {
    resetNotificationsSafeForTesting();
    Platform.OS = 'android';
    jest.clearAllMocks();
  });

  afterEach(() => {
    resetNotificationsSafeForTesting();
    Platform.OS = origPlatform;
  });

  describe('notificationsSafe environment detection and lazy loading', () => {
    it('returns null when Platform.OS === "web" without throwing', () => {
      Platform.OS = 'web';
      resetNotificationsSafeForTesting();

      expect(getNotificationsSafe()).toBeNull();
      expect(isNotificationSupported()).toBe(false);
    });

    it('returns null when running in Expo Go (executionEnvironment: "storeClient")', () => {
      jest.isolateModules(() => {
        jest.doMock('expo-constants', () => ({
          executionEnvironment: 'storeClient',
          appOwnership: 'expo',
        }));
        const safe = require('../src/services/notificationsSafe');
        safe.resetNotificationsSafeForTesting();

        expect(safe.isExpoGoEnvironment()).toBe(true);
        expect(safe.getNotificationsSafe()).toBeNull();
        expect(safe.isNotificationSupported()).toBe(false);
      });
    });

    it('returns null when running in Expo Go (appOwnership: "expo")', () => {
      jest.isolateModules(() => {
        jest.doMock('expo-constants', () => ({
          executionEnvironment: 'standalone',
          appOwnership: 'expo',
        }));
        const safe = require('../src/services/notificationsSafe');
        safe.resetNotificationsSafeForTesting();

        expect(safe.isExpoGoEnvironment()).toBe(true);
        expect(safe.getNotificationsSafe()).toBeNull();
      });
    });

    it('returns null and never throws when require throws "Cannot find native module"', () => {
      jest.isolateModules(() => {
        jest.doMock('expo-constants', () => ({
          executionEnvironment: 'standalone',
          appOwnership: 'standalone',
        }));
        jest.doMock('expo-notifications', () => {
          throw new Error("Cannot find native module 'ExpoTopicSubscriptionModule'");
        });

        const safe = require('../src/services/notificationsSafe');
        safe.resetNotificationsSafeForTesting();

        let result;
        expect(() => {
          result = safe.getNotificationsSafe();
        }).not.toThrow();
        expect(result).toBeNull();
        expect(safe.isNotificationSupported()).toBe(false);
      });
    });

    it('caches the result and returns identical reference on subsequent calls', () => {
      const mockModule = {
        scheduleNotificationAsync: jest.fn(),
      };
      setNotificationsMockForTesting(mockModule);

      const first = getNotificationsSafe();
      const second = getNotificationsSafe();
      expect(first).toBe(mockModule);
      expect(second).toBe(mockModule);
      expect(first).toBe(second);
    });
  });

  describe('licenseNotifications behavior when notifications are unsupported (null)', () => {
    beforeEach(() => {
      setNotificationsMockForTesting(null);
    });

    it('setupNotificationChannelAsync returns supported: false and does not throw', async () => {
      const result = await setupNotificationChannelAsync();
      expect(result).toEqual({ supported: false });
    });

    it('cancelAllLicenseNotificationsAsync returns supported: false with 0 cancelled', async () => {
      const result = await cancelAllLicenseNotificationsAsync();
      expect(result).toEqual({ supported: false, cancelledCount: 0 });
    });

    it('getNotificationPermissionStatusAsync returns clear unsupported status', async () => {
      const result = await getNotificationPermissionStatusAsync();
      expect(result).toEqual({ granted: false, canAskAgain: false, supported: false });
    });

    it('requestNotificationPermissionAsync returns supported: false', async () => {
      const result = await requestNotificationPermissionAsync();
      expect(result).toEqual({ granted: false, supported: false });
    });

    it('rescheduleAllLicenseReminders returns 0 scheduled and supported: false', async () => {
      const result = await rescheduleAllLicenseReminders({
        shop_license_validity: '2028-12-31',
        pharmacist_license_validity: '2028-12-31',
      });
      expect(result).toEqual({ scheduledCount: 0, supported: false });
    });

    it('registerNotificationResponseListener returns callable no-op function', () => {
      const unsubscribe = registerNotificationResponseListener({ isReady: () => true });
      expect(typeof unsubscribe).toBe('function');
      expect(() => unsubscribe()).not.toThrow();
    });
  });

  describe('licenseNotifications behavior when notifications are available (mocked)', () => {
    let mockNotifications;

    beforeEach(() => {
      mockNotifications = {
        AndroidImportance: { DEFAULT: 3 },
        SchedulableTriggerInputTypes: { DATE: 'date' },
        setNotificationHandler: jest.fn(),
        setNotificationChannelAsync: jest.fn().mockResolvedValue('license-reminders'),
        getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([
          { identifier: 'license-shop-1' },
          { identifier: 'other-app-alarm' },
        ]),
        cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(),
        scheduleNotificationAsync: jest.fn().mockResolvedValue('new-id'),
        getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', granted: true }),
        requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', granted: true }),
        addNotificationResponseReceivedListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
      };
      setNotificationsMockForTesting(mockNotifications);
    });

    it('setupNotificationChannelAsync sets channel and configures handler', async () => {
      const result = await setupNotificationChannelAsync();
      expect(result).toEqual({ supported: true, success: true });
      expect(mockNotifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        'license-reminders',
        expect.objectContaining({ name: 'License Expiry Reminders' })
      );
      expect(mockNotifications.setNotificationHandler).toHaveBeenCalled();
    });

    it('cancelAllLicenseNotificationsAsync cancels only license-* items', async () => {
      const result = await cancelAllLicenseNotificationsAsync();
      expect(result.supported).toBe(true);
      expect(result.cancelledCount).toBe(1);
      expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('license-shop-1');
      expect(mockNotifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('other-app-alarm');
    });

    it('rescheduleAllLicenseReminders schedules future triggers', async () => {
      const futureDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const result = await rescheduleAllLicenseReminders({
        shop_license_validity: futureDate,
        pharmacist_license_validity: '',
      });
      expect(result.supported).toBe(true);
      expect(result.scheduledCount).toBeGreaterThan(0);
      expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalled();
    });
  });

  describe('Load-time isolation verification', () => {
    it('importing App.js and HomeScreen does not evaluate or touch expo-notifications at load time', () => {
      jest.isolateModules(() => {
        let notificationsRequired = false;
        jest.doMock('expo-notifications', () => {
          notificationsRequired = true;
          return {};
        });

        // Mock database and navigation to allow App and HomeScreen evaluation
        jest.doMock('../src/db/database', () => ({
          initDatabase: jest.fn(),
          getAllCustomers: jest.fn().mockReturnValue([]),
          searchCustomers: jest.fn().mockReturnValue([]),
          getShopProfile: jest.fn().mockReturnValue(null),
          getActiveDriverName: jest.fn().mockReturnValue('SQLITE'),
        }));

        // Load modules
        require('../src/screens/HomeScreen');
        require('../App');

        // Verify that expo-notifications was never required or loaded at module load time
        expect(notificationsRequired).toBe(false);
      });
    });
  });
});
