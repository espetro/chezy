"use client";

import { RotateCcw, X } from "lucide-react";
import dynamic from "next/dynamic";
import { createContext, type ReactNode, useContext, useState } from "react";
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

// Owns the chat drawer for the whole (flow) surface and lets any flow component
// open it with a seed message (the explore chat bar).
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
