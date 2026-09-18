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
const AdminStaffHotelsScreen = lazy(() => import('../screens/admin/AdminStaffHotelsScreen'));
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
const MockAuthorizationScreen = lazy(() => import('../screens/MockAuthorizationScreen'));
const PaymentHistoryScreen = lazy(() => import('../screens/PaymentHistoryScreen'));
const ChapaCheckoutScreen = lazy(() => import('../screens/ChapaCheckoutScreen'));
const TelebirrOtpScreen = lazy(() => import('../screens/TelebirrOtpScreen'));
const BankAuthScreen = lazy(() => import('../screens/BankAuthScreen'));
const PaymentResultScreen = lazy(() => import('../screens/PaymentResultScreen'));
const MockSmsInboxScreen = lazy(() => import('../screens/MockSmsInboxScreen'));

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

function withSuspense<P extends object>(Component: React.ComponentType<P>) {
  return function SuspendedComponent(props: P) {
    return (
      <WithSuspense>
        <Component {...props} />
      </WithSuspense>
    );
  };
}

function withProtected<P extends object>(Component: React.ComponentType<P>, allowedRoles?: string[]) {
  return function ProtectedComponent(props: P) {
    const inner = (
      <WithSuspense>
        <Component {...props} />
      </WithSuspense>
    );
    if (allowedRoles && allowedRoles.length > 0) {
      return (
        <AuthGuard>
          <RoleGuard allowedRoles={allowedRoles}>{inner}</RoleGuard>
        </AuthGuard>
      );
    }
    return <AuthGuard>{inner}</AuthGuard>;
  };
}

// Imperative helpers are used by the static wrapped screen definitions below.
// Keep them tied to the app-level navigation ref so callbacks remain valid
// when a screen is rendered outside a component that owns useNavigation().
function goTo(name: keyof RootStackParamList, params?: unknown) {
  if (!navigationRef.current) return;
  const nav = navigationRef.current as any;
  if (params === undefined) nav.navigate(name);
  else nav.navigate(name, params);
}

function goBack() {
  if (navigationRef.current?.canGoBack()) navigationRef.current.goBack();
}

// Static wrapped components for optimal React Navigation rendering
const HotelDetailWrapped = withSuspense(HotelDetailScreen);
const SearchWrapped = withSuspense(SearchScreen);
const BookingDetailWrapped = withProtected(BookingDetailScreen);
const BookingFlowWrapped = withProtected(BookingFlowScreen, ['CUSTOMER']);
const ReviewWrapped = withProtected(ReviewScreen, ['CUSTOMER']);
const NotificationsWrapped = withProtected(NotificationsScreen);
const MyReviewsWrapped = withProtected(MyReviewsScreen, ['CUSTOMER']);
const BookingModifyWrapped = withProtected(BookingModifyScreen, ['CUSTOMER']);
const DisputesWrapped = withProtected(DisputeScreen, ['CUSTOMER']);
const DisputeDetailWrapped = withProtected(DisputeDetailScreen, ['CUSTOMER', 'ADMIN']);
const ContactInboxWrapped = withProtected(ContactInboxScreen);
const ContactThreadWrapped = withProtected(ContactThreadDetailScreen);
const ContactNewWrapped = withProtected(ContactNewScreen);
const WalkInBookingWrapped = withProtected(WalkInBookingScreen, ['MANAGER', 'STAFF', 'ADMIN']);
const EarlyCheckinLateCheckoutWrapped = withProtected(EarlyCheckinLateCheckoutScreen, ['MANAGER', 'STAFF', 'ADMIN']);
const AccountSecurityWrapped = withProtected(AccountSecurityScreen);
const MockAuthWrapped = withProtected(MockAuthorizationScreen, ['CUSTOMER']);
const PaymentHistoryWrapped = withProtected(PaymentHistoryScreen, ['CUSTOMER']);
const ChapaCheckoutWrapped = withProtected(ChapaCheckoutScreen, ['CUSTOMER']);
const TelebirrOtpWrapped = withProtected(TelebirrOtpScreen, ['CUSTOMER']);
const BankAuthWrapped = withProtected(BankAuthScreen, ['CUSTOMER']);
const PaymentResultWrapped = withProtected(PaymentResultScreen, ['CUSTOMER']);
const MockSmsInboxWrapped = withProtected(MockSmsInboxScreen, ['CUSTOMER']);

const SplashWrapped = withSuspense(SplashScreen);
const SettingsWrapped = withSuspense(SettingsScreen);
const HelpWrapped = withSuspense(HelpScreen);
const OnboardingWrapped = withSuspense(OnboardingScreen);

