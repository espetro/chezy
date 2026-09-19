import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: "chezMoi — your rental agent",
  description:
    "chezMoi searches, scores, and negotiates your next rental for you, with you approving what matters.",
};

interface FlowLayoutProps {
  children: React.ReactNode;
}

// Isolated UX exploration (onboarding/explore/match), namespaced under /flow so it never
// collides with the real app's routes while it's being validated — see
// .agents/plans/2026-09-19-port-to-main.md. `bg-paper`/`text-obsidian`/`font-flow` are new
// tokens declared in globals.css; they don't touch `--background`/`--foreground` etc., so
// nothing outside this subtree is affected.
const FlowLayout = ({ children }: FlowLayoutProps) => (
  <div className={`${dmSans.variable} min-h-screen bg-paper font-flow text-obsidian`}>
    {children}
  </div>
);

export default FlowLayout;
