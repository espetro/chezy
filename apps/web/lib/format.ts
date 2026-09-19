export const eur = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
  // es-ES sets minimumGroupingDigits=2, so 4187 would render "4187 €"; force
  // grouping so prices always read "4.187 €".
  useGrouping: "always",
});

// es-ES integer grouping without the currency symbol, for spoken prices.
export const esInt = new Intl.NumberFormat("es-ES", {
  useGrouping: "always",
  maximumFractionDigits: 0,
});

// TTS-safe text: whitespace collapsed, straight apostrophes become curly
// (SLNG HTML-escapes ' into &#x27; in the rendered prompt), double quotes
// stripped.
export function speechText(value: string): string {
  return value.replace(/\s+/g, " ").replace(/'/g, "’").replace(/"/g, "").trim();
}

// ALL-CAPS portal titles read letter-by-letter through TTS; downcase them to
// sentence case when >= 60% of the letters are uppercase. Mixed-case input is
// returned untouched (aside from speechText cleanup).
export function sentenceCase(value: string): string {
  const letters = value.match(/\p{L}/gu) ?? [];
  const upper = letters.filter((c) => /\p{Lu}/u.test(c)).length;
  const cased =
    letters.length > 0 && upper / letters.length >= 0.6
      ? value.toLowerCase().replace(/\p{L}/u, (c) => c.toUpperCase())
      : value;
  return speechText(cased);
}

const STREET_CONNECTORS = new Set([
  "de",
  "del",
  "la",
  "las",
  "el",
  "los",
  "i",
  "d’",
  "l’",
  "dels",
  "les",
]);

// Title-case for street names: "FERRAN VALLS I TABERNER" -> "Ferran Valls i
// Taberner", connectors stay lowercase, first word always capitalised.
export function streetCase(value: string): string {
  const words = speechText(value).toLowerCase().split(" ");
  const cased = words
    .map((word, i) =>
      i > 0 && STREET_CONNECTORS.has(word) ? word : word.replace(/\p{L}/u, (c) => c.toUpperCase()),
    )
    .join(" ");
  return speechText(cased);
}
