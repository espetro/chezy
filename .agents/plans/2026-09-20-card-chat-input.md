# Plan: ask Chezy about a listing from its card

Date: 2026-09-20. Branch `feat/chezy-0/card-chat-input`.

## Problems

- The floating chat launcher is fixed bottom-right; on `/explore` the carousel controls row
  is `justify-between`, so the button covers "Next match" whenever that row reaches the
  bottom of the viewport.
- The drawer has no listing context; users want to ask about a specific home.

## Decisions

- `FlowChatLauncherProvider` owns the drawer for the whole `(flow)` surface and exposes
  `useChatLauncher().open({ message, subject })`. A seeded open bumps a `session` key so a
  fresh conversation mounts; the header shows `About: <subject>`.
- The floating button is hidden on `/explore` (cards carry their own entry) as well as
  `/onboarding`; it stays on `/` and `/explore/[id]`. It reads `usePathname` in its own
  `Suspense` boundary so the page is not wrapped in one.
- Each `CandidateCard` gets an "Ask about this home…" input row; Enter opens the drawer with
  `Regarding listing <id> ("<title>", <neighborhood>, €<price>/month): <question>` so the
  chat tools can resolve the listing by id. The prefix is visible on purpose.
- `ActiveChatProvider` accepts `initialQuery`; the seeded send is deferred by a tick because
  `useChat` stops the chat in its effect cleanup and the dev StrictMode remount otherwise
  aborts the request before it leaves the browser (latent in the legacy `?query=` path too).

## Verification

Playwright: launcher hidden on `/explore` and `/onboarding`, visible on `/` and the detail
page; "Next match" in viewport and clickable at 390px; card question opens the drawer with
the `About:` header, the seeded user bubble and an assistant reply; existing card-action and
happy-path specs unchanged and green.
