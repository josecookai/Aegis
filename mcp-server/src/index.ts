#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadMcpConfig } from './config.js';
import { AegisClient } from './client.js';
import { registerRequestPayment } from './tools/requestPayment.js';
import { registerGetPaymentStatus } from './tools/getPaymentStatus.js';
import { registerCancelPayment } from './tools/cancelPayment.js';
import { registerListCapabilities } from './tools/listCapabilities.js';

const config = loadMcpConfig();
const client = new AegisClient(config.aegisApiUrl, config.aegisApiKey, config.aegisUserId);

const server = new McpServer({
  name: 'aegis-payment',
  version: '1.0.0',
});

registerRequestPayment(server, client);
registerGetPaymentStatus(server, client);
registerCancelPayment(server, client);
registerListCapabilities(server, client);

const transport = new StdioServerTransport();
await server.connect(transport);
