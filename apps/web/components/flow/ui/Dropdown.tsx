"use client";

import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "~/lib/utils";

interface DropdownOption<T extends string> {
  value: T;
  label: string;
}

const triggerClass = (isOpen: boolean, compact: boolean) =>
  cn(
    "flex h-11 w-full items-center gap-2 rounded-inputs border border-mist bg-snow text-label-md text-obsidian transition-colors duration-200 hover:border-ash focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian",
    compact ? "w-11 justify-center px-0" : "justify-between px-3.5",
    isOpen && "border-obsidian",
  );

const panelClass = (align: "start" | "end") =>
  cn(
    "absolute top-[calc(100%+6px)] z-20 flex max-h-72 min-w-full max-w-[280px] flex-col gap-0.5 overflow-y-auto rounded-[14px] border border-mist bg-snow p-1.5 shadow-float",
    align === "end" ? "right-0" : "left-0",
  );

const optionClass = (isSelected: boolean) =>
  cn(
    "flex min-h-10 items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-left text-label-md transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian",
    isSelected ? "bg-obsidian font-semibold text-snow" : "text-graphite hover:bg-paper",
  );

const useDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);

  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") setIsOpen(false);
  };

  return { isOpen, setIsOpen, handleBlur, handleKeyDown };
};

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
  const { isOpen, setIsOpen, handleBlur, handleKeyDown } = useDropdown();

  const selected = options.find((option) => option.value === value);

  return (
    <div className={cn("relative", className)} onBlur={handleBlur} onKeyDown={handleKeyDown}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className={triggerClass(isOpen, compact)}
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
        <div role="listbox" aria-label={label} className={panelClass(align)}>
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
                className={optionClass(isSelected)}
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

interface MultiDropdownProps<T extends string> {
  label: string;
  values: T[];
  options: DropdownOption<T>[];
  onChange: (values: T[]) => void;
  emptyLabel: string;
  selectionLabel: (count: number) => string;
  align?: "start" | "end";
  className?: string;
}

export const FlowMultiDropdown = <T extends string>({
  label,
  values,
  options,
  onChange,
  emptyLabel,
  selectionLabel,
  align = "start",
  className,
}: MultiDropdownProps<T>) => {
  const { isOpen, setIsOpen, handleBlur, handleKeyDown } = useDropdown();

  const triggerLabel =
    values.length === 0
      ? emptyLabel
      : values.length === 1
        ? (options.find((option) => option.value === values[0])?.label ?? selectionLabel(1))
        : selectionLabel(values.length);

  const toggle = (value: T) => {
    onChange(
      values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value],
    );
  };

  return (
    <div className={cn("relative", className)} onBlur={handleBlur} onKeyDown={handleKeyDown}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className={triggerClass(isOpen, false)}
      >
        <span className="truncate">{triggerLabel}</span>
        <ChevronDown
          size={16}
          aria-hidden
          className={cn("shrink-0 text-steel transition-transform", isOpen && "rotate-180")}
        />
      </button>

      {isOpen ? (
        <div role="group" aria-label={label} className={panelClass(align)}>
          <button
            type="button"
            onClick={() => onChange([])}
            className={optionClass(values.length === 0)}
          >
            <span className="truncate">{emptyLabel}</span>
            {values.length === 0 ? <Check size={14} aria-hidden className="shrink-0" /> : undefined}
          </button>
          {options.map((option) => {
            const isChecked = values.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                role="checkbox"
                aria-checked={isChecked}
                onClick={() => toggle(option.value)}
                className="flex min-h-10 items-center gap-3 rounded-[10px] px-3 py-2 text-left text-label-md text-graphite transition-colors duration-200 hover:bg-paper focus-visible:ring-2 focus-visible:ring-obsidian focus-visible:outline-none"
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-[18px] shrink-0 items-center justify-center rounded-[6px] border transition-colors duration-200",
                    isChecked ? "border-obsidian bg-obsidian text-snow" : "border-mist bg-snow",
                  )}
                >
                  {isChecked ? <Check size={12} /> : undefined}
                </span>
                <span className="truncate">{option.label}</span>
              </button>
            );
          })}
        </div>
      ) : undefined}
    </div>
  );
};
