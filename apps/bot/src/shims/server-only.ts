// Shim for the `server-only` package imported by apps/web/lib/db/queries.ts.
// The package only throws when bundled into a client graph; apps/bot is
// server-only by construction, so an empty module is correct here.
export {};
