import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { COLORS } from '../../constants';

const calculateAge = (dob: string): number => {
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

export default function WhoLikedMeScreen() {
  const navigation = useNavigation<any>();
  const { likedMe, isLoading, loadWhoLikedMe, isGoldOrAbove } = useSubscriptionStore();

  useEffect(() => {
    loadWhoLikedMe();
  }, []);

  if (!isGoldOrAbove()) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Who Liked You</Text>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.lockedContainer}>
          <Text style={styles.lockedEmoji}>👀</Text>
          <Text style={styles.lockedTitle}>Unlock with Gold</Text>
          <Text style={styles.lockedText}>
            See everyone who already liked you and match instantly with Gold or Platinum.
          </Text>
          <TouchableOpacity
            style={styles.upgradeBtn}
            onPress={() => navigation.navigate('Subscription')}
          >
            <LinearGradient colors={['#FF4458', '#C850C0']} style={styles.upgradeBtnGradient}>
              <Text style={styles.upgradeBtnText}>Upgrade to Gold ⭐</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Who Liked You</Text>
        <View style={styles.backBtn} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : likedMe.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>🌟</Text>
          <Text style={styles.emptyTitle}>No likes yet</Text>
          <Text style={styles.emptyText}>Keep swiping — someone will like you soon!</Text>
        </View>
      ) : (
        <FlatList
          data={likedMe}
          keyExtractor={(item) => item.userId}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => {
            const photoUrl = item.photos?.[0]?.url;
            const age = item.dob ? calculateAge(item.dob) : null;
            return (
              <View style={styles.card}>
                {photoUrl ? (
                  <Image source={{ uri: photoUrl }} style={styles.cardPhoto} contentFit="cover" />
                ) : (
                  <View style={[styles.cardPhoto, styles.noPhoto]}>
                    <Text style={{ fontSize: 32 }}>👤</Text>
                  </View>
                )}
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.8)']}
                  style={styles.cardGradient}
                />
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName} numberOfLines={1}>
                    {item.name || 'Someone'}
                    {age ? `, ${age}` : ''}
                  </Text>
                  <View style={styles.likedBadge}>
                    <Text style={styles.likedBadgeText}>❤️ Liked you</Text>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
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
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  emptyText: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },
  lockedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 32,
  },
  lockedEmoji: { fontSize: 64 },
  lockedTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  lockedText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  upgradeBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 8 },
  upgradeBtnGradient: { paddingHorizontal: 32, paddingVertical: 16 },
  upgradeBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  grid: { padding: 12 },
  gridRow: { gap: 10, marginBottom: 10 },
  card: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    aspectRatio: 0.75,
    backgroundColor: COLORS.surface,
  },
  cardPhoto: { width: '100%', height: '100%', position: 'absolute' },
  noPhoto: { alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceLight },
  cardGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%' },
  cardInfo: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10, gap: 4 },
  cardName: { fontSize: 14, fontWeight: '700', color: '#fff' },
  likedBadge: {
    backgroundColor: `${COLORS.primary}CC`,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  likedBadgeText: { fontSize: 11, color: '#fff', fontWeight: '600' },
});
