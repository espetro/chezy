import type { ComparisonField, ComparisonPanelSpec, OutdoorSpace } from "@chezy/contract";
import type { Listing } from "~/lib/db/schema";
import { eur, sentenceCase } from "~/lib/format";

// Column title for a spec listingId that has no matching Listing row.
export const UNKNOWN_LISTING_TITLE = "Unknown listing";

export interface ResolvedPanel {
  title: string;
  focus: ComparisonPanelSpec["focus"];
  actions: ComparisonPanelSpec["actions"];
  columns: { listingId: string; title: string }[];
  rows: { field: ComparisonField; label: string; note?: string; cells: string[] }[];
}

const UNKNOWN = "Unknown";

const PHOTO_OUTDOOR_LABEL: Partial<Record<OutdoorSpace, string>> = {
  balcony: "Balcony seen in photos",
  terrace: "Terrace seen in photos",
  patio: "Patio seen in photos",
  garden: "Garden seen in photos",
};
const COLUMN_TITLE_MAX = 48;

// Cuts long listing titles at a word boundary so column headers and action
// labels stay readable on a 375px viewport.
const columnTitle = (title: string) => {
  const cased = sentenceCase(title);
  if (cased.length <= COLUMN_TITLE_MAX) return cased;
  const cut = cased.slice(0, COLUMN_TITLE_MAX);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 20)).trimEnd()}…`;
};

const cellFor = (field: ComparisonField, row: Listing): string => {
  switch (field) {
    case "price":
      return row.priceEur === null ? UNKNOWN : `${eur.format(row.priceEur)}/mo`;
    case "area":
      return row.neighbourhood ?? row.district ?? UNKNOWN;
    case "balcony":
      if (row.amenities.some((amenity) => /balcony/i.test(amenity))) return "Balcony listed";
      if (row.amenities.some((amenity) => /terrace/i.test(amenity))) return "Terrace listed";
      return (row.outdoorSpace && PHOTO_OUTDOOR_LABEL[row.outdoorSpace]) || "Not listed";
    case "rooms":
      return row.rooms === null ? UNKNOWN : `${row.rooms} room${row.rooms === 1 ? "" : "s"}`;
    case "size":
      return row.builtM2 === null ? UNKNOWN : `${Math.round(row.builtM2)} m²`;
  }
};

// Resolves a validated spec against the Listing rows it references. The spec
// never carries display values; every cell is computed here from live data.
export const resolvePanel = (spec: ComparisonPanelSpec, rows: Listing[]): ResolvedPanel => {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return {
    title: spec.title,
    focus: spec.focus,
    actions: spec.actions,
    columns: spec.listingIds.map((listingId) => {
      const row = byId.get(listingId);
      return {
        listingId,
        title: row ? columnTitle(row.title) : UNKNOWN_LISTING_TITLE,
      };
    }),
    rows: spec.rows.map((row) => ({
      field: row.field,
      label: row.label,
      note: row.note,
      cells: spec.listingIds.map((listingId) => {
        const listingRow = byId.get(listingId);
        return listingRow ? cellFor(row.field, listingRow) : UNKNOWN;
      }),
    })),
  };
};
