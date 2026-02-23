import { AegisClient } from '../sdk/typescript/src';

async function main(): Promise<void> {
  const baseUrl = process.env.AEGIS_BASE_URL ?? 'http://localhost:3000';
  const callbackUrl = process.env.AEGIS_CALLBACK_URL ?? `${baseUrl}/_test/callback`;
  const rail = (process.env.AEGIS_RAIL ?? 'card') as 'card' | 'crypto';

  const client = new AegisClient({
    baseUrl,
    apiKey: process.env.AEGIS_API_KEY ?? 'aegis_demo_agent_key',
  });

  const payload = rail === 'card'
    ? {
        idempotency_key: `demo-${Date.now()}`,
        end_user_id: 'usr_demo',
        action_type: 'payment' as const,
        callback_url: callbackUrl,
        details: {
          amount: '19.99',
          currency: 'USD',
          recipient_name: 'Demo Merchant API',
          description: 'Card rail demo charge',
          payment_rail: 'card' as const,
          payment_method_preference: 'card_default',
          recipient_reference: 'merchant_api:demo_store',
        },
        metadata: { source: 'examples/agent-demo.ts', rail: 'card' },
      }
    : {
        idempotency_key: `demo-${Date.now()}`,
        end_user_id: 'usr_demo',
        action_type: 'payment' as const,
        callback_url: callbackUrl,
        details: {
          amount: '25.00',
          currency: 'USDC',
          recipient_name: 'Demo Wallet',
          description: 'Crypto rail demo transfer',
          payment_rail: 'crypto' as const,
          payment_method_preference: 'crypto_default',
          recipient_reference: 'address:0x2222222222222222222222222222222222222222',
        },
        metadata: { source: 'examples/agent-demo.ts', rail: 'crypto' },
      };

  const result = await client.requestAction(payload);
  console.log(JSON.stringify(result, null, 2));
  console.log('Open approval URL:', result.links?.approval_url);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
