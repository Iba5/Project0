// Minimal helper: generate an Idempotency-Key and attach to payment initiation
import { apiUrl } from './api-client'

export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback UUID v4 simple implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function initiatePaymentWithIdempotency(body: any, idempotencyKey: string) {
  const res = await fetch(apiUrl('/payments/initiate'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(body),
    credentials: 'include', // Important for sending httpOnly cookies
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.detail || data?.error || 'Payment initiation failed');
  }

  return res.json();
}
