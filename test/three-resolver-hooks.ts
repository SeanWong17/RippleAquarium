// Module resolution hook: rewrite the browser-style bare specifiers to the
// vendored three.js files on disk. Mirrors the importmap in index.html.
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as resolvePath } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const vendor = resolvePath(process.cwd(), "vendor", "three");

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "three") {
    return {
      url: pathToFileURL(resolvePath(vendor, "three.module.js")).href,
      shortCircuit: true,
    };
  }

  if (specifier.startsWith("three/addons/")) {
    const subpath = specifier.slice("three/addons/".length);
    return {
      url: pathToFileURL(resolvePath(vendor, "addons", subpath)).href,
      shortCircuit: true,
    };
  }

  return nextResolve(specifier, context);
}
