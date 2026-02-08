import "dotenv/config";
import { agent } from "./agent.js";

async function main() {
  const graph = agent();
  const result = await graph.invoke({});
  console.log("URL scraped:", result.url);
  console.log("Markdown length:", result.scrapedMarkdown?.length ?? 0, "chars");
  if (result.scrapedMarkdown) {
    console.log("\n--- First 500 chars of scraped content ---\n");
    console.log(result.scrapedMarkdown.slice(0, 500));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
