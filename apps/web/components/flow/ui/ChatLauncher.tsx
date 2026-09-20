"use client";

import { MessageCircle, RotateCcw, X } from "lucide-react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { createContext, type ReactNode, Suspense, useContext, useState } from "react";
import { FlowAgentMark } from "~/components/flow/ui/AgentMark";
import { Sheet, SheetClose, SheetContent, SheetTitle } from "~/components/ui/sheet";
import { cn } from "~/lib/utils";

// Lazy so the flow pages don't pay the chat bundle until the drawer opens.
const EmbeddedChat = dynamic(
  () => import("~/components/flow/ui/EmbeddedChat").then((mod) => mod.EmbeddedChat),
  {
    ssr: false,
    loading: () => (
      <div role="status" className="flex h-full items-center justify-center text-[13px] text-fog">
        Opening chat…
      </div>
    ),
  },
);

interface OpenChatOptions {
  // Sent as the first user message of a fresh conversation.
  message?: string;
  // Shown in the drawer header, e.g. the listing title the question is about.
  subject?: string;
  // "bottom" rises from the pinned chat bar (explore); "right" is the side drawer.
  placement?: "right" | "bottom";
}

interface ChatLauncherContextValue {
  open: (options?: OpenChatOptions) => void;
  // Drop the current thread (next open starts fresh), e.g. the listing in view changed.
  reset: () => void;
}

const ChatLauncherContext = createContext<ChatLauncherContextValue | undefined>(undefined);

export const useChatLauncher = () => {
  const value = useContext(ChatLauncherContext);
  if (!value) throw new Error("useChatLauncher must be used inside FlowChatLauncherProvider");
  return value;
};

interface DrawerState {
  open: boolean;
  message?: string;
  subject?: string;
  placement: "right" | "bottom";
  // Bumped whenever a seeded conversation starts so the chat remounts fresh.
  session: number;
}

// The floating button reads the pathname (uncached under Cache Components, so
// it sits in its own Suspense boundary rather than dragging the page into one).
const LauncherButton = ({ open, onOpen }: { open: boolean; onOpen: () => void }) => {
  const pathname = usePathname();

  // Only the listing detail page gets the floating button: the landing has
  // nothing to chat about yet, onboarding is itself the agent conversation, and
  // on /explore every card carries its own "ask" input (the button would also
  // cover the carousel's Next control there).
  if (!/^\/explore\/.+/.test(pathname)) return undefined;

  // /explore/[id] has a fixed bottom action bar below md; raise the launcher to
  // clear it there, otherwise sit just above the safe-area edge.
  const onMatchDetail = /^\/explore\/.+/.test(pathname);
  const bottomOffset = onMatchDetail
    ? "bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-6"
    : "bottom-[calc(1rem+env(safe-area-inset-bottom))] sm:bottom-6";

  return (
    // Stays mounted while open (under the overlay) so Radix can return focus to it on close.
    <button
      type="button"
      aria-label="Chat with Chezy"
      aria-expanded={open}
      onClick={onOpen}
      className={cn(
        "fixed right-4 z-30 inline-flex size-12 items-center justify-center rounded-full bg-obsidian text-snow shadow-lg shadow-obsidian/20 sm:right-6",
        "hover:bg-graphite focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-obsidian motion-safe:transition-transform active:scale-95",
        bottomOffset,
      )}
    >
      <MessageCircle size={20} aria-hidden />
    </button>
  );
};

// Owns the floating launcher and the drawer for the whole (flow) surface, and
// lets any flow component open the drawer with a seed message (the card input).
export const FlowChatLauncherProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<DrawerState>({
    open: false,
    placement: "right",
    session: 0,
  });

  const open = (options: OpenChatOptions = {}) =>
    setState((current) => ({
      open: true,
      message: options.message,
      subject: options.subject,
      placement: options.placement ?? "right",
      session: options.message ? current.session + 1 : current.session,
    }));

  // Clear the thread: remount the chat with no seed, keep the sheet where it is.
  const reset = () =>
    setState((current) => ({
      ...current,
      message: undefined,
      subject: undefined,
      session: current.session + 1,
    }));

  const setOpen = (next: boolean) =>
    setState((current) =>
      next
        ? { ...current, open: true }
        : { ...current, open: false, message: undefined, subject: undefined },
    );

  return (
    <ChatLauncherContext.Provider value={{ open, reset }}>
      {children}
      <Sheet open={state.open} onOpenChange={setOpen}>
        <Suspense>
          <LauncherButton open={state.open} onOpen={() => open()} />
        </Suspense>
        <SheetContent
          side={state.placement}
          showCloseButton={false}
          className={cn(
            "gap-0 p-0 font-flow data-[side=right]:w-full data-[side=right]:sm:max-w-md",
            // Bottom sheet: rises to leave the page peeking above, rounded like a card.
            "data-[side=bottom]:h-[78dvh] data-[side=bottom]:rounded-t-cards data-[side=bottom]:border-t-0 data-[side=bottom]:shadow-[0_-12px_40px_rgba(9,9,11,0.18)]",
          )}
        >
          <SheetTitle className="sr-only">Chat with Chezy</SheetTitle>
          <div className="flex items-center gap-3 border-b border-cloud bg-snow px-4 py-3">
            <FlowAgentMark size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-obsidian">Chezy</p>
              <p className="truncate text-[13px] text-fog">
                {state.subject ? `About: ${state.subject}` : "Ask anything about your search"}
              </p>
            </div>
            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-[13px] text-fog hover:bg-paper hover:text-obsidian focus-visible:outline-2 focus-visible:outline-obsidian"
            >
              <RotateCcw size={14} aria-hidden />
              New chat
            </button>
            <SheetClose asChild>
              <button
                type="button"
                aria-label="Close chat"
                className="flex size-11 items-center justify-center rounded-lg text-fog hover:bg-paper hover:text-obsidian focus-visible:outline-2 focus-visible:outline-obsidian"
              >
                <X size={18} aria-hidden />
              </button>
            </SheetClose>
          </div>
          <div className="min-h-0 flex-1">
            <EmbeddedChat key={state.session} initialQuery={state.message} />
          </div>
        </SheetContent>
      </Sheet>
    </ChatLauncherContext.Provider>
  );
};
