# Onboarding to call happy path (designer UI, Stitch export)

> **Superseded 2026-09-19**: the `(agent)` routes described here (`/`, `/onboarding/*`,
> `/feed`, `/listing/[id]`) were retired; the product surface is now `app/(flow)` at `/`,
> `/onboarding`, `/explore`, `/explore/[id]`. Kept for history.

Branch `feat/chezy-0-onboarding-happy-path`, worktree `~/.worktrees/chezy-0/onboarding-happy-path`.
Source frames: `stitch_chezy_ai_rental_platform/*/{code.html,screen.png}` + `design.md` in the
main checkout (untracked; not copied into the repo).

## Happy path (demo script)

1. `/` landing (Tu agente autónomo de alquiler) → "Activar mi Agente" with barrio/email.
2. `/onboarding/preferences` (paso 1 de 2): work address, commute cap, barrios objetivo, budget
   range, dormitorios, m² mín, fecha mudanza, imprescindibles, líneas rojas, alerta.
   Live counter "N pisos coinciden" → "Guardar y Continuar".
3. `/onboarding/verify` (paso 3): DNI upload (mock), consent checkbox → "Activar Agente Autónomo".
4. `/feed`: ranked cards with `% MATCH IA`, `VERIFICADO CHEZY`, commute estimate, amenity tags,
   "Por qué este piso lidera tu ranking". Like → "Pedir a Chezy que reserve visita" →
   `POST /api/viewing` → SLNG agent calls `DEMO_AGENCY_PHONE` → card shows the pre-agendada slot.
5. `/listing/[id]`: gallery, facts, "Por qué encaja contigo", perfil del barrio (illustrative),
   CTAs "Chatear con Chezy" (→ `/chat?query=`) and "Solicitar visita".

Deferred: map screen (no map lib in repo), real geocoding/routing, real identity verification,
push/WhatsApp alerts, Casilla live widget (static copy only).

## Verified seams (Round 0)

- Chat lives at `/` via `app/(chat)/page.tsx` returning `null`; `app/(chat)/layout.tsx` always
  renders `ChatShell`. Moving chat to `/chat` = move the page file + retarget `router.push("/")`
  in `components/chat/app-sidebar.tsx:63,96`, `components/chat/multimodal-input.tsx:172,199,216`,
  and add `/chat` to `proxy.ts` matcher. `hooks/use-active-chat.tsx` derives chat id from
  `/chat/:id` and treats any other path as new chat, so `/chat` works unchanged.
- Guest session: `proxy.ts` redirects every unauthenticated path to `/api/auth/guest`, so new
  pages need no auth work; `auth()` from `app/(auth)/auth` yields `session.user.id`.
- Listings: `lib/db/schema.ts` `listing` (lat/lon on 200/300 rows, `amenities` jsonb string[],
  `publisherKind` = `professional` on most rentals, `neighbourhood`/`district` text).
  `lib/listings.ts` `searchListings` is the chat tool's ladder; not reused for the feed.
- Viewing: `app/api/viewing/route.ts` + `packages/contract/src/index.ts` `ViewingRequestSchema`
  requires `agencyPhone`; dataset has zero phone numbers. `lib/listings.ts`
  `listingToCallVariables` already feeds listing facts to the SLNG agent.
- Env: `lib/env.ts` is the Valibot env seam (`VIEWING_MODE` default `mock`).
- Migrations: `pnpm --filter @chezy/web db:generate` → `lib/db/migrations/000N_*.sql`;
  `db:migrate` applies. pg0 data dir is user-global, shared with the main checkout.
- Dataset amenities (rent rows): air_conditioning, elevator, equipped_kitchen, balcony,
  exterior, furnished, heating, terrace, pets_allowed, … `deposit` is null everywhere.

## Changes

### Data
- `lib/db/schema.ts`: `SearchProfile` table (one per user, `userId` unique FK → `User.id`):
  `workAddress text`, `workLat/workLon double`, `maxCommuteMin int`, `neighbourhoods jsonb
  string[]`, `minPriceEur/maxPriceEur int`, `minRooms int`, `minM2 int`, `moveDate text null`,
  `flexibleDays int default 0`, `mustHaves jsonb string[]`, `redLines jsonb string[]`,
  `alertsEnabled bool`, `verified bool default false`, `createdAt/updatedAt`.
