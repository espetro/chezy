# Plan: voice agent, telephony, and calendar (2026-09-19)

> Status: draft, pending human review. Companion to `2026-09-19-layer0.md`.

## Target call flow

```
apps/web /api/viewing
  │  POST https://api.agents.slng.ai/v1/agents/$AGENT_ID/calls
  │       { "phone_number": "+34...", "arguments": { property_ref, slot_hint } }
  ▼
SLNG managed agent (authored with unmute, target: slng)
  │  tool call: book_viewing
  ▼
SLNG org tool (API Request)  ──HTTPS──▶  apps/web /api/calendar  ──▶  Google Calendar
  │                                              │
  │ outbound SIP (SLNG Manual connection)        └─ returns { status, slotIso, eventId }
  ▼
Vonage SIP trunk ──▶ PSTN ──▶ agency (or a controlled test number)
```

The UI polls/receives the booked `slotIso` and fires the calendar toast.

## Decisions

### 1. Vonage telephony: yes, via SLNG Manual connection

Verified: SLNG reaches the phone network through a **connection**, a SIP link
between your carrier and SLNG. You bring your own numbers; they do not come from
SLNG. The wizard has a **Twilio** guided mode and a **Manual** mode for "another
carrier, or Twilio without the guided flow". An outbound connection takes
termination host, caller ID pool (E.164), transport (Auto/UDP/TCP/TLS), and SIP
credentials.

**Two directions, do not mix them up:**

- **Inbound** (someone dials your number): Vonage number settings -> Voice ->
  **Forward to SIP** -> a SIP URI. That URI is YOUR endpoint, supplied by
  whatever terminates the call (for SLNG, the SIP forwarding target from an
  *inbound* connection). This is the screen in the Vonage number dialog, and it
  is **not** needed for outbound. The SIP values flow *into* Vonage here, not out
  of it.
- **Outbound** (the agent dials the agency): there is no Vonage number setting
  for this. You need a SIP **termination** endpoint from Vonage, then paste it
  into SLNG's outbound connection. The SIP values flow Vonage -> SLNG.

Setup (outbound):

1. In Vonage, open the **SIP Trunking dashboard** (`https://dashboard.nexmo.com/sip-trunking`).
   Vonage SIP Trunking "seamlessly enable[s] both inbound and outbound calls from
   your SIP infrastructure".
2. Provision a **Programmable SIP domain** (dashboard, or `POST` to the
   Programmable SIP API, `/api/psip#createDomain`) and create **SIP credentials**
   (username/password).
3. Attach the US number (`+1...`) to the domain as caller ID, and enable
   international outbound (the call terminates in Spain).
4. In the SLNG dashboard, **Telephony -> Outbound -> Add connection -> Manual**:
   termination host = the Vonage domain host, caller ID pool = the `+1` number,
   transport Auto/TLS, credentials = the Vonage SIP username/password.
5. Attach the connection to the agent.

Caveat: the exact termination host string and credential shape are per-domain and
not verified against a live Vonage account here; read them off the SIP Trunking
dashboard. If provisioning stalls past ~30 minutes, fall back to the SLNG Twilio
guided mode; the agent and the calendar tool are unchanged, only the carrier
connection differs.

Note: connection management is dashboard-only (the SLNG public API cannot create
connections) and the Telephony section is admin-only, so one teammate with SLNG
admin has to do this.

### 2. unmute + SLNG for the agent

Verified: unmute is a declarative voice-agent standard that compiles to exactly
three targets, **Pipecat, LiveKit (code), and SLNG (hosted)**. `unmute deploy
my-agent --target slng` creates a managed SLNG agent; there is no `unmute dev`
for that target.

Two constraints that shape the design:

- On the `slng` target, **unmute creates no tool from the package**: a `local:`
  or `webhook:` block is refused. Tools must already exist in the SLNG org and
  be referenced by name (`slng:`), or use hosted/MCP tools.
- unmute's phone-route carriers are `twilio | telnyx | plivo`. Vonage is not in
  that list.

Neither blocks us, because telephony lives in the SLNG connection (decision 1),
not in unmute. Use unmute to author the prompt, greeting, variables, and models,
then deploy to `slng`. Extra credit: the SLNG hackathon track explicitly awards
points for building on unmute.ai.

### 3. Google Calendar lives on our side

Verified: SLNG's built-in **Templates** include **Create calendar event**, but it
is a *preconfigured API Request tool*: "You provide the HTTPS endpoint." There is
no native Google Calendar sync in SLNG. So the calendar integration lives in
`apps/web`:

- `app/api/calendar/route.ts` writes the event and returns `{ status, slotIso, eventId }`.
- The SLNG **API Request** tool points at that endpoint, with a bearer secret
  stored in the SLNG Vault, and an input schema `{ property_ref, slot_iso, agency_phone }`.
- Fallback option if endpoint wiring is slow: attach a Google Calendar MCP server
  to the agent (SLNG supports MCP over Streamable HTTP/SSE). More moving parts;
  prefer the API Request tool.

Because SLNG must reach the endpoint, the web app has to be **deployed (Vercel)
or tunneled** before the tool works. That is a hard prerequisite, not a nice to
have.

Google Calendar auth: use a **service account** with a calendar shared to it.
No OAuth consent screen, no refresh-token dance. Insert an event and return its
id. Keep a `mock` mode returning a fixed `slotIso` so the demo never blocks.

### 4. Trigger and correlation

Layer 0 swiping right on Card 2 calls `/api/viewing`, which dispatches:

```bash
curl -X POST https://api.agents.slng.ai/v1/agents/$AGENT_ID/calls \
  -H "Authorization: Bearer $SLNG_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "phone_number": "+34...", "arguments": { "property_ref": "..." } }'
```

