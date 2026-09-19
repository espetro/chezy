"use client";

import { Calendar } from "lucide-react";
import { FlowTextField } from "@/components/flow/ui/TextField";
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

// The native picker button is stretched over the whole control and made invisible so the
// field keeps the FlowTextField look while staying clickable end to end.
const datePickerClass =
  "[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:m-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0";

export const FlowDateChips = ({ value, onChange }: DateChipsProps) => {
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
        <FlowTextField
          label="Ideal move-in date"
          icon={<Calendar size={18} aria-hidden />}
          type="date"
          value={value.date}
          onChange={(event) => onChange({ mode: "date", date: event.target.value })}
          className={cn(datePickerClass, value.date === "" && "[&::-webkit-datetime-edit]:text-ash")}
        />
      ) : undefined}
    </div>
  );
};
