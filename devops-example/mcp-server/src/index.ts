import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import http from "node:http";

const server = new McpServer({
  name: "ddt-mcp-server",
  version: "0.1.0",
});

server.tool("ping", "Health check tool", {}, async () => {
  return { content: [{ type: "text", text: "pong" }] };
});

const httpServer = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200).end();
    return;
  }
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }
  if (req.url === "/sse") {
    const transport = new SSEServerTransport("/messages", res);
    await server.connect(transport);
    return;
  }
  res.writeHead(404).end();
});

const PORT = Number(process.env.PORT) || 3001;
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`MCP Server listening on http://0.0.0.0:${PORT}`);
});
