import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useUserStore } from '../../store/userStore';
import { useAuthStore } from '../../store/authStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { COLORS, INTERESTS } from '../../constants';
import { getApiErrorMessage } from '../../services/api';

export default function ProfileScreen() {
  const calculateAge = (dob: Date): number => {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
};
  const navigation = useNavigation<any>();
  const { profile, loadProfile, updateProfile, uploadPhoto, deletePhoto } = useUserStore();
  const { logout } = useAuthStore();
  const { status: subStatus, loadStatus: loadSubStatus } = useSubscriptionStore();

  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState(profile?.bio || '');
  const [interests, setInterests] = useState<string[]>(profile?.interests || []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfile();
    loadSubStatus();
  }, []);

  useEffect(() => {
    if (profile) {
      setBio(profile.bio || '');
      setInterests(profile.interests || []);
    }
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({ bio, interests });
      setEditing(false);
    } catch {
      Alert.alert('Error', 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [3, 4],
    });

    if (result.canceled || !result.assets[0]) return;

    const formData = new FormData();
    formData.append('photo', {
      uri: result.assets[0].uri,
      type: 'image/jpeg',
      name: `photo_${Date.now()}.jpg`,
    } as any);

    try {
      const uploaded: any = await uploadPhoto(formData);
      if (uploaded?.verificationStatus === 'pending') {
        Alert.alert('Photo uploaded', 'Your photo is waiting for review by our team.');
      }
    } catch (err) {
      Alert.alert('Could not upload photo', getApiErrorMessage(err, 'Please try again.'));
    }
  };

  const handleDeletePhoto = (storagePath: string) => {
    Alert.alert('Delete Photo', 'Remove this photo from your profile?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePhoto(storagePath);
          } catch (err) {
            Alert.alert('Could not delete photo', getApiErrorMessage(err, 'Please try again.'));
          }
        },
      },
    ]);
  };

  const toggleInterest = (i: string) => {
    setInterests((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : prev.length < 10 ? [...prev, i] : prev,
    );
  };

  const age = profile?.dob ? calculateAge(new Date(profile.dob)) : null;

  if (!profile) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Profile</Text>
        <TouchableOpacity
          onPress={() => (editing ? handleSave() : setEditing(true))}
          style={styles.editBtn}
        >
          {saving ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Text style={styles.editBtnText}>{editing ? 'Save' : 'Edit'}</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Photos */}
        <View style={styles.photosGrid}>
          {(profile.photos || [])
            .sort((a, b) => a.order - b.order)
            .map((photo, i) => (
              <TouchableOpacity
                key={photo.storagePath}
                style={[styles.photoCell, i === 0 && styles.photoMain]}
                onLongPress={() => handleDeletePhoto(photo.storagePath)}
              >
                <Image
                  source={{ uri: photo.url }}
                  style={styles.photoImg}
                  contentFit="cover"
                />
                {i === 0 && (
                  <View style={styles.mainBadge}>
                    <Text style={styles.mainBadgeText}>Main</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}

          {(profile.photos?.length || 0) < 6 && (
            <TouchableOpacity style={styles.addPhotoCell} onPress={handleAddPhoto}>
              <Text style={styles.addPhotoIcon}>+</Text>
              <Text style={styles.addPhotoText}>Add Photo</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Name & age */}
        <View style={styles.nameSection}>
          <Text style={styles.profileName}>{profile.name}</Text>
          {age && <Text style={styles.profileAge}>{age} years old</Text>}
          {profile.location?.city && (
            <Text style={styles.profileLocation}>📍 {profile.location.city}</Text>
          )}
        </View>

        {/* Bio */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>About me</Text>
          {editing ? (
            <TextInput
              style={styles.bioInput}
              value={bio}
              onChangeText={setBio}
              multiline
              maxLength={500}
              placeholder="Tell others about yourself..."
              placeholderTextColor={COLORS.textMuted}
            />
          ) : (
            <Text style={styles.bioText}>{bio || 'No bio yet. Add one!'}</Text>
          )}
        </View>

        {/* Interests */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            Interests {editing && `(${interests.length}/10)`}
          </Text>
          <View style={styles.interestWrap}>
            {editing
              ? INTERESTS.map((interest) => (
                  <TouchableOpacity
                    key={interest}
                    style={[
                      styles.chip,
                      interests.includes(interest) && styles.chipActive,
                    ]}
                    onPress={() => toggleInterest(interest)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        interests.includes(interest) && styles.chipTextActive,
                      ]}
                    >
                      {interest}
                    </Text>
                  </TouchableOpacity>
                ))
              : interests.map((interest) => (
                  <View key={interest} style={[styles.chip, styles.chipActive]}>
                    <Text style={[styles.chipText, styles.chipTextActive]}>
                      {interest}
                    </Text>
                  </View>
                ))}
          </View>
        </View>

        {/* Subscription */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Membership</Text>

          <TouchableOpacity
            style={[styles.menuItem, styles.subscriptionItem]}
            onPress={() => navigation.navigate('Subscription')}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.menuItemText}>
                {subStatus?.tier === 'platinum' ? '💎 GenXAura Platinum' :
                 subStatus?.tier === 'gold' ? '⭐ GenXAura Gold' : '🔓 Upgrade to Gold'}
              </Text>
              {subStatus?.tier === 'free' && (
                <Text style={styles.upgradeSubtext}>Unlimited likes, see who liked you & more</Text>
              )}
              {subStatus?.expiresAt && subStatus?.tier !== 'free' && (
                <Text style={styles.upgradeSubtext}>
                  Expires {new Date(subStatus.expiresAt).toLocaleDateString()}
                </Text>
              )}
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>

          {(subStatus?.tier === 'gold' || subStatus?.tier === 'platinum') && (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('WhoLikedMe')}
            >
              <Text style={styles.menuItemText}>👀 Who Liked You</Text>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Shop */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>À-la-carte</Text>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('Shop')}
          >
            <Text style={styles.menuItemText}>🛍️ Shop — Boosts, Roses & More</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Account</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.menuItemText}>⚙️ Settings & Preferences</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('NotificationPreferences')}
          >
            <Text style={styles.menuItemText}>🔔 Notification Preferences</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('SafetyCenter')}
          >
            <Text style={styles.menuItemText}>🛡️ Safety Center</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('Verification')}
          >
            <Text style={styles.menuItemText}>✅ Verify Your Identity</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('Privacy')}
          >
            <Text style={styles.menuItemText}>🔒 Privacy & Data</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, styles.logoutItem]}
            onPress={() =>
              Alert.alert('Log out?', undefined, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Log Out', style: 'destructive', onPress: () => logout() },
              ])
            }
          >
            <Text style={[styles.menuItemText, styles.logoutText]}>🚪 Log Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  editBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: `${COLORS.primary}22`,
    borderRadius: 10,
  },
  editBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 8,
  },
  photoCell: {
    width: '31%',
    aspectRatio: 3 / 4,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
  },
  photoMain: {
    width: '64%',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  photoImg: { width: '100%', height: '100%' },
  mainBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  mainBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFF' },
  addPhotoCell: {
    width: '31%',
    aspectRatio: 3 / 4,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addPhotoIcon: { fontSize: 28, color: COLORS.textMuted },
  addPhotoText: { fontSize: 11, color: COLORS.textMuted },
  nameSection: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 4,
  },
  profileName: { fontSize: 26, fontWeight: '800', color: COLORS.text },
  profileAge: { fontSize: 15, color: COLORS.textSecondary },
  profileLocation: { fontSize: 14, color: COLORS.textSecondary },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 12,
  },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  bioInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    color: COLORS.text,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bioText: { fontSize: 15, color: COLORS.textSecondary, lineHeight: 22 },
  interestWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  chipActive: { borderColor: COLORS.primary, backgroundColor: `${COLORS.primary}20` },
  chipText: { fontSize: 13, color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.primary, fontWeight: '600' },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuItemText: { fontSize: 15, color: COLORS.text },
  menuArrow: { fontSize: 20, color: COLORS.textMuted },
  logoutItem: { borderBottomWidth: 0 },
  logoutText: { color: COLORS.primary },
  subscriptionItem: { paddingVertical: 16 },
  upgradeSubtext: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
});
