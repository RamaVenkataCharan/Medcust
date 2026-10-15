import React from 'react';
import { render, act } from '@testing-library/react-native';
import { StyleSheet, View, Keyboard } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';

// Target Screens & Components
import StickyFooter from '../src/components/StickyFooter';
import ScreenContainer from '../src/components/ScreenContainer';
import FirstLaunchNoticeModal from '../src/components/FirstLaunchNoticeModal';
import HomeScreen from '../src/screens/HomeScreen';
import CustomerProfileScreen from '../src/screens/CustomerProfileScreen';
import AddCustomerScreen from '../src/screens/AddCustomerScreen';
import EditCustomerScreen from '../src/screens/EditCustomerScreen';
import AddPurchaseScreen from '../src/screens/AddPurchaseScreen';
import RecordPaymentScreen from '../src/screens/RecordPaymentScreen';
import SettingsScreen from '../src/screens/SettingsScreen';
import ProfileScreen from '../src/screens/ProfileScreen';
import RecycleBinScreen from '../src/screens/RecycleBinScreen';
import AboutScreen from '../src/screens/AboutScreen';

import * as database from '../src/db/database';

let mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    useSafeAreaInsets: () => mockInsets,
    SafeAreaProvider: ({ children }) => children,
  };
});

jest.mock('../src/db/database', () => ({
  getAllCustomers: jest.fn(),
  searchCustomers: jest.fn(),
  getCustomerById: jest.fn(),
  getCustomerLedger: jest.fn(),
  getPastMedicineNames: jest.fn(),
  getDeletedCustomers: jest.fn(),
  exportAllData: jest.fn(),
  getActiveDriverName: jest.fn(),
  getShopProfile: jest.fn(),
  saveShopProfile: jest.fn(),
  getAppMeta: jest.fn(),
  setAppMeta: jest.fn(),
  addDuePayment: jest.fn(),
  calculateCustomerTotalDue: jest.fn().mockReturnValue(100),
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

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(),
}));

jest.mock('expo-sharing', () => ({
  shareAsync: jest.fn(),
}));

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  reset: jest.fn(),
  addListener: jest.fn().mockReturnValue(() => {}),
  setOptions: jest.fn(),
};

const renderWithNav = async (ui) => {
  return await render(
    <NavigationContainer>
      {ui}
    </NavigationContainer>
  );
};

