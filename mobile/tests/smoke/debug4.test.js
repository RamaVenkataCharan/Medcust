import React from 'react';
import { View, TextInput } from 'react-native';
import { render } from '@testing-library/react-native';

test('debug4', () => {
  const result = render(<View><TextInput testID='abc' placeholder='test' /></View>);
  console.log('KEYS', Object.keys(result));
  let proto = Object.getPrototypeOf(result);
  console.log('PROTO', Object.getOwnPropertyNames(proto));
});
