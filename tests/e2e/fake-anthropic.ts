import { createServer, type IncomingMessage, type Server } from "node:http";

/**
 * A stand-in for Anthropic's messages API, for the specs that check what the concierge sends to the model and what it does
 * with the answer. The server under test must be started with it as the API (see the top of concierge-guide.spec.ts).
 * Answers are played back from `script` in order; when it is empty the model says "Certainly."
 */
type Block = { type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: unknown };
export type ModelCall = {
  key: string | undefined;
  body: {
    model: string;
    max_tokens: number;
    thinking: { type: string };
    system: string;
    tools?: { name: string; input_schema: { properties: Record<string, unknown> } }[];
    tool_choice?: { type: string };
    messages: { role: string; content: string | { type: string; tool_use_id?: string; content?: string }[] }[];
  };
};
type Scripted = { status?: number; stop?: string; content?: Block[] };

export function fakeAnthropic(port: number) {
  const calls: ModelCall[] = [];
  const script: Scripted[] = [];
  let server: Server;
  const bodyOf = (req: IncomingMessage) =>
    new Promise<string>((resolve) => {
      let data = "";
      req.on("data", (chunk) => (data += chunk));
      req.on("end", () => resolve(data));
    });
  return {
    calls,
    script,
    /** A tool call by the model, as the API sends it */
    toolUse: (input: unknown, id = "toolu_test"): Block => ({ type: "tool_use", id, name: "update_booking", input }),
    say: (text: string): Block => ({ type: "text", text }),
    reset() {
      calls.length = 0;
      script.length = 0;
    },
    async start() {
      server = createServer(async (req, res) => {
        calls.push({ key: req.headers["x-api-key"] as string | undefined, body: JSON.parse(await bodyOf(req)) });
        const next = script.shift() ?? { content: [{ type: "text", text: "Certainly." } as Block] };
        if (next.status && next.status !== 200) {
          res.writeHead(next.status).end(JSON.stringify({ error: "down" }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ stop_reason: next.stop ?? (next.content?.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn"), content: next.content }));
      });
      await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
    },
    stop: () => server.close(),
  };
}
