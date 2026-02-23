#!/usr/bin/env node

/**
 * Streamable HTTP transport for remote AI agents (Manus, OpenClaw, etc.).
 * Exposes the same MCP tools as the STDIO entry point, but over HTTP.
 */

import express from 'express';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { loadMcpConfig } from './config.js';
import { AegisClient } from './client.js';
import { registerRequestPayment } from './tools/requestPayment.js';
import { registerGetPaymentStatus } from './tools/getPaymentStatus.js';
import { registerCancelPayment } from './tools/cancelPayment.js';
import { registerListCapabilities } from './tools/listCapabilities.js';

const config = loadMcpConfig();
const client = new AegisClient(config.aegisApiUrl, config.aegisApiKey, config.aegisUserId);

const app = express();
app.use(express.json());

const sessions = new Map<string, { transport: StreamableHTTPServerTransport; server: McpServer }>();

function createSession(): { transport: StreamableHTTPServerTransport; server: McpServer } {
  const server = new McpServer({ name: 'aegis-payment', version: '1.0.0' });
  registerRequestPayment(server, client);
  registerGetPaymentStatus(server, client);
  registerCancelPayment(server, client);
  registerListCapabilities(server, client);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  server.connect(transport);
  return { transport, server };
}

app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  let session: { transport: StreamableHTTPServerTransport; server: McpServer };

  if (sessionId && sessions.has(sessionId)) {
    session = sessions.get(sessionId)!;
  } else {
    session = createSession();
    session.transport.onclose = () => {
      const sid = (session.transport as any).sessionId as string | undefined;
      if (sid) sessions.delete(sid);
    };
  }

  await session.transport.handleRequest(req, res, req.body);

  const newSid = (session.transport as any).sessionId as string | undefined;
  if (newSid && !sessions.has(newSid)) {
    sessions.set(newSid, session);
  }
});

app.get('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId || !sessions.has(sessionId)) {
    res.status(400).json({ error: 'Invalid or missing session ID' });
    return;
  }
  const session = sessions.get(sessionId)!;
  await session.transport.handleRequest(req, res);
});

app.delete('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId || !sessions.has(sessionId)) {
    res.status(400).json({ error: 'Invalid or missing session ID' });
    return;
  }
  const session = sessions.get(sessionId)!;
  await session.transport.handleRequest(req, res);
  sessions.delete(sessionId);
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', sessions: sessions.size });
});

app.listen(config.httpPort, () => {
  console.log(`Aegis MCP HTTP server running on http://localhost:${config.httpPort}/mcp`);
  console.log(`Aegis API target: ${config.aegisApiUrl}`);
});
