# Flow chat launcher

Add a discreet chat entry point to the `(flow)` product surface so users can open
the existing Vercel-chatbot-derived chat in a right-hand Sheet without leaving the
landing/explore/match pages.

## Approach

- `components/flow/ui/ChatLauncher.tsx` (new, client): `FlowChatLauncher` renders a
  fixed circular obsidian button (`aria-label="Chat with Chezy"`, lucide
  `MessageCircle`) bottom-right. Hidden on `/onboarding` (that page is the agent
  conversation) and while the drawer is open. Raised bottom offset below `md` on
  `/explore/[id]` to clear the fixed mobile action bar.
- The button opens a `Sheet` (`side="right"`, `w-full sm:max-w-md`, `p-0`) with a
  flow-styled light header (`FlowAgentMark`, "Chezy" / "Ask anything about your
  search", custom 44px close button, built-in close button disabled) and a body
  mounting the chat subtree.
- `components/flow/ui/EmbeddedChat.tsx` (new, client): composes
  `DataStreamProvider` → `ActiveChatProvider` → `ChatShell embedded` + sonner
  `Toaster` (same props as `(chat)/layout.tsx`). No `SidebarProvider`: nothing in
  the embedded subtree calls `useSidebar` (only `chat-header`, `artifact`, and the
  sidebar files do, all unmounted). No `AppSidebar`.
- `components/chat/shell.tsx`: add `embedded?: boolean`. When true: no
  `ChatHeader`, no `Artifact`, outer `h-full` (not `h-dvh`), panel drops
  `bg-sidebar` and the `md:rounded/border` chrome, artifact-width logic disabled.
  Only template file edited.
- Mounted in `app/(flow)/layout.tsx` after `<FlowMotion>`. Chat subtree lazy-loaded
  via `next/dynamic` (`ssr: false`) so flow pages don't pay the chat bundle.
- `MatchDetail.tsx` mobile bar gets `aria-label="Listing actions"` for test
  targeting.

## Known limitation

`MultimodalInput.submitForm` calls `window.history.pushState` to `/chat/<id>` on
send; that only syncs `usePathname`, the flow page stays mounted, but the URL bar
shows the chat URL while the drawer is open. Not fixable without editing the
template input (out of scope); will verify behaviour in e2e.

## Tests

`tests/e2e/flow-chat-launcher.test.ts` — desktop open/close, mobile offsets and
onboarding absence, send flow (skipped without a working model key).
