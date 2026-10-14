import { Alert, Platform } from 'react-native';
import { PurchaseProof, getApiErrorMessage, getErrorStatus } from './api';

/**
 * Store product identifiers. These must match the products configured in
 * App Store Connect / Google Play Console.
 */
export const PRODUCT_IDS = {
  subscription: (tier: 'gold' | 'platinum', months: 1 | 3 | 12) => `genxaura.${tier}.${months}m`,
  superLikes: (packIndex: number) => `genxaura.superlikes.pack${packIndex}`,
  roses: (packIndex: number) => `genxaura.roses.pack${packIndex}`,
  boost: 'genxaura.boost.single',
  spotlight: 'genxaura.spotlight.single',
} as const;

/** What a store purchase must yield so the backend can verify it. */
export interface StorePurchaseResult {
  receipt: string;
  transactionId: string;
}

/**
 * Pluggable in-app purchase implementation.
 *
 * TODO(iap): implement with react-native-iap or expo-iap, e.g.
 *   - init: initConnection()
 *   - purchase: requestPurchase / requestSubscription(productId)
 *     → iOS: { receipt: purchase.transactionReceipt, transactionId: purchase.transactionId }
 *     → Android: { receipt: purchase.purchaseToken, transactionId: purchase.transactionId ?? purchase.purchaseToken }
 *   - finish: finishTransaction(purchase) AFTER the backend has accepted it.
 * then call `setPurchaseProvider(provider)` once at app start.
 */
export interface PurchaseProvider {
  purchase(productId: string): Promise<StorePurchaseResult>;
  /** Called after the backend verified + granted the purchase (acknowledge / finish transaction). */
  finish?(result: StorePurchaseResult): Promise<void>;
}

export class PurchasesNotConfiguredError extends Error {
  constructor() {
    super('In-app purchases are not configured yet.');
    this.name = 'PurchasesNotConfiguredError';
  }
}

export class PurchaseCancelledError extends Error {
  constructor() {
    super('Purchase cancelled');
    this.name = 'PurchaseCancelledError';
  }
}

let provider: PurchaseProvider | null = null;

export function setPurchaseProvider(p: PurchaseProvider | null): void {
  provider = p;
}

export function isPurchasingAvailable(): boolean {
  return provider !== null && (Platform.OS === 'ios' || Platform.OS === 'android');
}

export const purchaseService = {
  /**
   * Runs the store purchase flow and returns the proof the backend needs.
   * Never fabricates receipts: throws PurchasesNotConfiguredError when no
   * IAP implementation is plugged in.
   */
  async purchase(productId: string): Promise<PurchaseProof & { finish: () => Promise<void> }> {
    if (!provider || (Platform.OS !== 'ios' && Platform.OS !== 'android')) {
      throw new PurchasesNotConfiguredError();
    }
    const result = await provider.purchase(productId);
    const p = provider;
    return {
      platform: Platform.OS,
      receipt: result.receipt,
      transactionId: result.transactionId,
      finish: async () => {
        await p.finish?.(result);
      },
    };
  },
};

/**
 * Shows a user-friendly alert for a failed purchase.
 * 402 → receipt could not be verified; 409 → transaction already used.
 */
export function showPurchaseError(err: unknown): void {
  if (err instanceof PurchaseCancelledError) return;
  if (err instanceof PurchasesNotConfiguredError) {
    Alert.alert(
      'Not available yet',
      'In-app purchases are not configured yet in this version of the app. You have not been charged.',
    );
    return;
  }
  const status = getErrorStatus(err);
  if (status === 402) {
    Alert.alert(
      'Purchase not verified',
      'We could not verify this purchase with the store, so nothing was added to your account. If you were charged, please contact support with your store receipt.',
    );
    return;
  }
  if (status === 409) {
    Alert.alert(
      'Already processed',
      'This purchase has already been applied to an account. If something looks wrong, please contact support.',
    );
    return;
  }
  Alert.alert('Purchase failed', getApiErrorMessage(err, 'Please try again.'));
}
