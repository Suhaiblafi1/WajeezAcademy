/* تجميع معالج Vercel في ملف واحد — يحل مشكلة الاستيرادات النسبية بلا امتداد في ESM */
import { build } from 'esbuild'

await build({
  entryPoints: ['server/http/vercel-handler.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  minify: true,
  packages: 'external',
  target: 'node22',
  outfile: 'api/index.js',
  banner: { js: '// ملف مولّد تلقائيًا — لا تعدّله يدويًا (scripts/bundle-api.mjs)' },
})
console.log('✓ api/index.js bundled')
