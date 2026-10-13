import React from 'react';
import { render, waitFor, screen } from '@testing-library/react-native';
import HomeScreen from '../../src/screens/HomeScreen';
import AddCustomerScreen from '../../src/screens/AddCustomerScreen';
import EditCustomerScreen from '../../src/screens/EditCustomerScreen';
import CustomerProfileScreen from '../../src/screens/CustomerProfileScreen';
import AddPurchaseScreen from '../../src/screens/AddPurchaseScreen';
import RecordPaymentScreen from '../../src/screens/RecordPaymentScreen';
import SettingsScreen from '../../src/screens/SettingsScreen';
import RecycleBinScreen from '../../src/screens/RecycleBinScreen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';

import * as database from '../../src/db/database';

jest.mock('../../src/db/database', () => ({
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
}));

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  reset: jest.fn(),
  addListener: jest.fn().mockReturnValue(() => {}),
  setOptions: jest.fn(),
};

describe('Phase C: Render Smoke Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    database.getAllCustomers.mockReturnValue([]);
    database.searchCustomers.mockReturnValue([]);
    database.getCustomerById.mockReturnValue(null);
    database.getCustomerLedger.mockReturnValue([]);
    database.getPastMedicineNames.mockReturnValue([]);
    database.getDeletedCustomers.mockReturnValue([]);
    database.exportAllData.mockReturnValue({ customers: [], entries: [], entryMedicines: [] });
    database.getActiveDriverName.mockReturnValue('SQLITE');
    database.getShopProfile.mockReturnValue({
      shop_name: 'Test Shop',
      shop_license_no: '',
      shop_license_validity: '',
      shop_phone: '',
      pharmacist_name: '',
      pharmacist_phone: '',
      pharmacist_license_validity: '',
    });
  });

  const customRender = (ui) => {
    return render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 0, height: 0 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <NavigationContainer>
          {ui}
        </NavigationContainer>
      </SafeAreaProvider>
    );
  };

  describe('HomeScreen', () => {
    it('renders empty data', () => {
      database.getAllCustomers.mockReturnValue([]);
      customRender(<HomeScreen navigation={mockNavigation} />);
    });

    it('renders normal data', () => {
      database.getAllCustomers.mockReturnValue([{ customer_id: 1, name: 'John Doe', phone_number: '1234567890', total_due: 100 }]);
      customRender(<HomeScreen navigation={mockNavigation} />);
    });
  });

  describe('AddCustomerScreen', () => {
    it('renders', () => {
      customRender(<AddCustomerScreen navigation={mockNavigation} route={{ params: {} }} />);
    });
  });

  describe('EditCustomerScreen', () => {
    it('renders with customer data', async () => {
      database.getCustomerById.mockReturnValue({ customer_id: 1, name: 'John', phone_number: '1234567890' });
      customRender(<EditCustomerScreen navigation={mockNavigation} route={{ params: { customerId: 1 } }} />);
      await waitFor(() => expect(database.getCustomerById).toHaveBeenCalledWith(1));
    });
  });

  describe('CustomerProfileScreen', () => {
    it('renders with due > 0', async () => {
      database.getCustomerById.mockReturnValue({ customer_id: 1, name: 'John' });
      database.getCustomerLedger.mockReturnValue([{ entry_id: 1, total_amount: 100, amount_paid: 0, due_amount: 100, entry_date: new Date().toISOString() }]);
      customRender(<CustomerProfileScreen navigation={mockNavigation} route={{ params: { customerId: 1 } }} />);
      await waitFor(() => expect(database.getCustomerLedger).toHaveBeenCalledWith(1));
    });

    it('renders with due == 0', async () => {
      database.getCustomerById.mockReturnValue({ customer_id: 1, name: 'John' });
      database.getCustomerLedger.mockReturnValue([{ entry_id: 1, total_amount: 100, amount_paid: 100, due_amount: 0, entry_date: new Date().toISOString() }]);
      customRender(<CustomerProfileScreen navigation={mockNavigation} route={{ params: { customerId: 1 } }} />);
      await waitFor(() => expect(database.getCustomerLedger).toHaveBeenCalledWith(1));
    });

    it('renders with credit (due < 0)', async () => {
      database.getCustomerById.mockReturnValue({ customer_id: 1, name: 'John' });
      database.getCustomerLedger.mockReturnValue([{ entry_id: 1, total_amount: 0, amount_paid: 50, due_amount: -50, entry_date: new Date().toISOString() }]);
      customRender(<CustomerProfileScreen navigation={mockNavigation} route={{ params: { customerId: 1 } }} />);
      await waitFor(() => expect(database.getCustomerLedger).toHaveBeenCalledWith(1));
    });
  });

  describe('AddPurchaseScreen', () => {
    it('renders empty data', async () => {
      database.getCustomerById.mockReturnValue({ customer_id: 1, name: 'John' });
      database.getPastMedicineNames.mockReturnValue([]);
      customRender(<AddPurchaseScreen navigation={mockNavigation} route={{ params: { customerId: 1 } }} />);
      await waitFor(() => expect(database.getCustomerById).toHaveBeenCalledWith(1));
    });
  });

  describe('RecordPaymentScreen', () => {
    it('renders empty data', async () => {
      database.getCustomerById.mockReturnValue({ customer_id: 1, name: 'John' });
      customRender(<RecordPaymentScreen navigation={mockNavigation} route={{ params: { customerId: 1 } }} />);
      await waitFor(() => expect(database.getCustomerById).toHaveBeenCalledWith(1));
    });
  });

  describe('SettingsScreen', () => {
    it('renders empty data', () => {
      customRender(<SettingsScreen navigation={mockNavigation} />);
    });

    it('renders with saved shop profile and expired license badge', async () => {
      database.getShopProfile.mockReturnValue({
        shop_name: 'City Meds',
        shop_license_no: 'DL-999',
        shop_license_validity: '2020-01-01',
        shop_phone: '9876543210',
        pharmacist_name: 'Dr. John',
        pharmacist_phone: '9876543211',
        pharmacist_license_validity: '2020-05-01',
      });
      await customRender(<SettingsScreen navigation={mockNavigation} />);
      const shopInput = await screen.findByTestId('input-shop-name');
      expect(shopInput.props.value).toBe('City Meds');
      const expiredBadges = await screen.findAllByText('EXPIRED');
      expect(expiredBadges.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('RecycleBinScreen', () => {
    it('renders empty data', async () => {
      database.getDeletedCustomers.mockReturnValue([]);
      customRender(<RecycleBinScreen navigation={mockNavigation} />);
      await waitFor(() => expect(database.getDeletedCustomers).toHaveBeenCalled());
    });

    it('renders normal data', async () => {
      database.getDeletedCustomers.mockReturnValue([{ customer_id: 1, name: 'Deleted John', phone_number: '123' }]);
      customRender(<RecycleBinScreen navigation={mockNavigation} />);
      await waitFor(() => expect(database.getDeletedCustomers).toHaveBeenCalled());
    });
  });
});
