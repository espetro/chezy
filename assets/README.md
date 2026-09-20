# Brand assets

Logo files, fonts, and how to load them.

## Logo

All files come from `chezy-logo-1024.png`, the 1024x1024 source PNG with a transparent
background. Palette: terracotta `#CA6A49`, mint `#93C8AE`.

| File | Size | Use |
| --- | --- | --- |
| `logo/favicon.ico` | 16, 32, 48 | favicon |
| `logo/chezy-logo-16.png` | 16x16 | favicon source |
| `logo/chezy-logo-32.png` | 32x32 | favicon source |
| `logo/chezy-logo-48.png` | 48x48 | favicon source |
| `logo/chezy-logo-64.png` | 64x64 | small UI |
| `logo/chezy-logo-128.png` | 128x128 | UI |
| `logo/chezy-logo-192.png` | 192x192 | app icon (Android/PWA) |
| `logo/chezy-logo-256.png` | 256x256 | README and docs |
| `logo/chezy-logo-512.png` | 512x512 | app icon, video title cards |
| `logo/chezy-logo-apple-180.png` | 180x180 | apple touch icon, flattened on white, no alpha |
| `logo/chezy-logo-1024.png` | 1024x1024 | source, transparent |

## Fonts

Two families, both variable fonts licensed under the SIL Open Font License 1.1:

- `fonts/outfit/`: Outfit, headings and display text. Weight axis `wght` 100-900.
- `fonts/dm-sans/`: DM Sans, UI and long reading text. Axes `opsz` 9-40 and `wght`
  100-1000, plus a matching italic variable font.

Each directory ships TTF and woff2 side by side. Use woff2 on the web and in Remotion;
TTF is for design tools (Figma, Sketch). The OFL requires `OFL.txt` to ship with the
font files, so keep it in place when copying.

## Loading

Planned in PR 2.

In `apps/web`, self-host via `next/font/local` in the root layout:

```ts
import localFont from "next/font/local";

const dmSans = localFont({
  src: [
    { path: "../../../assets/fonts/dm-sans/DMSans-Variable.woff2", style: "normal" },
    { path: "../../../assets/fonts/dm-sans/DMSans-Italic-Variable.woff2", style: "italic" },
  ],
  variable: "--font-dm-sans",
  weight: "100 900",
});

const outfit = localFont({
  src: "../../../assets/fonts/outfit/Outfit-Variable.woff2",
  variable: "--font-outfit",
  weight: "100 900",
});
```

In `apps/video`, Remotion loads fonts from `public/` via `@remotion/fonts`. Copy the
woff2 files to `apps/video/public/fonts/` (`assets/fonts` is the source of truth) and:

```ts
import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

loadFont({
  family: "DM Sans",
  url: staticFile("fonts/DMSans-Variable.woff2"),
  weight: "100 900",
});

loadFont({
  family: "Outfit",
  url: staticFile("fonts/Outfit-Variable.woff2"),
  weight: "100 900",
});
```
