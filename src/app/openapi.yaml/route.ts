import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const dynamic = "force-static";

export async function GET() {
  const file = await readFile(join(process.cwd(), "docs", "openapi.yaml"), "utf8");
  return new Response(file, {
    headers: { "Content-Type": "application/yaml; charset=utf-8" },
  });
}