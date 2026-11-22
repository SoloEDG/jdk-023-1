import { build } from 'esbuild'

await build({
  entryPoints: ['tests/practice-isolation.mts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'node_modules/.tmp-practice-test.mjs',
  alias: { '@': process.cwd() + '/src' },
  logLevel: 'warning',
  plugins: [
    {
      name: 'stub-vue',
      setup(plugin) {
        plugin.onLoad({ filter: /\.vue$/ }, () => ({
          contents: 'export default {}',
          loader: 'js',
        }))
      },
    },
  ],
})
console.log('bundled')
