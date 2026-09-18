const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [
  projectRoot,
  monorepoRoot,
  path.resolve(monorepoRoot, 'packages/shared-types'),
];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

config.resolver.extraNodeModules = {};

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@babel/runtime/')) {
    const sub = moduleName.slice('@babel/runtime/'.length);
    const base = path.resolve(monorepoRoot, 'node_modules/@babel/runtime');
    const candidate = path.join(base, sub);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return { filePath: path.join(candidate, 'index.js'), type: 'sourceFile' };
    }
    for (const ext of ['.js', '.ts', '']) {
      const p = candidate + ext;
      if (fs.existsSync(p)) return { filePath: p, type: 'sourceFile' };
    }
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
