import { z } from "zod";

/**
 * Structured output for Broker AI expert analysis: a complete
 * and thorough analysis of an apartment from a buying/selling,
 * design, and space-usage perspective.
 */
export const ApartmentAnalysisSchema = z.object({
  marketAssessment: z
    .string()
    .describe(
      "Assessment of price vs market, value for the area, who this listing suits (investors, first-time buyers, families), and any market context (e.g. trend in the neighborhood). Be specific and reference the listing data."
    ),
  designAndLayout: z
    .string()
    .describe(
      "Expert view on layout quality, room flow, natural light, ceiling height, finishes, and overall design. Comment on strengths and weaknesses from an interior design and livability perspective."
    ),
  spaceUsage: z
    .string()
    .describe(
      "How to use the space effectively: room roles, storage potential, flexibility for different lifestyles (e.g. WFH, kids), efficiency of the floor plan, and any suggestions to maximize the space."
    ),
  prosAndCons: z
    .string()
    .describe(
      "Clear, concise list or paragraph of main advantages and disadvantages of this apartment (location, building, condition, price, layout, etc.)."
    ),
  risksAndConsiderations: z
    .string()
    .describe(
      "Risks and things to verify: building/legal issues, maintenance, noise, future costs (renovation, fees), neighborhood factors, or anything a buyer should check before deciding."
    ),
  summaryAndRecommendation: z
    .string()
    .describe(
      "Overall verdict: who should consider this apartment, whether it represents good value, best use case (e.g. primary residence, rental, flip), and a clear recommendation (e.g. strong buy, consider with caveats, avoid). Be direct and actionable."
    ),
});

export type ApartmentAnalysis = z.infer<typeof ApartmentAnalysisSchema>;
