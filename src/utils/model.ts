import { ChatOpenAI } from "@langchain/openai";

export const model = new ChatOpenAI({
  model: "anthropic/claude-sonnet-4",
  temperature: 0,
  apiKey: process.env.OPENROUTER_API_KEY,
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
  },
});
