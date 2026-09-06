/* واجهة سطر أوامر لنشر لقطة الكتالوج — المنطق في auto-publish.service.ts
   كي يُختبَر، وهذا غلاف رفيع يصله بالبناء. */

import { getPrisma, disconnectPrisma } from '../server/db/client'
import { stopEmbeddedPostgres } from '../server/db/embedded'
import { publishSnapshotIfChanged } from '../server/services/auto-publish.service'
import { buildStamp } from '../server/build-stamp'

/* بصمة الالتزام تدخل تسمية اللقطة (auto-<sha7>-<hash6>) — وهي ما يقارن به
   `/api/version` نفسَه بنفسه. وكانت تُقرأ من `VERCEL_GIT_COMMIT_SHA` وحده،
   فبلا متغيّرِ التزامٍ من المضيف تخرج كلُّ لقطةٍ بالشكل الأعمى `auto-<hash12>` ويصير الجواب
   «لا يمكن الحكم» أبدا. فتُقرأ الآن من ختم البناء: بيئةً كانت أو ملفّا. */

const prisma = await getPrisma()
try {
  await publishSnapshotIfChanged(prisma, {
    commit: buildStamp().commit ?? undefined,
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
