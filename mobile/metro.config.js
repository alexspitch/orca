const path = require('node:path')
const { getDefaultConfig } = require('expo/metro-config')

const projectRoot = __dirname
const sharedRoot = path.resolve(projectRoot, '..', 'src', 'shared')
// Issues reads build-web's pure view models (tones, run cells, card facts) where the desktop keeps them.
const buildWebRoot = path.resolve(
  projectRoot,
  '..',
  'src',
  'renderer',
  'src',
  'components',
  'build-web'
)

const config = getDefaultConfig(projectRoot)

// Watch repo root: mobile source-control uses desktop’s pure prompt builders, outside Metro’s default mobile-only scope.
config.watchFolders = Array.from(
  new Set([...(config.watchFolders ?? []), sharedRoot, buildWebRoot])
)

module.exports = config
