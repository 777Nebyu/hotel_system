import React, { Suspense, lazy } from 'react';
import { ActivityIndicator, View, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { useAppSelector } from '../store/hooks';
import { navigationRef } from '../lib/navigationRef';
import { useTheme } from '../hooks/useTheme';
import AuthScreen from '../screens/AuthScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import VerifyEmailScreen from '../screens/VerifyEmailScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import MainTabs from './MainTabs';
import AuthGuard from '../components/AuthGuard';

const HotelDetailScreen = lazy(() => import('../screens/HotelDetailScreen'));
const SearchScreen = lazy(() => import('../screens/SearchScreen'));
const RoomDetailScreen = lazy(() => import('../screens/RoomDetailScreen'));
const BookingFlowScreen = lazy(() => import('../screens/BookingFlowScreen'));
const BookingDetailScreen = lazy(() => import('../screens/BookingDetailScreen'));
const ReviewScreen = lazy(() => import('../screens/ReviewScreen'));
const NotificationsScreen = lazy(() => import('../screens/NotificationsScreen'));

const AdminOverviewScreen = lazy(() => import('../screens/admin/AdminOverviewScreen'));
const AdminUsersScreen = lazy(() => import('../screens/admin/AdminUsersScreen'));
const AdminHotelsScreen = lazy(() => import('../screens/admin/AdminHotelsScreen'));
const AdminBookingsScreen = lazy(() => import('../screens/admin/AdminBookingsScreen'));
const AdminPaymentsScreen = lazy(() => import('../screens/admin/AdminPaymentsScreen'));
const AdminCouponsScreen = lazy(() => import('../screens/admin/AdminCouponsScreen'));
const AdminReviewsScreen = lazy(() => import('../screens/admin/AdminReviewsScreen'));
const AdminReportsScreen = lazy(() => import('../screens/admin/AdminReportsScreen'));
const AdminSettingsScreen = lazy(() => import('../screens/admin/AdminSettingsScreen'));
const AdminAuditLogScreen = lazy(() => import('../screens/admin/AdminAuditLogScreen'));
const ManagerOverviewScreen = lazy(() => import('../screens/manager/ManagerOverviewScreen'));
const ManagerBookingsScreen = lazy(() => import('../screens/manager/ManagerBookingsScreen'));
const ManagerHotelScreen = lazy(() => import('../screens/manager/ManagerHotelScreen'));
const ManagerRoomsScreen = lazy(() => import('../screens/manager/ManagerRoomsScreen'));
const ManagerReportsScreen = lazy(() => import('../screens/manager/ManagerReportsScreen'));
const ManagerMoreScreen = lazy(() => import('../screens/manager/ManagerMoreScreen'));
const BookingModifyScreen = lazy(() => import('../screens/BookingModifyScreen'));
const DisputeScreen = lazy(() => import('../screens/DisputeScreen'));
const ContactInboxScreen = lazy(() => import('../screens/ContactInboxScreen'));
const ContactThreadDetailScreen = lazy(() => import('../screens/ContactThreadDetailScreen'));
const ContactNewScreen = lazy(() => import('../screens/ContactNewScreen'));
const AdminStaffHotelScreen = lazy(() => import('../screens/admin/AdminStaffHotelScreen'));
const AdminDisputesScreen = lazy(() => import('../screens/admin/AdminDisputesScreen'));
const AdminEmergencyScreen = lazy(() => import('../screens/admin/AdminEmergencyScreen'));
const AdminFeatureFlagsScreen = lazy(() => import('../screens/admin/AdminFeatureFlagsScreen'));
const MyReviewsScreen = lazy(() => import('../screens/MyReviewsScreen'));
const WalkInBookingScreen = lazy(() => import('../screens/manager/WalkInBookingScreen'));
const EarlyCheckinLateCheckoutScreen = lazy(() => import('../screens/manager/EarlyCheckinLateCheckoutScreen'));
const SplashScreen = lazy(() => import('../screens/SplashScreen'));
const SettingsScreen = lazy(() => import('../screens/SettingsScreen'));
const HelpScreen = lazy(() => import('../screens/HelpScreen'));
const OnboardingScreen = lazy(() => import('../screens/OnboardingScreen'));
const DisputeDetailScreen = lazy(() => import('../screens/DisputeDetailScreen'));
const AccountSecurityScreen = lazy(() => import('../screens/AccountSecurityScreen'));

const ScreenLoader = () => <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" /></View>;

function WithSuspense({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<ScreenLoader />}>{children}</Suspense>;
}

function RoleGuard({ allowedRoles, children }: { allowedRoles: string[]; children: React.ReactNode }) {
  const session = useAppSelector((s) => s.auth.session);
  const role = session?.user.role ?? '';
  const { colors: c } = useTheme();
  if (!allowedRoles.includes(role)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: c.paper }}>
        <Text style={{ fontSize: 18, fontWeight: '600', color: c.ink, marginBottom: 8 }}>Access Denied</Text>
        <Text style={{ fontSize: 14, color: c.inkSoft, textAlign: 'center' }}>You do not have permission to view this screen.</Text>
      </View>
    );
  }
  return <>{children}</>;
}

