import React from 'react';
import { StyleSheet, Animated, AccessibilityInfo, Keyboard, Platform } from 'react-native';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import HomeScreen from '../src/screens/HomeScreen';
import { COLORS } from '../src/constants/theme';
import * as database from '../src/db/database';

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
}));

jest.mock('../src/services/exportService', () => ({
  exportKhataBackup: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock('../src/services/licenseNotifications', () => ({
  setupNotificationChannelAsync: jest.fn().mockResolvedValue(true),
  rescheduleAllLicenseReminders: jest.fn().mockResolvedValue([]),
  registerNotificationResponseListener: jest.fn().mockReturnValue(() => {}),
}));

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  reset: jest.fn(),
  addListener: jest.fn().mockReturnValue(() => {}),
  setOptions: jest.fn(),
};

const renderHomeScreen = async (insets = { top: 0, left: 0, right: 0, bottom: 20 }) => {
  return await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 360, height: 640 }, insets }}>
      <NavigationContainer>
        <HomeScreen navigation={mockNavigation} />
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

describe('Home Screen FAB Pop Feature Audit', () => {
  let timingSpy;
  let springSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    database.getAllCustomers.mockReturnValue([
      { customer_id: 1, name: 'Ramesh Kumar', phone_number: '9848012345', village: 'Town', total_due: 0 },
    ]);
    database.searchCustomers.mockReturnValue([
      { customer_id: 1, name: 'Ramesh Kumar', phone_number: '9848012345', village: 'Town', total_due: 0 },
    ]);
    database.getShopProfile.mockReturnValue(null);
    database.getAppMeta.mockReturnValue(null);

    timingSpy = jest.spyOn(Animated, 'timing').mockImplementation((val, config) => ({
      start: (cb) => {
        if (val && config && typeof config.toValue !== 'undefined') {
          val.setValue(config.toValue);
        }
        if (cb) cb({ finished: true });
      },
      stop: () => {},
    }));

    springSpy = jest.spyOn(Animated, 'spring').mockImplementation((val, config) => ({
      start: (cb) => {
        if (val && config && typeof config.toValue !== 'undefined') {
          val.setValue(config.toValue);
        }
        if (cb) cb({ finished: true });
      },
      stop: () => {},
    }));
  });

  afterEach(() => {
    cleanup();
    timingSpy.mockRestore();
    springSpy.mockRestore();
  });

  it('1. Raised look: verifies terracotta color, fully rounded pill, and soft elevated shadow', async () => {
    await renderHomeScreen();
    const fabBtn = screen.getByTestId('home-fab-add-customer');
    const style = StyleSheet.flatten(fabBtn.props.style);

    expect(style.backgroundColor).toBe(COLORS.primary);
    expect(style.borderRadius).toBeGreaterThanOrEqual(28);
    expect(style.elevation).toBe(8);
    expect(style.shadowColor).toBe('#000');
    expect(style.shadowOpacity).toBe(0.28);
    expect(style.shadowRadius).toBe(8);
    expect(style.overflow).toBeUndefined(); // Must not clip shadow
  });

  it('2. Accessibility: verifies role="button", label="Add customer", min 56px height, and 48px+ touch target', async () => {
    await renderHomeScreen();
    const fabBtn = screen.getByTestId('home-fab-add-customer');
    const style = StyleSheet.flatten(fabBtn.props.style);

    expect(fabBtn.props.accessibilityRole).toBe('button');
    expect(fabBtn.props.accessibilityLabel).toBe('Add customer');
    expect(style.minHeight).toBeGreaterThanOrEqual(56);
    expect(style.height).toBeGreaterThanOrEqual(56);
    expect(fabBtn.props.hitSlop).toBeDefined();
    expect(fabBtn.props.hitSlop.top).toBeGreaterThanOrEqual(8);
  });

  it('3. Safe-area rules: bottom offset = insets.bottom + 16, right offset 16, and list content padding >= 88', async () => {
    const bottomInset = 34;
    await renderHomeScreen({ top: 0, left: 0, right: 0, bottom: bottomInset });
    const fabBtn = screen.getByTestId('home-fab-add-customer');
    const fabStyle = StyleSheet.flatten(fabBtn.props.style);

    expect(fabStyle.position).toBe('absolute');
    expect(fabStyle.bottom).toBe(bottomInset + 16);
    expect(fabStyle.right).toBe(16);

    const list = screen.getByTestId('home-customer-list');
    const listStyle = StyleSheet.flatten(list.props.contentContainerStyle);
    expect(listStyle.paddingBottom).toBeGreaterThanOrEqual(bottomInset + 88);
  });

  it('4. Press feedback: on press-in scales quickly and shadow shrinks, on press-out springs back', async () => {
    await renderHomeScreen();
    let fabBtn = screen.getByTestId('home-fab-add-customer');

    // Press in
    await act(async () => {
      fireEvent(fabBtn, 'pressIn');
    });

    expect(timingSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        toValue: 0.92,
        duration: 80,
      })
    );

    // Verify pressed shadow
    fabBtn = screen.getByTestId('home-fab-add-customer');
    const pressedStyle = StyleSheet.flatten(fabBtn.props.style);
    expect(pressedStyle.elevation).toBe(3);
    expect(pressedStyle.shadowOpacity).toBe(0.16);

    // Press out
    await act(async () => {
      fireEvent(fabBtn, 'pressOut');
    });

    expect(springSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        toValue: 1,
        friction: 5,
        tension: 150,
      })
    );
  });

  it('5. Navigation: pressing the button navigates to AddCustomer screen', async () => {
    await renderHomeScreen();
    const fabBtn = screen.getByTestId('home-fab-add-customer');

    fireEvent.press(fabBtn);
    expect(mockNavigation.navigate).toHaveBeenCalledWith('AddCustomer', { initialPhoneOrName: '' });
  });

  it('6. Scroll behavior: scrolling down collapses label, scrolling up / stop restores pill', async () => {
    await renderHomeScreen();
    const list = screen.getByTestId('home-customer-list');

    // Scroll down (diff > 8 and currentY > 20)
    await act(async () => {
      fireEvent.scroll(list, {
        nativeEvent: {
          contentOffset: { y: 100 },
        },
      });
    });

    expect(timingSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        toValue: 0,
        duration: 200,
      })
    );

    // Scroll up
    await act(async () => {
      fireEvent.scroll(list, {
        nativeEvent: {
          contentOffset: { y: 20 },
        },
      });
    });

    expect(timingSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        toValue: 1,
        duration: 200,
      })
    );
  });

  it('7. Keyboard handling: hides button when keyboard appears', async () => {
    const keyboardListeners = {};
    const addListenerSpy = jest.spyOn(Keyboard, 'addListener').mockImplementation((event, cb) => {
      keyboardListeners[event] = cb;
      return {
        remove: () => {
          delete keyboardListeners[event];
        },
      };
    });

    await renderHomeScreen();
    expect(screen.getByTestId('home-fab-add-customer')).toBeTruthy();

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    // Trigger keyboard show
    await act(async () => {
      if (keyboardListeners[showEvent]) {
        keyboardListeners[showEvent]();
      }
    });

    expect(screen.queryByTestId('home-fab-add-customer')).toBeNull();

    // Trigger keyboard hide
    await act(async () => {
      if (keyboardListeners[hideEvent]) {
        keyboardListeners[hideEvent]();
      }
    });

    expect(screen.getByTestId('home-fab-add-customer')).toBeTruthy();
    addListenerSpy.mockRestore();
  });

  it('8. Reduced motion: respects AccessibilityInfo.isReduceMotionEnabled', async () => {
    const motionSpy = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await renderHomeScreen();

    const fabBtn = screen.getByTestId('home-fab-add-customer');
    expect(fabBtn).toBeTruthy();
    expect(screen.getByText('Add Customer')).toBeTruthy();
    motionSpy.mockRestore();
  });
});
