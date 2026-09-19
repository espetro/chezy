import { cn } from "~/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
}

export const FlowCard = ({ padded = true, className, ...props }: CardProps) => (
  <div className={cn("rounded-cards bg-snow shadow-sm", padded && "p-7", className)} {...props} />
);
