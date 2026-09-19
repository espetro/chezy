import { DM_Sans } from "next/font/google";

const dmSans = DM_Sans({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-dm-sans-var",
});

// The agent pages are light-only per design.md: they use the literal chezy
// palette tokens (bg-paper, text-graphite, ...) rather than the shadcn
// variables, so the root ThemeProvider's `.dark` class cannot darken them.
export default function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${dmSans.variable} min-h-dvh bg-paper font-dm-sans text-graphite`}
    >
      <div className="mx-auto min-h-dvh w-full max-w-[480px] bg-paper">
        {children}
      </div>
    </div>
  );
}
