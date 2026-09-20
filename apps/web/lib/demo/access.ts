import { isDevelopmentEnvironment } from "~/lib/constants";
import { env } from "~/lib/env";

export const isDemoResetEnabled = () => isDevelopmentEnvironment || env.IS_DEMO === "1";

export const isDemoRehearsalSafe = () =>
  env.VIEWING_MODE === "mock" && env.CALENDAR_MODE === "mock";
