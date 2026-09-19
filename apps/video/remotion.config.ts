import { Config } from "@remotion/cli/config";

// M1, 8 GB RAM: keep concurrency low and never render while Studio or the
// Next.js dev server is running. See .agents/plans/2026-09-19-demo-video.md.
Config.setConcurrency(2);
Config.setCodec("h264");
Config.setAudioCodec("aac");
Config.setOverwriteOutput(true);
