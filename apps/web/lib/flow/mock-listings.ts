import type { Listing } from "@/lib/flow/types";

export const mockListings: Listing[] = [
  {
    id: "gracia-01",
    title: "Bright apartment with balcony",
    neighborhood: "Gràcia",
    city: "Barcelona",
    price: 1050,
    sizeM2: 62,
    rooms: 2,
    imageUrl:
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80",
    agency: "Tecnocasa Gràcia",
    tags: ["Exterior-facing", "Elevator", "Renovated"],
    depositMonths: 1,
    sharedFlat: false,
    matchScore: 96,
    matchReasons: [
      { label: "Within budget", detail: "€1,050 vs. your €1,100 ceiling" },
      { label: "Priority neighborhood", detail: "Gràcia is your #1 neighborhood pick" },
      { label: "18 min to your office", detail: "Under your 30 min limit" },
    ],
    neighborhoodProfile: {
      shops: 92,
      nightlife: 78,
      safety: 85,
      transitMinutesToWork: 18,
      noise: 45,
    },
    availableFrom: "Nov 1, 2026",
  },
  {
    id: "eixample-02",
    title: "Renovated studio next to Sagrada Família",
    neighborhood: "Eixample",
    city: "Barcelona",
    price: 980,
    sizeM2: 45,
    rooms: 1,
    imageUrl:
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80",
    agency: "Tecnocasa Eixample Dreta",
    tags: ["Furnished", "Bills included", "Elevator"],
    depositMonths: 1,
    sharedFlat: false,
    matchScore: 88,
    matchReasons: [
      { label: "Within budget", detail: "€980 vs. your €1,100 ceiling" },
      { label: "Must-have met", detail: "Furnished, as you asked" },
      { label: "24 min to your office", detail: "Within your 30 min limit" },
    ],
    neighborhoodProfile: {
      shops: 88,
      nightlife: 60,
      safety: 90,
      transitMinutesToWork: 24,
      noise: 55,
    },
    availableFrom: "Oct 15, 2026",
  },
  {
    id: "poble-sec-03",
    title: "Apartment with terrace near Montjuïc",
    neighborhood: "Poble Sec",
    city: "Barcelona",
    price: 1100,
    sizeM2: 70,
    rooms: 2,
    imageUrl:
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=80",
    agency: "Tecnocasa Poble Sec",
    tags: ["Terrace", "Exterior-facing", "Pets allowed"],
    depositMonths: 2,
    sharedFlat: false,
    matchScore: 81,
    matchReasons: [
      { label: "At your budget limit", detail: "€1,100 matches your maximum ceiling" },
      { label: "Pets allowed", detail: "You marked this as a must-have" },
      { label: "29 min to your office", detail: "Just inside your 30 min limit" },
    ],
    neighborhoodProfile: {
      shops: 70,
      nightlife: 82,
      safety: 75,
      transitMinutesToWork: 29,
      noise: 50,
    },
    availableFrom: "Dec 1, 2026",
  },
  {
    id: "sant-antoni-04",
    title: "Penthouse with elevator in Sant Antoni",
    neighborhood: "Sant Antoni",
    city: "Barcelona",
    price: 1250,
    sizeM2: 58,
    rooms: 2,
    imageUrl:
      "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1200&q=80",
    agency: "Tecnocasa Sant Antoni",
    tags: ["Elevator", "Exterior-facing"],
    depositMonths: 1,
    sharedFlat: true,
    matchScore: 72,
    matchReasons: [
      { label: "Over your budget", detail: "€1,250 vs. your €1,100 ceiling" },
      { label: "Secondary neighborhood", detail: "Not in your top picks, but borders Eixample" },
    ],
    neighborhoodProfile: {
      shops: 85,
      nightlife: 70,
      safety: 88,
      transitMinutesToWork: 20,
      noise: 48,
    },
    availableFrom: "Nov 1, 2026",
  },
  {
    id: "sants-05",
    title: "Renovated family apartment in Sants",
    neighborhood: "Sants",
    city: "Barcelona",
    price: 890,
    sizeM2: 75,
    rooms: 3,
    imageUrl:
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1200&q=80",
    agency: "Tecnocasa Sants",
    tags: ["Renovated", "Elevator", "Bills included"],
    depositMonths: 3,
    sharedFlat: false,
    matchScore: 65,
    matchReasons: [
      { label: "Well under budget", detail: "€890 vs. your €1,100 ceiling" },
      { label: "Neighborhood outside your selection", detail: "You didn't pick Sants among your neighborhoods" },
    ],
    neighborhoodProfile: {
      shops: 75,
      nightlife: 40,
      safety: 82,
      transitMinutesToWork: 33,
      noise: 42,
    },
    availableFrom: "Oct 20, 2026",
  },
];

export const getListingById = (id: string) =>
  mockListings.find((listing) => listing.id === id);

export const topMatch = mockListings.reduce((best, listing) =>
  listing.matchScore > best.matchScore ? listing : best,
);
