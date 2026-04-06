import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Image } from 'expo-image';
import { profileApi } from '../../services/api';
import { useUserStore } from '../../store/userStore';
import { useAuthStore } from '../../store/authStore';
import { COLORS, INTERESTS } from '../../constants';

const { width } = Dimensions.get('window');
const TOTAL_STEPS = 5;

type Gender = 'male' | 'female' | 'non_binary' | 'other';

export default function OnboardingScreen() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [interestedIn, setInterestedIn] = useState<Gender[]>([]);
  const [bio, setBio] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploadedPaths, setUploadedPaths] = useState<string[]>([]);

  const { loadProfile, completeOnboarding } = useUserStore();
  const { setOnboarded } = useAuthStore();

  const progress = step / TOTAL_STEPS;

  const canProceed = () => {
    switch (step) {
      case 1: return name.trim().length >= 2 && dob.length === 10;
      case 2: return gender !== null && interestedIn.length > 0;
      case 3: return bio.trim().length >= 10;
      case 4: return selectedInterests.length >= 3;
      case 5: return photos.length >= 1;
      default: return false;
    }
  };

  const handleNext = async () => {
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    } else {
      await handleSubmit();
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Get location
      const { status } = await Location.requestForegroundPermissionsAsync();
      let locationData: any = undefined;
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const [place] = await Location.reverseGeocodeAsync(loc.coords);
        locationData = {
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          city: place?.city || undefined,
          country: place?.country || undefined,
        };
      }

      // Parse dob
      const [dd, mm, yyyy] = dob.split('/');
      const dobDate = new Date(`${yyyy}-${mm}-${dd}`);

      await profileApi.setupProfile({
        name: name.trim(),
        dob: dobDate.toISOString(),
        gender: gender!,
        interestedIn,
        bio: bio.trim(),
        interests: selectedInterests,
        location: locationData,
        preferences: {
          minAge: 18,
          maxAge: 50,
          maxDistance: 50,
          genderPreference: interestedIn,
        },
      });

      await profileApi.completeOnboarding();
      await loadProfile();
      setOnboarded(true);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Setup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const pickPhoto = async () => {
    if (photos.length >= 6) {
      Alert.alert('Maximum photos', 'You can upload up to 6 photos.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.85,
      allowsEditing: true,
      aspect: [3, 4],
    });

    if (result.canceled || !result.assets[0]) return;

    const uri = result.assets[0].uri;
    setPhotos((prev) => [...prev, uri]);

    // Upload immediately
    const formData = new FormData();
    formData.append('photo', {
      uri,
      type: 'image/jpeg',
      name: `photo_${Date.now()}.jpg`,
    } as any);

    try {
      const { data } = await profileApi.uploadPhoto(formData);
      setUploadedPaths((prev) => [...prev, data.data.storagePath]);
    } catch (err: any) {
      console.error('[Upload Error]', err?.response?.status, JSON.stringify(err?.response?.data), err?.message);
      Alert.alert('Upload failed', err?.response?.data?.message || err?.message || 'Could not upload photo. Please try again.');
      setPhotos((prev) => prev.filter((p) => p !== uri));
    }
  };

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : prev.length < 10
        ? [...prev, interest]
        : prev,
    );
  };

  const renderStep = () => {
    switch (step) {
      // ── Step 1: Name + DOB ─────────────────────────────────────────
      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>What's your name?</Text>
            <Text style={styles.stepHint}>This is how you'll appear to others</Text>

            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder="Your first name"
              placeholderTextColor={COLORS.textMuted}
              autoFocus
              maxLength={50}
            />

            <Text style={styles.fieldLabel}>Date of birth</Text>
            <TextInput
              style={styles.textInput}
              value={dob}
              onChangeText={(text) => {
                // Auto-format DD/MM/YYYY
                const cleaned = text.replace(/\D/g, '');
                let formatted = cleaned;
                if (cleaned.length >= 2) formatted = cleaned.slice(0, 2) + '/' + cleaned.slice(2);
                if (cleaned.length >= 4) formatted = cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4) + '/' + cleaned.slice(4, 8);
                setDob(formatted);
              }}
              placeholder="DD/MM/YYYY"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="number-pad"
              maxLength={10}
            />
          </View>
        );

      // ── Step 2: Gender ─────────────────────────────────────────────
      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>I am a...</Text>

            {(['male', 'female', 'non_binary', 'other'] as Gender[]).map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.optionBtn, gender === g && styles.optionBtnSelected]}
                onPress={() => setGender(g)}
              >
                <Text style={[styles.optionText, gender === g && styles.optionTextSelected]}>
                  {g === 'non_binary' ? 'Non-binary' : g.charAt(0).toUpperCase() + g.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}

            <Text style={[styles.stepTitle, { marginTop: 28 }]}>Interested in...</Text>

            <View style={styles.checkRow}>
              {(['male', 'female', 'non_binary', 'other'] as Gender[]).map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[
                    styles.checkBtn,
                    interestedIn.includes(g) && styles.checkBtnSelected,
                  ]}
                  onPress={() =>
                    setInterestedIn((prev) =>
                      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g],
                    )
                  }
                >
                  <Text style={[styles.checkText, interestedIn.includes(g) && styles.checkTextSelected]}>
                    {g === 'non_binary' ? 'NB' : g.charAt(0).toUpperCase() + g.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      // ── Step 3: Bio ────────────────────────────────────────────────
      case 3:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>About you</Text>
            <Text style={styles.stepHint}>
              Write a short bio — what makes you unique?
            </Text>
            <TextInput
              style={[styles.textInput, styles.bioInput]}
              value={bio}
              onChangeText={setBio}
              placeholder="I'm passionate about travel, coffee, and finding adventures in everyday life..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              maxLength={500}
              autoFocus
            />
            <Text style={styles.charCount}>{bio.length}/500</Text>
          </View>
        );

      // ── Step 4: Interests ──────────────────────────────────────────
      case 4:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Your interests</Text>
            <Text style={styles.stepHint}>
              Pick up to 10 ({selectedInterests.length}/10)
            </Text>
            <View style={styles.interestGrid}>
              {INTERESTS.map((interest) => (
                <TouchableOpacity
                  key={interest}
                  style={[
                    styles.interestChip,
                    selectedInterests.includes(interest) && styles.interestChipSelected,
                  ]}
                  onPress={() => toggleInterest(interest)}
                >
                  <Text
                    style={[
                      styles.interestChipText,
                      selectedInterests.includes(interest) && styles.interestChipTextSelected,
                    ]}
                  >
                    {interest}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      // ── Step 5: Photos ─────────────────────────────────────────────
      case 5:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Add your photos</Text>
            <Text style={styles.stepHint}>
              Add at least 1 photo (up to 6)
            </Text>
            <View style={styles.photoGrid}>
              {Array.from({ length: 6 }).map((_, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.photoSlot}
                  onPress={i <= photos.length ? pickPhoto : undefined}
                >
                  {photos[i] ? (
                    <Image
                      source={{ uri: photos[i] }}
                      style={styles.photoThumbnail}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Text style={styles.photoPlaceholderText}>
                        {i === photos.length ? '+' : ''}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {renderStep()}
      </ScrollView>

      {/* Navigation */}
      <View style={styles.footer}>
        {step > 1 && (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => setStep(step - 1)}
          >
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.nextBtn,
            !canProceed() && styles.nextBtnDisabled,
            step === 1 && { flex: 1 },
          ]}
          onPress={handleNext}
          disabled={!canProceed() || loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.nextBtnText}>
              {step === TOTAL_STEPS ? '🎉 Get Started' : 'Continue →'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  progressBar: {
    height: 4,
    backgroundColor: COLORS.border,
    marginHorizontal: 0,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 20 },
  stepContent: { gap: 16 },
  stepTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    lineHeight: 34,
  },
  stepHint: {
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 22,
    marginTop: -8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: -8,
    marginTop: 8,
  },
  textInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bioInput: {
    height: 140,
    textAlignVertical: 'top',
    paddingTop: 16,
  },
  charCount: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'right',
    marginTop: -10,
  },
  optionBtn: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  optionBtnSelected: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}22`,
  },
  optionText: { fontSize: 16, color: COLORS.textSecondary, fontWeight: '500' },
  optionTextSelected: { color: COLORS.primary, fontWeight: '700' },
  checkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  checkBtn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  checkBtnSelected: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}22`,
  },
  checkText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
  checkTextSelected: { color: COLORS.primary, fontWeight: '700' },
  interestGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  interestChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  interestChipSelected: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}22`,
  },
  interestChipText: { fontSize: 13, color: COLORS.textSecondary },
  interestChipTextSelected: { color: COLORS.primary, fontWeight: '600' },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  photoSlot: {
    width: (width - 48 - 16) / 3,
    aspectRatio: 3 / 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  photoThumbnail: { width: '100%', height: '100%' },
  photoPlaceholder: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    fontSize: 28,
    color: COLORS.textMuted,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 17,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: { fontSize: 15, color: COLORS.textSecondary, fontWeight: '600' },
  nextBtn: {
    flex: 2,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
  },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
