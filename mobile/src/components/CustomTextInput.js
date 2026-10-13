import React, { useState, forwardRef } from 'react';
import { TextInput, StyleSheet } from 'react-native';
import { COLORS, GLOBAL_STYLES } from '../constants/theme';

const CustomTextInput = forwardRef(({ style, onFocus, onBlur, ...props }, ref) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <TextInput
      ref={ref}
      style={[
        styles.base,
        style,
        GLOBAL_STYLES.noFocusOutline,
        isFocused && styles.focused
      ]}
      underlineColorAndroid="transparent"
      onFocus={(e) => {
        setIsFocused(true);
        if (onFocus) onFocus(e);
      }}
      onBlur={(e) => {
        setIsFocused(false);
        if (onBlur) onBlur(e);
      }}
      {...props}
    />
  );
});

const styles = StyleSheet.create({
  base: {
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  focused: {
    borderColor: COLORS.primary,
  }
});

export default CustomTextInput;
