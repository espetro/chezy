// Illustrative static data for the demo; not sourced.
// Per-district neighbourhood profile shown on the listing detail screen.

export interface DistrictProfile {
  readonly safety: number;
  readonly commerce: number;
  readonly noise: "Bajo" | "Bajo / Medio" | "Medio" | "Alto";
  readonly life: "Media" | "Alta" | "Muy Alta";
  readonly pois: Array<{
    readonly name: string;
    readonly minutes: number;
    readonly kind: "market" | "gym" | "pharmacy" | "metro" | "park";
  }>;
}

const DISTRICT_PROFILES: Record<string, DistrictProfile> = {
  "Sarrià - Sant Gervasi": {
    safety: 9.6,
    commerce: 7.8,
    noise: "Bajo",
    life: "Media",
    pois: [
      { name: "Mercat de Sarrià", minutes: 6, kind: "market" },
      { name: "Parc de l'Oreneta", minutes: 9, kind: "park" },
      { name: "FGC Sarrià", minutes: 4, kind: "metro" },
    ],
  },
  Gràcia: {
    safety: 8.4,
    commerce: 9.2,
    noise: "Medio",
    life: "Muy Alta",
    pois: [
      { name: "Mercat de la Llibertat", minutes: 4, kind: "market" },
      { name: "Metro Fontana (L3)", minutes: 3, kind: "metro" },
      { name: "Farmàcia Plaça de la Virreina", minutes: 5, kind: "pharmacy" },
    ],
  },
  "Les Corts": {
    safety: 9.1,
    commerce: 8.0,
    noise: "Bajo / Medio",
    life: "Media",
    pois: [
      { name: "Mercat de Les Corts", minutes: 5, kind: "market" },
      { name: "Metro Les Corts (L3)", minutes: 4, kind: "metro" },
      { name: "Canal Olímpic gym", minutes: 8, kind: "gym" },
    ],
  },
  "Ciutat Vella": {
    safety: 7.5,
    commerce: 9.8,
    noise: "Alto",
    life: "Muy Alta",
    pois: [
      { name: "Mercat de la Boqueria", minutes: 5, kind: "market" },
      { name: "Metro Liceu (L3)", minutes: 3, kind: "metro" },
      { name: "Parc de la Ciutadella", minutes: 9, kind: "park" },
    ],
  },
  Eixample: {
    safety: 8.7,
    commerce: 9.4,
    noise: "Medio",
    life: "Alta",
    pois: [
      { name: "Mercat de la Concepció", minutes: 6, kind: "market" },
      { name: "Metro Passeig de Gràcia (L2/L3/L4)", minutes: 4, kind: "metro" },
      { name: "Dir Diagonal gym", minutes: 7, kind: "gym" },
    ],
  },
  "Sant Martí": {
    safety: 8.3,
    commerce: 8.6,
    noise: "Bajo / Medio",
    life: "Alta",
    pois: [
      { name: "Mercat del Poblenou", minutes: 5, kind: "market" },
      { name: "Metro Llacuna (L4)", minutes: 4, kind: "metro" },
      { name: "Parc del Centre del Poblenou", minutes: 6, kind: "park" },
    ],
  },
  "Sants - Montjuïc": {
    safety: 8.1,
    commerce: 8.9,
    noise: "Medio",
    life: "Alta",
    pois: [
      { name: "Mercat de Sants", minutes: 4, kind: "market" },
      { name: "Sants Estació (L3/L5)", minutes: 6, kind: "metro" },
      { name: "Parc de Montjuïc", minutes: 9, kind: "park" },
    ],
  },
};

// District chips for the preferences form. `value` is the substring that
// matches the DB district text via ilike '%x%'.
export const DISTRICT_CHIPS: ReadonlyArray<{
  readonly label: string;
  readonly value: string;
}> = [
  { label: "Eixample", value: "Eixample" },
  { label: "Gràcia", value: "Gràcia" },
  { label: "Ciutat Vella", value: "Ciutat Vella" },
  { label: "Sant Martí", value: "Sant Martí" },
  { label: "Sants-Montjuïc", value: "Sants" },
  { label: "Les Corts", value: "Les Corts" },
  { label: "Sarrià-Sant Gervasi", value: "Sarrià" },
];

export function getDistrictProfile(district: string | null): DistrictProfile | undefined {
  if (!district) {
    return undefined;
  }
  return DISTRICT_PROFILES[district];
}
