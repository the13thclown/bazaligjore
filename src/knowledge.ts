import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = path.join(here, "..", "knowledge");

export const GUIDES: Record<string, string> = {
  methodology:
    "How to research correctly: in-force tracing via REPEAL edges, GJK cross-checks, citation discipline, source-reliability tiers",
  "legal-system":
    "Map of the Albanian legal system: act types (VKM = VENDIM), hierarchy, numbering formats, the Official Gazette",
  amendments:
    "How acts amend each other: instruction anatomy ('Në ligjin nr.X…'), declensions, the omnibus trap, consolidated versions",
  "data-caveats":
    "Coverage and sharp edges: OCR ë/ç corruption, unreliable in_force flag, fast vs slow search paths",
  gjk:
    "Constitutional Court decisions: yearly numbering, the real 2019–20 gap, reading dispositives (shfuqizim vs rrëzim)",
  schema:
    "Table/column/index reference and worked examples for query_sql — read before writing SQL",
  "external-sources":
    "Beyond this DB: qbz PDF patterns, parliamentary debates API (bisedimet.parlament.al), court and registry websites",
};

const cache = new Map<string, string>();

export async function loadGuide(topic: string): Promise<string | null> {
  if (!(topic in GUIDES)) return null;
  if (!cache.has(topic)) {
    try {
      cache.set(topic, await readFile(path.join(KNOWLEDGE_DIR, `${topic}.md`), "utf-8"));
    } catch {
      return null;
    }
  }
  return cache.get(topic)!;
}

export function guideIndex(): string {
  return (
    "Available guides (call get_guide with a topic for the full text):\n" +
    Object.entries(GUIDES)
      .map(([t, d]) => `- ${t} — ${d}`)
      .join("\n")
  );
}

export function registerKnowledge(server: McpServer) {
  server.registerTool(
    "get_guide",
    {
      title: "Domain knowledge guides",
      description:
        "Returns expert guides on the Albanian legal system and this database — the accumulated know-how needed to " +
        "research correctly. Call with no topic to list available guides. Read 'methodology' before any nontrivial " +
        "research task, and 'schema' before using query_sql. Topics: " +
        Object.keys(GUIDES).join(", ") + ".",
      inputSchema: {
        topic: z.enum(Object.keys(GUIDES) as [string, ...string[]]).optional()
          .describe("Guide to fetch. Omit to get the index of all guides."),
      },
    },
    async (args: { topic?: string }) => {
      if (!args.topic) {
        return { content: [{ type: "text" as const, text: guideIndex() }] };
      }
      const body = await loadGuide(args.topic);
      if (!body) {
        return { content: [{ type: "text" as const, text: `Unknown guide '${args.topic}'.\n${guideIndex()}` }] };
      }
      return { content: [{ type: "text" as const, text: body }] };
    }
  );

  for (const [topic, description] of Object.entries(GUIDES)) {
    server.registerResource(
      `guide-${topic}`,
      `guide://bazaligjore/${topic}`,
      { title: `Guide: ${topic}`, description, mimeType: "text/markdown" },
      async () => {
        const body = (await loadGuide(topic)) ?? "Guide not bundled.";
        return {
          contents: [{ uri: `guide://bazaligjore/${topic}`, mimeType: "text/markdown", text: body }],
        };
      }
    );
  }
}
