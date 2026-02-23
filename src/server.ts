import { createAegisApp } from './app';

const runtime = createAegisApp();

const server = runtime.app.listen(runtime.config.port, () => {
  console.log(`Aegis MVP server listening on ${runtime.config.baseUrl}`);
});

function shutdown(signal: string): void {
  console.log(`Received ${signal}, shutting down...`);
  server.close(() => {
    runtime.stop();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
