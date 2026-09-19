import { setupLogging } from "~lib/observability";

export async function register(): Promise<void> {
  await setupLogging();
}
