# broker

TypeScript + LangGraph project using [OpenRouter](https://openrouter.ai) as the LLM provider.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and set your OpenRouter API key:

   ```bash
   cp .env.example .env
   ```

   Get an API key at [OpenRouter Keys](https://openrouter.ai/keys). Set `FIRECRAWL_API_KEY` in `.env` for the scrape node ([Firecrawl](https://firecrawl.dev)). For observability, set `LANGSMITH_TRACING=true` and `LANGSMITH_API_KEY` ([LangSmith](https://smith.langchain.com)).

3. Build:

   ```bash
   npm run build
   ```

## Run

- **Development** (TypeScript, no build step; needs `FIRECRAWL_API_KEY` in `.env`):

  ```bash
  npm run dev
  ```

- **Production** (run compiled JS after `npm run build`):

  ```bash
  npm run start
  ```

Both invoke the agent once: they scrape the hardcoded URL with Firecrawl and print the scraped URL and a short preview of the markdown.

## Project structure

- `src/utils/model.ts` – OpenRouter-configured ChatOpenAI instance
- `src/utils/firecrawl.ts` – Firecrawl client (single scrape)
- `src/agent.ts` – LangGraph agent: first node scrapes a URL with Firecrawl (single scrape), state has `url` and `scrapedMarkdown`. The URL is hardcoded in `HARDCODED_URL` for now.
- `src/run.ts` – Entry script: invokes the agent once and logs the scraped URL and a short markdown preview.
- `langgraph.json` – LangGraph config (graphs, dependencies)

## OpenRouter

The model is configured in `src/utils/model.ts` with `configuration.baseURL: "https://openrouter.ai/api/v1"`. Change the `model` field to use any [OpenRouter model](https://openrouter.ai/docs#models) (e.g. `anthropic/claude-sonnet-4`, `openai/gpt-4o`).

## LangSmith observability

Tracing is enabled when `LANGSMITH_TRACING=true` and `LANGSMITH_API_KEY` is set in `.env`. Invocations of the LangGraph agent (and any LangChain runnables) are sent to [LangSmith](https://smith.langchain.com). Use `LANGSMITH_PROJECT` to group traces (default: `"default"`). The agent module loads `dotenv/config` so `.env` is applied when the graph is loaded.
