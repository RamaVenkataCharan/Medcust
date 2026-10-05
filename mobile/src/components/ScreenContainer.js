import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useResponsive } from '../utils/responsive';
import { COLORS } from '../constants/theme'; 

// Handles top (notch / status bar / camera cutout) and left/right (landscape cutouts).
// The bottom edge is handled by <StickyFooter> or by the scroll content padding.
export default function ScreenContainer({ children, style, edges = ['top', 'left', 'right'] }) {
  const r = useResponsive();
  return (
    <SafeAreaView style={styles.root} edges={edges}>
      <StatusBar style="dark" backgroundColor="transparent" translucent />
      <View style={[styles.inner, { maxWidth: r.contentMaxWidth }, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  inner: { flex: 1, width: '100%', alignSelf: 'center' },
});
