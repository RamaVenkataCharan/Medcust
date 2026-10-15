import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  CHANNEL_ID,
  setupNotificationChannelAsync,
  cancelAllLicenseNotificationsAsync,
  getNotificationPermissionStatusAsync,
  requestNotificationPermissionAsync,
  rescheduleAllLicenseReminders,
  registerNotificationResponseListener,
} from '../src/services/licenseNotifications';
import * as database from '../src/db/database';

jest.mock('expo-notifications', () => ({
  AndroidImportance: {
    DEFAULT: 3,
  },
  SchedulableTriggerInputTypes: {
    DATE: 'date',
  },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
}));

jest.mock('../src/db/database', () => ({
  getShopProfile: jest.fn(),
}));

describe('licenseNotifications service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('setupNotificationChannelAsync', () => {
    test('creates Android channel "license-reminders" with DEFAULT importance', async () => {
      const origOS = Platform.OS;
      Platform.OS = 'android';
      try {
        await setupNotificationChannelAsync();
        expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
          CHANNEL_ID,
          expect.objectContaining({
            name: 'License Expiry Reminders',
            importance: Notifications.AndroidImportance.DEFAULT,
          })
        );
      } finally {
        Platform.OS = origOS;
      }
    });
  });

  describe('cancelAllLicenseNotificationsAsync', () => {
    test('cancels only scheduled notifications starting with "license-"', async () => {
      Notifications.getAllScheduledNotificationsAsync.mockResolvedValue([
        { identifier: 'license-shop-2026-10-15T09:00:00.000Z' },
        { identifier: 'license-pharm-2026-10-15T09:00:00.000Z' },
        { identifier: 'other-notification-id' },
      ]);

      await cancelAllLicenseNotificationsAsync();

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
        'license-shop-2026-10-15T09:00:00.000Z'
      );
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
        'license-pharm-2026-10-15T09:00:00.000Z'
      );
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith(
        'other-notification-id'
      );
    });
  });

  describe('getNotificationPermissionStatusAsync & requestNotificationPermissionAsync', () => {
    test('returns granted when permissions are granted', async () => {
      Notifications.getPermissionsAsync.mockResolvedValue({
        granted: true,
        canAskAgain: true,
        status: 'granted',
      });
      const status = await getNotificationPermissionStatusAsync();
      expect(status.granted).toBe(true);
      expect(status.canAskAgain).toBe(true);
    });

    test('requests permissions and returns result', async () => {
      Notifications.requestPermissionsAsync.mockResolvedValue({
        granted: true,
        status: 'granted',
      });
      const result = await requestNotificationPermissionAsync();
      expect(result.granted).toBe(true);
      expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    });
  });

  describe('rescheduleAllLicenseReminders', () => {
    test('cancels existing and schedules notifications for both shop and pharmacist licenses', async () => {
      Notifications.getAllScheduledNotificationsAsync.mockResolvedValue([]);
      database.getShopProfile.mockReturnValue({
        shop_license_validity: '2026-11-15',
        pharmacist_license_validity: '2026-12-01',
      });

      const res = await rescheduleAllLicenseReminders();
      expect(res.scheduledCount).toBeGreaterThan(0);
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();

      // Check scheduled notification properties
      const firstCallArgs = Notifications.scheduleNotificationAsync.mock.calls[0][0];
      expect(firstCallArgs.identifier).toMatch(/^license-/);
      expect(firstCallArgs.content.data).toEqual({ screen: 'Profile' });
      expect(firstCallArgs.trigger.channelId).toBe(CHANNEL_ID);
    });

    test('caps scheduled notifications to avoid OS limits (~20 per license)', async () => {
      Notifications.getAllScheduledNotificationsAsync.mockResolvedValue([]);
      database.getShopProfile.mockReturnValue({
        shop_license_validity: '2027-10-15', // far future
        pharmacist_license_validity: '2027-10-15',
      });

      const res = await rescheduleAllLicenseReminders();
      // Up to 20 for shop and 20 for pharmacist = 40 total
      expect(res.scheduledCount).toBeLessThanOrEqual(40);
    });

    test('handles cleared dates by cancelling without scheduling new ones', async () => {
      Notifications.getAllScheduledNotificationsAsync.mockResolvedValue([
        { identifier: 'license-shop-1' },
      ]);
      database.getShopProfile.mockReturnValue({
        shop_license_validity: '',
        pharmacist_license_validity: '',
      });

      const res = await rescheduleAllLicenseReminders();
      expect(res.scheduledCount).toBe(0);
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('license-shop-1');
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('registerNotificationResponseListener', () => {
    test('listens and navigates to Profile on notification response', () => {
      let listenerCallback;
      Notifications.addNotificationResponseReceivedListener.mockImplementation((cb) => {
        listenerCallback = cb;
        return { remove: jest.fn() };
      });

      const mockNavigationRef = {
        isReady: jest.fn().mockReturnValue(true),
        navigate: jest.fn(),
      };

      const unsubscribe = registerNotificationResponseListener(mockNavigationRef);
      expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalled();

      // Simulate notification tap
      listenerCallback({
        notification: {
          request: {
            content: {
              data: { screen: 'Profile' },
            },
          },
        },
      });

      expect(mockNavigationRef.navigate).toHaveBeenCalledWith('Profile');
      unsubscribe();
    });
  });
});
