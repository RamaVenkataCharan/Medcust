import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import AddPurchaseScreen from '../../src/screens/AddPurchaseScreen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import * as database from '../../src/db/database';

jest.mock('../../src/db/database', () => ({
  getCustomerById: jest.fn(),
  getPastMedicineNames: jest.fn(),
  addPurchaseEntry: jest.fn(),
}));

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  addListener: jest.fn().mockReturnValue(() => {}),
  setOptions: jest.fn(),
};

const customRender = (ui) => {
  return render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 0, height: 0 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <NavigationContainer>
        {ui}
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

describe('AddPurchaseScreen Discount Calculations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    database.getCustomerById.mockReturnValue({ customer_id: 1, name: 'John Doe', total_due: 65 });
    database.getPastMedicineNames.mockReturnValue([]);
  });

  it('Scenario A: asserts % discount default mode without chip press, totals, balance, and save payload', async () => {
    await customRender(
      <AddPurchaseScreen navigation={mockNavigation} route={{ params: { customerId: 1, customerName: 'John Doe' } }} />
    );

    // Row 1: Cifran, 75, 10% (uses default % mode with no chip press)
    fireEvent.changeText(await screen.findByTestId('medicineName_0'), 'Cifran');
    fireEvent.changeText(await screen.findByTestId('medicinePrice_0'), '75');
    fireEvent.changeText(await screen.findByTestId('medicineDiscount_0'), '10');

    // Add Row
    fireEvent.press(await screen.findByText('Add Medicine'));

    // Row 2: Dolo, 15, 0 (default % mode, 0 discount)
    fireEvent.changeText(await screen.findByTestId('medicineName_1'), 'Dolo');
    fireEvent.changeText(await screen.findByTestId('medicinePrice_1'), '15');
    fireEvent.changeText(await screen.findByTestId('medicineDiscount_1'), '0');

    // Paid Now 25
    fireEvent.changeText(await screen.findByTestId('paidNowInput'), '25');

    // Assert on-screen Subtotal 90, Discount -8, Grand Total 83, Due Created 58, Updated Balance 123
    expect(await screen.findByText('₹90')).toBeTruthy();
    expect(await screen.findByText('−₹8')).toBeTruthy();
    expect(await screen.findByText('₹83')).toBeTruthy();
    expect(await screen.findByText('₹58')).toBeTruthy();
    expect(await screen.findByText('₹123')).toBeTruthy();

    // Now trigger Save and assert DB call
    fireEvent.press(await screen.findByText('Save Purchase'));
    
    expect(database.addPurchaseEntry).toHaveBeenCalled();
    const saveCall = database.addPurchaseEntry.mock.calls[0][0];
    
    expect(saveCall.totalAmount).toBe(82.50);
    expect(saveCall.amountPaid).toBe(25);
    
    expect(saveCall.medicines[0].price).toBe(75);
    expect(saveCall.medicines[0].discount).toBe(7.5);
    expect(saveCall.medicines[1].price).toBe(15);
    expect(saveCall.medicines[1].discount).toBe(0);
  }, 15000);
  
  it('Scenario B: asserts ₹ discount mode by pressing chip to switch to ₹, totals, and balance', async () => {
    await customRender(
      <AddPurchaseScreen navigation={mockNavigation} route={{ params: { customerId: 1, customerName: 'John Doe' } }} />
    );

    // Row 1: Cifran, 75, switch to ₹ mode via chip press, discount 7.5
    fireEvent.changeText(await screen.findByTestId('medicineName_0'), 'Cifran');
    fireEvent.changeText(await screen.findByTestId('medicinePrice_0'), '75');

    // Press chip to switch from default % to ₹
    fireEvent.press(await screen.findByTestId('medicineMode_0'));

    fireEvent.changeText(await screen.findByTestId('medicineDiscount_0'), '7.5');

    // Add Row
    fireEvent.press(await screen.findByText('Add Medicine'));

    // Row 2: Dolo, 15, switch to ₹ mode, discount 0
    fireEvent.changeText(await screen.findByTestId('medicineName_1'), 'Dolo');
    fireEvent.changeText(await screen.findByTestId('medicinePrice_1'), '15');
    fireEvent.press(await screen.findByTestId('medicineMode_1'));
    fireEvent.changeText(await screen.findByTestId('medicineDiscount_1'), '0');

    // Paid Now 25
    fireEvent.changeText(await screen.findByTestId('paidNowInput'), '25');

    // Assert on-screen Subtotal 90, Discount -8, Grand Total 83, Due Created 58, Updated Balance 123
    expect(await screen.findByText('₹90')).toBeTruthy();
    expect(await screen.findByText('−₹8')).toBeTruthy();
    expect(await screen.findByText('₹83')).toBeTruthy();
    expect(await screen.findByText('₹58')).toBeTruthy();
    expect(await screen.findByText('₹123')).toBeTruthy();

    // Trigger Save and assert DB call
    fireEvent.press(await screen.findByText('Save Purchase'));
    expect(database.addPurchaseEntry).toHaveBeenCalled();
    const saveCall = database.addPurchaseEntry.mock.calls[0][0];
    expect(saveCall.totalAmount).toBe(82.50);
    expect(saveCall.amountPaid).toBe(25);
    expect(saveCall.medicines[0].price).toBe(75);
    expect(saveCall.medicines[0].discount).toBe(7.5);
  }, 15000);

  it('New case: Domperidone 125 with 5% default discount and paid 0', async () => {
    database.getCustomerById.mockReturnValue({ customer_id: 1, name: 'John Doe', total_due: 0 });

    await customRender(
      <AddPurchaseScreen navigation={mockNavigation} route={{ params: { customerId: 1, customerName: 'John Doe' } }} />
    );

    fireEvent.changeText(await screen.findByTestId('medicineName_0'), 'Domperidone');
    fireEvent.changeText(await screen.findByTestId('medicinePrice_0'), '125');
    // Discount 5 in default % mode (no chip press)
    fireEvent.changeText(await screen.findByTestId('medicineDiscount_0'), '5');
    fireEvent.changeText(await screen.findByTestId('paidNowInput'), '0');

    // Expect Net Total 119, Discount -6, Grand Total 119, Subtotal 125
    const matches119 = await screen.findAllByText('₹119');
    expect(matches119.length).toBeGreaterThanOrEqual(2); // Appears in row Net Total and Grand Total
    expect(await screen.findByText('−₹6')).toBeTruthy();
    expect(await screen.findByText('₹125')).toBeTruthy();

    // Save and check payload (saved discount 6.25)
    fireEvent.press(await screen.findByText('Save Purchase'));
    expect(database.addPurchaseEntry).toHaveBeenCalled();
    const saveCall = database.addPurchaseEntry.mock.calls[0][0];
    expect(saveCall.totalAmount).toBe(118.75);
    expect(saveCall.amountPaid).toBe(0);
    expect(saveCall.medicines[0].name).toBe('Domperidone');
    expect(saveCall.medicines[0].price).toBe(125);
    expect(saveCall.medicines[0].discount).toBe(6.25);
  }, 15000);

  it('validates percent above 100 shows inline error and disables Save', async () => {
    database.getCustomerById.mockReturnValue({ customer_id: 1, name: 'John Doe', total_due: 0 });

    await customRender(
      <AddPurchaseScreen navigation={mockNavigation} route={{ params: { customerId: 1, customerName: 'John Doe' } }} />
    );

    fireEvent.changeText(await screen.findByTestId('medicineName_0'), 'Amoxicillin');
    fireEvent.changeText(await screen.findByTestId('medicinePrice_0'), '100');
    // Discount 105% in default mode
    fireEvent.changeText(await screen.findByTestId('medicineDiscount_0'), '105');

    // Assert inline error under field
    expect(await screen.findByText('Discount cannot exceed 100%')).toBeTruthy();

    // Assert Save is disabled
    const saveBtn = await screen.findByText('Save Purchase');
    fireEvent.press(saveBtn);
    expect(database.addPurchaseEntry).not.toHaveBeenCalled();
  }, 15000);

  it('renders customer card with name only, omitting phone number and separator', async () => {
    database.getCustomerById.mockReturnValue({
      customer_id: 1,
      name: 'giri',
      phone_number: '9848012345',
      total_due: 65,
    });

    await customRender(
      <AddPurchaseScreen navigation={mockNavigation} route={{ params: { customerId: 1, customerName: 'giri' } }} />
    );

    expect(await screen.findByText('giri')).toBeTruthy();
    expect(screen.queryByText(/98480/)).toBeNull();
    expect(screen.queryByText(/12345/)).toBeNull();
    expect(screen.queryByText(/·/)).toBeNull();
  });
});
