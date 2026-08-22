import { createApp } from "./api/app.js";

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
const app = createApp();

app.listen(port, () => {
  console.log(`travel-recs listening on http://localhost:${port}`);
  console.log(`  REST:   GET  /api/members/:memberId`);
  console.log(`          GET  /api/recommendations/:memberId`);
  console.log(`  MCP:    POST /mcp`);
});
