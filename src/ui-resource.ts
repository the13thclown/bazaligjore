import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";

export const FAMILY_GRAPH_RESOURCE_URI = "ui://bazaligjore/family-graph.html";

const here = path.dirname(fileURLToPath(import.meta.url));
const UI_HTML_PATH = path.join(here, "..", "dist", "ui", "index.html");

let cached: string | null = null;

export function registerUiResources(server: McpServer) {
  registerAppResource(
    server,
    FAMILY_GRAPH_RESOURCE_URI,
    FAMILY_GRAPH_RESOURCE_URI,
    { mimeType: RESOURCE_MIME_TYPE },
    async () => {
      if (!cached) {
        try {
          cached = await readFile(UI_HTML_PATH, "utf-8");
        } catch {
          cached =
            "<!doctype html><p>UI bundle not built. Run <code>npm run build:ui</code> in mcp-server/.</p>";
        }
      }
      return {
        contents: [{ uri: FAMILY_GRAPH_RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: cached }],
      };
    }
  );
}
