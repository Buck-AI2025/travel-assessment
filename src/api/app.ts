import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "../mcp/server.js";
import { getMemberProfile } from "../services/memberService.js";
import {
  getRecommendations,
  MemberNotFoundError,
  PartnerConfigNotFoundError,
} from "../services/recommendationService.js";

export function createApp() {
  const app = express();
  app.use(express.json());

  // ---- REST API -----------------------------------------------------
  // Same service layer as the MCP tools below, so rule enforcement can't
  // diverge between the two surfaces.

  app.get("/api/members/:memberId", async (req, res) => {
    const member = await getMemberProfile(req.params.memberId);
    if (!member) return res.status(404).json({ error: `No member found with id "${req.params.memberId}"` });
    res.json(member);
  });

  app.get("/api/recommendations/:memberId", async (req, res) => {
    try {
      const result = await getRecommendations(req.params.memberId);
      res.json(result);
    } catch (err) {
      if (err instanceof MemberNotFoundError || err instanceof PartnerConfigNotFoundError) {
        return res.status(404).json({ error: err.message });
      }
      throw err;
    }
  });

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  // ---- MCP server ------------------------------------------------------
  // Stateless mode: a fresh McpServer + transport per request. This is the
  // endpoint an AI agent discovers and invokes (e.g. via a POST with a
  // JSON-RPC "tools/call" body).
  //
  // A single shared McpServer instance was tried first, but the SDK's
  // Protocol.connect() throws if a transport is already attached — reusing
  // one server across overlapping requests means a second request arriving
  // before the first's `res.on('close')` cleanup can crash the handler with
  // an unhandled rejection. Creating a new (cheap — just tool registration)
  // McpServer per request avoids that race entirely; this matches the
  // pattern in the SDK's own stateless-mode example.
  app.post("/mcp", async (req, res) => {
    const mcpServer = createMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      transport.close();
      mcpServer.close();
    });
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  return app;
}
