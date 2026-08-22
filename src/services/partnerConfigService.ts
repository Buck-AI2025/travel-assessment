import partnersData from "../data/partners.json" with { type: "json" };
import type { PartnerConfig } from "../types.js";

// Mocked upstream: in production this would call the partner-configuration
// service, which is the source of truth for caps and category exclusions.
// Held in memory here (not re-read from disk) so a runtime update — e.g. via
// updatePartnerConfig — is visible immediately, the same way a config-service
// push or webhook would be in production.
const partners: PartnerConfig[] = (partnersData as PartnerConfig[]).map((p) => ({ ...p }));

export async function getPartnerConfig(partnerId: string): Promise<PartnerConfig | undefined> {
  return partners.find((p) => p.partnerId === partnerId);
}

// Simulates a partner pushing a config change (new cap and/or exclusions).
// No caching layer sits in front of this in the POC, so the very next
// getPartnerConfig call reflects it — see README Section A for how a real
// deployment (with a cache) would need to invalidate on this same event.
export async function updatePartnerConfig(
  partnerId: string,
  patch: Partial<Pick<PartnerConfig, "recommendationCap" | "excludedCategories">>
): Promise<PartnerConfig | undefined> {
  const partner = partners.find((p) => p.partnerId === partnerId);
  if (!partner) return undefined;
  Object.assign(partner, patch, { lastUpdated: new Date().toISOString() });
  return partner;
}
