import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { usersApi, moderationApi } from '../../services/api';
import { COLORS } from '../../constants';

const REPORT_REASONS = [
  { label: 'Fake profile', category: 'fake_profile' },
  { label: 'Inappropriate photos', category: 'inappropriate_photos' },
  { label: 'Harassment or spam', category: 'harassment' },
  { label: 'Underage user', category: 'underage' },
  { label: 'Abusive behavior', category: 'abusive_behavior' },
  { label: 'Hate speech', category: 'hate_speech' },
  { label: 'Sexual harassment', category: 'sexual_harassment' },
  { label: 'Scam or fraud', category: 'scam' },
  { label: 'Threats of violence', category: 'violence_threats' },
  { label: 'Other', category: 'other' },
];

interface Props {
  visible: boolean;
  targetUserId: string;
  targetName: string;
  onClose: () => void;
  onBlocked: () => void;
  // Optional: pre-fill context from a chat message
  messageId?: string;
  matchId?: string;
}

export default function BlockReportModal({
  visible,
  targetUserId,
  targetName,
  onClose,
  onBlocked,
  messageId,
  matchId,
}: Props) {
  const [step, setStep] = useState<'main' | 'report'>('main');
  const [selectedReason, setSelectedReason] = useState<typeof REPORT_REASONS[0] | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    setStep('main');
    setSelectedReason(null);
    onClose();
  };

  const handleBlock = async () => {
    Alert.alert(
      `Block ${targetName}?`,
      "They won't be able to see your profile or contact you.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await usersApi.blockUser(targetUserId);
              handleClose();
              onBlocked();
            } catch {
              Alert.alert('Error', 'Could not block user. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleReport = async () => {
    if (!selectedReason) {
      Alert.alert('Select a reason', 'Please select a reason for reporting.');
      return;
    }
    setLoading(true);
    try {
      await moderationApi.submitReport(
        targetUserId,
        selectedReason.category,
        selectedReason.label,
        messageId,
        matchId,
      );
      handleClose();
      Alert.alert('Report submitted', "Thank you. Our team will review this within 24 hours.");
    } catch {
      Alert.alert('Error', 'Could not submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet}>
          {step === 'main' ? (
            <>
              <View style={styles.handle} />
              <Text style={styles.title}>{targetName}</Text>

              <TouchableOpacity style={styles.option} onPress={() => setStep('report')}>
                <Text style={styles.optionIcon}>🚩</Text>
                <View>
                  <Text style={styles.optionText}>Report</Text>
                  <Text style={styles.optionSubtext}>Report inappropriate behavior</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.option} onPress={handleBlock} disabled={loading}>
                <Text style={styles.optionIcon}>🚫</Text>
                <View>
                  <Text style={[styles.optionText, { color: COLORS.error }]}>Block</Text>
                  <Text style={styles.optionSubtext}>Block and remove from your feed</Text>
                </View>
                {loading && <ActivityIndicator color={COLORS.error} style={{ marginLeft: 'auto' }} />}
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.handle} />
              <Text style={styles.title}>Report {targetName}</Text>
              <Text style={styles.subtitle}>Why are you reporting this profile?</Text>

              <ScrollView style={styles.reasonList} showsVerticalScrollIndicator={false}>
                {REPORT_REASONS.map((reason) => (
                  <TouchableOpacity
                    key={reason.category}
                    style={[
                      styles.reasonRow,
                      selectedReason?.category === reason.category && styles.reasonRowSelected,
                    ]}
                    onPress={() => setSelectedReason(reason)}
                  >
                    <Text style={styles.reasonText}>{reason.label}</Text>
                    {selectedReason?.category === reason.category && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity
                style={[styles.submitBtn, !selectedReason && styles.submitBtnDisabled]}
                onPress={handleReport}
                disabled={!selectedReason || loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitText}>Submit Report</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelBtn} onPress={() => setStep('main')}>
                <Text style={styles.cancelText}>Back</Text>
              </TouchableOpacity>
            </>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 14,
  },
  optionIcon: { fontSize: 24 },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  optionSubtext: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  reasonList: { maxHeight: 320 },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: COLORS.background,
  },
  reasonRowSelected: {
    backgroundColor: `${COLORS.primary}22`,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  reasonText: { fontSize: 15, color: COLORS.text },
  checkmark: { fontSize: 16, color: COLORS.primary, fontWeight: '700' },
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  cancelBtn: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: { fontSize: 15, color: COLORS.textSecondary },
});
