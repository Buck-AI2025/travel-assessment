import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getRecommendations,
  MemberNotFoundError,
  PartnerConfigNotFoundError,
} from "../services/recommendationService.js";
import { getMemberProfile } from "../services/memberService.js";

// The MCP server: this is the surface an AI agent (a travel concierge, for
// example) discovers and calls. It is a thin wrapper around the same
// service layer the REST API uses — neither surface can bypass partner rule
// enforcement, because both call the same recommendationService function.
export function createMcpServer(): McpServer {
  const server = new McpServer({ name: "travel-recs", version: "0.1.0" });

  server.registerTool(
    "get_member_profile",
    {
      title: "Get member profile",
      description:
        "Look up a loyalty member's profile: id, partner affiliation, tier, and stated travel preferences.",
      inputSchema: { memberId: z.string().describe("The member's id, e.g. m-1001") },
    },
    async ({ memberId }) => {
      const member = await getMemberProfile(memberId);
      if (!member) {
        return {
          isError: true,
          content: [{ type: "text", text: `No member found with id "${memberId}".` }],
        };
      }
      return { content: [{ type: "text", text: JSON.stringify(member, null, 2) }] };
    }
  );

  server.registerTool(
    "get_recommendations",
    {
      title: "Get travel recommendations",
      description:
        "Get personalized travel recommendations for a member, with that member's partner's " +
        "recommendation cap and category exclusions already enforced.",
      inputSchema: { memberId: z.string().describe("The member's id, e.g. m-1001") },
    },
    async ({ memberId }) => {
      try {
        const result = await getRecommendations(memberId);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        if (err instanceof MemberNotFoundError || err instanceof PartnerConfigNotFoundError) {
          return { isError: true, content: [{ type: "text", text: err.message }] };
        }
        throw err;
      }
    }
  );

  return server;
}
