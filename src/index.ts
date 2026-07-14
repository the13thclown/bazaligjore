import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildServer } from "./server.js";
import { pool, healthPool } from "./db.js";

const app = express();
// Behind Azure App Service's reverse proxy: trust X-Forwarded-For so the rate
// limiter keys on the real client IP, not the proxy.
app.set("trust proxy", 1);
app.use(cors({ origin: "*", exposedHeaders: ["Mcp-Session-Id"] }));
app.use(express.json({ limit: "1mb" }));

// Per-IP rate limit on the unauthenticated MCP endpoint. Generous enough for a
// real research session's burst of tool calls, low enough to blunt pool-
// exhaustion abuse. Tune MCP_RATE_MAX if legitimate use hits the ceiling.
const mcpLimiter = rateLimit({
  windowMs: 60_000,
  max: Number(process.env.MCP_RATE_MAX ?? 120),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    jsonrpc: "2.0",
    error: { code: -32029, message: "Rate limit exceeded — slow down and retry." },
    id: null,
  },
});

// Stateless streamable HTTP: a fresh server+transport per request, shared DB pool.
app.post("/mcp", mcpLimiter, async (req, res) => {
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    transport.close();
    server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("MCP request failed:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

const methodNotAllowed = (_req: express.Request, res: express.Response) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed (stateless server)" },
    id: null,
  });
};
app.get("/mcp", methodNotAllowed);
app.delete("/mcp", methodNotAllowed);

app.get("/healthz", async (_req, res) => {
  try {
    // Dedicated pool — stays responsive even if the main query pool is saturated.
    await healthPool.query("SELECT 1");
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

const port = Number(process.env.PORT ?? 3200);
app.listen(port, () => {
  console.log(`bazaligjore MCP server on http://localhost:${port}/mcp`);
});
