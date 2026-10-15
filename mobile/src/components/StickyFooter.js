import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsive } from '../utils/responsive';
import { COLORS } from '../constants/theme';

export default function StickyFooter({ children, onHeight, style, testID = 'sticky-footer' }) {
  const insets = useSafeAreaInsets();
  const r = useResponsive();
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setIsKeyboardVisible(false));

    return () => {
      showSub?.remove?.();
      hideSub?.remove?.();
    };
  }, []);

  const bottomPadding = isKeyboardVisible
    ? r.moderate(12)
    : Math.max(insets.bottom, r.moderate(12));

  return (
    <View
      testID={testID}
      onLayout={(e) => onHeight && onHeight(e.nativeEvent.layout.height)}
      style={[
        styles.footer,
        {
          paddingTop: r.moderate(10),
          paddingHorizontal: r.moderate(16),
          paddingBottom: bottomPadding,
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
