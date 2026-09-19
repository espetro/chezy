// Pins the SLNG agent to the region/orchestrator pair that owns the
// chezy-vonage LiveKit project, then prints the resulting state. Run via
// `mise run slng:agent:sync` (loads apps/web/.env.local via --env-file).
import { ensureSlngAgentPinned } from "~/lib/slng";

const state = await ensureSlngAgentPinned();
console.log(JSON.stringify(state, null, 2));

if (state.sipOutboundTrunkId === null) {
  console.error(
    "SLNG agent has no outbound SIP trunk attached; attach a connection in the SLNG dashboard (Telephony -> Outbound)",
  );
  process.exit(1);
}
