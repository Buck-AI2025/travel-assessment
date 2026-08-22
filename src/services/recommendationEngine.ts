import type { Member, TravelOffer, ScoredOffer } from "../types.js";

// Scores every offer in the catalog for a member's preferences. This runs
// BEFORE partner rules are applied — it knows nothing about caps or
// exclusions, so it never needs to change when a partner's policy changes.
export function scoreOffersForMember(member: Member, offers: TravelOffer[]): ScoredOffer[] {
  const scored = offers.map((offer) => {
    let score = 1;
    if (member.preferredCategories.includes(offer.category)) score += 2;
    if (member.pastCategories.includes(offer.category)) score -= 1; // mild novelty bias
    return { ...offer, score };
  });

  return scored.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}
