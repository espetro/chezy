// Deterministic demo listings. Each card carries the forensic truth tags
// pre-extracted so the swipe deck works with no network. `mock_properties`
// is the Layer 0 fixture from .agents/plans/2026-09-19-layer0.md.

export interface MockProperty {
  readonly id: string;
  readonly title: string;
  readonly neighborhood: string;
  readonly priceEur: number;
  readonly cadastralSqm: number;
  readonly pricePerSqm: number;
  readonly neighborhoodAvgPerSqm: number;
  readonly sunlight: "direct" | "lightwell";
  readonly truthTags: readonly string[];
  readonly agentLine: string;
}

export const MOCK_PROPERTIES = [
  {
    id: "card-1-lightwell",
    title: "Atico centrico luminoso",
    neighborhood: "El Raval",
    priceEur: 349000,
    cadastralSqm: 68,
    pricePerSqm: 5132,
    neighborhoodAvgPerSqm: 4548,
    sunlight: "lightwell",
    truthTags: [
      "Ventanas a patio interior de 1.5 m",
      "0% luz solar directa",
      "Sin ascensor",
    ],
    agentLine: "+34930000001",
  },
  {
    id: "card-2-eixample",
    title: "Piso reformado en Eixample Dreta",
    neighborhood: "Eixample",
    priceEur: 372000,
    cadastralSqm: 84,
    pricePerSqm: 4428,
    neighborhoodAvgPerSqm: 5350,
    sunlight: "direct",
    truthTags: [
      "Orientacion sur, luz directa",
      "Ascensor",
      "A 6 min de Arc de Triomf",
    ],
    agentLine: "+34930000002",
  },
  {
    id: "card-3-poblenou",
    title: "Atico con terraza en Poblenou",
    neighborhood: "Poblenou",
    priceEur: 361000,
    cadastralSqm: 79,
    pricePerSqm: 4569,
    neighborhoodAvgPerSqm: 4850,
    sunlight: "direct",
    truthTags: [
      "Terraza de 12 m2",
      "Luz directa manana",
      "Ascensor",
      "A 12 min de Arc de Triomf",
    ],
    agentLine: "+34930000003",
  },
] as const satisfies readonly MockProperty[];

/** Non-empty by construction; throws rather than returning undefined. */
export function propertyAt(index: number): MockProperty {
  const found = MOCK_PROPERTIES[index % MOCK_PROPERTIES.length];
  if (!found) {
    throw new Error("MOCK_PROPERTIES is empty");
  }
  return found;
}
