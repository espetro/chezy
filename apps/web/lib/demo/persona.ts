import { SearchProfileInputSchema } from "@chezy/contract";
import * as v from "valibot";

export const DEMO_PERSONA = v.parse(SearchProfileInputSchema, {
  workAddress: "Norrsken / Poblenou 22@",
  maxCommuteMin: 25,
  neighbourhoods: ["Poblenou", "Sant Martí"],
  minPriceEur: 1500,
  maxPriceEur: 2500,
  minRooms: 2,
  minM2: 60,
  // oxlint-disable-next-line unicorn/no-null
  moveDate: null,
  flexibleDays: 15,
  mustHaves: ["balcony_or_terrace"],
  redLines: [],
  alertsEnabled: false,
});

export const DEMO_CANDIDATE_IDS = [
  "fotocasa:190866104",
  "fotocasa:190451552",
  "fotocasa:189698965",
] as const;
