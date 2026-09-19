"use client";

import { cn } from "@/lib/utils";

interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
}

interface SegmentedSelectorProps<T extends string | number> {
  label: string;
  valueLabel?: string;
  options: SegmentedOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
}

export const FlowSegmentedSelector = <T extends string | number>({
  label,
  valueLabel,
  options,
  value,
  onChange,
}: SegmentedSelectorProps<T>) => {
  const selectedIndex = options.findIndex((option) => option.value === value);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const delta =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (delta === 0) return;
    event.preventDefault();
    const from = selectedIndex === -1 ? 0 : selectedIndex;
    const next = options[(from + delta + options.length) % options.length];
    if (next) onChange(next.value);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-label-sm text-steel">{label}</span>
        {valueLabel ? (
          <span className="text-label-md font-semibold text-obsidian">{valueLabel}</span>
        ) : undefined}
      </div>
      <div
        role="radiogroup"
        aria-label={label}
        onKeyDown={handleKeyDown}
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((option, index) => {
          const isSelected = option.value === value;
          const isTabStop = isSelected || (selectedIndex === -1 && index === 0);
          return (
            <button
              key={String(option.value)}
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={isTabStop ? 0 : -1}
              onClick={() => onChange(option.value)}
              className={cn(
                "min-h-11 rounded-[12px] px-1 py-2 text-center text-label-md transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian",
                isSelected ? "bg-obsidian font-semibold text-snow" : "bg-paper text-steel hover:text-obsidian",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
