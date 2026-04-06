import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { usersApi, verificationApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { COLORS } from '../../constants';
import EmergencyShareModal from '../../components/safety/EmergencyShareModal';

interface BlockedProfile {
  userId: string;
  name: string;
  photos?: { url: string }[];
}

const SAFETY_TIPS = [
  { icon: '📍', title: 'Meet in public', body: 'Always choose a public place for first dates.' },
  { icon: '📱', title: 'Tell a friend', body: "Let someone know where you're going and who you're meeting." },
  { icon: '🚗', title: 'Drive yourself', body: 'Arrange your own transportation to and from dates.' },
  { icon: '🔋', title: 'Keep phone charged', body: 'Make sure you have battery for emergencies.' },
  { icon: '🚩', title: 'Trust your instincts', body: "If something feels wrong, it's okay to leave." },
  { icon: '💬', title: 'Video call first', body: 'Do a video call before meeting in person.' },
];

const CRISIS_RESOURCES = [
  { label: 'National DV Hotline', number: '18007997233', display: '1-800-799-7233' },
  { label: 'Crisis Text Line', sms: '741741', display: 'Text HOME to 741741' },
  { label: 'Emergency Services', number: '911', display: '911' },
];

export default function SafetyCenterScreen() {
  const navigation = useNavigation<any>();
  const { logout } = useAuthStore();

  const [blockedUsers, setBlockedUsers] = useState<BlockedProfile[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(true);
  const [unblocking, setUnblocking] = useState<string | null>(null);
  const [tipsExpanded, setTipsExpanded] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [activeShare, setActiveShare] = useState<any>(null);
  const [verificationStatus, setVerificationStatus] = useState<{
    liveness?: { status: string } | null;
    id?: { status: string } | null;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [blockedRes, verifyRes, shareRes] = await Promise.allSettled([
        usersApi.getBlockedUsers(),
        verificationApi.getStatus(),
        verificationApi.getActiveEmergencyShare(),
      ]);
      if (blockedRes.status === 'fulfilled') setBlockedUsers(blockedRes.value.data.data || []);
      if (verifyRes.status === 'fulfilled') setVerificationStatus(verifyRes.value.data.data);
      if (shareRes.status === 'fulfilled') setActiveShare(shareRes.value.data.data);
    } finally {
      setLoadingBlocked(false);
    }
  }, []);

  const handleUnblock = (user: BlockedProfile) => {
    Alert.alert(`Unblock ${user.name}?`, 'They may appear in your Discover feed again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        onPress: async () => {
          setUnblocking(user.userId);
          try {
            await usersApi.unblockUser(user.userId);
            setBlockedUsers((prev) => prev.filter((u) => u.userId !== user.userId));
          } catch {
            Alert.alert('Error', 'Could not unblock. Please try again.');
          } finally {
            setUnblocking(null);
          }
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This permanently deletes your account and all data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await usersApi.deleteAccount();
              logout();
            } catch {
              Alert.alert('Error', 'Could not delete account. Please contact support.');
            }
          },
        },
      ],
    );
  };

  const getBadge = (status?: string | null) => {
    if (status === 'approved') return { label: '✓ Verified', color: '#4CAF50' };
    if (status === 'pending') return { label: '⏳ Under review', color: '#FF9800' };
    return { label: '○ Not verified', color: '#666' };
  };

  const livenessBadge = getBadge(verificationStatus?.liveness?.status);
  const idBadge = getBadge(verificationStatus?.id?.status);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Safety Center</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.heroCard}>
          <Text style={styles.heroIcon}>🛡️</Text>
          <Text style={styles.heroTitle}>Your Safety Hub</Text>
          <Text style={styles.heroSubtitle}>
            Tools and resources to help you date safely and confidently
          </Text>
        </View>

        {/* Identity Verification */}
        <Text style={styles.sectionLabel}>Verify Your Identity</Text>
        <View style={styles.verifyRow}>
          <TouchableOpacity style={styles.verifyCard} onPress={() => navigation.navigate('Verification')}>
            <Text style={styles.verifyIcon}>🤳</Text>
            <Text style={styles.verifyTitle}>Photo{'\n'}Verification</Text>
            <View style={[styles.badge, { borderColor: livenessBadge.color }]}>
              <Text style={[styles.badgeText, { color: livenessBadge.color }]}>{livenessBadge.label}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.verifyCard} onPress={() => navigation.navigate('IDVerification')}>
            <Text style={styles.verifyIcon}>🪪</Text>
            <Text style={styles.verifyTitle}>ID{'\n'}Verification</Text>
            <View style={[styles.badge, { borderColor: idBadge.color }]}>
              <Text style={[styles.badgeText, { color: idBadge.color }]}>{idBadge.label}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Before Your Date */}
        <Text style={styles.sectionLabel}>Before Your Date</Text>
        <TouchableOpacity
          style={[styles.featureCard, activeShare && styles.featureCardActive]}
          onPress={() => setShowEmergencyModal(true)}
        >
          <View style={styles.featureLeft}>
            <Text style={styles.featureIcon}>📍</Text>
            <View>
              <Text style={styles.featureTitle}>Emergency Safety Share</Text>
              <Text style={styles.featureSub}>
                {activeShare ? '🟢 Safety share is active' : 'Share your plans with a trusted friend'}
              </Text>
            </View>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        {/* While Chatting */}
        <Text style={styles.sectionLabel}>While Chatting</Text>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>🤖 AI Message Screening</Text>
          <Text style={styles.infoBody}>
            We automatically detect potentially harmful messages and ask if you're comfortable.
          </Text>
        </View>
        <View style={[styles.infoCard, { marginTop: 10 }]}>
          <Text style={styles.infoTitle}>🆘 SOS Panic Button</Text>
          <Text style={styles.infoBody}>
            Available in every chat via the ⋮ menu. Hold for 3 seconds to activate.
          </Text>
        </View>

        {/* Blocked Users */}
        <Text style={styles.sectionLabel}>Blocked Users ({blockedUsers.length})</Text>
        {loadingBlocked ? (
          <View style={styles.centered}><ActivityIndicator color={COLORS.primary} /></View>
        ) : blockedUsers.length === 0 ? (
          <Text style={styles.emptyText}>You haven't blocked anyone.</Text>
        ) : (
          blockedUsers.map((user) => (
            <View key={user.userId} style={styles.blockedRow}>
              {user.photos?.[0]?.url ? (
                <Image source={{ uri: user.photos[0].url }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={{ fontSize: 20 }}>👤</Text>
                </View>
              )}
              <Text style={styles.blockedName} numberOfLines={1}>{user.name || 'Unknown'}</Text>
              <TouchableOpacity
                style={styles.unblockBtn}
                onPress={() => handleUnblock(user)}
                disabled={unblocking === user.userId}
              >
                {unblocking === user.userId ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <Text style={styles.unblockText}>Unblock</Text>
                )}
              </TouchableOpacity>
            </View>
          ))
        )}

        {/* Safety Tips (collapsible) */}
        <TouchableOpacity
          style={styles.tipsToggle}
          onPress={() => setTipsExpanded((v) => !v)}
        >
          <Text style={styles.sectionLabel}>Dating Safety Tips</Text>
          <Text style={styles.chevron}>{tipsExpanded ? '∧' : '∨'}</Text>
        </TouchableOpacity>
        {tipsExpanded && SAFETY_TIPS.map((tip) => (
          <View key={tip.title} style={styles.tipRow}>
            <Text style={styles.tipIcon}>{tip.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.tipTitle}>{tip.title}</Text>
              <Text style={styles.tipBody}>{tip.body}</Text>
            </View>
          </View>
        ))}

        {/* Crisis Resources */}
        <Text style={styles.sectionLabel}>Crisis Resources</Text>
        {CRISIS_RESOURCES.map((r) => (
          <TouchableOpacity
            key={r.label}
            style={styles.crisisRow}
            onPress={() => {
              if (r.number) {
                Linking.openURL(`tel:${r.number}`).catch(() => Alert.alert(r.label, r.display));
              } else {
                Alert.alert(r.label, r.display);
              }
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.crisisLabel}>{r.label}</Text>
              <Text style={styles.crisisNumber}>{r.display}</Text>
            </View>
            <View style={styles.callBtn}>
              <Text style={styles.callBtnText}>{r.number ? 'Call' : 'Text'}</Text>
            </View>
          </TouchableOpacity>
        ))}

        {/* Danger Zone */}
        <View style={styles.dangerZone}>
          <Text style={styles.dangerLabel}>Account</Text>
          <TouchableOpacity style={styles.privacyBtn} onPress={() => navigation.navigate('Privacy')}>
            <Text style={styles.privacyBtnText}>🔒 Privacy Settings & Data Export</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
            <Text style={styles.deleteBtnText}>Delete My Account</Text>
          </TouchableOpacity>
          <Text style={styles.deleteNote}>Permanently removes all your data. Cannot be undone.</Text>
        </View>
      </ScrollView>

      <EmergencyShareModal
        visible={showEmergencyModal}
        onClose={() => {
          setShowEmergencyModal(false);
          verificationApi.getActiveEmergencyShare()
            .then((r) => setActiveShare(r.data.data))
            .catch(() => {});
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { width: 40, alignItems: 'center' },
  backIcon: { fontSize: 32, color: COLORS.text, lineHeight: 36 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  content: { padding: 16, paddingBottom: 48 },

  heroCard: {
    backgroundColor: '#1A1A1A', borderRadius: 20, padding: 20, alignItems: 'center',
    marginBottom: 8, borderWidth: 1, borderColor: '#2A2A2A',
  },
  heroIcon: { fontSize: 40, marginBottom: 8 },
  heroTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  heroSubtitle: { fontSize: 14, color: '#999', textAlign: 'center', lineHeight: 20 },

  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: '#666', textTransform: 'uppercase',
    letterSpacing: 0.8, marginTop: 24, marginBottom: 10,
  },

  verifyRow: { flexDirection: 'row', gap: 12 },
  verifyCard: {
    flex: 1, backgroundColor: '#1A1A1A', borderRadius: 16, padding: 16,
    alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#2A2A2A',
  },
  verifyIcon: { fontSize: 28 },
  verifyTitle: { fontSize: 13, fontWeight: '600', color: COLORS.text, textAlign: 'center' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, marginTop: 2 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  featureCard: {
    backgroundColor: '#1A1A1A', borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  featureCardActive: { borderColor: '#4CAF50', backgroundColor: '#0A1A0A' },
  featureLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  featureIcon: { fontSize: 22 },
  featureTitle: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  featureSub: { fontSize: 12, color: '#999', marginTop: 2 },

  infoCard: {
    backgroundColor: '#1A1A1A', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#2A2A2A', gap: 6,
  },
  infoTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  infoBody: { fontSize: 13, color: '#999', lineHeight: 19 },

  centered: { paddingVertical: 20, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#555', paddingVertical: 8 },

  blockedRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#1A1A1A', gap: 12,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1A1A1A' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  blockedName: { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.text },
  unblockBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10,
    borderWidth: 1.5, borderColor: COLORS.primary, minWidth: 76, alignItems: 'center',
  },
  unblockText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  tipsToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tipRow: {
    flexDirection: 'row', gap: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#1A1A1A', alignItems: 'flex-start',
  },
  tipIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  tipTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  tipBody: { fontSize: 13, color: '#999', lineHeight: 18 },

  crisisRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1A1A1A',
  },
  crisisLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  crisisNumber: { fontSize: 13, color: '#999', marginTop: 2 },
  callBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  callBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  chevron: { fontSize: 20, color: '#666' },

  dangerZone: {
    marginTop: 32, padding: 16, borderRadius: 16,
    borderWidth: 1, borderColor: '#FF444430', backgroundColor: '#FF444408', gap: 12,
  },
  dangerLabel: {
    fontSize: 12, fontWeight: '700', color: '#FF6666', textTransform: 'uppercase', letterSpacing: 0.8,
  },
  privacyBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#1A1A1A', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
  },
  privacyBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  deleteBtn: { backgroundColor: '#FF4444', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  deleteBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  deleteNote: { fontSize: 12, color: '#666', textAlign: 'center', lineHeight: 17 },
});
