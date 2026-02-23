import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AegisClient } from '../client.js';

export function registerCancelPayment(server: McpServer, client: AegisClient) {
  server.tool(
    'aegis_cancel_payment',
    'Cancel a pending payment request that has not yet been executed.',
    {
      action_id: z.string().describe('The action_id of the payment to cancel'),
      reason: z.string().optional().describe('Optional cancellation reason'),
    },
    async (params) => {
      try {
        const result = await client.cancel(params.action_id, params.reason);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  action_id: result.action.action_id,
                  status: result.action.status,
                  message: 'Payment has been cancelled.',
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
