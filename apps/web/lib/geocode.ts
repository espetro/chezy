// Static Barcelona anchors for the demo: no real geocoding service is wired
// yet, so the work address is matched against a handful of well-known
// reference points. Unmatched addresses fall back to the default anchor with
// `approximate: true`.

export interface GeoPoint {
  readonly lat: number;
  readonly lon: number;
}

export interface GeocodeResult {
  readonly point: GeoPoint;
  readonly label: string;
  readonly approximate: boolean;
}

interface Anchor {
  readonly point: GeoPoint;
  readonly label: string;
  readonly keywords: readonly string[];
}

const DEFAULT_ANCHOR: Anchor = {
  point: { lat: 41.3954, lon: 2.1618 },
  label: "Diagonal 405 / Passeig de Gràcia",
  keywords: [
    "diagonal",
    "passeig de gracia",
    "paseo de gracia",
    "pg. de gracia",
  ],
};

const ANCHORS: readonly Anchor[] = [
  DEFAULT_ANCHOR,
  {
    point: { lat: 41.387, lon: 2.1701 },
    label: "Plaça Catalunya",
    keywords: ["placa catalunya", "plaza cataluna", "pl. catalunya"],
  },
  {
    point: { lat: 41.4036, lon: 2.187 },
    label: "Glòries / 22@",
    keywords: ["glories", "22@", "poblenou"],
  },
  {
    point: { lat: 41.3792, lon: 2.14 },
    label: "Sants Estació",
    keywords: ["sants"],
  },
  {
    point: { lat: 41.4036, lon: 2.1744 },
    label: "Sagrada Família",
    keywords: ["sagrada familia"],
  },
  {
    point: { lat: 41.3751, lon: 2.1489 },
    label: "Plaça Espanya",
    keywords: ["placa espanya", "plaza espana", "pl. espanya"],
  },
];

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function geocodeWorkAddress(address: string): GeocodeResult {
  const normalized = normalizeText(address);
  for (const anchor of ANCHORS) {
    if (anchor.keywords.some((kw) => normalized.includes(kw))) {
      return { point: anchor.point, label: anchor.label, approximate: false };
    }
  }
  return {
    point: DEFAULT_ANCHOR.point,
    label: DEFAULT_ANCHOR.label,
    approximate: true,
  };
}
