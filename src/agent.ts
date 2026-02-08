import "dotenv/config";
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { firecrawl } from "./utils/firecrawl.js";
import { model } from "./utils/model.js";
import { ApartmentExtractionSchema, type ApartmentExtraction } from "./utils/apartmentSchema.js";

const State = Annotation.Root({
  url: Annotation<string>(),
  scrapedMarkdown: Annotation<string>(),
  scrapedImages: Annotation<string[]>(),
  extractedApartment: Annotation<ApartmentExtraction>(),
});

// Hardcoded link for now; replace with user-provided URL later
const HARDCODED_URL =
  "https://www.imot.bg/obiava-1a176909066903505-prodava-ednostaen-apartament-oblast-burgas-gr-aheloy";

async function scrapeNode(_state: typeof State.State) {
  const urlToScrape = HARDCODED_URL;
  const doc = await firecrawl.scrape(urlToScrape, {
    formats: ["markdown", "images"],
  });
  return {
    url: urlToScrape,
    scrapedMarkdown: doc.markdown ?? "",
    scrapedImages: doc.images ?? [],
  };
}

const EXTRACTION_SYSTEM = `You are Broker AI, an assistant that analyzes apartment listings. Extract all relevant information about the target apartment from the scraped listing content. Return only the structured data; omit any field you cannot find (leave optional fields undefined). For numbers (price, area, rooms, etc.) use numeric values. For lists (amenities) use an array of strings.`;

async function extractionNode(state: typeof State.State) {
  const markdown = state.scrapedMarkdown ?? "";
  const listingUrl = state.url ?? "";

  const structuredModel = model.withStructuredOutput(ApartmentExtractionSchema, {
    name: "ApartmentExtraction",
    method: "functionCalling",
  });

  const result = await structuredModel.invoke([
    new HumanMessage({
      content: `${EXTRACTION_SYSTEM}\n\nListing URL: ${listingUrl}\n\n--- Scraped markdown ---\n\n${markdown}`,
    }),
  ]);

  return {
    extractedApartment: result as ApartmentExtraction,
  };
}

const graph = new StateGraph(State)
  .addNode("scrape", scrapeNode)
  .addNode("extraction", extractionNode)
  .addEdge(START, "scrape")
  .addEdge("scrape", "extraction")
  .addEdge("extraction", END)
  .compile();

export function agent() {
  return graph;
}
