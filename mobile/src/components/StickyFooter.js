import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsive } from '../utils/responsive';
import { COLORS } from '../constants/theme';

export default function StickyFooter({ children, onHeight, style }) {
  const insets = useSafeAreaInsets();
  const r = useResponsive();
  return (
    <View
      onLayout={(e) => onHeight && onHeight(e.nativeEvent.layout.height)}
      style={[
        styles.footer,
        {
          paddingTop: r.moderate(10),
          paddingHorizontal: r.moderate(16),
          paddingBottom: Math.max(insets.bottom, r.moderate(12)), // works for gesture AND 3-button nav
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { backgroundColor: COLORS.background },
});
