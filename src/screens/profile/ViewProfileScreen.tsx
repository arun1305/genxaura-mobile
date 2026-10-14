import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Image } from 'expo-image';
import { profileApi, getApiErrorMessage, getErrorStatus } from '../../services/api';
import { COLORS } from '../../constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_HEIGHT = SCREEN_WIDTH * 1.25;

interface PublicProfile {
  userId: string;
  name: string;
  dob?: string;
  bio?: string;
  interests?: string[];
  photos?: { url: string; order: number }[];
  /** Other users' profiles have no coordinates — only city/country. */
  location?: { city?: string; country?: string };
  /** Distance in km (integer) or null. */
  distance?: number | null;
}

const calculateAge = (dob: Date): number => {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
};

/** Read-only view of another user's profile (GET /profile/:userId). */
export default function ViewProfileScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const userId: string | undefined = route.params?.userId;

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    if (!userId) {
      setError('Profile not found.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await profileApi.getProfile(userId);
        if (!cancelled) setProfile(data.data);
      } catch (err) {
        if (cancelled) return;
        setError(
          getErrorStatus(err) === 404
            ? 'This profile is no longer available.'
            : getApiErrorMessage(err, 'Could not load this profile.'),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const photos = [...(profile?.photos || [])].sort((a, b) => a.order - b.order);
  const age = profile?.dob ? calculateAge(new Date(profile.dob)) : null;
  const place = [profile?.location?.city, profile?.location?.country].filter(Boolean).join(', ');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{profile?.name ?? 'Profile'}</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : error || !profile ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error ?? 'Profile not found.'}</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {photos.length > 0 ? (
            <View>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) =>
                  setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))
                }
              >
                {photos.map((p) => (
                  <Image key={p.url} source={{ uri: p.url }} style={styles.photo} contentFit="cover" />
                ))}
              </ScrollView>
              {photos.length > 1 && (
                <View style={styles.dots}>
                  {photos.map((p, i) => (
                    <View key={p.url} style={[styles.dot, i === photoIndex && styles.dotActive]} />
                  ))}
                </View>
              )}
            </View>
          ) : (
            <View style={[styles.photo, styles.noPhoto]}>
              <Text style={styles.noPhotoText}>No photos</Text>
            </View>
          )}

          <View style={styles.body}>
            <Text style={styles.name}>
              {profile.name}
              {age != null ? <Text style={styles.age}>{`, ${age}`}</Text> : null}
            </Text>
            {(place || profile.distance != null) && (
              <Text style={styles.meta}>
                📍 {[place, profile.distance != null ? `${profile.distance} km away` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            )}

            {!!profile.bio && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>About</Text>
                <Text style={styles.bio}>{profile.bio}</Text>
              </View>
            )}

            {!!profile.interests?.length && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Interests</Text>
                <View style={styles.chips}>
                  {profile.interests.map((i) => (
                    <View key={i} style={styles.chip}>
                      <Text style={styles.chipText}>{i}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        </ScrollView>
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
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  errorText: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center' },
  photo: { width: SCREEN_WIDTH, height: PHOTO_HEIGHT, backgroundColor: COLORS.surface },
  noPhoto: { alignItems: 'center', justifyContent: 'center' },
  noPhotoText: { color: COLORS.textMuted, fontSize: 15 },
  dots: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: { width: 28, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotActive: { backgroundColor: '#FFFFFF' },
  body: { padding: 20, gap: 8 },
  name: { fontSize: 28, fontWeight: '800', color: COLORS.text },
  age: { fontWeight: '400' },
  meta: { fontSize: 14, color: COLORS.textSecondary },
  section: { marginTop: 16, gap: 8 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  bio: { fontSize: 15, color: COLORS.text, lineHeight: 22 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: `${COLORS.primary}22`,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  chipText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
});