describe('Bottom Navigation and Edge-to-Edge Safe Area Insets Audit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    database.searchCustomers.mockReturnValue([
      { customer_id: 1, name: 'Ramesh', phone_number: '9848012345', village: 'Town', total_due: 150 },
    ]);
    database.getCustomerById.mockReturnValue({
      customer_id: 1,
      name: 'Ramesh',
      phone_number: '9848012345',
      village: 'Town',
      total_due: 150,
    });
    database.getCustomerLedger.mockReturnValue([
      { entry_id: 1, customer_id: 1, type: 'PURCHASE', total_amount: 150, paid_amount: 0, due_amount: 150, balance: 150 },
    ]);
    database.getDeletedCustomers.mockReturnValue([
      { customer_id: 2, name: 'Deleted User', deleted_at: '2026-10-10' },
    ]);
    database.getShopProfile.mockReturnValue({
      shop_name: 'MedTrack Pharmacy',
      shop_license_no: 'DL-12345',
      shop_license_validity: '2027-01-01',
      shop_phone: '9848012345',
      pharmacist_name: 'Dr. John',
      pharmacist_phone: '9848012345',
      pharmacist_license_validity: '2027-01-01',
    });
    database.getActiveDriverName.mockReturnValue('SQLite');
  });

  const INSET_CONFIGS = [
    { name: '3-button navigation (bottom: 48)', insets: { top: 30, bottom: 48, left: 0, right: 0 } },
    { name: 'Gesture navigation (bottom: 24)', insets: { top: 40, bottom: 24, left: 0, right: 0 } },
    { name: 'Zero inset navigation (bottom: 0)', insets: { top: 20, bottom: 0, left: 0, right: 0 } },
    { name: 'Landscape cutout navigation (left/right: 48, bottom: 0)', insets: { top: 0, bottom: 0, left: 48, right: 48 } },
  ];

  describe.each(INSET_CONFIGS)('$name', ({ insets }) => {
    beforeEach(() => {
      mockInsets = insets;
    });

    test('StickyFooter applies appropriate bottom padding for insets', async () => {
      let measuredHeight = 0;
      const { getByTestId } = await render(
        <StickyFooter onHeight={(h) => { measuredHeight = h; }}>
          <View />
        </StickyFooter>
      );
      const footerView = getByTestId('sticky-footer');
      const style = StyleSheet.flatten(footerView.props.style);

      // When keyboard is closed, bottom padding is Math.max(insets.bottom, r.moderate(12))
      if (insets.bottom > 12) {
        expect(style.paddingBottom).toBe(insets.bottom);
      } else {
        expect(style.paddingBottom).toBeGreaterThanOrEqual(12);
      }
    });

    test('HomeScreen offsets FAB and customer list paddingBottom', async () => {
      const { getByTestId } = await renderWithNav(
        <HomeScreen navigation={mockNavigation} />
      );

      // Verify FAB button offset
      const fabBtn = getByTestId('home-fab-add-customer');
      const fabStyle = StyleSheet.flatten(fabBtn.props.style);
      expect(fabStyle.position).toBe('absolute');
      expect(fabStyle.bottom).toBe(insets.bottom + 16);

      // Verify FlatList content container padding bottom
      const flatList = getByTestId('home-customer-list');
      const listStyle = StyleSheet.flatten(flatList.props.contentContainerStyle);
      expect(listStyle.paddingBottom).toBeGreaterThanOrEqual(insets.bottom + 85);
    });

    test('CustomerProfileScreen renders StickyFooter with safe insets', async () => {
      const { getByTestId } = await renderWithNav(
        <CustomerProfileScreen navigation={mockNavigation} route={{ params: { customerId: 1 } }} />
      );

      const footer = getByTestId('sticky-footer');
      const footerStyle = StyleSheet.flatten(footer.props.style);
      if (insets.bottom > 12) {
        expect(footerStyle.paddingBottom).toBe(insets.bottom);
      } else {
        expect(footerStyle.paddingBottom).toBeGreaterThanOrEqual(12);
      }

      const flatList = getByTestId('customer-profile-list');
      const listStyle = StyleSheet.flatten(flatList.props.contentContainerStyle);
      expect(listStyle.paddingBottom).toBeGreaterThan(0);
    });

    test('AddCustomerScreen renders StickyFooter and scroll content padding', async () => {
      const { getByTestId } = await renderWithNav(
        <AddCustomerScreen navigation={mockNavigation} route={{ params: {} }} />
      );

      const footer = getByTestId('sticky-footer');
      const footerStyle = StyleSheet.flatten(footer.props.style);
      if (insets.bottom > 12) {
        expect(footerStyle.paddingBottom).toBe(insets.bottom);
      } else {
        expect(footerStyle.paddingBottom).toBeGreaterThanOrEqual(12);
      }

      const scrollView = getByTestId('add-customer-scroll');
      const scrollStyle = StyleSheet.flatten(scrollView.props.contentContainerStyle);
      expect(scrollStyle.paddingBottom).toBeGreaterThan(0);
    });

    test('EditCustomerScreen renders StickyFooter and scroll content padding', async () => {
      const { getByTestId } = await renderWithNav(
        <EditCustomerScreen navigation={mockNavigation} route={{ params: { customerId: 1 } }} />
      );

      const footer = getByTestId('sticky-footer');
      const footerStyle = StyleSheet.flatten(footer.props.style);
      if (insets.bottom > 12) {
        expect(footerStyle.paddingBottom).toBe(insets.bottom);
      } else {
        expect(footerStyle.paddingBottom).toBeGreaterThanOrEqual(12);
      }

      const scrollView = getByTestId('edit-customer-scroll');
      const scrollStyle = StyleSheet.flatten(scrollView.props.contentContainerStyle);
      expect(scrollStyle.paddingBottom).toBeGreaterThan(0);
    });

    test('AddPurchaseScreen renders StickyFooter and scroll content padding', async () => {
      const { getByTestId } = await renderWithNav(
        <AddPurchaseScreen navigation={mockNavigation} route={{ params: { customerId: 1, customerName: 'Ramesh' } }} />
      );

      const footer = getByTestId('sticky-footer');
      const footerStyle = StyleSheet.flatten(footer.props.style);
      if (insets.bottom > 12) {
        expect(footerStyle.paddingBottom).toBe(insets.bottom);
      } else {
        expect(footerStyle.paddingBottom).toBeGreaterThanOrEqual(12);
      }

      const scrollView = getByTestId('add-purchase-scroll');
      const scrollStyle = StyleSheet.flatten(scrollView.props.contentContainerStyle);
      expect(scrollStyle.paddingBottom).toBeGreaterThan(0);
    });

    test('RecordPaymentScreen renders StickyFooter and scroll content padding', async () => {
      const { getByTestId } = await renderWithNav(
        <RecordPaymentScreen navigation={mockNavigation} route={{ params: { customerId: 1 } }} />
      );

      const footer = getByTestId('sticky-footer');
      const footerStyle = StyleSheet.flatten(footer.props.style);
      if (insets.bottom > 12) {
        expect(footerStyle.paddingBottom).toBe(insets.bottom);
      } else {
        expect(footerStyle.paddingBottom).toBeGreaterThanOrEqual(12);
      }

      const scrollView = getByTestId('record-payment-scroll');
      const scrollStyle = StyleSheet.flatten(scrollView.props.contentContainerStyle);
      expect(scrollStyle.paddingBottom).toBeGreaterThan(0);
    });

    test('SettingsScreen scroll content padding includes insets.bottom', async () => {
      const { getByTestId } = await renderWithNav(
        <SettingsScreen navigation={mockNavigation} />
      );

      const scrollView = getByTestId('settings-scroll');
      const scrollStyle = StyleSheet.flatten(scrollView.props.contentContainerStyle);
      expect(scrollStyle.paddingBottom).toBeGreaterThanOrEqual(insets.bottom + 20);
    });

    test('ProfileScreen scroll content padding includes insets.bottom', async () => {
      const { getByTestId } = await renderWithNav(
        <ProfileScreen navigation={mockNavigation} />
      );

      const scrollView = getByTestId('profile-scroll');
      const scrollStyle = StyleSheet.flatten(scrollView.props.contentContainerStyle);
      expect(scrollStyle.paddingBottom).toBeGreaterThanOrEqual(insets.bottom + 20);
    });

    test('RecycleBinScreen list content padding includes insets.bottom', async () => {
      const { getByTestId } = await renderWithNav(
        <RecycleBinScreen navigation={mockNavigation} />
      );

      const flatList = getByTestId('recycle-bin-list');
      const listStyle = StyleSheet.flatten(flatList.props.contentContainerStyle);
      expect(listStyle.paddingBottom).toBeGreaterThanOrEqual(insets.bottom + 20);
    });

    test('AboutScreen scroll content padding includes insets.bottom', async () => {
      const { getByTestId } = await renderWithNav(
        <AboutScreen navigation={mockNavigation} />
      );

      const scrollView = getByTestId('about-scroll');
      const scrollStyle = StyleSheet.flatten(scrollView.props.contentContainerStyle);
      expect(scrollStyle.paddingBottom).toBeGreaterThanOrEqual(insets.bottom + 30);
    });

    test('FirstLaunchNoticeModal footer padding includes insets.bottom and landscape insets', async () => {
      const { getByTestId } = await render(
        <FirstLaunchNoticeModal visible={true} onAccept={jest.fn()} />
      );

      const modalContainer = getByTestId('first-launch-notice');
      const containerStyle = StyleSheet.flatten(modalContainer.props.style);
      expect(containerStyle.paddingLeft).toBe(insets.left);
      expect(containerStyle.paddingRight).toBe(insets.right);

      const acceptBtn = getByTestId('btn-accept-first-launch-notice').parent;
      const footerStyle = StyleSheet.flatten(acceptBtn.props.style);
      expect(footerStyle.paddingBottom).toBeGreaterThanOrEqual(insets.bottom + 14);
    });
  });

  describe('Keyboard Visibility on StickyFooter', () => {
    test('does not add bottom inset twice when keyboard is open', async () => {
      mockInsets = { top: 30, bottom: 48, left: 0, right: 0 };

      const keyboardListeners = {};
      const addListenerSpy = jest.spyOn(Keyboard, 'addListener').mockImplementation((event, cb) => {
        keyboardListeners[event] = cb;
        return {
          remove: () => {
            delete keyboardListeners[event];
          },
        };
      });

      const { getByTestId } = await render(
        <StickyFooter>
          <View />
        </StickyFooter>
      );

      const footerView = getByTestId('sticky-footer');
      const closedStyle = StyleSheet.flatten(footerView.props.style);
      expect(closedStyle.paddingBottom).toBe(48);

      // Simulate keyboard open
      await act(async () => {
        const showCb = keyboardListeners['keyboardDidShow'] || keyboardListeners['keyboardWillShow'];
        showCb?.({ endCoordinates: { height: 300 } });
      });

      const openStyle = StyleSheet.flatten(footerView.props.style);
      // When keyboard is visible, paddingBottom drops to base moderate(12) so bottom inset is NOT added twice!
      expect(openStyle.paddingBottom).toBeLessThan(48);
      expect(openStyle.paddingBottom).toBeGreaterThanOrEqual(10);

      // Simulate keyboard close
      await act(async () => {
        const hideCb = keyboardListeners['keyboardDidHide'] || keyboardListeners['keyboardWillHide'];
        hideCb?.({});
      });

      const restoredStyle = StyleSheet.flatten(footerView.props.style);
      expect(restoredStyle.paddingBottom).toBe(48);

      addListenerSpy.mockRestore();
    });
  });

  describe('Landscape ScreenContainer Safe Area Handling', () => {
    test('ScreenContainer applies edges top, left, right by default', async () => {
      mockInsets = { top: 0, bottom: 0, left: 48, right: 48 };

      const { getByTestId } = await render(
        <ScreenContainer>
          <View />
        </ScreenContainer>
      );

      const container = getByTestId('screen-container');
      // In react-native-safe-area-context, SafeAreaView converts ['top', 'left', 'right'] to { top: 'additive', left: 'additive', right: 'additive', bottom: 'off' }
      if (Array.isArray(container.props.edges)) {
        expect(container.props.edges).toEqual(['top', 'left', 'right']);
      } else {
        expect(container.props.edges).toMatchObject({
          top: 'additive',
          left: 'additive',
          right: 'additive',
          bottom: 'off',
        });
      }
    });
  });
});
