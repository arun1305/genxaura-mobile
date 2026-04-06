import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../../constants';
import {
  NotificationPreferences,
  useNotificationStore,
} from '../../store/notificationStore';

// ─── Types ────────────────────────────────────────────────────────────────────

type BooleanPrefKey = {
  [K in keyof NotificationPreferences]: NotificationPreferences[K] extends boolean ? K : never;
}[keyof NotificationPreferences];

type NumberPrefKey = {
  [K in keyof NotificationPreferences]: NotificationPreferences[K] extends number ? K : never;
}[keyof NotificationPreferences];

interface ToggleRowConfig {
  key: BooleanPrefKey;
  icon: string;
  title: string;
  subtitle?: string;
  badge?: string;
}

// ─── Row configs ──────────────────────────────────────────────────────────────

const MATCHES_ROWS: ToggleRowConfig[] = [
  {
    key: 'newMatch',
    icon: '🎉',
    title: 'New Match',
    subtitle: 'Be notified the moment you match',
  },
  {
    key: 'newMessage',
    icon: '💬',
    title: 'New Message',
    subtitle: 'Push alert for every new message',
  },
  {
    key: 'superLikeReceived',
    icon: '⭐',
    title: 'Super Like Received',
    subtitle: 'Someone sent you a Super Like',
  },
  {
    key: 'likedYou',
    icon: '❤️',
    title: 'Someone Liked You',
    subtitle: 'See who's interested in you',
    badge: 'Gold+',
  },
];

const ACTIVITY_ROWS: ToggleRowConfig[] = [
  {
    key: 'boostActive',
    icon: '⚡',
    title: 'Profile Boost Active',
    subtitle: 'In-app banner when boost is running',
  },
  {
    key: 'dailyRecap',
    icon: '📊',
    title: 'Daily Recap',
    subtitle: 'Evening summary of matches and messages',
  },
  {
    key: 'reEngagement',
    icon: '👋',
    title: 'Re-engagement Reminders',
    subtitle: 'Smart nudge after 3 days away',
  },
];

// ─── Helper: hour label ───────────────────────────────────────────────────────

function formatHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

// ─── Stepper ─────────────────────────────────────────────────────────────────

interface StepperProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  saving: boolean;
}

