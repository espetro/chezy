"use client";

import {
  Bot,
  Building2,
  Map as MapIcon,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/feed", label: "Descubrir", icon: Building2 },
  { href: null, label: "Mapa", icon: MapIcon },
  { href: "/chat", label: "Casilla IA", icon: Bot },
  { href: "/onboarding/preferences", label: "Perfil", icon: SlidersHorizontal },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 z-50 w-full max-w-[480px] bg-paper/90 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-xl">
      <div className="flex h-20 items-center justify-around px-4">
        {ITEMS.map((item) => {
          const active = item.href !== null && pathname?.startsWith(item.href);
          const cls = `flex min-w-[44px] flex-col items-center justify-center gap-1 ${
            active ? "font-semibold text-obsidian" : "text-fog"
          }`;
          const inner = (
            <>
              <item.icon className="h-6 w-6" />
              <span className="text-xs tracking-tight">{item.label}</span>
            </>
          );
          return item.href === null ? (
            <span
              className={`${cls} cursor-not-allowed opacity-60`}
              key={item.label}
              title="pronto"
            >
              {inner}
            </span>
          ) : (
            <Link className={cls} href={item.href} key={item.label}>
              {inner}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
