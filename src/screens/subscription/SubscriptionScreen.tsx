import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { purchaseService, PRODUCT_IDS, showPurchaseError } from '../../services/purchaseService';
import { COLORS } from '../../constants';

const GOLD_COLOR = '#F5C518';
const PLATINUM_COLOR = '#E5E4E2';

const GOLD_FEATURES = [
  { icon: '♾️', text: 'Unlimited Likes' },
  { icon: '👀', text: 'See Who Liked You' },
  { icon: '⭐', text: '5 Super Likes per day' },
  { icon: '🚀', text: '1 Boost per month (30 min top)' },
  { icon: '🌍', text: 'Passport — Swipe in any city' },
  { icon: '🚫', text: 'No Ads' },
  { icon: '↩', text: '1 Free Rewind per day' },
];

const PLATINUM_FEATURES = [
  { icon: '✨', text: 'All Gold features' },
  { icon: '💌', text: 'Message before matching' },
  { icon: '⚡', text: 'Priority Likes — shown first' },
  { icon: '🔍', text: 'Advanced filters (height, lifestyle)' },
  { icon: '🕵️', text: 'Incognito Mode' },
  { icon: '🚀', text: '5 Boosts per month' },
  { icon: '⭐', text: 'Unlimited Super Likes' },
];

type Plan = 'gold' | 'platinum';
type Duration = 1 | 3 | 12;

const PRICES: Record<Plan, Record<Duration, string>> = {
  gold:     { 1: '$9.99/mo', 3: '$7.99/mo', 12: '$4.99/mo' },
  platinum: { 1: '$19.99/mo', 3: '$16.99/mo', 12: '$9.99/mo' },
};

