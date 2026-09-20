"use client";

import { Suspense } from "react";
import { Toaster } from "sonner";
import { DataStreamProvider } from "~/components/chat/data-stream-provider";
import { ChatShell } from "~/components/chat/shell";
import { ActiveChatProvider } from "~/hooks/use-active-chat";

// The chat subtree mounted inside the flow chat launcher drawer. Mirrors the
// provider stack of app/(chat)/layout.tsx minus the sidebar: nothing under
// ChatShell in embedded mode calls useSidebar (only ChatHeader, Artifact and the
// sidebar files do, all unmounted here), so no SidebarProvider is needed.
export const EmbeddedChat = () => (
  <DataStreamProvider>
    <Toaster
      position="top-center"
      theme="system"
      toastOptions={{
        className: "!bg-card !text-foreground !border-border/50 !shadow-[var(--shadow-float)]",
      }}
    />
    <Suspense fallback={<div className="h-full bg-background" />}>
      <ActiveChatProvider>
        <ChatShell embedded />
      </ActiveChatProvider>
    </Suspense>
  </DataStreamProvider>
);
