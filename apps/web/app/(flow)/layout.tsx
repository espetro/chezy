import type { Metadata } from "next";
import { Suspense } from "react";
import { FlowChatLauncher } from "~/components/flow/ui/ChatLauncher";
import { FlowMotion } from "~/components/flow/ui/FlowMotion";

export const metadata: Metadata = {
  title: "Chezy — your rental agent",
  description:
    "Chezy searches, scores, and negotiates your next rental for you, with you approving what matters.",
};

interface FlowLayoutProps {
  children: React.ReactNode;
}

// The product surface (formerly the /flow prototype — see
// .agents/plans/2026-09-19-port-to-main.md): landing → onboarding → explore/match at the
// root routes. `bg-paper`/`text-obsidian`/`font-flow` are flow tokens declared in
// globals.css; they don't touch `--background`/`--foreground` etc., so the (chat) subtree
// is unaffected.
const FlowLayout = ({ children }: FlowLayoutProps) => (
  <div className="min-h-[100dvh] bg-paper font-flow text-obsidian">
    <FlowMotion>{children}</FlowMotion>
    <Suspense>
      <FlowChatLauncher />
    </Suspense>
  </div>
);

export default FlowLayout;
