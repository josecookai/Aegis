# Aegis MVP SDK (TypeScript)

Minimal SDK for the Aegis MVP prototype.

```ts
import { AegisClient } from './src';

const client = new AegisClient({
  baseUrl: 'http://localhost:3000',
  apiKey: 'aegis_demo_agent_key',
});

const result = await client.requestAction({
  idempotency_key: 'demo-1',
  end_user_id: 'usr_demo',
  action_type: 'payment',
  callback_url: 'http://localhost:3000/_test/callback',
  details: {
    amount: '12.34',
    currency: 'USD',
    recipient_name: 'Demo Merchant',
    description: 'Test payment',
    payment_rail: 'card',
    payment_method_preference: 'card_default',
    recipient_reference: 'merchant_api:demo_merchant',
  },
});
```
