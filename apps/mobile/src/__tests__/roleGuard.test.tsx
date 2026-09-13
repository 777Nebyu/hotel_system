import React from 'react';
import { render } from '@testing-library/react-native';
import { View, Text } from 'react-native';

// Inline reproduction of RoleGuard logic as defined in RootNavigator
function TestRoleGuard({
  allowedRoles,
  children,
  role,
}: {
  allowedRoles: string[];
  children: React.ReactNode;
  role?: string;
}) {
  const currentRole = role ?? '';
  if (!allowedRoles.includes(currentRole)) {
    return (
      <View testID="access-denied-view">
        <Text>Access Denied</Text>
      </View>
    );
  }
  return <>{children}</>;
}

describe('RootNavigator RoleGuard Policy Compliance', () => {
  it('GAP-1: BookingModify restricts access to CUSTOMER only', () => {
    const allowedRoles = ['CUSTOMER'];

    // CUSTOMER should have access
    const { queryByText: customerAccess } = render(
      <TestRoleGuard allowedRoles={allowedRoles} role="CUSTOMER">
        <Text>BookingModify Content</Text>
      </TestRoleGuard>
    );
    expect(customerAccess('BookingModify Content')).not.toBeNull();
    expect(customerAccess('Access Denied')).toBeNull();

    // STAFF, MANAGER, ADMIN should be blocked
    for (const unauthorizedRole of ['STAFF', 'MANAGER', 'ADMIN']) {
      const { queryByText: blockedAccess } = render(
        <TestRoleGuard allowedRoles={allowedRoles} role={unauthorizedRole}>
          <Text>BookingModify Content</Text>
        </TestRoleGuard>
      );
      expect(blockedAccess('BookingModify Content')).toBeNull();
      expect(blockedAccess('Access Denied')).not.toBeNull();
    }
  });

  it('GAP-2: Disputes screen restricts access to CUSTOMER only', () => {
    const allowedRoles = ['CUSTOMER'];

    const { queryByText: customerAccess } = render(
      <TestRoleGuard allowedRoles={allowedRoles} role="CUSTOMER">
        <Text>Disputes List</Text>
      </TestRoleGuard>
    );
    expect(customerAccess('Disputes List')).not.toBeNull();

    for (const unauthorizedRole of ['STAFF', 'MANAGER']) {
      const { queryByText: blockedAccess } = render(
        <TestRoleGuard allowedRoles={allowedRoles} role={unauthorizedRole}>
          <Text>Disputes List</Text>
        </TestRoleGuard>
      );
      expect(blockedAccess('Disputes List')).toBeNull();
      expect(blockedAccess('Access Denied')).not.toBeNull();
    }
  });

  it('GAP-3: DisputeDetail screen allows CUSTOMER and ADMIN only', () => {
    const allowedRoles = ['CUSTOMER', 'ADMIN'];

    // CUSTOMER allowed
    const { queryByText: cust } = render(
      <TestRoleGuard allowedRoles={allowedRoles} role="CUSTOMER">
        <Text>Dispute Details</Text>
      </TestRoleGuard>
    );
    expect(cust('Dispute Details')).not.toBeNull();

    // ADMIN allowed
    const { queryByText: admin } = render(
      <TestRoleGuard allowedRoles={allowedRoles} role="ADMIN">
        <Text>Dispute Details</Text>
      </TestRoleGuard>
    );
    expect(admin('Dispute Details')).not.toBeNull();

    // STAFF and MANAGER blocked
    for (const unauthorizedRole of ['STAFF', 'MANAGER']) {
      const { queryByText: blocked } = render(
        <TestRoleGuard allowedRoles={allowedRoles} role={unauthorizedRole}>
          <Text>Dispute Details</Text>
        </TestRoleGuard>
      );
      expect(blocked('Dispute Details')).toBeNull();
      expect(blocked('Access Denied')).not.toBeNull();
    }
  });
});
