import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "chezy",
  description: "Voice-first property acquisition",
};

export default function RootLayout({
  children,
}: {
  readonly children: ReactNode;
}): React.JSX.Element {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          background: "#0a0a0a",
          color: "#fafafa",
        }}
      >
        {children}
      </body>
    </html>
  );
}
