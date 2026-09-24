// Node resolve hook: lets plain `node` run the legacy TypeScript as-is.
// Maps the "@/…" path alias to legacy/ and adds the ".ts" extension that the
// legacy imports omit (Next's bundler allowed that; Node's ESM loader doesn't).
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const legacyRoot = path.resolve(fileURLToPath(new URL("../../legacy/", import.meta.url)));

function withTsExtension(filePath) {
  if (existsSync(filePath)) return filePath;
  if (existsSync(`${filePath}.ts`)) return `${filePath}.ts`;
  return filePath;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const target = withTsExtension(path.join(legacyRoot, specifier.slice(2)));
    return nextResolve(pathToFileURL(target).href, context);
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL) {
    const parentDir = path.dirname(fileURLToPath(context.parentURL));
    const target = withTsExtension(path.resolve(parentDir, specifier));
    return nextResolve(pathToFileURL(target).href, context);
  }
  return nextResolve(specifier, context);
}
