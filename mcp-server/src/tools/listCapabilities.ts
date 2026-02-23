import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AegisClient } from '../client.js';

export function registerListCapabilities(server: McpServer, client: AegisClient) {
  server.tool(
    'aegis_list_capabilities',
    'List the payment methods and rails available for the current user.',
    {},
    async () => {
      try {
        const result = await client.capabilities();
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
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
