import { withBotId } from "botid/next/config";
import type { NextConfig } from "next";

const basePath = process.env.IS_DEMO === "1" ? "/demo" : "";

// /flow was the prototype prefix; the routes now live at the root. Keep the
// designer's bookmarks working.
const flowRedirects = [
  { source: "/flow", destination: "/", permanent: false },
  { source: "/flow/onboarding", destination: "/onboarding", permanent: false },
  { source: "/flow/explore", destination: "/explore", permanent: false },
  { source: "/flow/explore/:id", destination: "/explore/:id", permanent: false },
];

const nextConfig: NextConfig = {
  ...(basePath
    ? {
        assetPrefix: "/demo-assets",
        basePath,
      }
    : {}),
  cacheComponents: true,
  devIndicators: false,
  redirects: async () => [
    ...(basePath
      ? [
          {
            basePath: false as const,
            destination: basePath,
            permanent: false,
            source: "/",
          },
        ]
      : []),
    ...flowRedirects,
  ],
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  experimental: {
    appNewScrollHandler: true,
    cachedNavigations: true,
    inlineCss: true,
    prefetchInlining: true,
    turbopackFileSystemCacheForDev: true,
  },
  images: {
    remotePatterns: [
      {
        hostname: "avatar.vercel.sh",
      },
      {
        hostname: "*.public.blob.vercel-storage.com",
        protocol: "https",
      },
    ],
  },
  logging: {
    fetches: {
      fullUrl: false,
    },
    incomingRequests: false,
  },
  poweredByHeader: false,
  reactCompiler: true,
  transpilePackages: ["@chezy/contract", "@chezy/observability", "@chezy/ui"],
};

export default withBotId(nextConfig);
