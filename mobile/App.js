import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { initDatabase } from './src/db/database';
import { COLORS } from './src/constants/theme';
import HomeScreen from './src/screens/HomeScreen';
import AddCustomerScreen from './src/screens/AddCustomerScreen';
import CustomerProfileScreen from './src/screens/CustomerProfileScreen';
import AddPurchaseScreen from './src/screens/AddPurchaseScreen';
import RecordPaymentScreen from './src/screens/RecordPaymentScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import RecycleBinScreen from './src/screens/RecycleBinScreen';
import EditCustomerScreen from './src/screens/EditCustomerScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import AboutScreen from './src/screens/AboutScreen';
import {
  setupNotificationChannelAsync,
  rescheduleAllLicenseReminders,
  registerNotificationResponseListener,
} from './src/services/licenseNotifications';

const Stack = createNativeStackNavigator();

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    try {
      initDatabase();
      setDbReady(true);
      setupNotificationChannelAsync();
      rescheduleAllLicenseReminders();
    } catch (err) {
      console.error('Failed to initialize local SQLite database:', err);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = registerNotificationResponseListener(navigationRef);
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [navigationRef]);

  if (!dbReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider style={{ backgroundColor: COLORS.background }}>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: COLORS.background },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="AddCustomer" component={AddCustomerScreen} />
          <Stack.Screen name="CustomerProfile" component={CustomerProfileScreen} />
          <Stack.Screen name="AddPurchase" component={AddPurchaseScreen} />
          <Stack.Screen name="RecordPayment" component={RecordPaymentScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="RecycleBin" component={RecycleBinScreen} />
          <Stack.Screen name="EditCustomer" component={EditCustomerScreen} />
          <Stack.Screen name="About" component={AboutScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
