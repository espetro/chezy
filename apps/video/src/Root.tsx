import { AbsoluteFill, Composition } from "remotion";

const Scaffold = () => (
  <AbsoluteFill style={{ background: "#0a0a0a" }} />
);

export const RemotionRoot = () => (
  <Composition
    id="ChezyDemo"
    component={Scaffold}
    fps={30}
    width={1920}
    height={1080}
    durationInFrames={30}
  />
);
