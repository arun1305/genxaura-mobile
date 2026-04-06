import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Show notifications when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

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
    const token = await Notifications.getDevicePushTokenAsync();
    return token.data;
  } catch (err) {
    console.warn('[Notifications] Failed to get push token:', err);
    return null;
  }
}

export function setupNotificationResponseHandler(navigation: any) {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as any;
    if (!data) return;

    if (data.type === 'match' || data.type === 'message') {
      navigation.navigate('Chat', { matchId: data.matchId });
    }
  });
}
