import "dotenv/config";
import { agent } from "./agent.js";

async function main() {
  const graph = agent();
  const result = await graph.invoke({});
  console.log("URL scraped:", result.url);
  console.log("Markdown length:", result.scrapedMarkdown?.length ?? 0, "chars");
  console.log("Images:", result.scrapedImages?.length ?? 0);
  if (result.extractedApartment) {
    console.log("\n--- Extracted apartment (Broker AI) ---\n");
    console.log(JSON.stringify(result.extractedApartment, null, 2));
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
