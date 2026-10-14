import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';

// Show notifications when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Returns an FCM registration token for this device (the backend sends pushes
 * through FCM). On iOS `getDevicePushTokenAsync` would return a raw APNs
 * token, which FCM cannot use — so the Firebase Messaging token is used on
 * both platforms.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Create Android notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('genxaura_default', {
      name: 'GenXAura',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF4458',
      sound: 'default',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Notifications] Permission not granted');
    return null;
  }

  try {
    if (Platform.OS === 'ios' && !messaging().isDeviceRegisteredForRemoteMessages) {
      await messaging().registerDeviceForRemoteMessages();
    }
    return await messaging().getToken();
  } catch (err) {
    console.warn('[Notifications] Failed to get FCM token:', err);
    // On Android the native device token *is* an FCM token — use it as a fallback.
    if (Platform.OS === 'android') {
      try {
        const token = await Notifications.getDevicePushTokenAsync();
        return typeof token.data === 'string' ? token.data : null;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/** Calls `onToken` whenever FCM rotates the registration token. */
export function onPushTokenRefresh(onToken: (token: string) => void): () => void {
  try {
    return messaging().onTokenRefresh(onToken);
  } catch {
    return () => undefined;
  }
}

export interface NotificationNavigator {
  /** True when the navigation container is ready and the main (authenticated + onboarded) stack is mounted. */
  canNavigate: () => boolean;
  navigate: (route: string, params?: Record<string, unknown>) => void;
}

/**
 * Handles notification taps. Navigation only happens when the target route is
 * mounted; otherwise the tap is kept and replayed via `flushPendingNotification`.
 */
let pendingTarget: { route: string; params?: Record<string, unknown> } | null = null;

function targetFor(data: any): { route: string; params?: Record<string, unknown> } | null {
  if (!data) return null;
  if ((data.type === 'match' || data.type === 'message') && typeof data.matchId === 'string') {
    return { route: 'Chat', params: { matchId: data.matchId } };
  }
  return null;
}

export function setupNotificationResponseHandler(nav: NotificationNavigator) {
  const handle = (data: any) => {
    const target = targetFor(data);
    if (!target) return;
    if (nav.canNavigate()) nav.navigate(target.route, target.params);
    else pendingTarget = target;
  };

  // App launched from a notification tap (cold start)
  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (response) handle(response.notification.request.content.data);
    })
    .catch(() => undefined);

  return Notifications.addNotificationResponseReceivedListener((response) => {
    handle(response.notification.request.content.data);
  });
}

/** Replays a notification tap that arrived before the main stack was mounted. */
export function flushPendingNotification(nav: NotificationNavigator): void {
  if (!pendingTarget || !nav.canNavigate()) return;
  const target = pendingTarget;
  pendingTarget = null;
  nav.navigate(target.route, target.params);
}

export function clearPendingNotification(): void {
  pendingTarget = null;
}
