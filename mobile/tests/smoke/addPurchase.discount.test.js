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

describe('AddPurchaseScreen Discount Bug', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    database.getCustomerById.mockReturnValue({ customer_id: 1, name: 'John Doe', total_due: 65 });
    database.getPastMedicineNames.mockReturnValue([]);
  });

  it('reproduces % discount bug', async () => {
    await customRender(
      <AddPurchaseScreen navigation={mockNavigation} route={{ params: { customerId: 1, customerName: 'John Doe' } }} />
    );

    // Row 1: Cifran, 75, 10%
    fireEvent.changeText(await screen.findByTestId('medicineName_0'), 'Cifran');
    fireEvent.changeText(await screen.findByTestId('medicinePrice_0'), '75');
    
    // Change to % mode
    fireEvent.press(await screen.findByTestId('medicineMode_0'));
    
    fireEvent.changeText(await screen.findByTestId('medicineDiscount_0'), '10');

    // Add Row
    fireEvent.press(await screen.findByText('Add Medicine'));

    // Row 2: Dolo, 15, 0 (default ₹ mode)
    fireEvent.changeText(await screen.findByTestId('medicineName_1'), 'Dolo');
    fireEvent.changeText(await screen.findByTestId('medicinePrice_1'), '15');
    fireEvent.changeText(await screen.findByTestId('medicineDiscount_1'), '0');

    // Paid Now 25
    fireEvent.changeText(await screen.findByTestId('paidNowInput'), '25');

    // Assert on-screen Subtotal 90.00, Discount -7.50, Grand Total 82.50, Due Created 57.50, Updated Balance 122.50
    expect(await screen.findByText('₹90.00')).toBeTruthy();
    expect(await screen.findByText('−₹7.50')).toBeTruthy();
    expect(await screen.findByText('₹82.50')).toBeTruthy();
    expect(await screen.findByText('₹57.50')).toBeTruthy();
    expect(await screen.findByText('₹122.50')).toBeTruthy();

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
  });
  
  it('reproduces ₹ discount bug', async () => {
    await customRender(
      <AddPurchaseScreen navigation={mockNavigation} route={{ params: { customerId: 1, customerName: 'John Doe' } }} />
    );

    // Row 1: Cifran, 75, 7.5₹
    fireEvent.changeText(await screen.findByTestId('medicineName_0'), 'Cifran');
    fireEvent.changeText(await screen.findByTestId('medicinePrice_0'), '75');
    fireEvent.changeText(await screen.findByTestId('medicineDiscount_0'), '7.5');

    // Add Row
    fireEvent.press(await screen.findByText('Add Medicine'));

    // Row 2: Dolo, 15, 0 (default ₹ mode)
    fireEvent.changeText(await screen.findByTestId('medicineName_1'), 'Dolo');
    fireEvent.changeText(await screen.findByTestId('medicinePrice_1'), '15');
    fireEvent.changeText(await screen.findByTestId('medicineDiscount_1'), '0');

    // Paid Now 25
    fireEvent.changeText(await screen.findByTestId('paidNowInput'), '25');

    // Assert on-screen Subtotal 90.00, Discount -7.50, Grand Total 82.50, Due Created 57.50, Updated Balance 122.50
    expect(await screen.findByText('₹90.00')).toBeTruthy();
    expect(await screen.findByText('−₹7.50')).toBeTruthy();
    expect(await screen.findByText('₹82.50')).toBeTruthy();
    expect(await screen.findByText('₹57.50')).toBeTruthy();
    expect(await screen.findByText('₹122.50')).toBeTruthy();
  });
});
