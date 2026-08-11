#!/usr/bin/env node
// Marks a package's dist-cjs/ output as CommonJS, overriding the parent
// package.json's "type": "module" for that directory - Node resolves
// module type per-directory via the nearest package.json, and dist-cjs/
// has no other way to declare itself CJS without this. Run from the
// package's own directory (cwd), after tsc has produced dist-cjs/.
import { mkdirSync, writeFileSync } from "node:fs";

mkdirSync("dist-cjs", { recursive: true });
writeFileSync("dist-cjs/package.json", `${JSON.stringify({ type: "commonjs" }, null, 2)}\n`);
