import "dotenv/config";
import { agent } from "./agent.js";

async function main() {
  const start = Date.now();
  console.log("[Broker AI] Starting pipeline: scrape → extract → analyze\n");
  const graph = agent();
  const result = await graph.invoke({});
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log("\n[Broker AI] Pipeline complete in", elapsed, "s. Results:\n");
  console.log("URL scraped:", result.url);
  console.log("Markdown length:", result.scrapedMarkdown?.length ?? 0, "chars");
  console.log("Images:", result.scrapedImages?.length ?? 0);
  if (result.extractedApartment) {
    console.log("\n--- Extracted apartment (Broker AI) ---\n");
    console.log(JSON.stringify(result.extractedApartment, null, 2));
  }
  if (result.apartmentAnalysis) {
    const a = result.apartmentAnalysis;
    console.log("\n--- Expert analysis ---\n");
    console.log("## Market assessment\n", a.marketAssessment);
    console.log("\n## Design & layout\n", a.designAndLayout);
    console.log("\n## Space usage\n", a.spaceUsage);
    console.log("\n## Pros & cons\n", a.prosAndCons);
    console.log("\n## Risks & considerations\n", a.risksAndConsiderations);
    console.log("\n## Summary & recommendation\n", a.summaryAndRecommendation);
  }
  if (result.scrapedMarkdown && !result.extractedApartment) {
    console.log("\n--- First 500 chars of scraped content ---\n");
    console.log(result.scrapedMarkdown.slice(0, 500));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
