"use client";

import { Calendar } from "lucide-react";
import { useId } from "react";
import type { MoveIn } from "~/lib/flow/types";
import { cn } from "~/lib/utils";

interface DateChipsProps {
  value: MoveIn | undefined;
  onChange: (value: MoveIn) => void;
}

const chipClass = (isSelected: boolean) =>
  cn(
    "flex-1 rounded-[14px] px-3 py-2.5 text-center text-label-md transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian",
    isSelected
      ? "bg-obsidian font-semibold text-snow"
      : "bg-paper text-graphite hover:text-obsidian",
  );

export const FlowDateChips = ({ value, onChange }: DateChipsProps) => {
  const dateInputId = useId();
  const isDate = value?.mode === "date";
  const isFlexible = value?.mode === "flexible";

  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Move-in timing" className="flex gap-2">
        <button
          type="button"
          role="radio"
          aria-checked={isDate}
          onClick={() => onChange({ mode: "date", date: isDate ? value.date : "" })}
          className={chipClass(isDate)}
        >
          Pick a date
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={isFlexible}
          onClick={() => onChange({ mode: "flexible" })}
          className={chipClass(isFlexible)}
        >
          Flexible ±15 days
        </button>
      </div>

      {isDate ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={dateInputId} className="text-label-sm text-steel">
            Ideal move-in date
          </label>
          <div className="relative flex items-center">
            <span className="pointer-events-none absolute left-3.5 flex text-fog">
              <Calendar size={18} aria-hidden />
            </span>
            <input
              id={dateInputId}
              type="date"
              value={value.date}
              onChange={(event) => onChange({ mode: "date", date: event.target.value })}
              className="h-12 w-full rounded-[14px] bg-paper pr-4 pl-10 text-body-medium text-graphite transition-colors outline-none focus:bg-snow focus-visible:ring-2 focus-visible:ring-obsidian"
            />
          </div>
        </div>
      ) : undefined}
    </div>
  );
};
