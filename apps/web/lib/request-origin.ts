// Origin the browser actually used. `next start` builds `request.url` from its
// own bind address, so behind a TLS-terminating proxy (Tailscale serve, ngrok)
// the forwarded headers, then the Host header, are the source of truth.
function firstValue(header: string | null): string | undefined {
  return header?.split(",")[0]?.trim() || undefined;
}

export function requestOrigin(request: Request): string {
  const url = new URL(request.url);
  const host =
    firstValue(request.headers.get("x-forwarded-host")) ??
    firstValue(request.headers.get("host")) ??
    url.host;
  const proto = firstValue(request.headers.get("x-forwarded-proto")) ?? url.protocol.slice(0, -1);
  return `${proto}://${host}`;
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === requestOrigin(request);
}
