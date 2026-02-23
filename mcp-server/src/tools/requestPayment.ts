import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AegisClient } from '../client.js';

export function registerRequestPayment(server: McpServer, client: AegisClient) {
  server.tool(
    'aegis_request_payment',
    'Request a payment on behalf of the user. The payment requires user approval in the Aegis mobile app before execution.',
    {
      amount: z.string().describe('Payment amount, e.g. "20.00"'),
      currency: z.string().default('USD').describe('ISO 4217 currency code'),
      recipient_name: z.string().describe('Name of the payment recipient'),
      description: z.string().describe('Human-readable payment description'),
      payment_rail: z
        .enum(['card', 'crypto'])
        .default('card')
        .describe('Payment rail to use'),
    },
    async (params) => {
      try {
        const result = await client.requestPayment({
          amount: params.amount,
          currency: params.currency,
          recipient_name: params.recipient_name,
          description: params.description,
          payment_rail: params.payment_rail,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  action_id: result.action.action_id,
                  status: result.action.status,
                  approval_url: result.links?.approval_url,
                  message:
                    'Payment request created. The user must approve it in the Aegis app. Use aegis_get_payment_status to poll for updates.',
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err: unknown) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }],
          isError: true,
        };
      }
    },
  );
}
