"use client";

import { Check } from "lucide-react";
import { cn } from "~/lib/utils";

export interface ToggleChipOption {
  label: string;
  value: string;
}

interface ToggleChipGroupProps {
  label?: string;
  options: ToggleChipOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export const FlowToggleChipGroup = ({
  label,
  options,
  selected,
  onChange,
}: ToggleChipGroupProps) => {
  const toggle = (value: string) => {
    onChange(
      selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value],
    );
  };

  return (
    <div className="flex flex-col gap-2">
      {label ? <span className="text-label-sm text-steel">{label}</span> : undefined}
      <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const isActive = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => toggle(option.value)}
              className={cn(
                "flex min-h-11 items-center gap-1.5 rounded-full px-3 py-1.5 text-label-md transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian",
                isActive ? "bg-obsidian text-snow" : "bg-paper text-steel hover:text-obsidian",
              )}
            >
              <span>{option.label}</span>
              <Check size={14} aria-hidden className={cn(!isActive && "opacity-0")} />
            </button>
          );
        })}
      </div>
    </div>
  );
};
