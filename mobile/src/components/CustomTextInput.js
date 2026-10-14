import React, { forwardRef } from 'react';
import { TextInput, StyleSheet } from 'react-native';
import { GLOBAL_STYLES } from '../constants/theme';

const CustomTextInput = forwardRef(({ style, onFocus, onBlur, ...props }, ref) => {
  return (
    <TextInput
      ref={ref}
      style={[
        styles.base,
        style,
        GLOBAL_STYLES.noFocusOutline,
      ]}
      underlineColorAndroid="transparent"
      onFocus={onFocus}
      onBlur={onBlur}
      {...props}
    />
  );
});

const styles = StyleSheet.create({
  base: {
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
});

export default CustomTextInput;
