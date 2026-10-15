import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert, Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import HomeScreen from '../src/screens/HomeScreen';
import ProfileScreen from '../src/screens/ProfileScreen';
import * as database from '../src/db/database';
import * as Notifications from 'expo-notifications';

jest.mock('../src/db/database', () => ({
  searchCustomers: jest.fn(),
  getShopProfile: jest.fn(),
  saveShopProfile: jest.fn(),
}));

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([]),
  cancelScheduledNotificationAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  getPermissionsAsync: jest.fn().mockResolvedValue({ granted: true, status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true, status: 'granted' }),
  addNotificationResponseReceivedListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
}));

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  addListener: jest.fn().mockReturnValue(() => {}),
  setOptions: jest.fn(),
};

const renderWithProviders = async (ui) => {
  return await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 0, height: 0 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <NavigationContainer>
        {ui}
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

// Helper to return a date N days relative to today as YYYY-MM-DD
function getDateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

describe('License Expiry Reminders UI Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    database.searchCustomers.mockReturnValue([]);
  });

  describe('HomeScreen Banners', () => {
    test('renders amber banner when Drug License is expiring in 45 days', async () => {
      database.getShopProfile.mockReturnValue({
        shop_license_validity: getDateOffset(45),
        pharmacist_license_validity: '',
      });

      const { getByTestId, queryByTestId } = await renderWithProviders(
        <HomeScreen navigation={mockNavigation} />
      );

      await waitFor(() => {
        expect(getByTestId('banner-license-shop')).toBeTruthy();
      });
      expect(queryByTestId('banner-license-pharmacist')).toBeNull();

      // Tap update button navigates to Profile
      fireEvent.press(getByTestId('btn-banner-shop-update'));
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Profile');
    });

    test('renders red banner when Pharmacist Registration is expired', async () => {
      database.getShopProfile.mockReturnValue({
        shop_license_validity: '',
        pharmacist_license_validity: getDateOffset(-10), // expired 10 days ago
      });

      const { getByTestId, queryByTestId } = await renderWithProviders(
        <HomeScreen navigation={mockNavigation} />
      );

      await waitFor(() => {
        expect(getByTestId('banner-license-pharmacist')).toBeTruthy();
      });
      expect(queryByTestId('banner-license-shop')).toBeNull();

      fireEvent.press(getByTestId('btn-banner-pharmacist-update'));
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Profile');
    });

    test('renders both banners when both qualify', async () => {
      database.getShopProfile.mockReturnValue({
        shop_license_validity: getDateOffset(20),
        pharmacist_license_validity: getDateOffset(-5),
      });

      const { getByTestId } = await renderWithProviders(
        <HomeScreen navigation={mockNavigation} />
      );

      await waitFor(() => {
        expect(getByTestId('banner-license-shop')).toBeTruthy();
        expect(getByTestId('banner-license-pharmacist')).toBeTruthy();
      });
    });

    test('does not render banners when validity dates are > 90 days away or empty', async () => {
      database.getShopProfile.mockReturnValue({
        shop_license_validity: getDateOffset(120),
        pharmacist_license_validity: '',
      });

      const { queryByTestId } = await renderWithProviders(
        <HomeScreen navigation={mockNavigation} />
      );

      expect(queryByTestId('banner-license-shop')).toBeNull();
      expect(queryByTestId('banner-license-pharmacist')).toBeNull();
    });
  });

  describe('ProfileScreen Badges and Permission Flow', () => {
    test('renders amber "Expires in N days" badge and red "EXPIRED" badge', async () => {
      database.getShopProfile.mockReturnValue({
        shop_name: 'MedTrack Pharmacy',
        shop_license_no: 'DL-12345',
        shop_license_validity: getDateOffset(45),
        shop_phone: '9848012345',
        pharmacist_name: 'Dr. Test',
        pharmacist_phone: '9848012345',
        pharmacist_license_validity: getDateOffset(-5),
      });

      const { getByTestId } = await renderWithProviders(
        <ProfileScreen navigation={mockNavigation} />
      );

      await waitFor(() => {
        expect(getByTestId('badge-shop-expiring')).toBeTruthy();
        expect(getByTestId('badge-pharmacist-expired')).toBeTruthy();
      });
    });

    test('displays note with open settings button when notification permissions are denied', async () => {
      Notifications.getPermissionsAsync.mockResolvedValue({
        granted: false,
        status: 'denied',
      });

      database.getShopProfile.mockReturnValue({
        shop_name: 'MedTrack Pharmacy',
        shop_license_validity: getDateOffset(30),
      });

      const spyOpenSettings = jest.spyOn(Linking, 'openSettings').mockImplementation(() => Promise.resolve());

      const { getByTestId } = await renderWithProviders(
        <ProfileScreen navigation={mockNavigation} />
      );

      await waitFor(() => {
        expect(getByTestId('notifications-permission-note')).toBeTruthy();
      });

      fireEvent.press(getByTestId('btn-open-notification-settings'));
      expect(spyOpenSettings).toHaveBeenCalled();

      spyOpenSettings.mockRestore();
    });

    test('prompts explanation alert on saving profile with validity date when permission is not granted', async () => {
      Notifications.getPermissionsAsync.mockResolvedValue({
        granted: false,
        status: 'undetermined',
      });

      database.getShopProfile.mockReturnValue({
        shop_name: 'MedTrack Pharmacy',
        shop_license_no: 'DL-123',
        shop_license_validity: getDateOffset(30),
        shop_phone: '9848012345',
        pharmacist_name: 'Pharmacist A',
        pharmacist_phone: '9848012345',
        pharmacist_license_validity: '',
      });

      const alertSpy = jest.spyOn(Alert, 'alert');

      const { getByTestId } = await renderWithProviders(
        <ProfileScreen navigation={mockNavigation} />
      );

      await act(async () => {
        fireEvent.press(getByTestId('btn-save-profile'));
      });

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          'License Reminders',
          expect.stringContaining('MedTrack needs permission'),
          expect.any(Array)
        );
      });

      alertSpy.mockRestore();
    });
  });
});
