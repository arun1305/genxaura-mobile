import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useUserStore } from '../store/userStore';
import { COLORS } from '../constants';
import {
  registerForPushNotificationsAsync,
  setupNotificationResponseHandler,
  flushPendingNotification,
  onPushTokenRefresh,
  NotificationNavigator,
} from '../services/notificationService';
import { refreshLocationIfDue } from '../services/locationService';
import { socketService } from '../sockets/socketService';
import { useSubscriptionStore } from '../store/subscriptionStore';
import { useNotificationStore } from '../store/notificationStore';

// Screens
import LoginScreen from '../screens/auth/LoginScreen';
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';
import HomeScreen from '../screens/home/HomeScreen';
import ChatScreen from '../screens/chat/ChatScreen';
import MatchListScreen from '../screens/chat/MatchListScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import SafetyCenterScreen from '../screens/profile/SafetyCenterScreen';
import SubscriptionScreen from '../screens/subscription/SubscriptionScreen';
import WhoLikedMeScreen from '../screens/subscription/WhoLikedMeScreen';
import ShopScreen from '../screens/subscription/ShopScreen';
import VerificationScreen from '../screens/safety/VerificationScreen';
import IDVerificationScreen from '../screens/safety/IDVerificationScreen';
import PrivacyScreen from '../screens/safety/PrivacyScreen';
import NotificationPreferencesScreen from '../screens/profile/NotificationPreferencesScreen';
import SettingsScreen from '../screens/profile/SettingsScreen';
import ViewProfileScreen from '../screens/profile/ViewProfileScreen';

const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef<any>();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 82,
          paddingBottom: 16,
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Discover"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color }) => <Text style={[styles.tabIcon, { color }]}>🔥</Text>,
          tabBarLabel: 'Discover',
        }}
      />
      <Tab.Screen
        name="MatchList"
        component={MatchListScreen}
        options={{
          tabBarIcon: ({ color }) => <Text style={[styles.tabIcon, { color }]}>💬</Text>,
          tabBarLabel: 'Messages',
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color }) => <Text style={[styles.tabIcon, { color }]}>👤</Text>,
          tabBarLabel: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { isAuthenticated, isLoading, isOnboarded, hydrate, updateFcmToken, setOnboarded } =
    useAuthStore();
  const { profile, loadProfile } = useUserStore();
  const { loadStatus: loadSubStatus } = useSubscriptionStore();
  const { loadPreferences: loadNotifPrefs } = useNotificationStore();
  const [navReady, setNavReady] = useState(false);

  // Onboarding state comes from the server: user.isOnboarded (auth responses)
  // and profile.isOnboarded (/profile/me) — not only from the onboarding screen.
  const onboarded = isOnboarded || !!profile?.isOnboarded;
  const mainMounted = isAuthenticated && onboarded;

  useEffect(() => {
    hydrate();
  }, []);

  // Keep the persisted flag in sync with the latest profile from the server.
  useEffect(() => {
    if (profile && profile.isOnboarded !== isOnboarded) {
      setOnboarded(!!profile.isOnboarded);
    }
  }, [profile?.isOnboarded]);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadProfile();
    loadSubStatus();
    loadNotifPrefs();
    // Register for push notifications and save the FCM token
    registerForPushNotificationsAsync().then((token) => {
      if (token) updateFcmToken(token);
    });
    const unsubTokenRefresh = onPushTokenRefresh((token) => updateFcmToken(token));
    return unsubTokenRefresh;
  }, [isAuthenticated]);

  // Foreground work: reconnect the socket, refresh location (≤ once / 30 min).
  useEffect(() => {
    if (!mainMounted) return;
    refreshLocationIfDue();
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      socketService.connect().catch(() => undefined);
      refreshLocationIfDue();
    });
    return () => sub.remove();
  }, [mainMounted]);

  // Notification taps only navigate when the target stack is mounted.
  const notificationNav = useMemo<NotificationNavigator>(
    () => ({
      canNavigate: () => {
        const { isAuthenticated: authed, isOnboarded: onb } = useAuthStore.getState();
        const profOnb = !!useUserStore.getState().profile?.isOnboarded;
        return navigationRef.isReady() && authed && (onb || profOnb);
      },
      navigate: (route, params) => navigationRef.navigate(route, params),
    }),
    [],
  );

  useEffect(() => {
    const subscription = setupNotificationResponseHandler(notificationNav);
    return () => subscription.remove();
  }, [notificationNav]);

  useEffect(() => {
    if (navReady && mainMounted) {
      // Give the newly mounted stack a tick before navigating.
      const t = setTimeout(() => flushPendingNotification(notificationNav), 0);
      return () => clearTimeout(t);
    }
  }, [navReady, mainMounted, notificationNav]);

  const handleReady = useCallback(() => setNavReady(true), []);

  if (isLoading) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashLogo}>💫</Text>
        <Text style={styles.splashText}>GenXAura</Text>
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} onReady={handleReady}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : !onboarded ? (
          <Stack.Screen
            name="Onboarding"
            component={OnboardingScreen}
            options={{ gestureEnabled: false }}
          />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="SafetyCenter"
              component={SafetyCenterScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="Subscription"
              component={SubscriptionScreen}
              options={{ animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="WhoLikedMe"
              component={WhoLikedMeScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="Shop"
              component={ShopScreen}
              options={{ animation: 'slide_from_bottom', title: 'Shop' }}
            />
            <Stack.Screen
              name="Verification"
              component={VerificationScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="IDVerification"
              component={IDVerificationScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="Privacy"
              component={PrivacyScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="NotificationPreferences"
              component={NotificationPreferencesScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="ViewProfile"
              component={ViewProfileScreen}
              options={{ animation: 'slide_from_bottom' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabIcon: { fontSize: 22 },
  splash: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  splashLogo: { fontSize: 64 },
  splashText: {
    fontSize: 36,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: -0.5,
  },
});
