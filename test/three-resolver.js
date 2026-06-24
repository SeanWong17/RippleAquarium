// Maps the bare "three" / "three/addons/" specifiers to the vendored ESM
// files so Node's test runner resolves them the same way the browser importmap
// does. Registered via `node --import ./test/three-resolver.js`.
import { register } from "node:module";

register("./three-resolver-hooks.js", import.meta.url);
