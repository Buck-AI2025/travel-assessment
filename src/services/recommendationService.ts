import { getMemberProfile } from "./memberService.js";
import { getPartnerConfig } from "./partnerConfigService.js";
import { listOffers } from "./catalogService.js";
import { scoreOffersForMember } from "./recommendationEngine.js";
import { enforcePartnerRules } from "./partnerRules.js";
import type { RecommendationResult } from "../types.js";

export class MemberNotFoundError extends Error {
  constructor(memberId: string) {
    super(`No member found with id "${memberId}"`);
    this.name = "MemberNotFoundError";
  }
}

export class PartnerConfigNotFoundError extends Error {
  constructor(partnerId: string) {
    super(`No partner config found for partnerId "${partnerId}"`);
    this.name = "PartnerConfigNotFoundError";
  }
}

export async function getRecommendations(memberId: string): Promise<RecommendationResult> {
  const member = await getMemberProfile(memberId);
  if (!member) throw new MemberNotFoundError(memberId);

  // Partner config is re-fetched on every call rather than cached at
  // startup, so a partner's cap/exclusion change is picked up on the very
  // next request. See README Section A for the trade-off this implies.
  const partnerConfig = await getPartnerConfig(member.partnerId);
  if (!partnerConfig) throw new PartnerConfigNotFoundError(member.partnerId);

  const offers = await listOffers();
  const scored = scoreOffersForMember(member, offers);
  const { recommendations, appliedRules } = enforcePartnerRules(scored, partnerConfig);

  return {
    memberId: member.memberId,
    partnerId: member.partnerId,
    recommendations,
    appliedRules,
  };
}
