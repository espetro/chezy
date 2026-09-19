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

// The product surface (formerly the /flow prototype — see
// .agents/plans/2026-09-19-port-to-main.md): landing → onboarding → explore/match at the
// root routes. `bg-paper`/`text-obsidian`/`font-flow` are flow tokens declared in
// globals.css; they don't touch `--background`/`--foreground` etc., so the (chat) subtree
// is unaffected.
const FlowLayout = ({ children }: FlowLayoutProps) => (
  <div className={`${dmSans.variable} min-h-[100dvh] bg-paper font-flow text-obsidian`}>
    {children}
  </div>
);

export default FlowLayout;