const Stack = createNativeStackNavigator<RootStackParamList>();

// Imperative navigation helpers using the module-level ref — safe to call
// at the root navigator level where no parent navigator exists for useNavigation().
const goBack = () => {
  if (navigationRef.current?.isReady() && navigationRef.current.canGoBack()) {
    navigationRef.current.goBack();
  }
};
const goTo = (screen: string, params?: any) =>
  navigationRef.current?.navigate(screen as any, params);

export default function RootNavigator() {

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="Auth" component={AuthScreen} options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="VerifyEmail">
        {({ route }) => <VerifyEmailScreen token={route.params.token} onVerified={goBack} onError={goBack} />}
      </Stack.Screen>
      <Stack.Screen name="ResetPassword">
        {({ route }) => <ResetPasswordScreen token={route.params.token} onReset={goBack} onError={goBack} />}
      </Stack.Screen>
      <Stack.Screen name="HotelDetail">
        {() => <WithSuspense><HotelDetailScreen /></WithSuspense>}
      </Stack.Screen>
      <Stack.Screen name="Search">
        {() => <WithSuspense><SearchScreen /></WithSuspense>}
      </Stack.Screen>
      <Stack.Screen name="RoomDetail">
        {({ route }) => <WithSuspense><RoomDetailScreen room={route.params.room} hotelName={route.params.hotelName} hotelId={route.params.hotelId} checkIn={route.params.checkIn} checkOut={route.params.checkOut} hotelImages={route.params.hotelImages} onBack={goBack} onBook={(roomId: string, cIn?: string, cOut?: string, promo?: string) => goTo('BookingFlow', { hotelId: route.params.hotelId, roomId, hotelName: route.params.hotelName, roomType: route.params.room?.type, roomCapacity: route.params.room?.capacity, checkIn: cIn ?? route.params.checkIn, checkOut: cOut ?? route.params.checkOut, promoCode: promo })} /></WithSuspense>}
      </Stack.Screen>
      <Stack.Screen name="BookingFlow">
        {() => <AuthGuard><RoleGuard allowedRoles={['CUSTOMER']}><WithSuspense><BookingFlowScreen /></WithSuspense></RoleGuard></AuthGuard>}
      </Stack.Screen>
      <Stack.Screen name="BookingDetail">
        {() => <AuthGuard><WithSuspense><BookingDetailScreen /></WithSuspense></AuthGuard>}
      </Stack.Screen>
      <Stack.Screen name="Review">
        {() => <AuthGuard><RoleGuard allowedRoles={['CUSTOMER']}><WithSuspense><ReviewScreen /></WithSuspense></RoleGuard></AuthGuard>}
      </Stack.Screen>
      <Stack.Screen name="Notifications">
        {() => <AuthGuard><WithSuspense><NotificationsScreen /></WithSuspense></AuthGuard>}
      </Stack.Screen>
      {/* RBAC-002: Only Customer has "My Reviews" (own reviews for own stays) */}
      <Stack.Screen name="MyReviews" >
        {() => <AuthGuard><RoleGuard allowedRoles={['CUSTOMER']}><WithSuspense><MyReviewsScreen /></WithSuspense></RoleGuard></AuthGuard>}
      </Stack.Screen>
      <Stack.Screen name="AdminOverview" >
        {() => <AuthGuard><RoleGuard allowedRoles={['ADMIN']}><WithSuspense><AdminOverviewScreen onBack={goBack} onNavigate={(p: any) => goTo(p.screen, p)} /></WithSuspense></RoleGuard></AuthGuard>}
      </Stack.Screen>
      <Stack.Screen name="AdminUsers" >
        {() => <AuthGuard><RoleGuard allowedRoles={['ADMIN']}><WithSuspense><AdminUsersScreen onBack={() => goTo('AdminOverview')} /></WithSuspense></RoleGuard></AuthGuard>}
      </Stack.Screen>
      <Stack.Screen name="AdminHotels" >
        {() => <AuthGuard><RoleGuard allowedRoles={['ADMIN']}><WithSuspense><AdminHotelsScreen onBack={() => goTo('AdminOverview')} /></WithSuspense></RoleGuard></AuthGuard>}
      </Stack.Screen>
      <Stack.Screen name="AdminBookings" >
        {() => <AuthGuard><RoleGuard allowedRoles={['ADMIN']}><WithSuspense><AdminBookingsScreen onBack={() => goTo('AdminOverview')} /></WithSuspense></RoleGuard></AuthGuard>}
      </Stack.Screen>
      <Stack.Screen name="AdminPayments" >
        {() => <AuthGuard><RoleGuard allowedRoles={['ADMIN']}><WithSuspense><AdminPaymentsScreen onBack={() => goTo('AdminOverview')} /></WithSuspense></RoleGuard></AuthGuard>}
      </Stack.Screen>
      <Stack.Screen name="AdminCoupons" >
        {() => <AuthGuard><RoleGuard allowedRoles={['ADMIN']}><WithSuspense><AdminCouponsScreen onBack={() => goTo('AdminOverview')} /></WithSuspense></RoleGuard></AuthGuard>}
      </Stack.Screen>
      <Stack.Screen name="AdminReviews" >
        {() => <AuthGuard><RoleGuard allowedRoles={['ADMIN']}><WithSuspense><AdminReviewsScreen onBack={() => goTo('AdminOverview')} /></WithSuspense></RoleGuard></AuthGuard>}
      </Stack.Screen>
      <Stack.Screen name="AdminReports" >
        {() => <AuthGuard><RoleGuard allowedRoles={['ADMIN']}><WithSuspense><AdminReportsScreen onBack={() => goTo('AdminOverview')} /></WithSuspense></RoleGuard></AuthGuard>}
      </Stack.Screen>
      <Stack.Screen name="AdminSettings" >
        {() => <AuthGuard><RoleGuard allowedRoles={['ADMIN']}><WithSuspense><AdminSettingsScreen onBack={() => goTo('AdminOverview')} /></WithSuspense></RoleGuard></AuthGuard>}
      </Stack.Screen>
      <Stack.Screen name="AdminAuditLog" >
        {() => <AuthGuard><RoleGuard allowedRoles={['ADMIN']}><WithSuspense><AdminAuditLogScreen onBack={() => goTo('AdminOverview')} /></WithSuspense></RoleGuard></AuthGuard>}
      </Stack.Screen>
      <Stack.Screen name="ManagerOverview" >
        {() => <AuthGuard><RoleGuard allowedRoles={['MANAGER', 'STAFF']}><WithSuspense><ManagerOverviewScreen onBack={goBack} onNavigate={(p: any) => goTo(p.screen, p)} /></WithSuspense></RoleGuard></AuthGuard>}
      </Stack.Screen>
      <Stack.Screen name="ManagerBookings" >
        {() => <AuthGuard><RoleGuard allowedRoles={['MANAGER', 'STAFF']}><WithSuspense><ManagerBookingsScreen onBack={() => goTo('ManagerOverview')} /></WithSuspense></RoleGuard></AuthGuard>}
      </Stack.Screen>
      {/* STAFF-003: Staff CANNOT create/edit hotel — Manager + Admin only */}
      <Stack.Screen name="ManagerHotel" >
        {() => <AuthGuard><RoleGuard allowedRoles={['MANAGER', 'ADMIN']}><WithSuspense><ManagerHotelScreen onBack={() => goTo('ManagerOverview')} /></WithSuspense></RoleGuard></AuthGuard>}
      </Stack.Screen>
      {/* STAFF-003: Staff CANNOT create/edit rooms or set pricing — Manager + Admin only */}
      <Stack.Screen name="ManagerRooms" >
        {() => <AuthGuard><RoleGuard allowedRoles={['MANAGER', 'ADMIN']}><WithSuspense><ManagerRoomsScreen onBack={() => goTo('ManagerOverview')} /></WithSuspense></RoleGuard></AuthGuard>}
      </Stack.Screen>
      {/* Staff gets operational reports only; Manager gets full hotel-level reports (enforced server-side) */}
      <Stack.Screen name="ManagerReports" >
        {() => <AuthGuard><RoleGuard allowedRoles={['MANAGER', 'STAFF']}><WithSuspense><ManagerReportsScreen onBack={() => goTo('ManagerOverview')} /></WithSuspense></RoleGuard></AuthGuard>}
      </Stack.Screen>
      <Stack.Screen name="ManagerMore" >
        {() => <AuthGuard><RoleGuard allowedRoles={['MANAGER', 'STAFF']}><WithSuspense><ManagerMoreScreen onBack={() => goTo('ManagerOverview')} onNavigate={(p: any) => goTo(p.screen, p)} /></WithSuspense></RoleGuard></AuthGuard>}
      </Stack.Screen>
      {/* GAP-1 fixed: BOOKMOD-001 — only Customer can modify own bookings */}
      <Stack.Screen name="BookingModify" >
        {() => <AuthGuard><RoleGuard allowedRoles={['CUSTOMER']}><WithSuspense><BookingModifyScreen /></WithSuspense></RoleGuard></AuthGuard>}
      </Stack.Screen>
      {/* GAP-2 fixed: DISPUTE-001 — only Customer can open disputes */}
      <Stack.Screen name="Disputes" >
        {() => <AuthGuard><RoleGuard allowedRoles={['CUSTOMER']}><WithSuspense><DisputeScreen /></WithSuspense></RoleGuard></AuthGuard>}
      </Stack.Screen>
      <Stack.Screen name="ContactInbox" >
        {() => <AuthGuard><WithSuspense><ContactInboxScreen /></WithSuspense></AuthGuard>}
      </Stack.Screen>
      <Stack.Screen name="ContactThread" >
        {() => <AuthGuard><WithSuspense><ContactThreadDetailScreen /></WithSuspense></AuthGuard>}
      </Stack.Screen>
      <Stack.Screen name="ContactNew" >
        {() => <AuthGuard><WithSuspense><ContactNewScreen /></WithSuspense></AuthGuard>}
      </Stack.Screen>
      {/* GAP-3 fixed: DISPUTE-001/003 — Customer views own disputes, Admin resolves */}
      <Stack.Screen name="DisputeDetail" >
        {() => <AuthGuard><RoleGuard allowedRoles={['CUSTOMER', 'ADMIN']}><WithSuspense><DisputeDetailScreen /></WithSuspense></RoleGuard></AuthGuard>}
      </Stack.Screen>
      <Stack.Screen name="AdminStaffHotels" >
        {() => <AuthGuard><RoleGuard allowedRoles={['ADMIN']}><WithSuspense><AdminStaffHotelScreen onBack={() => goTo('AdminOverview')} /></WithSuspense></RoleGuard></AuthGuard>}
      </Stack.Screen>
      <Stack.Screen name="AdminDisputes" >
        {() => <AuthGuard><RoleGuard allowedRoles={['ADMIN']}><WithSuspense><AdminDisputesScreen onBack={() => goTo('AdminOverview')} /></WithSuspense></RoleGuard></AuthGuard>}
      </Stack.Screen>
      <Stack.Screen name="AdminEmergency" >
        {() => <AuthGuard><RoleGuard allowedRoles={['ADMIN']}><WithSuspense><AdminEmergencyScreen onBack={() => goTo('AdminOverview')} /></WithSuspense></RoleGuard></AuthGuard>}
      </Stack.Screen>
      <Stack.Screen name="AdminFeatureFlags" >
        {() => <AuthGuard><RoleGuard allowedRoles={['ADMIN']}><WithSuspense><AdminFeatureFlagsScreen onBack={() => goTo('AdminOverview')} /></WithSuspense></RoleGuard></AuthGuard>}
      </Stack.Screen>
      <Stack.Screen name="WalkInBooking" >
        {() => <AuthGuard><RoleGuard allowedRoles={['MANAGER', 'STAFF', 'ADMIN']}><WithSuspense><WalkInBookingScreen /></WithSuspense></RoleGuard></AuthGuard>}
      </Stack.Screen>
      <Stack.Screen name="EarlyCheckinLateCheckout" >
        {() => <AuthGuard><RoleGuard allowedRoles={['MANAGER', 'STAFF', 'ADMIN']}><WithSuspense><EarlyCheckinLateCheckoutScreen /></WithSuspense></RoleGuard></AuthGuard>}
      </Stack.Screen>
      <Stack.Screen name="Splash">
        {() => <WithSuspense><SplashScreen /></WithSuspense>}
      </Stack.Screen>
      <Stack.Screen name="Settings">
        {() => <WithSuspense><SettingsScreen /></WithSuspense>}
      </Stack.Screen>
      <Stack.Screen name="Help">
        {() => <WithSuspense><HelpScreen /></WithSuspense>}
      </Stack.Screen>
      <Stack.Screen name="Onboarding">
        {() => <WithSuspense><OnboardingScreen /></WithSuspense>}
      </Stack.Screen>
      <Stack.Screen name="AccountSecurity">
        {() => <AuthGuard><WithSuspense><AccountSecurityScreen /></WithSuspense></AuthGuard>}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
