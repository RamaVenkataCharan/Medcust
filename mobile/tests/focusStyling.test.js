import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import CustomTextInput from '../src/components/CustomTextInput';
import HomeScreen from '../src/screens/HomeScreen';
import AddCustomerScreen from '../src/screens/AddCustomerScreen';
import EditCustomerScreen from '../src/screens/EditCustomerScreen';
import AddPurchaseScreen from '../src/screens/AddPurchaseScreen';
import RecordPaymentScreen from '../src/screens/RecordPaymentScreen';
import ProfileScreen from '../src/screens/ProfileScreen';
import RecycleBinScreen from '../src/screens/RecycleBinScreen';
import { COLORS, GLOBAL_STYLES } from '../src/constants/theme';
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
}));

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  reset: jest.fn(),
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

describe('Text Input Focus Highlight & Outline Removal Audit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    database.getAllCustomers.mockReturnValue([]);
    database.searchCustomers.mockReturnValue([]);
    database.getCustomerById.mockReturnValue({
      customer_id: 1,
      name: 'Ramesh Kumar',
      phone_number: '9848012345',
      village: 'Kothapally',
      address: 'H.No 1-23',
      total_due: 150,
    });
    database.getCustomerLedger.mockReturnValue([
      { entry_id: 1, total_amount: 150, amount_paid: 0, due_amount: 150, entry_date: new Date().toISOString() }
    ]);
    database.getPastMedicineNames.mockReturnValue(['Paracetamol', 'Amoxicillin']);
    database.getDeletedCustomers.mockReturnValue([
      { customer_id: 99, name: 'Deleted Customer', phone_number: '9999999999', deleted_at: new Date().toISOString() }
    ]);
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

  describe('CustomTextInput component focus and styling', () => {
    it('renders with transparent base border and does not change border colour or width on focus', async () => {
      const onFocusMock = jest.fn();
      const onBlurMock = jest.fn();

      const { getByPlaceholderText } = await render(
        <CustomTextInput
          placeholder="Enter name"
          onFocus={onFocusMock}
          onBlur={onBlurMock}
        />
      );

      const input = getByPlaceholderText('Enter name');
      const unfocusedStyle = StyleSheet.flatten(input.props.style);

      expect(unfocusedStyle.borderWidth).toBe(1.5);
      expect(unfocusedStyle.borderColor).toBe('transparent');
      expect(input.props.underlineColorAndroid).toBe('transparent');

      await act(async () => {
        fireEvent(input, 'focus');
      });
      expect(onFocusMock).toHaveBeenCalledTimes(1);

      const focusedStyle = StyleSheet.flatten(input.props.style);
      expect(focusedStyle.borderColor).not.toBe(COLORS.primary);
      expect(focusedStyle.borderColor).toBe('transparent');
      expect(focusedStyle.borderWidth).toBe(1.5);

      await act(async () => {
        fireEvent(input, 'blur');
      });
      expect(onBlurMock).toHaveBeenCalledTimes(1);
    });

    it('preserves custom border and dimensions without shifting on focus', async () => {
      const customStyle = {
        borderColor: COLORS.border,
        borderWidth: 1,
        backgroundColor: COLORS.surfaceSubtle,
      };

      const { getByPlaceholderText } = await render(
        <CustomTextInput
          placeholder="Search test"
          style={customStyle}
        />
      );

      const input = getByPlaceholderText('Search test');
      const initialStyle = StyleSheet.flatten(input.props.style);

      expect(initialStyle.borderColor).toBe(COLORS.border);
      expect(initialStyle.borderWidth).toBe(1);

      await act(async () => {
        fireEvent(input, 'focus');
      });

      const focusedStyle = StyleSheet.flatten(input.props.style);
      expect(focusedStyle.borderColor).toBe(COLORS.border);
      expect(focusedStyle.borderColor).not.toBe(COLORS.primary);
      expect(focusedStyle.borderWidth).toBe(1);
    });

    it('includes GLOBAL_STYLES.noFocusOutline and forwards props/ref', async () => {
      const ref = React.createRef();
      const { getByTestId } = await render(
        <CustomTextInput
          ref={ref}
          placeholder="Ref test"
          maxLength={10}
          keyboardType="phone-pad"
          testID="audit-input"
        />
      );

      const input = getByTestId('audit-input');
      const flattened = StyleSheet.flatten(input.props.style);

      expect(input.props.maxLength).toBe(10);
      expect(input.props.keyboardType).toBe('phone-pad');
      expect(ref.current).toBeTruthy();

      if (GLOBAL_STYLES.noFocusOutline && Object.keys(GLOBAL_STYLES.noFocusOutline).length > 0) {
        expect(flattened.outlineStyle).toBe('none');
        expect(flattened.outlineWidth).toBe(0);
        expect(flattened.boxShadow).toBe('none');
      }
    });
  });

  describe('Screen text inputs focus audit', () => {
    it('HomeScreen search input: focus does not change border color or outline', async () => {
      const { getByPlaceholderText } = await renderWithProviders(
        <HomeScreen navigation={mockNavigation} />
      );

      const searchInput = getByPlaceholderText('Search by phone, name or village...');
      const initialStyle = StyleSheet.flatten(searchInput.props.style);

      await act(async () => {
        fireEvent(searchInput, 'focus');
      });

      const focusedStyle = StyleSheet.flatten(searchInput.props.style);
      expect(focusedStyle.borderColor).toBe(initialStyle.borderColor);
      expect(focusedStyle.borderColor).not.toBe(COLORS.primary);
    });

    it('AddCustomerScreen inputs: focus does not change border color or outline', async () => {
      const { getByPlaceholderText } = await renderWithProviders(
        <AddCustomerScreen navigation={mockNavigation} route={{ params: {} }} />
      );

      const nameInput = getByPlaceholderText('e.g. Ramesh Kumar');
      const phoneInput = getByPlaceholderText('e.g. 9876543210');

      const initialNameStyle = StyleSheet.flatten(nameInput.props.style);
      const initialPhoneStyle = StyleSheet.flatten(phoneInput.props.style);

      await act(async () => {
        fireEvent(nameInput, 'focus');
        fireEvent(phoneInput, 'focus');
      });

      expect(StyleSheet.flatten(nameInput.props.style).borderColor).toBe(initialNameStyle.borderColor);
      expect(StyleSheet.flatten(nameInput.props.style).borderColor).not.toBe(COLORS.primary);
      expect(StyleSheet.flatten(phoneInput.props.style).borderColor).toBe(initialPhoneStyle.borderColor);
      expect(StyleSheet.flatten(phoneInput.props.style).borderColor).not.toBe(COLORS.primary);
    });

    it('EditCustomerScreen inputs: focus does not change border color or outline', async () => {
      const { getByPlaceholderText } = await renderWithProviders(
        <EditCustomerScreen navigation={mockNavigation} route={{ params: { customerId: 1 } }} />
      );

      const nameInput = getByPlaceholderText('e.g. Ramesh Kumar');
      const phoneInput = getByPlaceholderText('e.g. 9876543210');

      const initialNameStyle = StyleSheet.flatten(nameInput.props.style);

      await act(async () => {
        fireEvent(nameInput, 'focus');
        fireEvent(phoneInput, 'focus');
      });

      expect(StyleSheet.flatten(nameInput.props.style).borderColor).toBe(initialNameStyle.borderColor);
      expect(StyleSheet.flatten(nameInput.props.style).borderColor).not.toBe(COLORS.primary);
    });

    it('AddPurchaseScreen (name, price, discount, paid now): focus does not change border color', async () => {
      const { getByTestId } = await renderWithProviders(
        <AddPurchaseScreen navigation={mockNavigation} route={{ params: { customerId: 1 } }} />
      );

      const nameInput = getByTestId('medicineName_0');
      const priceInput = getByTestId('medicinePrice_0');
      const discountInput = getByTestId('medicineDiscount_0');
      const paidNowInput = getByTestId('paidNowInput');

      const initNameStyle = StyleSheet.flatten(nameInput.props.style);
      const initPriceStyle = StyleSheet.flatten(priceInput.props.style);
      const initDiscountStyle = StyleSheet.flatten(discountInput.props.style);
      const initPaidStyle = StyleSheet.flatten(paidNowInput.props.style);

      await act(async () => {
        fireEvent(nameInput, 'focus');
        fireEvent(priceInput, 'focus');
        fireEvent(discountInput, 'focus');
        fireEvent(paidNowInput, 'focus');
      });

      expect(StyleSheet.flatten(nameInput.props.style).borderColor).toBe(initNameStyle.borderColor);
      expect(StyleSheet.flatten(nameInput.props.style).borderColor).not.toBe(COLORS.primary);
      expect(StyleSheet.flatten(priceInput.props.style).borderColor).toBe(initPriceStyle.borderColor);
      expect(StyleSheet.flatten(priceInput.props.style).borderColor).not.toBe(COLORS.primary);
      expect(StyleSheet.flatten(discountInput.props.style).borderColor).toBe(initDiscountStyle.borderColor);
      expect(StyleSheet.flatten(discountInput.props.style).borderColor).not.toBe(COLORS.primary);
      expect(StyleSheet.flatten(paidNowInput.props.style).borderColor).toBe(initPaidStyle.borderColor);
      expect(StyleSheet.flatten(paidNowInput.props.style).borderColor).not.toBe(COLORS.primary);
    });

    it('RecordPaymentScreen (amount, note): focus does not change border color', async () => {
      const { getByPlaceholderText } = await renderWithProviders(
        <RecordPaymentScreen navigation={mockNavigation} route={{ params: { customerId: 1 } }} />
      );

      const amountInput = getByPlaceholderText('0.00');
      const noteInput = getByPlaceholderText('e.g. paid at counter');

      const initAmountStyle = StyleSheet.flatten(amountInput.props.style);
      const initNoteStyle = StyleSheet.flatten(noteInput.props.style);

      await act(async () => {
        fireEvent(amountInput, 'focus');
        fireEvent(noteInput, 'focus');
      });

      expect(StyleSheet.flatten(amountInput.props.style).borderColor).toBe(initAmountStyle.borderColor);
      expect(StyleSheet.flatten(amountInput.props.style).borderColor).not.toBe(COLORS.primary);
      expect(StyleSheet.flatten(noteInput.props.style).borderColor).toBe(initNoteStyle.borderColor);
      expect(StyleSheet.flatten(noteInput.props.style).borderColor).not.toBe(COLORS.primary);
    });

    it('ProfileScreen (shop and pharmacist fields): focus does not change border color', async () => {
      const { getByTestId } = await renderWithProviders(
        <ProfileScreen navigation={mockNavigation} />
      );

      const shopNameInput = getByTestId('input-shop-name');
      const pharmacistNameInput = getByTestId('input-pharmacist-name');

      const initShopStyle = StyleSheet.flatten(shopNameInput.props.style);
      const initPharmStyle = StyleSheet.flatten(pharmacistNameInput.props.style);

      await act(async () => {
        fireEvent(shopNameInput, 'focus');
        fireEvent(pharmacistNameInput, 'focus');
      });

      expect(StyleSheet.flatten(shopNameInput.props.style).borderColor).toBe(initShopStyle.borderColor);
      expect(StyleSheet.flatten(shopNameInput.props.style).borderColor).not.toBe(COLORS.primary);
      expect(StyleSheet.flatten(pharmacistNameInput.props.style).borderColor).toBe(initPharmStyle.borderColor);
      expect(StyleSheet.flatten(pharmacistNameInput.props.style).borderColor).not.toBe(COLORS.primary);
    });

    it('RecycleBinScreen DELETE confirmation input: focus does not change border color', async () => {
      const { getByText, getByPlaceholderText } = await renderWithProviders(
        <RecycleBinScreen navigation={mockNavigation} />
      );

      // Open permanent delete modal
      const deleteBtn = getByText('Delete');
      await act(async () => {
        fireEvent.press(deleteBtn);
      });

      const deleteInput = getByPlaceholderText('DELETE');
      const initStyle = StyleSheet.flatten(deleteInput.props.style);

      await act(async () => {
        fireEvent(deleteInput, 'focus');
      });

      const focusedStyle = StyleSheet.flatten(deleteInput.props.style);
      expect(focusedStyle.borderColor).toBe(initStyle.borderColor);
      expect(focusedStyle.borderColor).not.toBe(COLORS.primary);
    });
  });
});
