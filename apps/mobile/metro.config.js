// Explicit npm-workspaces monorepo config (Expo's official documented setup) — without this,
// Metro doesn't reliably resolve every dependency hoisted to the workspace root's node_modules
// (it worked for @musicapp/shared but not for @react-native-community/slider, which hoisted to
// the root instead of staying local to apps/mobile/node_modules — inconsistent enough to be
// worth pinning down explicitly rather than depending on Metro's implicit monorepo detection).
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;