export default function SubscriptionScreen() {
  const navigation = useNavigation<any>();
  const { status, loadStatus, activateSubscription } = useSubscriptionStore();
  const [selectedPlan, setSelectedPlan] = useState<Plan>('gold');
  const [selectedDuration, setSelectedDuration] = useState<Duration>(1);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  const handleSubscribe = async () => {
    setPurchasing(true);
    try {
      // 1. Store purchase (throws if IAP is not configured — no fake receipts).
      const proof = await purchaseService.purchase(
        PRODUCT_IDS.subscription(selectedPlan, selectedDuration),
      );
      // 2. Backend verifies the receipt and grants the entitlement (402/409 on failure).
      const durationDays = selectedDuration * 30;
      await activateSubscription(selectedPlan, durationDays, {
        platform: proof.platform,
        receipt: proof.receipt,
        transactionId: proof.transactionId,
      });
      await proof.finish();
      Alert.alert(
        '🎉 Welcome to GenXAura ' + (selectedPlan === 'platinum' ? 'Platinum' : 'Gold') + '!',
        'Your subscription is now active.',
        [{ text: 'Get Started', onPress: () => navigation.goBack() }],
      );
    } catch (err) {
      showPurchaseError(err);
    } finally {
      setPurchasing(false);
    }
  };

  const currentTier = status?.tier || 'free';
  const isActive = currentTier !== 'free';
  const isCurrentPlan = (plan: Plan) => currentTier === plan;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Hero */}
        <LinearGradient colors={['#FF4458', '#C850C0']} style={styles.hero}>
          <Text style={styles.heroEmoji}>💫</Text>
          <Text style={styles.heroTitle}>Upgrade GenXAura</Text>
          <Text style={styles.heroSubtitle}>
            {isActive
              ? `You're on ${currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}`
              : 'Find more connections, faster'}
          </Text>
        </LinearGradient>

        {/* Plan Selector */}
        <View style={styles.planRow}>
          <TouchableOpacity
            style={[styles.planTab, selectedPlan === 'gold' && styles.planTabGold]}
            onPress={() => setSelectedPlan('gold')}
          >
            <Text style={[styles.planTabText, selectedPlan === 'gold' && { color: GOLD_COLOR }]}>
              ⭐ Gold
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.planTab, selectedPlan === 'platinum' && styles.planTabPlatinum]}
            onPress={() => setSelectedPlan('platinum')}
          >
            <Text style={[styles.planTabText, selectedPlan === 'platinum' && { color: PLATINUM_COLOR }]}>
              💎 Platinum
            </Text>
          </TouchableOpacity>
        </View>

        {/* Duration Selector */}
        <View style={styles.durationRow}>
          {([1, 3, 12] as Duration[]).map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.durationBtn, selectedDuration === d && styles.durationBtnActive]}
              onPress={() => setSelectedDuration(d)}
            >
              <Text style={[styles.durationLabel, selectedDuration === d && styles.durationLabelActive]}>
                {d === 1 ? '1 Month' : d === 3 ? '3 Months' : '12 Months'}
              </Text>
              <Text style={[styles.durationPrice, selectedDuration === d && styles.durationPriceActive]}>
                {PRICES[selectedPlan][d]}
              </Text>
              {d === 12 && (
                <View style={styles.saveBadge}>
                  <Text style={styles.saveBadgeText}>SAVE 50%</Text>
                </View>
              )}
              {d === 3 && (
                <View style={[styles.saveBadge, { backgroundColor: '#4CAF50' }]}>
                  <Text style={styles.saveBadgeText}>POPULAR</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Features */}
        <View style={styles.featuresCard}>
          <Text style={[styles.featuresTitle, { color: selectedPlan === 'gold' ? GOLD_COLOR : PLATINUM_COLOR }]}>
            {selectedPlan === 'gold' ? '⭐ Gold Features' : '💎 Platinum Features'}
          </Text>
          {(selectedPlan === 'gold' ? GOLD_FEATURES : PLATINUM_FEATURES).map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        {/* Free tier reminder */}
        <View style={styles.freeCard}>
          <Text style={styles.freeTitle}>Free Plan</Text>
          <Text style={styles.freeText}>• 100 right-swipes per 12 hours</Text>
          <Text style={styles.freeText}>• 1 Super Like per day</Text>
          <Text style={styles.freeText}>• 1 Rewind per day</Text>
          <Text style={styles.freeText}>• Ads displayed between cards</Text>
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[
            styles.ctaBtn,
            { backgroundColor: selectedPlan === 'platinum' ? '#9B59B6' : GOLD_COLOR },
            isCurrentPlan(selectedPlan) && styles.ctaBtnDisabled,
          ]}
          onPress={handleSubscribe}
          disabled={purchasing || isCurrentPlan(selectedPlan)}
        >
          {purchasing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>
              {isCurrentPlan(selectedPlan)
                ? 'Current Plan'
                : `Get ${selectedPlan === 'platinum' ? 'Platinum' : 'Gold'} — ${PRICES[selectedPlan][selectedDuration]}`}
            </Text>
          )}
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Subscriptions auto-renew unless cancelled. Cancel anytime in App Store / Google Play settings.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingBottom: 40 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    alignItems: 'flex-end',
  },
  closeBtn: { padding: 8 },
  closeIcon: { fontSize: 18, color: COLORS.textMuted },
  hero: {
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  heroEmoji: { fontSize: 48, marginBottom: 4 },
  heroTitle: { fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: 0.3 },
  heroSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
  planRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
  },
  planTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  planTabGold: { backgroundColor: `${GOLD_COLOR}22` },
  planTabPlatinum: { backgroundColor: `${PLATINUM_COLOR}18` },
  planTabText: { fontSize: 15, fontWeight: '700', color: COLORS.textMuted },
  durationRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    gap: 8,
    marginBottom: 20,
  },
  durationBtn: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    position: 'relative',
  },
  durationBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}15`,
  },
  durationLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },
  durationLabelActive: { color: COLORS.primary },
  durationPrice: { fontSize: 13, fontWeight: '800', color: COLORS.textSecondary, marginTop: 2 },
  durationPriceActive: { color: COLORS.text },
  saveBadge: {
    position: 'absolute',
    top: -8,
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  saveBadgeText: { fontSize: 8, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  featuresCard: {
    marginHorizontal: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    gap: 14,
    marginBottom: 16,
  },
  featuresTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  featureText: { fontSize: 14, color: COLORS.text, flex: 1, lineHeight: 20 },
  freeCard: {
    marginHorizontal: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    gap: 6,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  freeTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textMuted, marginBottom: 4 },
  freeText: { fontSize: 13, color: COLORS.textMuted },
  ctaBtn: {
    marginHorizontal: 16,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  ctaBtnDisabled: { opacity: 0.5 },
  ctaText: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  disclaimer: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 16,
  },
});
