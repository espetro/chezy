import { OpenTelemetry } from "@ai-sdk/otel";
import { registerOTel } from "@vercel/otel";
import { registerTelemetry } from "ai";

export async function register() {
  registerOTel({ serviceName: "chatbot" });
  registerTelemetry(new OpenTelemetry());
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { configureLogger } = await import("@chezy/observability");
    await configureLogger({ service: "chezy-web" });
  }
}
