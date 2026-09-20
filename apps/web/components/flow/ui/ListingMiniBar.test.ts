import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ListingMiniBar } from "~/components/flow/ui/ListingMiniBar";
import type { ListingSummary } from "~/lib/listings";

const listing: ListingSummary = {
  id: "fotocasa:190866104",
  title: "Piso de obra nueva de 2 habitaciones",
  operation: "rent",
  priceEur: 2300,
  pricePeriod: "month",
  rooms: 2,
  bathrooms: 1,
  builtM2: 93,
  district: "Sant Martí",
  neighbourhood: "El Poblenou",
  street: null,
  url: "https://example.test/listing",
  coverUrl: null,
  description: "",
};

describe("ListingMiniBar", () => {
  it("shows price, size, rooms and match, and links to the listing page", () => {
    const html = renderToStaticMarkup(
      createElement(ListingMiniBar, { listing, score: 87.4, caption: "Top match of 6" }),
    );
    expect(html).toContain('href="/explore/fotocasa%3A190866104"');
    expect(html).toContain("€2,300");
    expect(html).toContain("/month");
    expect(html).toContain("El Poblenou · 93 m² · 2 bd");
    expect(html).toContain("87%");
    expect(html).toContain("Top match of 6");
    expect(html).not.toContain("<img");
  });

  it("labels unknown values instead of inventing them", () => {
    const html = renderToStaticMarkup(
      createElement(ListingMiniBar, {
        listing: { ...listing, priceEur: null, builtM2: null, rooms: null, neighbourhood: null },
      }),
    );
    expect(html).toContain("Price unknown");
    expect(html).toContain("Sant Martí");
    expect(html).not.toContain("m²");
    expect(html).not.toContain("€0");
    expect(html).not.toContain("match");
  });
});
