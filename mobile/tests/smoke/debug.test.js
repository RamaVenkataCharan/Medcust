import React from 'react';
import { View, Text, TextInput } from 'react-native';
import { render } from '@testing-library/react-native';

test('debug', () => {
  const result = render(<View><TextInput placeholder="test" /></View>);
  console.log(Object.keys(result));
});
