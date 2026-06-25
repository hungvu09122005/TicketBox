const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

const reactPath = path.dirname(
  require.resolve('react/package.json', { paths: [projectRoot] }),
);

const reactNativePath = path.dirname(
  require.resolve('react-native/package.json', { paths: [projectRoot] }),
);

config.watchFolders = [workspaceRoot];

config.resolver.disableHierarchicalLookup = true;

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

config.resolver.extraNodeModules = {
  react: reactPath,
  'react-native': reactNativePath,
};

module.exports = config;