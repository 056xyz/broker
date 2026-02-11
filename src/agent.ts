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

const MAX_ANALYZE_IMAGES = 15;
const IMAGE_FETCH_TIMEOUT_MS = 12_000;

/** Provider (Anthropic/OpenRouter) only accepts these image MIME types. */
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;

function normalizeImageMime(contentType: string | null): (typeof ALLOWED_IMAGE_TYPES)[number] {
  const mime = contentType?.split(";")[0]?.trim().toLowerCase() || "image/jpeg";
  if (ALLOWED_IMAGE_TYPES.includes(mime as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return mime as (typeof ALLOWED_IMAGE_TYPES)[number];
  }
  if (mime === "image/jpg") return "image/jpeg";
  return "image/jpeg";
}

/** Normalize data URL to use an allowed MIME type (for passthrough URLs). */
function normalizeDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) return dataUrl;
  const mime = normalizeImageMime(match[1]);
  return `data:${mime};base64,${match[2]}`;
}

/** Minimum image size in bytes to include (skip tiny tracking pixels, icons). */
const MIN_IMAGE_BYTES = 5_000;

/** Fetch image URLs and convert to base64 data URLs so the LLM provider can use them (they cannot download from many listing sites). */
async function resolveImagesToDataUrls(urls: string[], max: number): Promise<string[]> {
  const valid = urls.filter(
    (u) => typeof u === "string" && (u.startsWith("http") || u.startsWith("data:"))
  );
  const result: string[] = [];
  let fetchCount = 0;
  let skipped = 0;
  for (const u of valid) {
    if (result.length >= max) break;
    if (u.startsWith("data:")) {
      result.push(normalizeDataUrl(u));
      continue;
    }
    fetchCount++;
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
      const res = await fetch(u, {
        signal: controller.signal,
        headers: { "User-Agent": "BrokerAI/1.0 (apartment analysis)" },
      });
      clearTimeout(t);
      if (!res.ok) { skipped++; continue; }
      const rawMime = res.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
      // Skip non-raster images (SVG, etc.)
      if (rawMime && !rawMime.startsWith("image/") || rawMime === "image/svg+xml") {
        console.log("[analyze]   skip (type:", rawMime + ")", u.slice(0, 80));
        skipped++;
        continue;
      }
      const buf = await res.arrayBuffer();
      if (buf.byteLength < MIN_IMAGE_BYTES) {
        console.log("[analyze]   skip (too small:", buf.byteLength, "bytes)", u.slice(0, 80));
        skipped++;
        continue;
      }
      const base64 = Buffer.from(buf).toString("base64");
      const mime = normalizeImageMime(res.headers.get("content-type"));
      console.log("[analyze]   ok", mime, (buf.byteLength / 1024).toFixed(0) + "KB", u.slice(0, 80));
      result.push(`data:${mime};base64,${base64}`);
    } catch {
      skipped++;
    }
  }
  if (fetchCount > 0) {
    console.log("[analyze] Embedded", result.length, "images, skipped", skipped);
  }
  return result;
}

const ANALYZE_SYSTEM = `You are an expert in buying and selling properties, interior design, and efficient use of living space. You give complete, thorough, and actionable analyses of apartments. Your audience is a potential buyer or investor who wants a professional assessment. Base your analysis on the structured apartment data, the listing text, and the provided photos of the apartment. Use the images to assess layout, condition, natural light, finishes, and space use; cite what you see where relevant. Be specific, cite numbers (price, area, etc.) where relevant, and give a clear recommendation. Write in clear paragraphs or bullet points as fits each section.`;

function buildAnalyzeMessageContent(
  extracted: ApartmentExtraction | undefined,
  markdownSnippet: string,
  imageUrlsOrDataUrls: string[]
): Array<{ type: "text"; text: string } | { type: "image_url"; image_url: string | { url: string; detail?: "auto" | "low" | "high" } }> {
  const text = `${ANALYZE_SYSTEM}\n\n--- Extracted apartment data (JSON) ---\n${JSON.stringify(extracted ?? {}, null, 2)}\n\n--- Listing excerpt (for context) ---\n${markdownSnippet || "(none)"}`;
  const parts: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: string | { url: string; detail?: "auto" | "low" | "high" } }> = [
    { type: "text", text },
  ];
  for (let i = 0; i < Math.min(imageUrlsOrDataUrls.length, MAX_ANALYZE_IMAGES); i++) {
    parts.push({ type: "image_url", image_url: { url: imageUrlsOrDataUrls[i], detail: "auto" } });
  }
  return parts;
}

async function analyzeNode(state: typeof State.State) {
  const extracted = state.extractedApartment;
  const markdownSnippet = (state.scrapedMarkdown ?? "").slice(0, 8000);
  const imageUrls = state.scrapedImages ?? [];
  const resolvedImages = await resolveImagesToDataUrls(imageUrls, MAX_ANALYZE_IMAGES);
  console.log("[analyze] Running expert analysis (LLM +", resolvedImages.length, "images: market, design, space, recommendation)...");

  const structuredModel = model.withStructuredOutput(ApartmentAnalysisSchema, {
    name: "ApartmentAnalysis",
    method: "functionCalling",
  });

  const content = buildAnalyzeMessageContent(extracted, markdownSnippet, resolvedImages);

  const result = await structuredModel.invoke([
    new HumanMessage({
      content,
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
