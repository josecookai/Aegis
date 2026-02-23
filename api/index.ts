/**
 * Vercel Serverless entry point.
 * Exports the Express app for Vercel's Node.js runtime.
 * Workers are disabled on Vercel; use Vercel Cron to hit /api/cron/tick.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createAegisApp } = require('../dist/src/app');
const runtime = createAegisApp();
module.exports = runtime.app;
