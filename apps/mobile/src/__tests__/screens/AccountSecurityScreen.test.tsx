/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Image: (props: any) => React.createElement(View, { ...props, testID: 'mock-image' }),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
}));

jest.mock('../../hooks/useHaptics', () => ({
  hapticLight: jest.fn(),
  hapticMedium: jest.fn(),
  hapticSuccess: jest.fn(),
  hapticError: jest.fn(),
  hapticSelection: jest.fn(),
}));

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  const React = require('react');
  return Object.setPrototypeOf(
    {
      Switch: (props: any) => React.createElement('Switch', props, null),
      ScrollView: (props: any) => React.createElement('ScrollView', props, props.children),
    },
    RN,
  );
});

import AccountSecurityScreen from '../../screens/AccountSecurityScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    canGoBack: () => true,
  }),
}));

const mockSession = {
  accessToken: 'test-token',
  user: {
    id: 'u1',
    fullName: 'Alexander Wright',
    email: 'alexander@example.com',
    role: 'CUSTOMER',
  },
};

jest.mock('../../store/hooks', () => ({
  useAppSelector: (selector: any) => selector({ auth: { session: mockSession } }),
  useAppDispatch: () => jest.fn(),
}));

jest.mock('../../api', () => ({
  request: jest.fn(),
}));

jest.mock('../../lib/notifications', () => ({
  getStoredPushToken: jest.fn().mockResolvedValue('test-push-token'),
  deregisterPushToken: jest.fn().mockResolvedValue(undefined),
}));

describe('AccountSecurityScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders header elements with user name, email, membership badge, and edit profile button', () => {
    const { getByText, getByLabelText } = render(<AccountSecurityScreen />);
    expect(getByText('Alexander Wright')).toBeTruthy();
    expect(getByText('alexander@example.com')).toBeTruthy();
    expect(getByText('Platinum Elite')).toBeTruthy();
    expect(getByLabelText('Edit profile')).toBeTruthy();
    expect(getByLabelText('Go back')).toBeTruthy();
  });

  it('renders Profile and Security tabs with Security tab active', () => {
    const { getByLabelText, getByText } = render(<AccountSecurityScreen />);
    expect(getByLabelText('Profile tab')).toBeTruthy();
    expect(getByLabelText('Security tab active')).toBeTruthy();
    expect(getByText('Security')).toBeTruthy();
  });

  it('renders password management inputs and update button', () => {
    const { getByPlaceholderText, getByText } = render(<AccountSecurityScreen />);
    expect(getByPlaceholderText('••••••••')).toBeTruthy();
    expect(getByPlaceholderText('Minimum 8 characters')).toBeTruthy();
    expect(getByPlaceholderText('Re-enter new password')).toBeTruthy();
    expect(getByText('Update password')).toBeTruthy();
  });

  it('renders two-factor authentication and login notifications toggles', () => {
    const { getByText } = render(<AccountSecurityScreen />);
    expect(getByText('Two-factor authentication')).toBeTruthy();
    expect(getByText('Login notifications')).toBeTruthy();
    expect(getByText('RECOMMENDED')).toBeTruthy();
  });

  it('renders payment method cards: Visa ****4832, Telebirr, and Add payment method', () => {
    const { getByText } = render(<AccountSecurityScreen />);
    expect(getByText('Payment Methods')).toBeTruthy();
    expect(getByText('••••  ••••  ••••  4832')).toBeTruthy();
    expect(getByText('VISA')).toBeTruthy();
    expect(getByText('DEFAULT')).toBeTruthy();
    expect(getByText('Telebirr')).toBeTruthy();
    expect(getByText('Add payment method')).toBeTruthy();
  });

  it('renders the danger zone with sign out button', () => {
    const { getByText, getByLabelText } = render(<AccountSecurityScreen />);
    expect(getByText('Danger Zone')).toBeTruthy();
    expect(getByLabelText('Sign out')).toBeTruthy();
  });

  it('renders bottom navigation with Home, Explore, Trips, Saved, and Profile', () => {
    const { getByLabelText } = render(<AccountSecurityScreen />);
    expect(getByLabelText('Home tab')).toBeTruthy();
    expect(getByLabelText('Explore hotels tab')).toBeTruthy();
    expect(getByLabelText('Trips tab')).toBeTruthy();
    expect(getByLabelText('Saved hotels tab')).toBeTruthy();
    expect(getByLabelText('Profile tab, active')).toBeTruthy();
  });
});
