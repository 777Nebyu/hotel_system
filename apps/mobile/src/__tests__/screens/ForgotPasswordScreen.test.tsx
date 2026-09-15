import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ForgotPasswordScreen from '../../screens/ForgotPasswordScreen';

const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
}));

jest.mock('../../api', () => ({
  request: jest.fn(),
}));

describe('ForgotPasswordScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders email input and submit button', () => {
    const { getByPlaceholderText, getByText } = render(<ForgotPasswordScreen />);
    expect(getByPlaceholderText('Email address')).toBeTruthy();
    expect(getByText('Send reset link')).toBeTruthy();
  });

  it('shows inline error on blur when email is empty', () => {
    const { getByPlaceholderText, getByText } = render(<ForgotPasswordScreen />);
    const input = getByPlaceholderText('Email address');
    fireEvent(input, 'blur');
    expect(getByText('Email is required.')).toBeTruthy();
  });

  it('shows inline error on blur for invalid email', () => {
    const { getByPlaceholderText, getByText } = render(<ForgotPasswordScreen />);
    const input = getByPlaceholderText('Email address');
    fireEvent.changeText(input, 'notanemail');
    fireEvent(input, 'blur');
    expect(getByText('Invalid email')).toBeTruthy();
  });

  it('clears error when user types', () => {
    const { getByPlaceholderText, queryByText } = render(<ForgotPasswordScreen />);
    const input = getByPlaceholderText('Email address');
    fireEvent(input, 'blur');
    fireEvent.changeText(input, 'test@example.com');
    expect(queryByText('Email is required.')).toBeNull();
  });
});
