import { z } from 'zod';

export const requestActionSchema = z.object({
  idempotency_key: z.string().min(1).max(128),
  end_user_id: z.string().min(1).max(128),
  action_type: z.literal('payment'),
  details: z.object({
    amount: z.string().regex(/^\d+(\.\d{1,8})?$/),
    currency: z.string().min(1).max(10),
    recipient_name: z.string().min(1).max(200),
    description: z.string().min(1).max(500),
    payment_rail: z.enum(['card', 'crypto']),
    payment_method_preference: z.string().min(1).max(128),
    recipient_reference: z.string().min(1).max(500),
  }),
  callback_url: z.string().url().optional(),
  expires_at: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const webhookTestSchema = z.object({
  callback_url: z.string().url(),
});

export const cancelActionSchema = z.object({
  reason: z.string().max(200).optional(),
});
