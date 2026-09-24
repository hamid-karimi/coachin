// Node resolve hook: lets plain `node` run the legacy TypeScript as-is.
// Maps the "@/…" path alias to legacy/ and adds the ".ts" extension that the
// legacy imports omit (Next's bundler allowed that; Node's ESM loader doesn't).
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const legacyRoot = path.resolve(fileURLToPath(new URL("../../legacy/", import.meta.url)));
const stubs = path.resolve(fileURLToPath(new URL("./stubs/", import.meta.url)));

// Modules replaced for the golden run: the AI SDK types (no node_modules in
// legacy/) and the provider call (captured instead of sent).
const STUBBED = new Map([
  ["@google/genai", path.join(stubs, "genai.mjs")],
  [path.join(legacyRoot, "lib/ai/text-json.ts"), path.join(stubs, "text-json.mjs")],
]);

function withTsExtension(filePath) {
  if (existsSync(filePath)) return filePath;
  if (existsSync(`${filePath}.ts`)) return `${filePath}.ts`;
  return filePath;
}

function toUrl(target) {
  return pathToFileURL(STUBBED.get(target) ?? target).href;
}

export async function resolve(specifier, context, nextResolve) {
  if (STUBBED.has(specifier)) {
    return nextResolve(toUrl(specifier), context);
  }
  if (specifier.startsWith("@/")) {
    const target = withTsExtension(path.join(legacyRoot, specifier.slice(2)));
    return nextResolve(toUrl(target), context);
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL) {
    const parentDir = path.dirname(fileURLToPath(context.parentURL));
    const target = withTsExtension(path.resolve(parentDir, specifier));
    return nextResolve(toUrl(target), context);
  }
  return nextResolve(specifier, context);
}
