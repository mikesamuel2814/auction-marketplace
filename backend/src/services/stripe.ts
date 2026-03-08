import Stripe from 'stripe';
import { config } from '../config';

export const stripe = new Stripe(config.stripe.secretKey, { apiVersion: '2025-02-24.acacia' });

const PLATFORM_FEE_PERCENT = config.platformFeePercent;

export async function createPaymentIntent(
  amountInSmallestUnit: number,
  currency: string,
  metadata: { orderId: string; buyerId: string }
): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.create({
    amount: amountInSmallestUnit,
    currency: currency.toLowerCase(),
    automatic_payment_methods: { enabled: true },
    metadata,
  });
}

export function calculatePlatformFee(amount: number): number {
  return Math.round(amount * (PLATFORM_FEE_PERCENT / 100));
}

export function calculateSellerAmount(amount: number): number {
  return amount - calculatePlatformFee(amount);
}
