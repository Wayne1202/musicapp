// Works around an upstream packaging gap in react-native-webrtc@124.0.8: the published npm
// tarball is missing lib/typescript/vendor/event-target-shim/index.d.ts (the compiled JS output
// at lib/module and lib/commonjs both ship it fine — this is TS-defs-only, so it doesn't break
// the app at runtime, only `tsc`/editor typechecking, which is what this fixes). The library
// does ship the same file as TypeScript *source* at src/vendor/event-target-shim/index.d.ts, so
// this just copies it into the missing location. Re-run automatically via "postinstall" (below
// in package.json) since node_modules edits don't survive a fresh `npm install`.
const fs = require("fs");
const path = require("path");

const pkgRoot = path.join(__dirname, "..", "node_modules", "react-native-webrtc");
const src = path.join(pkgRoot, "src", "vendor", "event-target-shim", "index.d.ts");
const destDir = path.join(pkgRoot, "lib", "typescript", "vendor", "event-target-shim");
const dest = path.join(destDir, "index.d.ts");

if (!fs.existsSync(src)) {
  // Package not installed, or a future version already fixed this upstream — nothing to do.
  process.exit(0);
}
if (fs.existsSync(dest)) {
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log("[fix-webrtc-types] copied missing react-native-webrtc type defs into lib/typescript/vendor/");
