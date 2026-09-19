import * as v from "valibot";
import en from "./en.json";

// Every viewer-facing string lives in en.json. The schema is keyed by the same
// CheckpointId union demo.config.ts uses, so a missing or empty key fails at
// module load — no blank caption ships. Adding a checkpoint without copy is a
// type error downstream.

const nonEmpty = v.pipe(v.string(), v.minLength(1));

const transcriptLine = v.object({
  who: v.picklist(["agent", "agency"]),
  es: nonEmpty,
  en: nonEmpty,
  tag: v.optional(nonEmpty),
});

const listingCard = v.object({
  price: nonEmpty,
  specs: nonEmpty,
  zone: nonEmpty,
  perM2: nonEmpty,
});

const baseFields = {
  label: nonEmpty,
  subtext: nonEmpty,
  callout: nonEmpty,
  vo: nonEmpty,
};

const copySchema = v.object({
  intro: v.object({
    vo: nonEmpty,
    title: nonEmpty,
    kicker: nonEmpty,
    lines: v.pipe(v.array(nonEmpty), v.minLength(1)),
  }),
  footer: v.object({
    tagline: nonEmpty,
  }),
  checkpoints: v.object({
    brief: v.object({
      ...baseFields,
      screen: v.object({
        greeting: nonEmpty,
        user1: nonEmpty,
        assistant1: nonEmpty,
        user2: nonEmpty,
        assistant2: nonEmpty,
      }),
    }),
    shortlist: v.object({
      ...baseFields,
      screen: v.object({
        user: nonEmpty,
        assistant: nonEmpty,
        cards: v.pipe(v.array(listingCard), v.length(3)),
      }),
    }),
    forensic: v.object({
      ...baseFields,
      screen: v.object({
        checked: nonEmpty,
        amberTitle: nonEmpty,
        amberSummary: nonEmpty,
        amberBullets: v.pipe(v.array(nonEmpty), v.length(3)),
        greenLine: nonEmpty,
      }),
    }),
    call: v.object({
      ...baseFields,
      screen: v.object({
        approvalUser: nonEmpty,
        approvalAssistant: nonEmpty,
        dialing: nonEmpty,
        transcript: v.pipe(v.array(transcriptLine), v.length(4)),
        agreed: nonEmpty,
        endedChip: nonEmpty,
      }),
    }),
    booked: v.object({
      ...baseFields,
      screen: v.object({
        assistant: nonEmpty,
        calendar: v.object({
          day: nonEmpty,
          month: nonEmpty,
          title: nonEmpty,
          time: nonEmpty,
        }),
      }),
    }),
  }),
});

export const copy = v.parse(copySchema, en);
export type Copy = v.InferOutput<typeof copySchema>;
export type CheckpointCopy = Copy["checkpoints"][keyof Copy["checkpoints"]];