- `packages/contract/src/profile.ts`: `SearchProfileInputSchema` (Valibot) with picklists:
  mustHaves ∈ {exterior (Luz natural), balcony_or_terrace, elevator, air_conditioning,
  furnished, pets_allowed, heating}; redLines ∈ {no_interior, no_high_deposit, no_flatmates}.
  Only `no_interior` is computable today (requires `exterior`); the other two are stored and
  displayed, not filtered. Re-export from `src/index.ts`.
- `ViewingRequestSchema.agencyPhone` becomes optional; the route falls back to
  `env.DEMO_AGENCY_PHONE` and 400s when neither is present. `.env.example` documents it.

### Domain (pure, tested)
- `lib/match.ts`: `scoreListing(profile, listing)` → `{ score 0..100, reasons: string[] (es),
  commuteMin?: number }`. Weights: budget 30 (in range full; over max loses 3 pts per 5 %
  over), barrio 25 (district-only match 15), must-haves 25 × coverage, rooms 10, m² 10.
  `estimateCommuteMin(a, b)` = haversine km × `COMMUTE_MIN_PER_KM` + `COMMUTE_OVERHEAD_MIN`
  (constants.ts, commented). `rankListings(profile, rows)` = filter red lines, score, dedupe
  (existing `dedupeListings`), sort desc.
- `lib/geocode.ts`: static Barcelona anchors (Diagonal 405/Pg. de Gràcia, Pl. Catalunya,
  Glòries/22@, Sants Estació, Sagrada Família, Pl. Espanya, Pg. de la Castellana → no match)
  matched by case/accent-insensitive substring; default anchor Diagonal 405 with
  `approximate: true`.
- `lib/neighbourhoods.ts`: static per-district profile (7 districts) `{ safety, commerce,
  noise, life, pois[] }`, labelled "datos ilustrativos" in the UI.
- `lib/listings.ts`: `listRentCandidates({ neighbourhoods?, maxPriceEur?, minRooms?, minM2? })`
  (limit 120, price ≤ max × 1.15 headroom so near-misses can still rank) and
  `listRentCandidateCount` for the live "N pisos coinciden" counter.
- `lib/profile.ts`: `getProfile(userId)`, `upsertProfile(userId, input)`, `markVerified`.

### Routes / pages (`app/(agent)/…`, mobile-first shell max-w 480 centred)
- `layout.tsx`: DM Sans via `next/font/google` (Cosmica substitute per design.md), canvas
  `#f4f4f5`, `lang="es"`.
- `page.tsx` (`/`): landing; CTA links to `/onboarding/preferences?barrio=…`.
- `onboarding/preferences/page.tsx`: client form → `PUT /api/profile`; counter via
  `GET /api/profile/count?…` (debounced on change, event-handler pattern, no useEffect).
- `onboarding/verify/page.tsx`: mock upload + consent → `PATCH /api/profile` `{ verified: true }`.
- `feed/page.tsx` (server): profile → candidates → `rankListings` → cards; bottom nav
  (Descubrir `/feed`, Mapa disabled "pronto", Casilla IA `/chat`, Perfil `/onboarding/preferences`).
  `components/agent/listing-card.tsx` (client) handles ✕ / ♥ / "Pedir a Chezy que reserve
  visita" → `POST /api/viewing { propertyRef }` → renders `slotIso` as "jueves 18:30" or the
  `failed` detail.
- `listing/[id]/page.tsx`: detail per frame.
- `api/profile/route.ts` (GET/PUT/PATCH, session-scoped), `api/profile/count/route.ts`.
- Chat relocation: `app/(chat)/page.tsx` → `app/(chat)/chat/page.tsx`; retarget pushes above.

### Design tokens
- `app/globals.css` `@theme`: add `--color-obsidian … --color-ember`, `--font-dm-sans`.
  Icons: `lucide-react` (already a dependency) instead of Material Symbols.

## Tests
- `lib/match.test.ts` (table-driven): budget tiers, must-have coverage, barrio vs district,
  red line `no_interior` drops interior rows, score ∈ [0,100], commute estimate monotone.
- `lib/geocode.test.ts`: anchor hit, accent-insensitive hit, miss → default approximate.
- `app/api/viewing/route.test.ts`: missing phone + no env → 400; env fallback used in mock mode.
- Existing `lib/listings.test.ts` stays green.

## Verification
- `pnpm --filter @chezy/web typecheck`, `pnpm --filter @chezy/web test`, `mise run validate:quick`.
- Manual: dev server in worktree on :3001, walk steps 1→5 with `VIEWING_MODE=mock`; one live
  SLNG call with `VIEWING_MODE=slng` during the demo pass.