// Admin screens
const AdminOverviewWrapped = withProtected(() => <AdminOverviewScreen onBack={goBack} onNavigate={(p: any) => goTo(p.screen, p)} />, ['ADMIN']);
const AdminUsersWrapped = withProtected(() => <AdminUsersScreen onBack={() => goTo('AdminOverview')} />, ['ADMIN']);
const AdminHotelsWrapped = withProtected(() => <AdminHotelsScreen onBack={() => goTo('AdminOverview')} />, ['ADMIN']);
const AdminBookingsWrapped = withProtected(() => <AdminBookingsScreen onBack={() => goTo('AdminOverview')} />, ['ADMIN']);
const AdminPaymentsWrapped = withProtected(() => <AdminPaymentsScreen onBack={() => goTo('AdminOverview')} />, ['ADMIN']);
const AdminCouponsWrapped = withProtected(() => <AdminCouponsScreen onBack={() => goTo('AdminOverview')} />, ['ADMIN']);
const AdminReviewsWrapped = withProtected(() => <AdminReviewsScreen onBack={() => goTo('AdminOverview')} />, ['ADMIN']);
const AdminReportsWrapped = withProtected(() => <AdminReportsScreen onBack={() => goTo('AdminOverview')} />, ['ADMIN']);
const AdminSettingsWrapped = withProtected(() => <AdminSettingsScreen onBack={() => goTo('AdminOverview')} />, ['ADMIN']);
const AdminAuditLogWrapped = withProtected(() => <AdminAuditLogScreen onBack={() => goTo('AdminOverview')} />, ['ADMIN']);
const AdminStaffHotelsWrapped = withProtected(() => <AdminStaffHotelsScreen onBack={() => goTo('AdminOverview')} />, ['ADMIN']);
const AdminDisputesWrapped = withProtected(() => <AdminDisputesScreen onBack={() => goTo('AdminOverview')} />, ['ADMIN']);
const AdminEmergencyWrapped = withProtected(() => <AdminEmergencyScreen onBack={() => goTo('AdminOverview')} />, ['ADMIN']);
const AdminFeatureFlagsWrapped = withProtected(() => <AdminFeatureFlagsScreen onBack={() => goTo('AdminOverview')} />, ['ADMIN']);

// Manager screens
const ManagerOverviewWrapped = withProtected(() => <ManagerOverviewScreen onBack={goBack} onNavigate={(p: any) => goTo(p.screen, p)} />, ['MANAGER', 'STAFF']);
const ManagerBookingsWrapped = withProtected(() => <ManagerBookingsScreen onBack={() => goTo('ManagerOverview')} />, ['MANAGER', 'STAFF']);
const ManagerBillingScreen = lazy(() => import('../screens/manager/ManagerBillingScreen'));
const ManagerBillingWrapped = withProtected(() => <ManagerBillingScreen onBack={() => goTo('ManagerOverview')} />, ['MANAGER', 'STAFF']);
const ManagerHotelWrapped = withProtected(() => <ManagerHotelScreen onBack={() => goTo('ManagerOverview')} />, ['MANAGER', 'ADMIN']);
const ManagerRoomsWrapped = withProtected(() => <ManagerRoomsScreen onBack={() => goTo('ManagerOverview')} />, ['MANAGER', 'ADMIN']);
const ManagerReportsWrapped = withProtected(() => <ManagerReportsScreen onBack={() => goTo('ManagerOverview')} />, ['MANAGER', 'STAFF']);
const ManagerMoreWrapped = withProtected(() => <ManagerMoreScreen onBack={() => goTo('ManagerOverview')} onNavigate={(p: any) => goTo(p.screen, p)} />, ['MANAGER', 'STAFF']);

