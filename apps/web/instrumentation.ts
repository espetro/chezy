/**
 * Server boot hook. The audit sink writes files with `node:fs`, which the
 * Edge runtime rejects, so logging is configured only on the Node.js runtime.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { setupLogging } = await import("./lib/observability");
    await setupLogging();
  }
}
