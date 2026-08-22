export interface Member {
  memberId: string;
  name: string;
  partnerId: string;
  tier: "silver" | "gold" | "platinum";
  preferredCategories: string[];
  pastCategories: string[];
}

export interface PartnerConfig {
  partnerId: string;
  name: string;
  recommendationCap: number;
  excludedCategories: string[];
  lastUpdated: string;
}

export interface TravelOffer {
  offerId: string;
  title: string;
  category: string;
  destination: string;
  blurb: string;
}

export interface ScoredOffer extends TravelOffer {
  score: number;
}

export interface RecommendationResult {
  memberId: string;
  partnerId: string;
  recommendations: ScoredOffer[];
  appliedRules: {
    recommendationCap: number;
    excludedCategories: string[];
    candidatesConsidered: number;
    excludedByCategory: number;
    truncatedByCap: number;
  };
}
