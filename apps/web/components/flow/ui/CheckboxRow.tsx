"use client";

import { Check } from "lucide-react";
import { useId } from "react";
import { cn } from "~/lib/utils";

interface CheckboxRowProps {
  label: string;
  icon: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export const FlowCheckboxRow = ({ label, icon, checked, onChange }: CheckboxRowProps) => {
  const id = useId();

  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center justify-between gap-3 rounded-[18px] bg-paper p-3 transition-colors duration-200 has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-obsidian"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex shrink-0 text-ember-deep">{icon}</span>
        <span className="text-body-medium text-obsidian">{label}</span>
      </div>
      <span className="relative flex shrink-0">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className={cn(
            "flex size-5 items-center justify-center rounded-[6px] transition-colors duration-200",
            checked ? "bg-obsidian text-snow" : "bg-cloud text-transparent",
          )}
        >
          <Check size={14} />
        </span>
      </span>
    </label>
  );
};
