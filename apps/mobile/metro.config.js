const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Use the default watchFolders from expo/metro-config which already
// includes individual workspace packages (shared-types, etc.)
// WITHOUT watching the entire monorepo root's node_modules (1.5 GB).
config.watchFolders = [projectRoot, monorepoRoot];

// Tell Metro where to find node_modules in both app and root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Surface @babel/runtime from the pnpm virtual store so Metro
// resolves helpers that pnpm doesn't hoist to the root symlink layer.
config.resolver.extraNodeModules = {
  '@babel/runtime': path.resolve(
    monorepoRoot,
    'node_modules/.pnpm/@babel+runtime@7.29.7/node_modules/@babel/runtime',
  ),
};

module.exports = config;
