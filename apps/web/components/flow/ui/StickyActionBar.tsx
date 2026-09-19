"use client";

import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface StickyActionBarProps {
  matchCount: number;
  cta: string;
  disabled?: boolean;
  error?: string;
  onAction: () => void;
}

export const FlowStickyActionBar = ({
  matchCount,
  cta,
  disabled = false,
  error,
  onAction,
}: StickyActionBarProps) => (
  <div className="sticky bottom-0 z-10 -mx-4 bg-snow/90 p-4 backdrop-blur-md [padding-bottom:max(1rem,env(safe-area-inset-bottom))] sm:-mx-6 sm:px-6">
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <span className="size-2 animate-pulse rounded-full bg-ember motion-reduce:animate-none" />
          <span aria-live="polite" className="text-label-md font-semibold text-obsidian">
            {matchCount} {matchCount === 1 ? "listing matches" : "listings match"} right now
          </span>
        </div>
      </div>
      {error ? (
        <p role="alert" className="px-1 text-label-sm text-ember">
          {error}
        </p>
      ) : undefined}
      <button
        type="button"
        onClick={onAction}
        disabled={disabled}
        className={cn(
          "flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-obsidian text-body-medium font-semibold text-snow transition-[transform,opacity] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian focus-visible:ring-offset-2",
        )}
      >
        <span>{cta}</span>
        <ArrowRight size={18} aria-hidden />
      </button>
    </div>
  </div>
);
