/* واجهة سطر أوامر لنشر لقطة الكتالوج — المنطق في auto-publish.service.ts
   كي يُختبَر، وهذا غلاف رفيع يصله بالبناء. */

import { getPrisma, disconnectPrisma } from '../server/db/client'
import { stopEmbeddedPostgres } from '../server/db/embedded'
import { publishSnapshotIfChanged } from '../server/services/auto-publish.service'

const prisma = await getPrisma()
try {
  await publishSnapshotIfChanged(prisma, {
    commit: process.env.VERCEL_GIT_COMMIT_SHA,
    log: (line) => console.log(line),
  })
} finally {
  await disconnectPrisma()
  process.on('uncaughtException', (e) => {
    if (String(e).includes('terminat')) process.exit(0)
    throw e
  })
  await stopEmbeddedPostgres()
}
