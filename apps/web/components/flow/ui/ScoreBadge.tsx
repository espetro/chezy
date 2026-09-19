import { cn } from "~/lib/utils";

interface ScoreBadgeProps {
  score: number;
  className?: string;
}

const tierClasses = (score: number) => {
  if (score >= 85) return "bg-obsidian text-snow";
  if (score >= 70) return "bg-iron text-[#fafafa]";
  return "border border-mist text-steel bg-transparent";
};

export const FlowScoreBadge = ({ score, className }: ScoreBadgeProps) => (
  <div
    className={cn(
      "inline-flex items-center gap-1.5 rounded-pills px-3 py-1.5 text-caption font-medium",
      tierClasses(score),
      className,
    )}
  >
    <span className="text-[13px] font-semibold">{score}%</span>
    <span className="opacity-80">match</span>
  </div>
);
