import { getRecommendations } from "../services/recommendationService.js";
import { getPartnerConfig, updatePartnerConfig } from "../services/partnerConfigService.js";
import { listMemberIds, getMemberProfile } from "../services/memberService.js";

function printResult(label: string, result: Awaited<ReturnType<typeof getRecommendations>>) {
  console.log(`\n${label}`);
  console.log("-".repeat(label.length));
  console.log(
    `cap: ${result.appliedRules.recommendationCap}  |  excluded categories: [${result.appliedRules.excludedCategories.join(", ") || "none"}]  |  ` +
      `considered: ${result.appliedRules.candidatesConsidered}  |  filtered by exclusion: ${result.appliedRules.excludedByCategory}  |  truncated by cap: ${result.appliedRules.truncatedByCap}`
  );
  for (const rec of result.recommendations) {
    console.log(`  [${rec.category.padEnd(9)}] ${rec.title} — ${rec.destination}  (score ${rec.score})`);
  }
  if (result.recommendations.length === 0) console.log("  (no recommendations)");
}

async function main() {
  console.log("=== Agentic Travel Recommendations — end-to-end demo ===");

  const memberIds = await listMemberIds();
  for (const id of memberIds) {
    const member = await getMemberProfile(id);
    const result = await getRecommendations(id);
    printResult(`${member!.name} (${id}, partner ${result.partnerId})`, result);
  }

  console.log(
    "\nNote: Dana Whitfield and Owen Castillo both *prefer* cruise, but their partners " +
      "(Aurora Rewards / Harborview Alliance) exclude that category — it never appears above."
  );

  console.log("\n=== Live partner-config change ===");
  const before = await getPartnerConfig("p-aurora");
  console.log(`Aurora Rewards before: cap=${before!.recommendationCap}, excluded=[${before!.excludedCategories.join(", ")}]`);

  await updatePartnerConfig("p-aurora", { recommendationCap: 1, excludedCategories: ["cruise", "beach"] });

  const after = await getRecommendations("m-1001");
  printResult("Dana Whitfield (m-1001) AFTER Aurora drops cap to 1 and adds a beach exclusion", after);
  console.log(
    "\nNo code change or redeploy was needed — the very next recommendation call picked up " +
      "the partner's new cap and exclusion, because partner config is read fresh on every request."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
