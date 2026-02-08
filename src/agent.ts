import "dotenv/config";
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { firecrawl } from "./utils/firecrawl.js";
import { model } from "./utils/model.js";
import { ApartmentExtractionSchema, type ApartmentExtraction } from "./utils/apartmentSchema.js";
import { ApartmentAnalysisSchema, type ApartmentAnalysis } from "./utils/analysisSchema.js";

const State = Annotation.Root({
  url: Annotation<string>(),
  scrapedMarkdown: Annotation<string>(),
  scrapedImages: Annotation<string[]>(),
  extractedApartment: Annotation<ApartmentExtraction>(),
  apartmentAnalysis: Annotation<ApartmentAnalysis>(),
});

// Hardcoded link for now; replace with user-provided URL later
const HARDCODED_URL =
  "https://www.imot.bg/obiava-1a176909066903505-prodava-ednostaen-apartament-oblast-burgas-gr-aheloy";

async function scrapeNode(_state: typeof State.State) {
  const urlToScrape = HARDCODED_URL;
  console.log("[scrape] Starting Firecrawl single scrape...", urlToScrape);
  const doc = await firecrawl.scrape(urlToScrape, {
    formats: ["markdown", "images"],
  });
  const markdown = doc.markdown ?? "";
  const images = doc.images ?? [];
  console.log("[scrape] Done. Markdown:", markdown.length, "chars, images:", images.length);
  return {
    url: urlToScrape,
    scrapedMarkdown: markdown,
    scrapedImages: images,
  };
}

const EXTRACTION_SYSTEM = `You are Broker AI, an assistant that analyzes apartment listings. Extract all relevant information about the target apartment from the scraped listing content. Return only the structured data; omit any field you cannot find (leave optional fields undefined). For numbers (price, area, rooms, etc.) use numeric values. For lists (amenities) use an array of strings.`;

async function extractionNode(state: typeof State.State) {
  const markdown = state.scrapedMarkdown ?? "";
  const listingUrl = state.url ?? "";
  console.log("[extraction] Extracting structured apartment data (LLM)...");

  const structuredModel = model.withStructuredOutput(ApartmentExtractionSchema, {
    name: "ApartmentExtraction",
    method: "functionCalling",
  });

  const result = await structuredModel.invoke([
    new HumanMessage({
      content: `${EXTRACTION_SYSTEM}\n\nListing URL: ${listingUrl}\n\n--- Scraped markdown ---\n\n${markdown}`,
    }),
  ]);

  const extracted = result as ApartmentExtraction;
  console.log("[extraction] Done. Title:", extracted.title ?? "(none)", "| Price:", extracted.price ?? "—", extracted.currency ?? "");
  return {
    extractedApartment: extracted,
  };
}

const ANALYZE_SYSTEM = `You are an expert in buying and selling properties, interior design, and efficient use of living space. You give complete, thorough, and actionable analyses of apartments. Your audience is a potential buyer or investor who wants a professional assessment. Base your analysis strictly on the structured apartment data (and any listing context) provided. Be specific, cite numbers (price, area, etc.) where relevant, and give a clear recommendation. Write in clear paragraphs or bullet points as fits each section.`;

async function analyzeNode(state: typeof State.State) {
  const extracted = state.extractedApartment;
  const markdownSnippet = (state.scrapedMarkdown ?? "").slice(0, 8000);
  console.log("[analyze] Running expert analysis (LLM: market, design, space, recommendation)...");

  const structuredModel = model.withStructuredOutput(ApartmentAnalysisSchema, {
    name: "ApartmentAnalysis",
    method: "functionCalling",
  });

  const result = await structuredModel.invoke([
    new HumanMessage({
      content: `${ANALYZE_SYSTEM}\n\n--- Extracted apartment data (JSON) ---\n${JSON.stringify(extracted ?? {}, null, 2)}\n\n--- Listing excerpt (for context) ---\n${markdownSnippet || "(none)"}`,
    }),
  ]);

  const analysis = result as ApartmentAnalysis;
  console.log("[analyze] Done. Sections: market, design, space, pros/cons, risks, recommendation.");
  return {
    apartmentAnalysis: analysis,
  };
}

const graph = new StateGraph(State)
  .addNode("scrape", scrapeNode)
  .addNode("extraction", extractionNode)
  .addNode("analyze", analyzeNode)
  .addEdge(START, "scrape")
  .addEdge("scrape", "extraction")
  .addEdge("extraction", "analyze")
  .addEdge("analyze", END)
  .compile();

export function agent() {
  return graph;
}
