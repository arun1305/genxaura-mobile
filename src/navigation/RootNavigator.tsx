import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useUserStore } from '../store/userStore';
import { COLORS } from '../constants';
import {
  registerForPushNotificationsAsync,
  setupNotificationResponseHandler,
} from '../services/notificationService';
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

const Stack = createNativeStackNavigator();
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
  const { isAuthenticated, isLoading, isOnboarded, hydrate, updateFcmToken } = useAuthStore();
  const { profile, loadProfile } = useUserStore();
  const { loadStatus: loadSubStatus } = useSubscriptionStore();
  const { loadPreferences: loadNotifPrefs } = useNotificationStore();
  const navigationRef = useRef<any>(null);

  useEffect(() => {
    hydrate();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadProfile();
      loadSubStatus();
      loadNotifPrefs();
      // Register for push notifications and save FCM token
      registerForPushNotificationsAsync().then((token) => {
        if (token) updateFcmToken(token);
      });
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!navigationRef.current) return;
    const subscription = setupNotificationResponseHandler(navigationRef.current);
    return () => subscription.remove();
  }, [navigationRef.current]);

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
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : !isOnboarded || !profile?.isOnboarded ? (
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
