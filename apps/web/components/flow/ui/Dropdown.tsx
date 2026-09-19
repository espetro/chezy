"use client";

import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "~/lib/utils";

interface DropdownOption<T extends string> {
  value: T;
  label: string;
}

interface DropdownProps<T extends string> {
  label: string;
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  icon?: React.ReactNode;
  compact?: boolean;
  align?: "start" | "end";
  className?: string;
}

export const FlowDropdown = <T extends string>({
  label,
  value,
  options,
  onChange,
  icon,
  compact = false,
  align = "start",
  className,
}: DropdownProps<T>) => {
  const [isOpen, setIsOpen] = useState(false);

  const selected = options.find((option) => option.value === value);

  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
  };

  return (
    <div
      className={cn("relative", className)}
      onBlur={handleBlur}
      onKeyDown={(event) => {
        if (event.key === "Escape") setIsOpen(false);
      }}
    >
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex h-11 w-full items-center gap-2 rounded-inputs border border-mist bg-snow text-label-md text-obsidian transition-colors duration-200 hover:border-ash focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian",
          compact ? "w-11 justify-center px-0" : "justify-between px-3.5",
          isOpen && "border-obsidian",
        )}
      >
        {icon}
        {compact ? undefined : (
          <>
            <span className="truncate">{selected?.label ?? label}</span>
            <ChevronDown
              size={16}
              aria-hidden
              className={cn("shrink-0 text-steel transition-transform", isOpen && "rotate-180")}
            />
          </>
        )}
      </button>

      {isOpen ? (
        <div
          role="listbox"
          aria-label={label}
          className={cn(
            "absolute top-[calc(100%+6px)] z-20 flex min-w-full max-w-[280px] flex-col gap-0.5 rounded-[14px] border border-mist bg-snow p-1.5 shadow-float",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={cn(
                  "flex min-h-10 items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-left text-label-md transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian",
                  isSelected
                    ? "bg-obsidian font-semibold text-snow"
                    : "text-graphite hover:bg-paper hover:text-obsidian",
                )}
              >
                <span className="truncate">{option.label}</span>
                {isSelected ? <Check size={14} aria-hidden className="shrink-0" /> : undefined}
              </button>
            );
          })}
        </div>
      ) : undefined}
    </div>
  );
};
