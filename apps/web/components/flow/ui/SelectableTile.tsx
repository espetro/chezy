"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectableTileProps {
  label: string;
  icon: React.ReactNode;
  selected: boolean;
  onToggle: () => void;
}

export const FlowSelectableTile = ({ label, icon, selected, onToggle }: SelectableTileProps) => (
  <button
    type="button"
    aria-pressed={selected}
    onClick={onToggle}
    className="flex items-center justify-between gap-2 rounded-[18px] bg-paper p-3 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian"
  >
    <div className="flex min-w-0 items-center gap-2.5">
      <span
        className={cn(
          "flex shrink-0 transition-colors duration-200",
          selected ? "text-ember" : "text-fog",
        )}
      >
        {icon}
      </span>
      <span
        className={cn(
          "truncate text-label-md transition-colors duration-200",
          selected ? "text-obsidian" : "text-steel",
        )}
      >
        {label}
      </span>
    </div>
    <span
      aria-hidden
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-full transition-colors duration-200",
        selected ? "bg-obsidian text-snow" : "bg-cloud text-transparent",
      )}
    >
      <Check size={12} />
    </span>
  </button>
);
