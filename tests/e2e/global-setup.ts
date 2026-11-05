import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { E2E_ADMIN } from "./helpers";

/**
 * A stand-in for Google Places, for the booking bar (which takes only a picked address): it suggests exactly what was
 * typed, as an airport when the words say so. Run the suite with
 *   GOOGLE_MAPS_API_KEY=test PLACES_API_URL=http://127.0.0.1:4596 E2E_FAKE_PLACES=4596
 * (`next start` inherits PLACES_API_URL from the shell).
 */
function fakePlaces(port: number) {
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      res.setHeader("Content-Type", "application/json");
      if (req.method === "POST" && req.url?.endsWith("/places:autocomplete")) {
        let input = "";
        try {
          input = String((JSON.parse(body || "{}") as { input?: string }).input ?? "").trim();
        } catch {}
        const placeId = `fake-${input.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
        const types = /airport|schiphol|luchthaven/i.test(input) ? ["airport"] : ["establishment"];
        res.end(JSON.stringify({ suggestions: [{ placePrediction: { placeId, text: { text: input }, structuredFormat: { mainText: { text: input } }, types } }] }));
        return;
      }
      // The details request that closes a billing session
      res.end(JSON.stringify({ id: decodeURIComponent((req.url ?? "").split("?")[0].split("/").pop() ?? "") }));
    });
  });
  server.listen(port, "127.0.0.1");
  return server;
}

export default function globalSetup() {
  execFileSync(
    process.execPath,
    ["--env-file-if-exists=.env.local", "scripts/create-admin.mts", E2E_ADMIN.email, E2E_ADMIN.name],
    { stdio: "inherit", env: { ...process.env, ADMIN_PASSWORD: E2E_ADMIN.password } },
  );
  const port = Number(process.env.E2E_FAKE_PLACES ?? 0);
  if (!port) return;
  const server = fakePlaces(port);
  return () => new Promise<void>((done) => server.close(() => done()));
}
