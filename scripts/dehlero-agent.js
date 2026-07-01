import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const inbox = path.join(root, "ai", "inbox");
const processed = path.join(root, "ai", "processed");
const logs = path.join(root, "ai", "logs");

for (const dir of [inbox, processed, logs]) {
  fs.mkdirSync(dir, { recursive: true });
}

function isCommandEnvelope(data) {
  return (
    data &&
    data.dehleroCommand === true &&
    data.version === "0.1" &&
    Array.isArray(data.commands)
  );
}

function processFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").trim();

  if (!raw) return;

  const data = JSON.parse(raw);

  if (!isCommandEnvelope(data)) {
    throw new Error("Invalid command.");
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  fs.writeFileSync(
    path.join(processed, `command-${stamp}.json`),
    JSON.stringify(data, null, 2),
  );

  fs.appendFileSync(
    path.join(logs, "agent.log"),
    `[${new Date().toISOString()}] processed ${path.basename(filePath)}\n`,
  );

  console.log("Processed", path.basename(filePath));
}

console.log("Watching:", inbox);

fs.watch(inbox, (event, filename) => {
  if (!filename?.endsWith(".json")) return;

  const filePath = path.join(inbox, filename);

  setTimeout(() => {
    try {
      if (fs.existsSync(filePath)) {
        processFile(filePath);
      }
    } catch (err) {
      console.error(err);
    }
  }, 200);
});