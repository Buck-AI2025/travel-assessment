import type { PartnerConfig, ScoredOffer, RecommendationResult } from "../types.js";

// The single place partner business rules are enforced. Every path that
// returns recommendations (REST, MCP, CLI) must route through this function
// — it is not optional and not something a caller can skip, which is the
// direct fix for the "excluded category leaked through" incident class
// described in the README's incident runbook.
export function enforcePartnerRules(
  candidates: ScoredOffer[],
  partnerConfig: PartnerConfig
): Pick<RecommendationResult, "recommendations" | "appliedRules"> {
  const excludedSet = new Set(partnerConfig.excludedCategories.map((c) => c.toLowerCase()));

  const afterExclusions = candidates.filter((offer) => !excludedSet.has(offer.category.toLowerCase()));
  const excludedByCategory = candidates.length - afterExclusions.length;

  // A negative or non-integer cap must mean "show nothing," not
  // Array.prototype.slice's negative-index behavior (slice(0, -1) drops
  // only the last item, keeping the rest) — the opposite of what an
  // invalid cap should mean from the one function every surface trusts to
  // enforce this rule.
  const safeCap = Number.isInteger(partnerConfig.recommendationCap)
    ? Math.max(0, partnerConfig.recommendationCap)
    : 0;

  const capped = afterExclusions.slice(0, safeCap);
  const truncatedByCap = afterExclusions.length - capped.length;

  return {
    recommendations: capped,
    appliedRules: {
      recommendationCap: safeCap,
      excludedCategories: partnerConfig.excludedCategories,
      candidatesConsidered: candidates.length,
      excludedByCategory,
      truncatedByCap,
    },
  };
}
