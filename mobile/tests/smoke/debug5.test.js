import React from 'react';
import { View, TextInput } from 'react-native';
import { render } from '@testing-library/react-native';

test('debug5', () => {
  const result = render(<View><TextInput testID='abc' placeholder='test' /></View>);
  console.log(result);
});
