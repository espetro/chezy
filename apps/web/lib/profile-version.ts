import { createHash } from "node:crypto";
import type { ProfileVersion } from "@chezy/contract";
import type { SearchProfile } from "~/lib/db/schema";

export const getProfileVersion = (profile: SearchProfile): ProfileVersion =>
  `sha256:${createHash("sha256")
    .update(
      JSON.stringify(
        Object.fromEntries(Object.entries(profile).sort(([a], [b]) => a.localeCompare(b))),
      ),
    )
    .digest("hex")}`;
