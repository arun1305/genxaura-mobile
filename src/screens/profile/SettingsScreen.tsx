import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../../constants';

const ITEMS: { icon: string; label: string; route: string }[] = [
  { icon: '🔔', label: 'Notification Preferences', route: 'NotificationPreferences' },
  { icon: '🔒', label: 'Privacy & Data', route: 'Privacy' },
  { icon: '🛡️', label: 'Safety Center', route: 'SafetyCenter' },
  { icon: '✅', label: 'Photo Verification', route: 'Verification' },
  { icon: '🪪', label: 'ID Verification', route: 'IDVerification' },
  { icon: '💫', label: 'Membership', route: 'Subscription' },
];

/** Hub for account settings; every entry routes to an existing screen. */
export default function SettingsScreen() {
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {ITEMS.map((item) => (
          <TouchableOpacity
            key={item.route}
            style={styles.menuItem}
            onPress={() => navigation.navigate(item.route)}
          >
            <Text style={styles.menuItemText}>
              {item.icon} {item.label}
            </Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { width: 40, alignItems: 'center' },
  backIcon: { fontSize: 32, color: COLORS.text, lineHeight: 36 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  content: { paddingHorizontal: 20, paddingVertical: 8 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuItemText: { fontSize: 15, color: COLORS.text },
  menuArrow: { fontSize: 20, color: COLORS.textMuted },
});