const HourStepper: React.FC<StepperProps> = ({ label, value, onChange, saving }) => {
  const decrement = () => onChange(value === 0 ? 23 : value - 1);
  const increment = () => onChange(value === 23 ? 0 : value + 1);

  return (
    <View style={styles.stepperContainer}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <TouchableOpacity
          style={styles.stepperBtn}
          onPress={decrement}
          disabled={saving}
          accessibilityLabel={`Decrease ${label}`}
        >
          <Text style={styles.stepperBtnText}>−</Text>
        </TouchableOpacity>

        <View style={styles.stepperValueBox}>
          {saving ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Text style={styles.stepperValue}>{formatHour(value)}</Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.stepperBtn}
          onPress={increment}
          disabled={saving}
          accessibilityLabel={`Increase ${label}`}
        >
          <Text style={styles.stepperBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function NotificationPreferencesScreen() {
  const navigation = useNavigation<any>();
  const { prefs, isLoading, loadPreferences, updatePreference } = useNotificationStore();

  // Track which field is currently being saved, so we can show a per-row indicator
  const [savingKey, setSavingKey] = useState<keyof NotificationPreferences | null>(null);

  useEffect(() => {
    loadPreferences();
  }, []);

  // ── Generic boolean toggle ────────────────────────────────────────────
  const handleToggle = useCallback(
    async (key: BooleanPrefKey, currentValue: boolean) => {
      if (savingKey) return; // prevent simultaneous saves
      const next = !currentValue;
      setSavingKey(key);
      try {
        await updatePreference(key, next);
      } catch {
        Alert.alert('Error', 'Could not save your preference. Please try again.');
      } finally {
        setSavingKey(null);
      }
    },
    [savingKey, updatePreference],
  );

  // ── Number stepper (quiet hours) ─────────────────────────────────────
  const handleHourChange = useCallback(
    (key: NumberPrefKey, value: number) => {
      // Goes through the store for optimistic update + API call
      useNotificationStore.getState().updatePreference(key, value).catch(() => {
        Alert.alert('Error', 'Could not update quiet hours. Please try again.');
      });
    },
    [],
  );

  // ── Loading state ─────────────────────────────────────────────────────
  if (isLoading || !prefs) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading preferences…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isMuted = prefs.muteAll;

  // ── Row renderer ──────────────────────────────────────────────────────
  const renderToggleRow = (row: ToggleRowConfig) => {
    const isSaving = savingKey === row.key;
    const value = prefs[row.key] as boolean;
    const muted = isMuted && row.key !== 'muteAll';

    return (
      <View key={row.key} style={[styles.row, muted && styles.rowMuted]}>
        {/* Left: icon + text */}
        <View style={styles.rowLeft}>
          <Text style={styles.rowIcon}>{row.icon}</Text>
          <View style={styles.rowTextGroup}>
            <View style={styles.rowTitleRow}>
              <Text style={[styles.rowTitle, muted && styles.textMuted]}>{row.title}</Text>
              {row.badge && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{row.badge}</Text>
                </View>
              )}
            </View>
            {row.subtitle && (
              <Text style={[styles.rowSubtitle, muted && styles.textMuted]} numberOfLines={2}>
                {row.subtitle}
              </Text>
            )}
            {muted && (
              <Text style={styles.mutedOverlayText}>Muted by global setting</Text>
            )}
          </View>
        </View>

        {/* Right: switch or spinner */}
        <View style={styles.rowRight}>
          {isSaving ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Switch
              value={value}
              onValueChange={() => handleToggle(row.key, value)}
              disabled={muted || !!savingKey}
              trackColor={{ false: COLORS.border, true: COLORS.primary }}
              thumbColor={Platform.OS === 'android' ? (value ? COLORS.primary : COLORS.textSecondary) : undefined}
              ios_backgroundColor={COLORS.border}
            />
          )}
        </View>
      </View>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Section 1: Global mute ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Push Notifications</Text>

          {/* Mute All row */}
          <View style={[styles.row, styles.rowLast]}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowIcon}>🔕</Text>
              <View style={styles.rowTextGroup}>
                <Text style={styles.rowTitle}>Mute All Notifications</Text>
                <Text style={styles.rowSubtitle}>
                  {isMuted
                    ? 'All notifications are silenced'
                    : 'Silence every push notification'}
                </Text>
              </View>
            </View>
            <View style={styles.rowRight}>
              {savingKey === 'muteAll' ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Switch
                  value={isMuted}
                  onValueChange={() => handleToggle('muteAll', isMuted)}
                  disabled={!!savingKey}
                  trackColor={{ false: COLORS.border, true: COLORS.error }}
                  thumbColor={Platform.OS === 'android' ? (isMuted ? COLORS.error : COLORS.textSecondary) : undefined}
                  ios_backgroundColor={COLORS.border}
                />
              )}
            </View>
          </View>
        </View>

        {/* ── Section 2: Matches & Likes ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Matches & Likes</Text>
          {MATCHES_ROWS.map((row, i) => (
            <View key={row.key} style={i === MATCHES_ROWS.length - 1 ? undefined : styles.rowDivider}>
              {renderToggleRow(row)}
            </View>
          ))}
        </View>

        {/* ── Section 3: Activity ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Activity</Text>
          {ACTIVITY_ROWS.map((row, i) => (
            <View key={row.key} style={i === ACTIVITY_ROWS.length - 1 ? undefined : styles.rowDivider}>
              {renderToggleRow(row)}
            </View>
          ))}
        </View>

        {/* ── Section 4: Quiet Hours ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Quiet Hours</Text>

          {/* Enable toggle */}
          <View style={prefs.quietHoursEnabled ? styles.rowDivider : undefined}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowIcon}>🌙</Text>
                <View style={styles.rowTextGroup}>
                  <Text style={styles.rowTitle}>Enable Quiet Hours</Text>
                  <Text style={styles.rowSubtitle}>Silence notifications at night</Text>
                </View>
              </View>
              <View style={styles.rowRight}>
                {savingKey === 'quietHoursEnabled' ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <Switch
                    value={prefs.quietHoursEnabled}
                    onValueChange={() => handleToggle('quietHoursEnabled', prefs.quietHoursEnabled)}
                    disabled={!!savingKey}
                    trackColor={{ false: COLORS.border, true: COLORS.primary }}
                    thumbColor={
                      Platform.OS === 'android'
                        ? prefs.quietHoursEnabled
                          ? COLORS.primary
                          : COLORS.textSecondary
                        : undefined
                    }
                    ios_backgroundColor={COLORS.border}
                  />
                )}
              </View>
            </View>
          </View>

          {/* Time selectors — only visible when quiet hours enabled */}
          {prefs.quietHoursEnabled && (
            <View style={styles.quietHoursBody}>
              <View style={styles.steppersRow}>
                <HourStepper
                  label="Start"
                  value={prefs.quietHoursStart}
                  onChange={(v) => handleHourChange('quietHoursStart', v)}
                  saving={savingKey === 'quietHoursStart'}
                />
                <View style={styles.stepperSeparator} />
                <HourStepper
                  label="End"
                  value={prefs.quietHoursEnd}
                  onChange={(v) => handleHourChange('quietHoursEnd', v)}
                  saving={savingKey === 'quietHoursEnd'}
                />
              </View>

              <Text style={styles.quietHoursHelper}>
                {`Notifications will be silenced between ${formatHour(prefs.quietHoursStart)} and ${formatHour(prefs.quietHoursEnd)}`}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ── Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    color: COLORS.text,
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '300',
    includeFontPadding: false,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 36,
  },

  // ── Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },

  // ── Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  bottomSpacer: {
    height: 40,
  },

  // ── Section card
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    marginBottom: 16,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  sectionTitle: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },

  // ── Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    minHeight: 60,
  },
  rowLast: {
    marginBottom: 8,
  },
  rowMuted: {
    opacity: 0.5,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  rowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingRight: 12,
  },
  rowIcon: {
    fontSize: 20,
    lineHeight: 26,
    width: 26,
    textAlign: 'center',
  },
  rowTextGroup: {
    flex: 1,
    gap: 2,
  },
  rowTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  rowTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '500',
  },
  rowSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  rowRight: {
    width: 56,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },

  // ── Muted overlay text
  textMuted: {
    color: COLORS.textSecondary,
  },
  mutedOverlayText: {
    color: COLORS.error,
    fontSize: 11,
    marginTop: 2,
    fontStyle: 'italic',
  },

  // ── Badge
  badge: {
    backgroundColor: COLORS.warning,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '700',
  },

  // ── Quiet Hours body
  quietHoursBody: {
    paddingBottom: 14,
    paddingTop: 4,
  },
  steppersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 14,
  },
  stepperSeparator: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.border,
  },
  quietHoursHelper: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },

  // ── Stepper
  stepperContainer: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  stepperLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '300',
    lineHeight: 24,
    includeFontPadding: false,
  },
  stepperValueBox: {
    width: 60,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  stepperValue: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