The response returns a `call_id` at dispatch time (not on answer). Persist it to
correlate the call with the booking the calendar tool returns.

## Verified results (2026-09-19)

Live test, no public URL and no SIP trunk required:

- Auth: API key `7d65cf34` + the rotated secret -> balance EUR 19.34, one US number
  `+12012556040` (VOICE/MMS/SMS), one pre-existing app `all-hands`.
- Created a dedicated Voice app: `chezy-hackathon` (`aeb6d097-d788-43df-b9f6-d2e612873cd9`).
  Private key at `~/.vonage/chezy-hackathon.key` (0600). ID and path are in
  `apps/web/.env.local` (gitignored).
- JWT claims that work: `{ application_id, iat, jti, exp }`, RS256. Not `iss`/`sub`.
- `POST https://api.nexmo.com/v1/calls` accepts an **inline `ncco`**, so there is no
  `answer_url` to host. The inline validator allows only
  `record, conversation, connect, talk, stream, input, notify, wait, transfer`;
  `hangup` is rejected inline.
- Test call `from +12012556040` to `+34654808087`: **answered, completed, 9s,
  price EUR 0.0145, rate ~EUR 0.097/min** (call uuid `fcdf9aa7-94cb-4c39-ac66-bd8abe671660`).

### SLNG agent region / orchestrator (verified)

SLNG resolves the agent's LiveKit project from the pair **(region, orchestrator)**.
Valid agent regions are only:

| Region | Location |
| ------ | -------- |
| `eu-central` | Frankfurt (Europe) |
| `us-east` | Ashburn (United States) |
| `ap-south` | Mumbai (Asia) |

`us-west` / `eu-north` / `eu-west` / `gb` / `br` / `il` / `za` are
inference-platform `X-Region-Override` regions, **not** agent regions.

- `pipecat` has no `eu-central` deployment: PATCH `{"region":"eu-central"}` with
  `orchestrator: pipecat` returns 404
  `{"error":{"code":"AGENT_NOT_FOUND","message":"No default LiveKit deployment configured for region 'eu-central' and orchestrator 'pipecat'"}}`.
  PATCHing `region` + `orchestrator` together succeeds.
- Agent `housy` had drifted to `eu-west`/`pipecat` (no LiveKit deployment, so no
  SIP trunk could attach). It is now pinned to `eu-central`/`livekit` ->
  `livekit_deployment: default-eu`, with connection `chezy-vonage`
  (`sip_outbound_trunk_id` `80ec46a8-90ce-420e-b405-8e932020dc7b`, LiveKit trunk
  `ST_oVjMBnab8c5B`, caller ID `+12012556040`) attached.
- The pin is enforced in code: `ensureSlngAgentPinned()` in `apps/web/lib/slng.ts`
  GETs the agent and PATCHes `region`/`orchestrator` when they drift, before every
  `dispatchSlngCall`; `mise run slng:agent:sync` runs the same check standalone.

### Revised preferred architecture (Option B)

Because the Voice API leg is proven and needs no trunk, prefer it over Vonage SIP
termination:

```
/api/viewing
  │ POST api.nexmo.com/v1/calls  { from: +12012556040, to: agency,
  │      ncco: [ { action: "connect", endpoint: [ { type: "sip", uri: "sip:<SLNG target>" } ] } ] }
  ▼
Vonage PSTN leg ── agency answers ── audio bridged over SIP ──▶ SLNG agent
                                                                     │ tool: book_viewing
                                                                     ▼
                                                          /api/calendar ──▶ Google Calendar
```

This flips SLNG to an **inbound** connection: in the SLNG dashboard create an
inbound connection in **Manual** mode, which generates the SIP forwarding target,
and attach it to the agent. Vonage then `connect`s the answered PSTN call to that
target. The old build-speak-now code used exactly this `connect` + `type: sip`
pattern (to `sip.rtc.elevenlabs.io`), so it is a known-good shape.

Keep Option A (SLNG Manual outbound connection with a Vonage SIP trunk) only if
SLNG inbound SIP forwarding turns out to be restricted.

### Calendar asset already available

`~/Desktop/build-speak-now/backend/aletheia-auth-3b4fdf6ebe2d.json` is a Google
Cloud **service account** key (`hackathon@aletheia-auth...`, project
`aletheia-auth`). If a calendar is shared to that service account, `/api/calendar`
can insert events with no OAuth consent flow. Verify the account still exists.

## Demo safety

- Call a **controlled Spanish number** (a teammate's phone), not a live agency.
  A real agency call is a bonus, never the demo path.
- Keep a recorded fallback of the whole call and a `mock` booking.
- Spanish language, EU AI Act Article 50: disclose that it is an AI assistant.
- Attach SLNG built-in **Current date and time** (Europe/Madrid) so the agent
  proposes valid slots.

## Cost note

A US Vonage number is cheap (~$1/month) plus per-minute international outbound
to Spain. Fine for a demo. If the agency answering rate matters, a Spanish
number looks local, but a US number is what was asked for.

## Prize note

The Vonage hackathon track requires the **Vonage Video API**, not voice. Using
Vonage for telephony does not win that track. If a Vonage prize matters, add a
small Video API surface separately; otherwise treat Vonage here as telephony
plumbing, not a prize play.

## Open questions

- ~~Which teammate holds SLNG org admin to create the connection?~~ Done — the
  `chezy-vonage` connection exists and is attached to `housy` (see "SLNG agent
  region / orchestrator (verified)").
- Service account vs OAuth for Google Calendar (recommend service account).
- Deploy to Vercel today, or tunnel for tonight and deploy before the demo?
