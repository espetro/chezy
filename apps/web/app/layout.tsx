import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { ThemeProvider } from "~/components/theme-provider";
import { TooltipProvider } from "~/components/ui/tooltip";
import { env } from "~/lib/env";

import "./globals.css";
import { SessionProvider } from "next-auth/react";

export const metadata: Metadata = {
  description:
    "Chezy searches, scores, and negotiates your next rental for you, with you approving what matters.",
  metadataBase: new URL(env.APP_BASE_URL),
  title: { default: "Chezy", template: "%s · Chezy" },
};

export const viewport = {
  maximumScale: 1,
};

const dmSans = localFont({
  display: "swap",
  src: [
    {
      path: "../../../assets/fonts/dm-sans/DMSans-Variable.woff2",
      style: "normal",
    },
    {
      path: "../../../assets/fonts/dm-sans/DMSans-Italic-Variable.woff2",
      style: "italic",
    },
  ],
  variable: "--font-dm-sans",
  weight: "100 900",
});

const outfit = localFont({
  display: "swap",
  src: "../../../assets/fonts/outfit/Outfit-Variable.woff2",
  variable: "--font-outfit",
  weight: "100 900",
});

const geistMono = Geist_Mono({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const LIGHT_THEME_COLOR = "hsl(0 0% 100%)";
const DARK_THEME_COLOR = "hsl(240deg 10% 3.92%)";
const THEME_COLOR_SCRIPT = `\
(function() {
  var html = document.documentElement;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  function updateThemeColor() {
    var isDark = html.classList.contains('dark');
    meta.setAttribute('content', isDark ? '${DARK_THEME_COLOR}' : '${LIGHT_THEME_COLOR}');
  }
  var observer = new MutationObserver(updateThemeColor);
  observer.observe(html, { attributes: true, attributeFilter: ['class'] });
  updateThemeColor();
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`${dmSans.variable} ${outfit.variable} ${geistMono.variable}`}
      lang="en"
      suppressHydrationWarning
    >
      <head>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: "Required"
          dangerouslySetInnerHTML={{
            __html: THEME_COLOR_SCRIPT,
          }}
        />
      </head>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          disableTransitionOnChange
          enableSystem
        >
          <SessionProvider basePath={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/auth`}>
            <TooltipProvider>{children}</TooltipProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
