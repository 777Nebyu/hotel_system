/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
import { configure } from '@testing-library/react-native';

configure({ hostComponentNames: {
  text: 'Text',
  textInput: 'TextInput',
  switch: 'Switch',
  scrollView: 'ScrollView',
  modal: 'Modal',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
} });

jest.mock('react-native/Libraries/Modal/Modal', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockModal = ({ visible, children, ...rest }: any) => (visible ? React.createElement(View, rest, children) : null);
  MockModal.default = MockModal;
  return MockModal;
});

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Ionicons: ({ name, ...rest }: any) => React.createElement(Text, rest, name),
    MaterialIcons: ({ name, ...rest }: any) => React.createElement(Text, rest, name),
    FontAwesome: ({ name, ...rest }: any) => React.createElement(Text, rest, name),
    Feather: ({ name, ...rest }: any) => React.createElement(Text, rest, name),
  };
});
