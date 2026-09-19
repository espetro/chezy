"use client";

import { cn } from "~/lib/utils";

interface RangeSliderProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  format: (value: number) => string;
  scaleLabels: [string, string, string];
}

const thumbClass =
  "pointer-events-none absolute inset-0 h-5 w-full appearance-none bg-transparent outline-none [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[radial-gradient(circle,#ff5a00_0_4px,#ffffff_4.5px)] [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:active:scale-110 [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[radial-gradient(circle,#ff5a00_0_4px,#ffffff_4.5px)] [&::-moz-range-thumb]:shadow-md focus-visible:[&::-webkit-slider-thumb]:ring-2 focus-visible:[&::-webkit-slider-thumb]:ring-obsidian focus-visible:[&::-moz-range-thumb]:ring-2 focus-visible:[&::-moz-range-thumb]:ring-obsidian";

export const FlowRangeSlider = ({
  label,
  min,
  max,
  step,
  value,
  onChange,
  format,
  scaleLabels,
}: RangeSliderProps) => {
  const [low, high] = value;
  const toPercent = (n: number) => ((n - min) / (max - min)) * 100;

  const setLow = (next: number) => onChange([Math.min(next, high - step), high]);
  const setHigh = (next: number) => onChange([low, Math.max(next, low + step)]);

  return (
    <div className="flex flex-col gap-2 rounded-[20px] bg-paper p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-label-sm text-steel">{label}</span>
        <span className="text-body-medium font-semibold text-obsidian">
          {format(low)} — {format(high)}
        </span>
      </div>

      <div className="relative flex h-5 w-full items-center py-2">
        <div className="relative h-1.5 w-full rounded-full bg-cloud">
          <div
            className="absolute h-full rounded-full bg-ember"
            style={{ left: `${toPercent(low)}%`, right: `${100 - toPercent(high)}%` }}
          />
        </div>
        <input
          type="range"
          aria-label={`Minimum ${label.toLowerCase()}`}
          aria-valuetext={format(low)}
          min={min}
          max={max}
          step={step}
          value={low}
          onChange={(event) => setLow(Number(event.target.value))}
          className={cn(thumbClass, "z-10")}
        />
        <input
          type="range"
          aria-label={`Maximum ${label.toLowerCase()}`}
          aria-valuetext={format(high)}
          min={min}
          max={max}
          step={step}
          value={high}
          onChange={(event) => setHigh(Number(event.target.value))}
          className={cn(thumbClass, "z-20")}
        />
      </div>

      <div className="flex justify-between text-label-sm text-fog">
        <span>{scaleLabels[0]}</span>
        <span>{scaleLabels[1]}</span>
        <span>{scaleLabels[2]}</span>
      </div>
    </div>
  );
};
