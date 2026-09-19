import { FlowAgentMark } from "@/components/flow/ui/AgentMark";

interface ChatBubbleProps {
  from: "agent" | "user";
  meta?: React.ReactNode;
  children: React.ReactNode;
}

export const ChatBubble = ({ from, meta, children }: ChatBubbleProps) => {
  if (from === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[24px] rounded-tr-sm bg-obsidian px-4 py-3 text-body-default text-snow">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <FlowAgentMark size="lg" />
      <div className="flex max-w-[85%] flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-label-md font-semibold text-obsidian">Chezy AI</span>
          <span className="text-label-sm font-normal text-fog">Personal agent</span>
        </div>
        <div className="flex flex-col gap-2 rounded-[24px] rounded-tl-sm bg-snow p-4 text-body-default text-obsidian shadow-sm">
          {children}
          {meta ? <div className="flex flex-wrap items-center gap-2 pt-1">{meta}</div> : undefined}
        </div>
      </div>
    </div>
  );
};
