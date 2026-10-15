import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import AboutScreen from '../src/screens/AboutScreen';
import SettingsScreen from '../src/screens/SettingsScreen';
import HomeScreen from '../src/screens/HomeScreen';
import { LEGAL_TEXT_VERSION } from '../src/constants/legalText';
import * as database from '../src/db/database';
import * as exportService from '../src/services/exportService';

jest.mock('../src/db/database', () => ({
  searchCustomers: jest.fn(),
  getShopProfile: jest.fn(),
  saveShopProfile: jest.fn(),
  exportAllData: jest.fn(),
  getAppMeta: jest.fn(),
  setAppMeta: jest.fn(),
}));

jest.mock('../src/services/exportService', () => ({
  exportKhataBackup: jest.fn().mockResolvedValue({ success: true, count: 0 }),
}));

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([]),
  cancelScheduledNotificationAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  getPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
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

describe('About Screen and Legal Notices Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    database.searchCustomers.mockReturnValue([]);
    database.getShopProfile.mockReturnValue({
      shop_license_validity: '',
      pharmacist_license_validity: '',
    });
  });

  describe('AboutScreen', () => {
    test('renders app name, version, and placeholder legal sections', async () => {
      const { getByText, getByTestId } = await renderWithProviders(
        <AboutScreen navigation={mockNavigation} />
      );

      // App name & version
      expect(getByText('MedTrack')).toBeTruthy();
      expect(getByTestId('about-app-version')).toBeTruthy();

      // Terms of Use section
      expect(getByTestId('section-terms-of-use')).toBeTruthy();
      const termsText = getByTestId('text-terms-of-use');
      expect(termsText).toBeTruthy();

      // Privacy section
      expect(getByTestId('section-privacy-policy')).toBeTruthy();
      const privacyText = getByTestId('text-privacy-policy');
      expect(privacyText).toBeTruthy();

      // Back navigation
      fireEvent.press(getByTestId('about-back-btn'));
      expect(mockNavigation.goBack).toHaveBeenCalled();
    });

    test('Settings screen has an "About MedTrack" button that navigates to About', async () => {
      const { getByTestId } = await renderWithProviders(
        <SettingsScreen navigation={mockNavigation} />
      );

      const aboutBtn = getByTestId('btn-about');
      expect(aboutBtn).toBeTruthy();
      fireEvent.press(aboutBtn);
      expect(mockNavigation.navigate).toHaveBeenCalledWith('About');
    });
  });

  describe('First-Launch Notice Modal', () => {
    test('shown on first launch when no accepted version is stored in database', async () => {
      database.getAppMeta.mockImplementation((key) => {
        if (key === 'legal_terms_accepted_version') return null;
        return null;
      });

      const { getByTestId, queryByTestId } = await renderWithProviders(
        <HomeScreen navigation={mockNavigation} />
      );

      await waitFor(() => {
        expect(getByTestId('first-launch-notice')).toBeTruthy();
        expect(getByTestId('callout-backup-warning')).toBeTruthy();
        expect(getByTestId('btn-accept-first-launch-notice')).toBeTruthy();
      });

      // Press "I understand"
      await act(async () => {
        fireEvent.press(getByTestId('btn-accept-first-launch-notice'));
      });

      // Acceptance stored in local storage layer
      expect(database.setAppMeta).toHaveBeenCalledWith('legal_terms_accepted_version', LEGAL_TEXT_VERSION);
      expect(database.setAppMeta).toHaveBeenCalledWith('legal_terms_accepted_at', expect.any(String));

      // Notice should be dismissed
      expect(queryByTestId('first-launch-notice')).toBeNull();
    });

    test('not shown after acceptance when stored version matches current version', async () => {
      database.getAppMeta.mockImplementation((key) => {
        if (key === 'legal_terms_accepted_version') return LEGAL_TEXT_VERSION;
        return null;
      });

      const { queryByTestId } = await renderWithProviders(
        <HomeScreen navigation={mockNavigation} />
      );

      expect(queryByTestId('first-launch-notice')).toBeNull();
    });

    test('shown again when legal text version constant is increased', async () => {
      // User accepted an older version previously
      database.getAppMeta.mockImplementation((key) => {
        if (key === 'legal_terms_accepted_version') return '0.9.0';
        return null;
      });

      const { getByTestId } = await renderWithProviders(
        <HomeScreen navigation={mockNavigation} />
      );

      await waitFor(() => {
        expect(getByTestId('first-launch-notice')).toBeTruthy();
      });
    });
  });

  describe('14-Day Backup Reminder Banner on Home', () => {
    test('renders backup reminder banner when no export in last 14 days and allows dismissing', async () => {
      database.getAppMeta.mockImplementation((key) => {
        if (key === 'legal_terms_accepted_version') return LEGAL_TEXT_VERSION;
        if (key === 'last_backup_exported_at') return null; // never exported
        if (key === 'backup_reminder_dismissed_at') return null;
        return null;
      });

      const { getByTestId, queryByTestId, getByText } = await renderWithProviders(
        <HomeScreen navigation={mockNavigation} />
      );

      await waitFor(() => {
        expect(getByTestId('banner-backup-reminder')).toBeTruthy();
        expect(getByText('Your data is only on this phone. Export a backup.')).toBeTruthy();
      });

      // Dismiss the banner
      await act(async () => {
        fireEvent.press(getByTestId('btn-dismiss-backup-reminder'));
      });
      expect(database.setAppMeta).toHaveBeenCalledWith(
        'backup_reminder_dismissed_at',
        expect.any(String)
      );
      await waitFor(() => {
        expect(queryByTestId('banner-backup-reminder')).toBeNull();
      });
    });

    test('tapping Export button on banner triggers exportKhataBackup', async () => {
      database.getAppMeta.mockImplementation((key) => {
        if (key === 'legal_terms_accepted_version') return LEGAL_TEXT_VERSION;
        if (key === 'last_backup_exported_at') return null;
        if (key === 'backup_reminder_dismissed_at') return null;
        return null;
      });

      const { getByTestId } = await renderWithProviders(
        <HomeScreen navigation={mockNavigation} />
      );

      await waitFor(() => {
        expect(getByTestId('btn-backup-now')).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByTestId('btn-backup-now'));
      });

      expect(exportService.exportKhataBackup).toHaveBeenCalled();
    });
  });
});
