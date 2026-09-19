import type { NextConfig } from "next";

const config: NextConfig = {
  // Day-0: keep the Next config minimal. The vercel/chatbot fork uses a
  // proxy.ts (replacing middleware.ts from older versions), typedRoutes,
  // and the AI SDK instrumentation hook. Add those in follow-up tickets.
  typedRoutes: true,
  reactCompiler: true,
  experimental: {
    // ppr is experimental but stable enough for the chatbot fork.
    ppr: false,
  },
};

export default config;
