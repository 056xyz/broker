import { z } from "zod";

/**
 * Structured output schema for Broker AI: relevant information
 * extracted from a scraped apartment listing (e.g. imot.bg).
 */
export const ApartmentExtractionSchema = z.object({
  title: z.string().describe("Listing title or short headline"),
  address: z.string().optional().describe("Full address or location (city, district, area)"),
  price: z.number().optional().describe("Price as a number (no currency symbols)"),
  currency: z.string().optional().describe("Currency code or symbol, e.g. EUR, BGN"),
  areaSqm: z.number().optional().describe("Living area in square meters"),
  rooms: z.number().optional().describe("Number of rooms (e.g. 2 for 2-room apartment)"),
  bedrooms: z.number().optional().describe("Number of bedrooms"),
  floor: z.union([z.number(), z.string()]).optional().describe("Floor number or 'ground', 'last', etc."),
  totalFloors: z.number().optional().describe("Total floors in the building"),
  buildingType: z.string().optional().describe("e.g. panel, brick, new construction"),
  yearBuilt: z.number().optional().describe("Year built or renovated"),
  condition: z.string().optional().describe("Condition: renovated, needs renovation, new, etc."),
  amenities: z.array(z.string()).optional().describe("List of amenities: parking, elevator, balcony, etc."),
  description: z.string().optional().describe("Full or summarized listing description"),
  contactName: z.string().optional().describe("Name of seller or agent"),
  contactPhone: z.string().optional().describe("Phone number for contact"),
  contactEmail: z.string().optional().describe("Email for contact"),
  listingUrl: z.string().optional().describe("Original listing URL"),
  rawNotes: z.string().optional().describe("Any other relevant details not covered above"),
});

export type ApartmentExtraction = z.infer<typeof ApartmentExtractionSchema>;
