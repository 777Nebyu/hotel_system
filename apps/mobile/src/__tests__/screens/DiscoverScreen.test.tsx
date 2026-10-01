import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import DiscoverScreen from '../../screens/DiscoverScreen';

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
    React.createElement(name, props, children);
  const FlatList = ({
    data,
    renderItem,
    ListEmptyComponent,
    ListHeaderComponent,
    ...props
  }: {
    data: unknown[];
    renderItem: (args: { item: unknown; index: number }) => React.ReactNode;
    ListEmptyComponent?: React.ReactNode | React.ComponentType;
    ListHeaderComponent?: React.ReactNode | React.ComponentType;
    [key: string]: unknown;
  }) => {
    const empty =
      data.length === 0
        ? typeof ListEmptyComponent === 'function'
          ? React.createElement(ListEmptyComponent)
          : ListEmptyComponent
        : null;
    const header =
      typeof ListHeaderComponent === 'function'
        ? React.createElement(ListHeaderComponent)
        : ListHeaderComponent;
    return React.createElement(
      'FlatList',
      props,
      header,
      data.length > 0 ? data.map((item, index) => React.createElement(React.Fragment, { key: index }, renderItem({ item, index }))) : empty,
    );
  };
  return {
    ActivityIndicator: host('ActivityIndicator'),
    FlatList,
    Linking: { openURL: jest.fn(() => Promise.resolve()) },
    Pressable: host('Pressable'),
    Platform: { select: (values: { default?: unknown }) => values.default },
    RefreshControl: host('RefreshControl'),
    StyleSheet: {
      create: (styles: unknown) => styles,
      hairlineWidth: 1,
      absoluteFillObject: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
    },
    Text: host('Text'),
    TextInput: host('TextInput'),
    View: host('View'),
  };
});

const mockNavigate = jest.fn();
const mockRequest = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('../../api', () => ({
  request: (...args: unknown[]) => mockRequest(...args),
}));

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({ colorScheme: 'light' }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('../../components/ScreenHeader', () => {
  const React = require('react');
  const { Text, View } = require('react-native');
  return {
    __esModule: true,
    default: ({ title, subtitle }: { title: string; subtitle?: string }) =>
      React.createElement(
        View,
        null,
        React.createElement(Text, null, title),
        subtitle ? React.createElement(Text, null, subtitle) : null,
      ),
  };
});

jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Image: (props: Record<string, unknown>) => React.createElement(View, props),
  };
});

describe('DiscoverScreen map/list validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a useful empty state when list and map have no places', async () => {
    mockRequest.mockResolvedValue({ data: [] });

    const { getByText } = render(<DiscoverScreen />);

    await waitFor(() => expect(getByText('No locations found')).toBeTruthy());
    fireEvent.press(getByText('Map'));

    expect(getByText('No locations found')).toBeTruthy();
    expect(getByText('Try selecting a different category or clearing search filters.')).toBeTruthy();
  });

  it('switches to the map, selects a marker, and opens place details', async () => {
    mockRequest.mockResolvedValue({
      data: [
        {
          id: 'place-national-museum',
          name: 'National Museum of Ethiopia',
          description: 'Verified museum',
          category: 'MUSEUM',
          address: 'Arat Kilo, Addis Ababa',
          lat: 9.0384,
          lng: 38.7618,
          hoursVerified: true,
          source: { name: 'Ethiopian Heritage Authority' },
        },
      ],
    });

    const { getByText, getByLabelText } = render(<DiscoverScreen />);

    await waitFor(() => expect(getByText('National Museum of Ethiopia')).toBeTruthy());
    fireEvent.press(getByText('Map'));

    expect(getByLabelText('Map of verified places')).toBeTruthy();
    fireEvent.press(getByLabelText('Show National Museum of Ethiopia'));

    expect(getByText('Selected place')).toBeTruthy();
    fireEvent.press(getByText('Details'));
    expect(mockNavigate).toHaveBeenCalledWith('DiscoverPlaceDetails', {
      placeId: 'place-national-museum',
    });
  });
});
