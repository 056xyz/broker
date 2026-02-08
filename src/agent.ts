import "dotenv/config";
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { firecrawl } from "./utils/firecrawl.js";

const State = Annotation.Root({
  url: Annotation<string>(),
  scrapedMarkdown: Annotation<string>(),
});

// Hardcoded link for now; replace with user-provided URL later
const HARDCODED_URL = "https://www.imot.bg/obiava-1a176909066903505-prodava-ednostaen-apartament-oblast-burgas-gr-aheloy";

async function scrapeNode(_state: typeof State.State) {
  const urlToScrape = HARDCODED_URL;
  const doc = await firecrawl.scrape(urlToScrape, {
    formats: ["markdown","images"],
  });
  return {
    url: urlToScrape,
    scrapedMarkdown: doc.markdown ?? "",
    scrapedImages: doc.images ?? [],
  };
}

const graph = new StateGraph(State)
  .addNode("scrape", scrapeNode)
  .addEdge(START, "scrape")
  .addEdge("scrape", END)
  .compile();

export function agent() {
  return graph;
}
