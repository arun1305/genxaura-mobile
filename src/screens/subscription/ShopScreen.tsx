import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { subscriptionApi, PurchaseProof } from '../../services/api';
import { purchaseService, PRODUCT_IDS, showPurchaseError } from '../../services/purchaseService';

/**
 * Runs the store purchase, lets the backend verify + grant it, then finishes
 * the store transaction. Entitlements are never granted client-side.
 */
async function buy<T>(productId: string, grant: (proof: PurchaseProof) => Promise<T>): Promise<T> {
  const proof = await purchaseService.purchase(productId);
  const result = await grant({
    platform: proof.platform,
    receipt: proof.receipt,
    transactionId: proof.transactionId,
  });
  await proof.finish();
  return result;
}

interface Pack {
  quantity: number;
  priceCents: number;
  label: string;
  badge: string | null;
}

interface ShopData {
  superLikePacks: Pack[];
  rosePacks: Pack[];
  boostPriceCents: number;
  spotlightPriceCents: number;
}

export default function ShopScreen() {
  const [shop, setShop] = useState<ShopData | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const { status, purchaseSuperLikes, purchaseRoses, purchaseBoost, purchaseSpotlight, loadStatus } =
    useSubscriptionStore();

  useEffect(() => {
    loadShop();
  }, []);

  async function loadShop() {
    try {
      const { data } = await subscriptionApi.getShop();
      setShop(data.data);
    } catch {
      Alert.alert('Error', 'Failed to load shop.');
    } finally {
      setLoading(false);
    }
  }

  function formatPrice(cents: number) {
    return `$${(cents / 100).toFixed(2)}`;
  }

  async function handleBuySuperLikes(index: number, pack: Pack) {
    setPurchasing(`sl-${index}`);
    try {
      const { newBalance } = await buy(PRODUCT_IDS.superLikes(index), (proof) =>
        purchaseSuperLikes(index, proof),
      );
      Alert.alert('Success', `${pack.quantity} Super Likes added! Balance: ${newBalance}`);
    } catch (err) {
      showPurchaseError(err);
    } finally {
      setPurchasing(null);
    }
  }

  async function handleBuyRoses(index: number, pack: Pack) {
    setPurchasing(`r-${index}`);
    try {
      const { newBalance } = await buy(PRODUCT_IDS.roses(index), (proof) =>
        purchaseRoses(index, proof),
      );
      Alert.alert('Success', `${pack.quantity} Rose${pack.quantity > 1 ? 's' : ''} added! Balance: ${newBalance}`);
    } catch (err) {
      showPurchaseError(err);
    } finally {
      setPurchasing(null);
    }
  }

  async function handleBuyBoost() {
    setPurchasing('boost');
    try {
      await buy(PRODUCT_IDS.boost, (proof) => purchaseBoost(proof));
      loadStatus();
      Alert.alert('Boost Active!', 'You appear #1 in local stack for the next 30 minutes.');
    } catch (err) {
      showPurchaseError(err);
    } finally {
      setPurchasing(null);
    }
  }

  async function handleBuySpotlight() {
    setPurchasing('spotlight');
    try {
      await buy(PRODUCT_IDS.spotlight, (proof) => purchaseSpotlight(proof));
      loadStatus();
      Alert.alert('Spotlight Active!', 'You appear in Top Picks for the next 24 hours.');
    } catch (err) {
      showPurchaseError(err);
    } finally {
      setPurchasing(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#E8315B" />
      </View>
    );
  }

  if (!shop) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Balances */}
      <View style={styles.balanceRow}>
        <View style={styles.balanceItem}>
          <Text style={styles.balanceEmoji}>★</Text>
          <Text style={styles.balanceCount}>{status?.superLikesBalance ?? 0}</Text>
          <Text style={styles.balanceLabel}>Super Likes</Text>
        </View>
        <View style={styles.balanceItem}>
          <Text style={styles.balanceEmoji}>🌹</Text>
          <Text style={styles.balanceCount}>{status?.rosesBalance ?? 0}</Text>
          <Text style={styles.balanceLabel}>Roses</Text>
        </View>
      </View>

      {/* Boost */}
      <SectionHeader title="Boost" subtitle="Appear #1 in local stack for 30 min" />
      <TouchableOpacity
        style={[styles.singleCard, status?.isBoostActive && styles.activeCard]}
        onPress={handleBuyBoost}
        disabled={!!purchasing || !!status?.isBoostActive}
      >
        {purchasing === 'boost' ? (
          <ActivityIndicator color="#fff" />
        ) : status?.isBoostActive ? (
          <Text style={styles.activeText}>Boost Active</Text>
        ) : (
          <>
            <Text style={styles.singleCardEmoji}>⚡</Text>
            <Text style={styles.singleCardLabel}>Activate Boost</Text>
            <Text style={styles.singleCardPrice}>{formatPrice(shop.boostPriceCents)}</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Spotlight */}
      <SectionHeader title="Spotlight" subtitle="Featured in Top Picks for 24 hours" />
      <TouchableOpacity
        style={[styles.singleCard, status?.isSpotlightActive && styles.activeCard]}
        onPress={handleBuySpotlight}
        disabled={!!purchasing || !!status?.isSpotlightActive}
      >
        {purchasing === 'spotlight' ? (
          <ActivityIndicator color="#fff" />
        ) : status?.isSpotlightActive ? (
          <Text style={styles.activeText}>Spotlight Active</Text>
        ) : (
          <>
            <Text style={styles.singleCardEmoji}>✨</Text>
            <Text style={styles.singleCardLabel}>Activate Spotlight</Text>
            <Text style={styles.singleCardPrice}>{formatPrice(shop.spotlightPriceCents)}</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Super Like Packs */}
      <SectionHeader title="Super Like Packs" subtitle="Stand out with a Super Like" />
      <View style={styles.packRow}>
        {shop.superLikePacks.map((pack, i) => (
          <PackCard
            key={i}
            emoji="★"
            emojiColor="#00B4D8"
            pack={pack}
            price={formatPrice(pack.priceCents)}
            loading={purchasing === `sl-${i}`}
            onPress={() => handleBuySuperLikes(i, pack)}
            disabled={!!purchasing}
          />
        ))}
      </View>

      {/* Rose Packs */}
      <SectionHeader title="Rose Packs" subtitle="Send a premium rose to someone special" />
      <View style={styles.packRow}>
        {shop.rosePacks.map((pack, i) => (
          <PackCard
            key={i}
            emoji="🌹"
            emojiColor="#E8315B"
            pack={pack}
            price={formatPrice(pack.priceCents)}
            loading={purchasing === `r-${i}`}
            onPress={() => handleBuyRoses(i, pack)}
            disabled={!!purchasing}
          />
        ))}
      </View>
    </ScrollView>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
    </View>
  );
}

function PackCard({
  emoji,
  emojiColor,
  pack,
  price,
  loading,
  onPress,
  disabled,
}: {
  emoji: string;
  emojiColor: string;
  pack: Pack;
  price: string;
  loading: boolean;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.packCard, pack.badge === 'BEST VALUE' && styles.bestValue]}
      onPress={onPress}
      disabled={disabled}
    >
      {pack.badge && <Text style={styles.badge}>{pack.badge}</Text>}
      <Text style={[styles.packEmoji, { color: emojiColor }]}>{emoji}</Text>
      <Text style={styles.packQuantity}>{pack.quantity}</Text>
      <Text style={styles.packLabel}>{pack.label}</Text>
      {loading ? (
        <ActivityIndicator color="#E8315B" size="small" style={{ marginTop: 8 }} />
      ) : (
        <Text style={styles.packPrice}>{price}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0D0D0D' },

  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    marginBottom: 24,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
  },
  balanceItem: { alignItems: 'center', gap: 4 },
  balanceEmoji: { fontSize: 28 },
  balanceCount: { fontSize: 24, fontWeight: '700', color: '#FFFFFF' },
  balanceLabel: { fontSize: 12, color: '#999', fontWeight: '500' },

  sectionHeader: { marginTop: 24, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  sectionSubtitle: { fontSize: 13, color: '#999', marginTop: 2 },

  singleCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  activeCard: { borderColor: '#E8315B', backgroundColor: '#2A0A12' },
  singleCardEmoji: { fontSize: 24 },
  singleCardLabel: { flex: 1, fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  singleCardPrice: { fontSize: 16, fontWeight: '700', color: '#E8315B' },
  activeText: { fontSize: 16, fontWeight: '600', color: '#E8315B' },

  packRow: { flexDirection: 'row', gap: 12 },
  packCard: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    position: 'relative',
  },
  bestValue: { borderColor: '#E8315B' },
  badge: {
    position: 'absolute',
    top: -10,
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    backgroundColor: '#E8315B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  packEmoji: { fontSize: 28, marginBottom: 4 },
  packQuantity: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  packLabel: { fontSize: 11, color: '#999', textAlign: 'center', marginTop: 2 },
  packPrice: { fontSize: 14, fontWeight: '700', color: '#E8315B', marginTop: 8 },
});
