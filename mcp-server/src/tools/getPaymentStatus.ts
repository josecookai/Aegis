import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AegisClient } from '../client.js';

export function registerGetPaymentStatus(server: McpServer, client: AegisClient) {
  server.tool(
    'aegis_get_payment_status',
    'Check the current status of a payment request. Use this to poll after requesting a payment.',
    {
      action_id: z.string().describe('The action_id returned by aegis_request_payment'),
    },
    async (params) => {
      try {
        const result = await client.getStatus(params.action_id);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result.action, null, 2),
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
