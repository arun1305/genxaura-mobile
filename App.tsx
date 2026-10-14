import 'react-native-gesture-handler';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import RootNavigator from './src/navigation/RootNavigator';
import { API_URL_MISSING } from './src/config';
import { COLORS } from './src/constants';

export default function App() {
  if (API_URL_MISSING) {
    // Release build without EXPO_PUBLIC_API_URL: fail loudly instead of
    // silently calling localhost.
    return (
      <View style={styles.errorContainer}>
        <StatusBar style="light" />
        <Text style={styles.errorTitle}>Configuration error</Text>
        <Text style={styles.errorText}>
          This build was created without EXPO_PUBLIC_API_URL, so it cannot reach the GenXAura
          servers. Please install an updated version of the app.
        </Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <RootNavigator />
    </>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  errorTitle: { fontSize: 22, fontWeight: '800', color: COLORS.error },
  errorText: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
});
