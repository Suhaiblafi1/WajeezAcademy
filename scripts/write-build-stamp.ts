/* يكتب ختمَ البناء — يجري تلقائيا قبل `npm run build` (خطّاف npm: prebuild).
 *
 * لماذا ملفّ ولا قراءةَ Git وقتَ التشغيل: الخادمُ يخدم ما **بُني**، لا ما في
 * القرص الآن. فنسخةٌ سُحبت من GitHub ولم يُعَد بناؤها تجعل `git rev-parse`
 * يعلن التزاما لا يخدمه أحد — كذبةٌ في اللحظة التي تحتاج فيها الصدقَ.
 *
 * ومصدرُ البصمة: البيئةُ إن أعلنها المضيف، وإلّا فنسخةُ Git الحاضرة وقتَ
 * البناء. وهي حاضرةٌ على Hetzner لأنّ النشرَ سحبٌ من GitHub ثمّ بناءٌ على
 * الخادم نفسِه (`deploy/deploy.sh`).
 *
 * ولا يُسقط البناءَ حين يجهل: بناءٌ بلا ختمٍ أفضلُ من لا بناء. لكنّه يقولها
 * صراحةً في السجلّ فلا يمرّ العمى صامتا. ولذلك يُستدعى في `package.json`
 * متبوعا بـ`|| true`: خلَلٌ هنا يجب ألّا يمنع نشرَ الموقع كلِّه.
 *
 * ── ويُمحى الملفُّ قبل أن يُكتب ──
 *
 * لأنّ البديل أخطرُ من الغياب: لو أخفق هذا السكربتُ وبقي ختمُ البناء السابق
 * في مكانه، لأعلن `/api/version` التزاما **لم يعد يعمل** — وهو كذبٌ مطمئن.
 * والغيابُ يقول «مجهول»، والمجهولُ يُبحث فيه.
 */

import { execFileSync } from 'node:child_process'
import { rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BUILD_STAMP_FILE, commitFromEnv, refFromEnv, messageFromEnv } from '../server/build-stamp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, BUILD_STAMP_FILE)

/* أوّلا: لا يبقى ختمُ بناءٍ سابقٍ إن تعثّر ما بعده */
rmSync(out, { force: true })

const git = (...args: string[]) => {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || undefined
  } catch {
    return undefined
  }
}

const commit = commitFromEnv() ?? git('rev-parse', 'HEAD')
const ref = refFromEnv() ?? git('rev-parse', '--abbrev-ref', 'HEAD')
const message = (messageFromEnv() ?? git('log', '-1', '--pretty=%s'))?.split('\n')[0]

const stamp = {
  commit: commit ?? null,
  ref: ref && ref !== 'HEAD' ? ref : null,
  message: message ?? null,
  builtAt: new Date().toISOString(),
}

writeFileSync(out, JSON.stringify(stamp, null, 2) + '\n', 'utf8')

if (commit) {
  console.log(`ختمُ البناء: ${commit.slice(0, 7)}${stamp.ref ? ` · ${stamp.ref}` : ''} · ${stamp.builtAt}`)
} else {
  console.log('⚠️  ختمُ البناء بلا التزام — لا متغيّرَ بيئةٍ ولا نسخةَ Git هنا.')
  console.log('    فسيقول /api/version «لا يمكن الحكم»، ووقتُ البناء وحدَه يبقى دليلا.')
}
