import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ResetPasswordScreen from '../../screens/ResetPasswordScreen';

const mockOnReset = jest.fn();
const mockOnError = jest.fn();

describe('ResetPasswordScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders password inputs and submit button', () => {
    const { getByPlaceholderText, getByText } = render(
      <ResetPasswordScreen token="test-token" onReset={mockOnReset} onError={mockOnError} />
    );
    expect(getByPlaceholderText('New password')).toBeTruthy();
    expect(getByPlaceholderText('Confirm password')).toBeTruthy();
    expect(getByText('Reset password')).toBeTruthy();
  });

  it('shows inline error on blur when password is empty', () => {
    const { getByPlaceholderText, getByText } = render(
      <ResetPasswordScreen token="test-token" onReset={mockOnReset} onError={mockOnError} />
    );
    const input = getByPlaceholderText('New password');
    fireEvent(input, 'blur');
    expect(getByText('Enter a new password.')).toBeTruthy();
  });

  it('shows inline error for short password', () => {
    const { getByPlaceholderText, getByText } = render(
      <ResetPasswordScreen token="test-token" onReset={mockOnReset} onError={mockOnError} />
    );
    const input = getByPlaceholderText('New password');
    fireEvent.changeText(input, 'short');
    fireEvent(input, 'blur');
    expect(getByText('Password must be at least 8 characters.')).toBeTruthy();
  });

  it('shows inline error when passwords do not match', () => {
    const { getByPlaceholderText, getByText } = render(
      <ResetPasswordScreen token="test-token" onReset={mockOnReset} onError={mockOnError} />
    );
    const passwordInput = getByPlaceholderText('New password');
    const confirmInput = getByPlaceholderText('Confirm password');
    fireEvent.changeText(passwordInput, 'Password1');
    fireEvent.changeText(confirmInput, 'Different1');
    fireEvent(confirmInput, 'blur');
    expect(getByText('Passwords do not match.')).toBeTruthy();
  });
});
