export interface McpConfig {
  aegisApiUrl: string;
  aegisApiKey: string;
  aegisUserId: string;
  httpPort: number;
}

export function loadMcpConfig(): McpConfig {
  return {
    aegisApiUrl: process.env.AEGIS_API_URL ?? 'http://localhost:3000',
    aegisApiKey: process.env.AEGIS_API_KEY ?? 'aegis_demo_agent_key',
    aegisUserId: process.env.AEGIS_USER_ID ?? 'usr_demo',
    httpPort: Number(process.env.PORT ?? process.env.MCP_HTTP_PORT ?? 8080),
  };
}
