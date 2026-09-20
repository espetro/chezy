// Preload for node --import=tsx eval scripts: stub out the `server-only`
// package, which throws outside a React Server Components bundle but is
// imported by server modules like lib/db/queries.ts.
const Module = require("node:module");

try {
  const path = require.resolve("server-only");
  const stub = new Module(path);
  stub.exports = {};
  stub.loaded = true;
  require.cache[path] = stub;
} catch {
  // server-only not resolvable; nothing to stub.
}
