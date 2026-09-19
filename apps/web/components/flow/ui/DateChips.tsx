"use client";

import { FlowCalendar, formatFlowDate, toIsoDate } from "@/components/flow/ui/Calendar";
import type { MoveIn } from "@/lib/flow/types";
import { cn } from "@/lib/utils";

interface DateChipsProps {
  value: MoveIn | undefined;
  onChange: (value: MoveIn) => void;
}

const chipClass = (isSelected: boolean) =>
  cn(
    "flex-1 rounded-[14px] px-3 py-2.5 text-center text-label-md transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian",
    isSelected ? "bg-obsidian font-semibold text-snow" : "bg-paper text-graphite hover:text-obsidian",
  );

export const FlowDateChips = ({ value, onChange }: DateChipsProps) => {
  const isDate = value?.mode === "date";
  const isFlexible = value?.mode === "flexible";
  const selectedDate = isDate ? value.date : "";

  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Move-in timing" className="flex gap-2">
        <button
          type="button"
          role="radio"
          aria-checked={isDate}
          onClick={() => onChange({ mode: "date", date: selectedDate })}
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
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-label-sm text-steel">Ideal move-in date</span>
            <span className="text-label-md font-semibold text-obsidian">
              {selectedDate === "" ? "—" : formatFlowDate(selectedDate)}
            </span>
          </div>
          <FlowCalendar
            value={selectedDate}
            onChange={(date) => onChange({ mode: "date", date })}
            min={toIsoDate(new Date())}
          />
        </div>
      ) : undefined}
    </div>
  );
};
