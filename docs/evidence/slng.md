# Evidence: SLNG challenge

Challenge (from [`docs/hackbarna.md`](../hackbarna.md)): **use SLNG at the core of the
project** through its STT API, TTS API, or a full voice agent. Show where SLNG fits in
the stack, include a live or recorded voice agent walkthrough, and real numbers for
latency, cost, or audio quality. Bonus for building on the unmute framework.

## Where SLNG sits in the stack

The outbound agency call (demo checkpoint 3) runs on a **managed SLNG voice agent**:
`apps/web/lib/slng.ts` (`dispatchSlngCall`, `ensureSlngAgentPinned`) drives the Voice
Agents API — it pins the agent to the `eu-central`/`livekit` pair, filters call
arguments against the agent's declared `template_variables`, then dispatches via
`POST /v1/agents/{id}/calls`. The agent spec is authored with **unmute** (bonus
criteria) and exported as `housy.agent.json`.

Pipeline per call: caller audio → `deepgram/nova:3` STT →
`bedrock-mantle/nvidia.nemotron-super-3-120b` LLM (SLNG context router) →
`cartesia/sonic:3.5` TTS (Spanish voice) → callee. All inside SLNG's execution layer on
`eu-central`.

## Live calls (2026-09-20, ~12:05 UTC)

Three dispatches to a controlled +34 number with a real Barcelona listing rendered into
the prompt (Eixample/Sagrada Família, 2 rooms, 55 m², €1,800/mo, ref 190867916).
Raw call records: [`slng/`](slng/) (JSON dumps, callee number masked).

| Call | ID | Result | Duration |
| --- | --- | --- | --- |
| 1 | `68cd8370-350c-4f2a-8873-275710bc5841` | `sip call failed` (carrier dropped after greeting) | 15.1s |
| 2 | `c8831c20-19bc-4bf5-bc72-6ff05e91f253` | **completed** — disclosure, flat named, manager confirmed, availability asked | 28.1s |
| 3 | `69b9aac1-1fa8-4bff-ae3c-379c3dab5d4c` | **completed** — full flow: disclosure → confirm → availability → slots offered | 58.6s |

### Transcript, call 3 (verbatim from `livekit_session_report`)

```
agent: Hola, buenas. Soy el asistente de inteligencia artificial de Jessie.
       Llamo por el piso de dos habitaciones en la Sagrada Família.
       ¿Hablo con la persona que lo gestiona?
human: sí claro soy yo
agent: Perfecto. Gracias. Le llamo para confirmar si el piso sigue
       disponible y para ver si podemos concertar una visita.
       ¿Aún está libre para alquiler?
human: sí la verdad es que ahora tiene alta utilización y tendría hueco
       esta semana todas las tardes, el jueves de cuatro a ocho de la tarde
agent: Gracias. [call ended — participant disconnected]
```

The agent hit every checkpoint of its brief: AI disclosure up front (EU AI Act art. 50),
identified the listing in natural speech, confirmed the property manager, asked
availability, and got a real slot offer (Thursday 16:00–20:00).

## Numbers

| Metric | Call 2 | Call 3 |
| --- | --- | --- |
| Duration | 28.1s | 58.6s |
| STT audio processed | 0.39 min | 0.93 min |
| TTS audio generated | 0.40 min (372 chars) | 0.36 min (320 chars) |
| LLM turns | 4 | 6 |
| Tool executions | 0 | 0 |

Reliability signal worth noting for judges: call 1 shows a SIP failure handled cleanly
(`call_end_reason: "sip call failed"`, structured `error_message`/`call_phase_metrics`
on the record) — the dispatch API returns `call_id` at dispatch time and the record
captures per-phase metrics, which is what `lib/slng.ts` consumes.

## Notes

- `VIEWING_MODE=slng` in the app exercises the same `dispatchSlngCall` path; the
  evidence above used the API directly with the same agent and template variables.
- The booking leg (`book_viewing` tool → `POST /api/calendar`) needs a public
  `APP_BASE_URL`; not exercised in these calls.