const VerifyEmailWrapped = ({ route }: any) => <VerifyEmailScreen token={route.params.token} onVerified={goBack} onError={goBack} />;
const ResetPasswordWrapped = ({ route }: any) => <ResetPasswordScreen token={route.params.token} onReset={goBack} onError={goBack} />;
const RoomDetailWrapped = ({ route }: any) => (
  <WithSuspense>
    <RoomDetailScreen
      room={route.params.room}
      hotelName={route.params.hotelName}
      hotelId={route.params.hotelId}
      checkIn={route.params.checkIn}
      checkOut={route.params.checkOut}
      hotelImages={route.params.hotelImages}
      guests={route.params.guests}
      onBack={goBack}
      onBook={(roomId: string, cIn?: string, cOut?: string, promo?: string) =>
        goTo('BookingFlow', {
          hotelId: route.params.hotelId,
          roomId,
          hotelName: route.params.hotelName,
          roomType: route.params.room?.type,
          roomCapacity: route.params.room?.capacity,
          checkIn: cIn ?? route.params.checkIn,
          checkOut: cOut ?? route.params.checkOut,
          promoCode: promo,
        })
      }
    />
  </WithSuspense>
);

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="Auth" component={AuthScreen} options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="VerifyEmail" component={VerifyEmailWrapped} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordWrapped} />
      <Stack.Screen name="HotelDetail" component={HotelDetailWrapped} />
      <Stack.Screen name="Search" component={SearchWrapped} />
      <Stack.Screen name="RoomDetail" component={RoomDetailWrapped} />
      <Stack.Screen name="MockAuth" component={MockAuthWrapped} options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="PaymentHistory" component={PaymentHistoryWrapped} />
      <Stack.Screen name="ChapaCheckout" component={ChapaCheckoutWrapped} />
      <Stack.Screen name="TelebirrOtp" component={TelebirrOtpWrapped} />
      <Stack.Screen name="BankAuth" component={BankAuthWrapped} />
      <Stack.Screen name="PaymentResult" component={PaymentResultWrapped} />
      <Stack.Screen name="MockSmsInbox" component={MockSmsInboxWrapped} />
      <Stack.Screen name="BookingFlow" component={BookingFlowWrapped} />
      <Stack.Screen name="BookingDetail" component={BookingDetailWrapped} />
      <Stack.Screen name="Review" component={ReviewWrapped} />
      <Stack.Screen name="Notifications" component={NotificationsWrapped} />
      <Stack.Screen name="MyReviews" component={MyReviewsWrapped} />
      <Stack.Screen name="AdminOverview" component={AdminOverviewWrapped} />
      <Stack.Screen name="AdminUsers" component={AdminUsersWrapped} />
      <Stack.Screen name="AdminHotels" component={AdminHotelsWrapped} />
      <Stack.Screen name="AdminBookings" component={AdminBookingsWrapped} />
      <Stack.Screen name="AdminPayments" component={AdminPaymentsWrapped} />
      <Stack.Screen name="AdminCoupons" component={AdminCouponsWrapped} />
      <Stack.Screen name="AdminReviews" component={AdminReviewsWrapped} />
      <Stack.Screen name="AdminReports" component={AdminReportsWrapped} />
      <Stack.Screen name="AdminSettings" component={AdminSettingsWrapped} />
      <Stack.Screen name="AdminAuditLog" component={AdminAuditLogWrapped} />
      <Stack.Screen name="ManagerOverview" component={ManagerOverviewWrapped} />
      <Stack.Screen name="ManagerBookings" component={ManagerBookingsWrapped} />
      <Stack.Screen name="ManagerBilling" component={ManagerBillingWrapped} />
      <Stack.Screen name="ManagerHotel" component={ManagerHotelWrapped} />
      <Stack.Screen name="ManagerRooms" component={ManagerRoomsWrapped} />
      <Stack.Screen name="ManagerReports" component={ManagerReportsWrapped} />
      <Stack.Screen name="ManagerMore" component={ManagerMoreWrapped} />
      <Stack.Screen name="BookingModify" component={BookingModifyWrapped} />
      <Stack.Screen name="Disputes" component={DisputesWrapped} />
      <Stack.Screen name="ContactInbox" component={ContactInboxWrapped} />
      <Stack.Screen name="ContactThread" component={ContactThreadWrapped} />
      <Stack.Screen name="ContactNew" component={ContactNewWrapped} />
      <Stack.Screen name="DisputeDetail" component={DisputeDetailWrapped} />
      <Stack.Screen name="AdminStaffHotels" component={AdminStaffHotelsWrapped} />
      <Stack.Screen name="AdminDisputes" component={AdminDisputesWrapped} />
      <Stack.Screen name="AdminEmergency" component={AdminEmergencyWrapped} />
      <Stack.Screen name="AdminFeatureFlags" component={AdminFeatureFlagsWrapped} />
      <Stack.Screen name="WalkInBooking" component={WalkInBookingWrapped} />
      <Stack.Screen name="EarlyCheckinLateCheckout" component={EarlyCheckinLateCheckoutWrapped} />
      <Stack.Screen name="Splash" component={SplashWrapped} />
      <Stack.Screen name="Settings" component={SettingsWrapped} />
      <Stack.Screen name="Help" component={HelpWrapped} />
      <Stack.Screen name="Onboarding" component={OnboardingWrapped} />
      <Stack.Screen name="AccountSecurity" component={AccountSecurityWrapped} />
    </Stack.Navigator>
  );
}
