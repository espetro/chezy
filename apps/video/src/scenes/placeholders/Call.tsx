import { interpolate, useCurrentFrame } from "remotion";
import { copy } from "../../copy/copy.schema";
import { CallSheet } from "../mock/CallSheet";
import { ChatBubble, ChatColumn } from "../mock/ChatBubble";
import { Chip } from "../mock/Chip";
import { DialingCard } from "../mock/DialingCard";
import { MockTag } from "../mock/MockTag";
import type { SceneProps } from "./sceneProps";

// 4. call — approval, dialing card (pulsing dot, badges), then the call sheet:
// synthetic waveform + four es/en transcript lines in sync with the VO,
// truthful outcome footer, and the "Simulation ended" chip at the tail.
export const Call = ({ checkpoint, frames, showMockTag }: SceneProps) => {
  const frame = useCurrentFrame();
  const at = (p: number) => Math.round(p * frames);
  const s = copy.checkpoints.call.screen;

  const sheetAt = at(0.3);
  const sheetSpan = Math.round(frames * 0.6);
  const chipAt = at(0.94);
  const sheetFade = interpolate(frame, [chipAt - 6, chipAt], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const dialFade = interpolate(frame, [sheetAt + 10, sheetAt + 22], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {showMockTag && <MockTag />}
      <ChatColumn>
        <ChatBubble who="user" text={s.approvalUser} at={at(0.03)} typeIn />
        <ChatBubble who="assistant" text={s.approvalAssistant} at={at(0.14)} />
        {dialFade > 0 && (
          <div style={{ opacity: dialFade, alignSelf: "stretch" }}>
            <DialingCard
              number={s.dialing}
              sub={s.dialingSub}
              badges={checkpoint.badges}
              at={at(0.22)}
            />
          </div>
        )}
        <div style={{ opacity: sheetFade, alignSelf: "stretch" }}>
          <CallSheet
            transcript={s.transcript}
            speakers={s.speakers}
            outcome={s.outcome}
            at={sheetAt}
            span={sheetSpan}
          />
        </div>
        <Chip text={s.endedChip} at={chipAt} />
      </ChatColumn>
    </div>
  );
};
