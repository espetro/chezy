"use client";

import { cn } from "~/lib/utils";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

export const FlowSwitch = ({ checked, onChange, label }: SwitchProps) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={cn(
      "relative h-6 w-11 shrink-0 rounded-full before:absolute before:-inset-x-1 before:-inset-y-2.5 before:content-[''] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
      checked ? "bg-obsidian" : "bg-cloud",
    )}
  >
    <span
      aria-hidden
      className={cn(
        "absolute top-0.5 left-0.5 size-5 rounded-full bg-snow shadow-sm transition-transform duration-200",
        checked && "translate-x-5",
      )}
    />
  </button>
);
