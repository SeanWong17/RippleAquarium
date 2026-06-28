import { cp, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const assetPaths = [
  "src/styles.css",
  "src/coral",
  "src/decor/models",
  "src/fish/cartoon.glb",
  "src/fish/models",
];

for (const relativePath of assetPaths) {
  const source = join(root, relativePath);
  const destination = join(root, "dist", relativePath);
  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination, { force: true, recursive: true });
}
