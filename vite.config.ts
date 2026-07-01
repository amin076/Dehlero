import { defineConfig } from "vite";
import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, data: unknown, statusCode = 200) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

function dehleroDirectorApi(): Plugin {
  return {
    name: "dehlero-director-api",

    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) {
          next();
          return;
        }

        if (req.url.startsWith("/api/dehlero/health")) {
          sendJson(res, {
            ok: true,
            service: "Dehlero Director API",
            version: "0.1",
          });
          return;
        }

        if (req.url.startsWith("/api/dehlero/save-video")) {
  if (req.method !== "POST") {
    sendJson(res, { ok: false, error: "Method Not Allowed" }, 405);
    return;
  }

  const chunks: Buffer[] = [];

  req.on("data", (chunk: Buffer) => {
    chunks.push(chunk);
  });

  req.on("end", () => {
    const home = process.env.USERPROFILE ?? process.env.HOME ?? ".";
    const outDir = path.join(home, "Downloads", "dehlero videos");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outFile = path.join(outDir, `keynu-dehlero-auto-${stamp}.webm`);

    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outFile, Buffer.concat(chunks));

    sendJson(res, {
      ok: true,
      savedTo: outFile,
    });
  });

  return;
}
        if (req.url.startsWith("/api/dehlero/command")) {
          if (req.method !== "POST") {
            sendJson(res, { ok: false, error: "Method Not Allowed" }, 405);
            return;
          }

          try {
            const raw = await readBody(req);
            const parsed = JSON.parse(raw);

            const outDir = path.resolve("public", "ai");
            const outFile = path.join(outDir, "latest-command.json");

            fs.mkdirSync(outDir, { recursive: true });
            fs.writeFileSync(outFile, JSON.stringify(parsed, null, 2), "utf8");

            sendJson(res, {
              ok: true,
              writtenTo: outFile,
            });
          } catch {
            sendJson(res, { ok: false, error: "Invalid JSON" }, 400);
          }

          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [dehleroDirectorApi()],
});