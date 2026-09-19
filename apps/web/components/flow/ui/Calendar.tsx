"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface CalendarProps {
  value: string;
  onChange: (value: string) => void;
  min?: string;
}

const weekdays = [
  { key: "mon", label: "M" },
  { key: "tue", label: "T" },
  { key: "wed", label: "W" },
  { key: "thu", label: "T" },
  { key: "fri", label: "F" },
  { key: "sat", label: "S" },
  { key: "sun", label: "S" },
];

const monthFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
});

const pad = (value: number) => String(value).padStart(2, "0");

export const toIsoDate = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const parseIsoDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) return undefined;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export const formatFlowDate = (value: string) => {
  const date = parseIsoDate(value);
  return date === undefined
    ? ""
    : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(
        date,
      );
};

// Monday-first offset of the 1st of the month.
const leadingBlanks = (year: number, month: number) => (new Date(year, month, 1).getDay() + 6) % 7;

const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

export const FlowCalendar = ({ value, onChange, min }: CalendarProps) => {
  const today = new Date();
  const selected = parseIsoDate(value);
  const [view, setView] = useState(() => {
    const anchor = selected ?? today;
    return { year: anchor.getFullYear(), month: anchor.getMonth() };
  });

  const shiftMonth = (delta: number) =>
    setView((current) => {
      const next = new Date(current.year, current.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });

  const blanks = leadingBlanks(view.year, view.month);
  const total = daysInMonth(view.year, view.month);
  const todayIso = toIsoDate(today);

  return (
    <div className="flex flex-col gap-3 rounded-[14px] bg-paper p-3">
      <div className="flex items-center justify-between">
        <span className="text-label-md font-semibold text-obsidian capitalize">
          {monthFormatter.format(new Date(view.year, view.month, 1))}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => shiftMonth(-1)}
            className="flex size-11 items-center justify-center rounded-full text-steel transition-colors hover:bg-snow hover:text-obsidian focus-visible:ring-2 focus-visible:ring-obsidian focus-visible:outline-none"
          >
            <ChevronLeft size={16} aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => shiftMonth(1)}
            className="flex size-11 items-center justify-center rounded-full text-steel transition-colors hover:bg-snow hover:text-obsidian focus-visible:ring-2 focus-visible:ring-obsidian focus-visible:outline-none"
          >
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekdays.map((weekday) => (
          <span
            key={weekday.key}
            aria-hidden
            className="flex h-6 items-center justify-center text-label-sm text-ash"
          >
            {weekday.label}
          </span>
        ))}

        {Array.from({ length: blanks }, (_, index) => (
          <span key={`blank-${String(index)}`} className="h-11" />
        ))}

        {Array.from({ length: total }, (_, index) => {
          const day = index + 1;
          const iso = `${view.year}-${pad(view.month + 1)}-${pad(day)}`;
          const isSelected = iso === value;
          const isToday = iso === todayIso;
          const isDisabled = min !== undefined && iso < min;

          return (
            <button
              key={iso}
              type="button"
              disabled={isDisabled}
              aria-pressed={isSelected}
              onClick={() => onChange(iso)}
              className={cn(
                "flex h-11 w-full items-center justify-center rounded-full text-body-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian",
                isSelected
                  ? "bg-obsidian font-semibold text-snow"
                  : "text-graphite hover:bg-snow hover:text-obsidian",
                isToday && !isSelected && "font-semibold text-ember",
                isDisabled && "cursor-not-allowed text-mist hover:bg-transparent hover:text-mist",
              )}
            >
              {day}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-mist pt-3">
        <button
          type="button"
          onClick={() => onChange("")}
          className="min-h-11 text-label-md text-steel transition-colors hover:text-obsidian focus-visible:ring-2 focus-visible:ring-obsidian focus-visible:outline-none"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={() => onChange(todayIso)}
          className="min-h-11 text-label-md font-semibold text-ember transition-colors hover:text-ember-deep focus-visible:ring-2 focus-visible:ring-obsidian focus-visible:outline-none"
        >
          Today
        </button>
      </div>
    </div>
  );
};
