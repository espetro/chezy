import { useCurrentFrame } from "remotion";
import { copy } from "../../copy/copy.schema";
import { theme } from "../../theme";
import { MockTag } from "../mock/MockTag";
import type { SceneProps } from "./sceneProps";

// Skeleton placeholder — real scene lands in its own commit.
export const Booked = ({ showMockTag }: SceneProps) => {
  useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: theme.surface,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: theme.faint,
        fontSize: 20,
        fontFamily: theme.fontMono,
      }}
    >
      {showMockTag && <MockTag />}
      {copy.checkpoints.booked.label}
    </div>
  );
};
