import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { Button, Card, Badge, Stars, Logo, EmptyState } from '../../components/Shared';

describe('Shared Components', () => {
  describe('Button', () => {
    it('renders with title', () => {
      const { getByText } = render(<Button title="Press Me" onPress={() => {}} />);
      expect(getByText('Press Me')).toBeTruthy();
    });

    it('renders disabled state', () => {
      const { getByText } = render(<Button title="Disabled" onPress={() => {}} disabled />);
      const button = getByText('Disabled');
      expect(button).toBeTruthy();
    });
  });

  describe('Card', () => {
    it('renders children', () => {
      const { getByText } = render(
        <Card>
          <Text>Card Content</Text>
        </Card>
      );
      expect(getByText('Card Content')).toBeTruthy();
    });
  });

  describe('Badge', () => {
    it('renders with label', () => {
      const { getByText } = render(<Badge label="Active" />);
      expect(getByText('Active')).toBeTruthy();
    });

    it('renders with status', () => {
      const { getByText } = render(<Badge status="PENDING" />);
      expect(getByText('PENDING')).toBeTruthy();
    });
  });

  describe('Stars', () => {
    it('renders correct number of stars', () => {
      const { getByText } = render(<Stars value={3} />);
      const starsText = getByText('★★★☆☆');
      expect(starsText).toBeTruthy();
    });

    it('renders full stars for value 5', () => {
      const { getByText } = render(<Stars value={5} />);
      expect(getByText('★★★★★')).toBeTruthy();
    });

    it('renders empty stars for value 0', () => {
      const { getByText } = render(<Stars value={0} />);
      expect(getByText('☆☆☆☆☆')).toBeTruthy();
    });
  });

  describe('EmptyState', () => {
    it('renders title, subtitle, icon, and action button', () => {
      const { getByText } = render(
        <EmptyState
          title="No Results"
          subtitle="Try different keywords"
          icon="🔍"
          actionTitle="Reset"
          onAction={() => {}}
        />
      );
      expect(getByText('No Results')).toBeTruthy();
      expect(getByText('Try different keywords')).toBeTruthy();
      expect(getByText('🔍')).toBeTruthy();
      expect(getByText('Reset')).toBeTruthy();
    });
  });

  describe('Logo', () => {
    it('renders', () => {
      const { getByText } = render(<Logo />);
      expect(getByText('Y')).toBeTruthy();
      expect(getByText('YayeTech')).toBeTruthy();
    });

    it('renders without wordmark when showWordmark is false', () => {
      const { getByText, queryByText } = render(<Logo showWordmark={false} />);
      expect(getByText('Y')).toBeTruthy();
      expect(queryByText('YayeTech')).toBeNull();
    });
  });
});
