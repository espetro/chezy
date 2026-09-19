"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  icon?: React.ReactNode;
}

export const FlowTextField = ({ label, icon, className, ...props }: TextFieldProps) => {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label-sm text-steel">
        {label}
      </label>
      <div className="relative flex items-center">
        {icon ? (
          <span className="pointer-events-none absolute left-3.5 flex text-fog">{icon}</span>
        ) : undefined}
        <input
          id={id}
          className={cn(
            "h-12 w-full rounded-[14px] bg-paper pr-4 text-body-medium text-graphite outline-none transition-colors placeholder:text-ash focus:bg-snow focus-visible:ring-2 focus-visible:ring-obsidian",
            icon ? "pl-10" : "pl-4",
            className,
          )}
          {...props}
        />
      </div>
    </div>
  );
};
