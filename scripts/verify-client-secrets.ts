import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "dotenv";
async function files(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) =>
        e.isDirectory()
          ? files(join(dir, e.name))
          : Promise.resolve([join(dir, e.name)]),
      ),
    )
  ).flat();
}
const environment = parse(await readFile(".env", "utf8").catch(() => ""));
const secrets = [environment.GEMINI_API_KEY, process.env.GEMINI_API_KEY];
try {
  for (const credential of JSON.parse(
    environment.AUTH_CREDENTIALS_JSON ?? "[]",
  ))
    secrets.push(credential.token);
} catch {
  /* Invalid auth configuration is checked by backend startup. */
}
const clientFiles = await files("dist/frontend");
let failed = false;
for (const file of clientFiles.filter((file) =>
  /\.(js|html|css|map)$/.test(file),
)) {
  const content = await readFile(file, "utf8");
  if (
    secrets.some(
      (secret) =>
        typeof secret === "string" &&
        secret.length >= 12 &&
        content.includes(secret),
    ) ||
    /AIza[\w-]{30,}/.test(content)
  ) {
    failed = true;
  }
}
if (failed)
  throw new Error(
    "Client bundle contains a server credential. Values intentionally withheld.",
  );
console.log(
  "PASS: configured Gemini/staff credentials were not found in the client bundle. .env was read without modification.",
);
