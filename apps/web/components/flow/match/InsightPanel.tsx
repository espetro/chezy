import {
  MatchExplanation,
  type MatchExplanationProps,
} from "~/components/flow/match/MatchExplanation";
import { FlowCard } from "~/components/flow/ui/Card";

export const InsightPanel = (props: MatchExplanationProps) => (
  <FlowCard className="min-w-0">
    <MatchExplanation {...props} />
  </FlowCard>
);
