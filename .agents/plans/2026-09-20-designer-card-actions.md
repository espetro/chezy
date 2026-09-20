# Plan: integrate the designer's card actions (PR #32) with the backend

Date: 2026-09-20. Branch `feat/chezy-0/designer-card-actions`.

## Goal

Land the UI from PR #32 (book / heart / X actions per candidate card, price on cards,
listing-detail header card, pill hairlines, flat primary button) without losing the
backend behaviour main already has: JES-8 persisted rejections and rerank, JES-11
truthful call states, JES-7 explanation-driven unknown handling.

## Decisions

- Merge #32 as a merge commit; resolve `CandidateCard.tsx` and `MatchDetail.tsx` by taking
  the designer's layout and keeping main's data semantics (unknown values labelled, no
  placeholder `available Now`, reason fallback and outdoor evidence lines, equal-height
  helpers).
- The card becomes presentational: `saved`, `onToggleSave`, `onDismiss`, `busy` props.
- X records a persisted `other` rejection (the reason main added for the chat tools). It hides without reranking; refine chips in the feed status row
  `PATCH /api/feedback` the reason into a specific one.
- Heart persists via a new `listing_save` table (migration 0008), `GET`/`PUT /api/saved`
  with the same ownership guards as feedback, an optimistic client hook, and demo-reset
  cleanup.
- Book a visit reuses `createViewingController`, never `live: true` from a card, and labels
  the mock outcome "Simulated · <slot>".
- `RejectionControl` (full reason picker) stays on the detail page only.

## Verification

Vitest for the route guards, refine and ranking; Playwright `explore-card-actions.test.ts`
(heart persists, X hides / persists / refines / undoes, book is labelled as simulation,
detail picker lists "Other" last, API ownership) plus the existing happy path
and chat launcher specs.
