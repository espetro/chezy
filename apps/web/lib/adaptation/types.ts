import type { OutdoorSpace } from "@chezy/contract";

// Sanitized listing facts handed to the provider (prompt + mock context).
// Only these fields ever leave the server; nulls come from the Listing row.
export interface CandidateFacts {
  id: string;
  title: string;
  priceEur: number | null;
  neighbourhood: string | null;
  rooms: number | null;
  builtM2: number | null;
  amenities: string[];
  outdoorSpace: OutdoorSpace | null;
}
