/**
 * Service to manage local scheduling of license-expiry notifications.
 * Offline-first: no remote push tokens or server dependencies.
 * 
 * Reminders refresh whenever the app is opened, on app launch,
 * after saving the profile, and after a backup restore.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getShopProfile } from '../db/database';
import {
  buildReminderSchedule,
  getNotificationDetails,
} from '../utils/licenseReminders';

export const CHANNEL_ID = 'license-reminders';

// Configure foreground presentation behavior (when app is in foreground)
if (Platform.OS !== 'web') {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch (e) {
    // Graceful fallback for non-native / test environments
  }
}

/**
 * Creates the Android notification channel for license reminders.
 * Inexact scheduling with DEFAULT importance; does not require exact-alarm permission.
 */
export async function setupNotificationChannelAsync() {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'License Expiry Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      description: 'Reminders for Drug License and Pharmacist Registration expiration and renewals',
      enableVibrate: true,
      sound: 'default',
    });
  } catch (err) {
    console.warn('[licenseNotifications] Failed to setup notification channel:', err);
  }
}

/**
 * Cancels all previously scheduled notifications belonging to license reminders
 * (identified by prefix "license-").
 */
export async function cancelAllLicenseNotificationsAsync() {
  if (Platform.OS === 'web') return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    if (Array.isArray(scheduled)) {
      for (const item of scheduled) {
        const id = item?.identifier;
        if (id && String(id).startsWith('license-')) {
          await Notifications.cancelScheduledNotificationAsync(id);
        }
      }
    }
  } catch (err) {
    // Graceful fallback for unmocked headless/test environments
  }
}

/**
 * Returns current notification permission status.
 */
export async function getNotificationPermissionStatusAsync() {
  if (Platform.OS === 'web') return { granted: false, canAskAgain: false };
  try {
    const settings = await Notifications.getPermissionsAsync();
    return {
      granted: Boolean(settings.granted || settings.status === 'granted'),
      canAskAgain: settings.canAskAgain !== false,
      status: settings.status,
    };
  } catch (err) {
    return { granted: false, canAskAgain: false };
  }
}

/**
 * Requests notification permission from the user (Android 13+ / iOS).
 */
export async function requestNotificationPermissionAsync() {
  if (Platform.OS === 'web') return { granted: false };
  try {
    const result = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    return {
      granted: Boolean(result.granted || result.status === 'granted'),
      status: result.status,
    };
  } catch (err) {
    return { granted: false };
  }
}

/**
 * Cancels all existing license notifications and reschedules based on current shop profile.
 * Total scheduled notifications capped at about 40 across both licenses to avoid OS limits.
 * 
 * @param {object} [customProfile] - Optional profile override
 * @returns {Promise<{ scheduledCount: number }>}
 */
export async function rescheduleAllLicenseReminders(customProfile) {
  if (Platform.OS === 'web') {
    return { scheduledCount: 0 };
  }

  try {
    await setupNotificationChannelAsync();
    await cancelAllLicenseNotificationsAsync();

    const profile = customProfile || getShopProfile();
    if (!profile) return { scheduledCount: 0 };

    let totalScheduled = 0;
    const now = new Date();

    // 1. Drug License (shop_license_validity) - capped at 20 reminders
    if (profile.shop_license_validity) {
      const shopTriggers = buildReminderSchedule(profile.shop_license_validity, now, 20);
      for (const triggerDate of shopTriggers) {
        const id = `license-shop-${triggerDate.toISOString()}`;
        const { title, body } = getNotificationDetails('shop', profile.shop_license_validity, triggerDate);

        await Notifications.scheduleNotificationAsync({
          identifier: id,
          content: {
            title,
            body,
            data: { screen: 'Profile' },
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: triggerDate,
            channelId: CHANNEL_ID,
          },
        });
        totalScheduled++;
      }
    }

    // 2. Pharmacist Registration (pharmacist_license_validity) - capped at 20 reminders
    if (profile.pharmacist_license_validity) {
      const pharmTriggers = buildReminderSchedule(profile.pharmacist_license_validity, now, 20);
      for (const triggerDate of pharmTriggers) {
        const id = `license-pharm-${triggerDate.toISOString()}`;
        const { title, body } = getNotificationDetails('pharmacist', profile.pharmacist_license_validity, triggerDate);

        await Notifications.scheduleNotificationAsync({
          identifier: id,
          content: {
            title,
            body,
            data: { screen: 'Profile' },
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: triggerDate,
            channelId: CHANNEL_ID,
          },
        });
        totalScheduled++;
      }
    }

    return { scheduledCount: totalScheduled };
  } catch (err) {
    console.warn('[licenseNotifications] Error during rescheduleAllLicenseReminders:', err);
    return { scheduledCount: 0 };
  }
}

/**
 * Listens for notification interaction responses and navigates to the Shop Profile screen.
 */
export function registerNotificationResponseListener(navigationRef) {
  if (Platform.OS === 'web') return () => {};
  try {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const screen = response?.notification?.request?.content?.data?.screen;
      if (screen === 'Profile' && navigationRef?.isReady?.() && navigationRef?.navigate) {
        navigationRef.navigate('Profile');
      }
    });
    return () => {
      if (subscription && subscription.remove) {
        subscription.remove();
      }
    };
  } catch (err) {
    return () => {};
  }
}
