import { useId } from "react";
import { cn } from "~/lib/utils";

interface SectionCardProps {
  title: string;
  icon: React.ReactNode;
  iconTone?: "default" | "deep";
  aside?: React.ReactNode;
  description?: string;
  className?: string;
  children: React.ReactNode;
}

export const FlowSectionCard = ({
  title,
  icon,
  iconTone = "default",
  aside,
  description,
  className,
  children,
}: SectionCardProps) => {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className={cn("flex flex-col gap-4 rounded-[32px] bg-snow p-5 shadow-sm", className)}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full",
              iconTone === "deep" ? "bg-ember-soft text-ember-deep" : "bg-paper text-obsidian",
            )}
          >
            {icon}
          </div>
          <h3 id={headingId} className="min-w-0 text-headline-sm text-obsidian">
            {title}
          </h3>
        </div>
        {aside}
      </div>
      {description ? <p className="-mt-1 text-body-default text-fog">{description}</p> : undefined}
      {children}
    </section>
  );
};
