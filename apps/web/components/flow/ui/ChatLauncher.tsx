"use client";

import { MessageCircle, X } from "lucide-react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useState } from "react";
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

export const FlowChatLauncher = () => {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Onboarding is itself the agent conversation; no launcher there.
  if (pathname === "/onboarding") {
    return undefined;
  }

  // /explore/[id] has a fixed bottom action bar below md; raise the launcher to
  // clear it there, otherwise sit just above the safe-area edge.
  const onMatchDetail = /^\/explore\/.+/.test(pathname);
  const bottomOffset = onMatchDetail
    ? "bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-6"
    : "bottom-[calc(1rem+env(safe-area-inset-bottom))] sm:bottom-6";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {/* Stays mounted while open (under the overlay) so Radix can return focus to it on close. */}
      <button
        type="button"
        aria-label="Chat with Chezy"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={cn(
          "fixed right-4 z-30 inline-flex size-12 items-center justify-center rounded-full bg-obsidian text-snow shadow-lg shadow-obsidian/20 sm:right-6",
          "hover:bg-graphite focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-obsidian motion-safe:transition-transform active:scale-95",
          bottomOffset,
        )}
      >
        <MessageCircle size={20} aria-hidden />
      </button>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="gap-0 p-0 font-flow data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        <SheetTitle className="sr-only">Chat with Chezy</SheetTitle>
        <div className="flex items-center gap-3 border-b border-cloud bg-snow px-4 py-3">
          <FlowAgentMark size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-obsidian">Chezy</p>
            <p className="text-[13px] text-fog">Ask anything about your search</p>
          </div>
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
          <EmbeddedChat />
        </div>
      </SheetContent>
    </Sheet>
  );
};
