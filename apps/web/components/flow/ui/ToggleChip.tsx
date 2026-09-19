"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToggleChipGroupProps {
  label?: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export const FlowToggleChipGroup = ({
  label,
  options,
  selected,
  onChange,
}: ToggleChipGroupProps) => {
  const toggle = (option: string) => {
    onChange(
      selected.includes(option)
        ? selected.filter((item) => item !== option)
        : [...selected, option],
    );
  };

  return (
    <div className="flex flex-col gap-2">
      {label ? <span className="text-label-sm text-steel">{label}</span> : undefined}
      <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const isActive = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={isActive}
              onClick={() => toggle(option)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-label-md transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian",
                isActive ? "bg-obsidian text-snow" : "bg-paper text-steel hover:text-obsidian",
              )}
            >
              <span>{option}</span>
              <Check size={14} aria-hidden className={cn(!isActive && "opacity-0")} />
            </button>
          );
        })}
      </div>
    </div>
  );
};
