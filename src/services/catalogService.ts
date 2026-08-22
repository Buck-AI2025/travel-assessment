import catalogData from "../data/catalog.json" with { type: "json" };
import type { TravelOffer } from "../types.js";

// Mocked upstream: in production this would call the offer/inventory service.
const catalog = catalogData as TravelOffer[];

export async function listOffers(): Promise<TravelOffer[]> {
  return catalog;
}
