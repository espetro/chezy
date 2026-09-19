"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "~/lib/utils";

interface StatTileProps<T extends number> {
  label: string;
  icon: React.ReactNode;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  format: (value: T) => string;
}

export const FlowStatTile = <T extends number>({
  label,
  icon,
  options,
  value,
  onChange,
  format,
}: StatTileProps<T>) => {
  const index = options.indexOf(value);
  const previous = options[index - 1];
  const next = options[index + 1];

  const stepButton = (target: T | undefined, glyph: React.ReactNode, name: string) => (
    <button
      type="button"
      aria-label={`${name} ${label.toLowerCase()}`}
      disabled={target === undefined}
      onClick={() => target !== undefined && onChange(target)}
      className={cn(
        "relative flex size-7 items-center justify-center rounded-full before:absolute before:-inset-2 before:content-[''] bg-snow text-steel transition-colors duration-200 hover:text-obsidian disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian",
      )}
    >
      {glyph}
    </button>
  );

  return (
    <div className="flex items-center gap-3 rounded-[18px] bg-paper p-3">
      <span className="flex shrink-0 text-steel">{icon}</span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-label-sm text-fog">{label}</span>
        <span className="truncate text-body-medium font-semibold text-obsidian" aria-live="polite">
          {format(value)}
        </span>
      </div>
      <div className="flex shrink-0 gap-1">
        {stepButton(previous, <Minus size={14} aria-hidden />, "Decrease")}
        {stepButton(next, <Plus size={14} aria-hidden />, "Increase")}
      </div>
    </div>
  );
};
