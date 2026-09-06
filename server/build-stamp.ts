/* ختمُ البناء — «أيَّ نسخةٍ يخدم خادمي الآن؟» بجوابٍ لا يحتاج لوحةَ مزوّد.
 *
 * كان هذا السؤال يُجاب من متغيّراتٍ اسمُها `VERCEL_*`. ثمّ انتقلت المنصّةُ
 * إلى Cloudways، فبقيت القراءةُ على أسمائها وبقي المتغيّرُ غيرَ موجود — فردّ
 * `‎/api/version` على الإنتاج الحيّ: «الالتزام: null · البيئة: محلية». وهو
 * ليس خطأً في الحساب بل **عمًى**: الخادمُ يعمل ولا يعرف من أيّ التزامٍ بُني،
 * فلا يستطيع أحدٌ أن يقول «النشرةُ وصلت» ولا «لم تصل». وهذا بالضبط ما جعل
 * سؤالَ «لماذا أرى موقعا قديما؟» يبقى مفتوحا أسبوعا.
 *
 * ── والعلاجُ ألّا يُسأل المزوّدُ أصلا ──
 *
 * البناءُ نفسُه يعرف التزامَه: إمّا لأنّ المزوّدَ أعلنه في البيئة، وإمّا لأنّ
 * نسخةَ Git حاضرةٌ على القرص وقتَ البناء (وهي حاضرةٌ على Cloudways، فالنشرُ
 * سحبٌ من GitHub). فيُكتب الختمُ ملفّا وقتَ البناء (`scripts/write-build-stamp.ts`)
 * ويقرؤه الخادمُ وقتَ التشغيل. فيصير الجوابُ صحيحا على أيّ مضيفٍ كان.
 *
 * ── وما لا يفعله ──
 *
 * لا يشغّل `git` وقتَ التشغيل. لأنّ ما يخدمه الخادمُ هو ما بُني، لا ما في
 * القرص الآن: نسخةٌ سُحبت ولم يُعَد بناؤها تجعل `git rev-parse` يكذب بالضبط
 * حين تحتاج الصدقَ أكثر ما تحتاجه.
 *
 * ولا يكشف شيئا ليس معلنا: بصمةُ التزامٍ في مستودع، واسمُ فرع، وسطرُ رسالة.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface BuildStamp {
  /** بصمةُ الالتزام كاملةً، أو null حين لا تُعرف */
  commit: string | null
  ref: string | null
  message: string | null
  /** وقتُ البناء بصيغة ISO — يكشف نشرةً لم تصل ولو جُهل الالتزام */
  builtAt: string | null
  /** من أين عُرف: البيئةُ أسبق، فهي أصدقُ من ملفٍّ قد يبقى من بناءٍ سابق */
  source: 'بيئة' | 'ملفّ' | 'مجهول'
}

const EMPTY: BuildStamp = { commit: null, ref: null, message: null, builtAt: null, source: 'مجهول' }

const clean = (v: string | undefined) => {
  const s = v?.trim()
  return s ? s : undefined
}

/** أوّلُ متغيّرٍ موجودٍ من الأسماء المعطاة — فالأسماءُ تختلف باختلاف المضيف */
const fromEnv = (...names: string[]) => {
  for (const n of names) {
    const v = clean(process.env[n])
    if (v) return v
  }
  return undefined
}

/** بصمةُ الالتزام من البيئة وحدَها — يستعملها البناءُ ووقتُ التشغيل معا */
export function commitFromEnv(): string | undefined {
  return fromEnv('GIT_COMMIT_SHA', 'VERCEL_GIT_COMMIT_SHA', 'SOURCE_VERSION', 'COMMIT_SHA')
}

export function refFromEnv(): string | undefined {
  return fromEnv('GIT_COMMIT_REF', 'VERCEL_GIT_COMMIT_REF', 'GIT_BRANCH')
}

export function messageFromEnv(): string | undefined {
  return fromEnv('GIT_COMMIT_MESSAGE', 'VERCEL_GIT_COMMIT_MESSAGE')
}

/** اسمُ الملفّ الذي يكتبه البناءُ ويقرؤه التشغيل */
export const BUILD_STAMP_FILE = 'build-stamp.json'

/* المواضعُ المحتملة — ومقصودٌ ألّا يكون فيها اشتقاقٌ من موضع هذه الوحدة.
   فالإنتاجُ يشغّل `api/index.js` المجمَّعة لا ملفّاتِ `server/`، والصعودُ من
   موقع الوحدة يحسب صحيحا في المصدر وخاطئا في الحزمة — عطبٌ أسقط تحليلَ الأثر
   على الإنتاج مرّةً، ويحرسه `server/tests/catalog/bundle-safety.test.ts`.

   فالمرجعُ مجلّدُ التشغيل: عمليّةُ Node تُشغَّل من جذر التطبيق، وهناك يكتب
   البناءُ ختمَه. و`BUILD_STAMP_PATH` **قاطعٌ لا مرجَّح**: من سمّى مسارا صراحةً
   يريد هذا الملفَّ وحدَه — والتراجعُ عنه إلى ملفٍّ آخر يجعل «لا ختمَ هنا»
   تُقرأ ختما من بناءٍ سابق، وهو أسوأ من الجهل به. */
function candidatePaths(): string[] {
  const explicit = clean(process.env.BUILD_STAMP_PATH)
  if (explicit) return [explicit]
  return [join(process.cwd(), BUILD_STAMP_FILE), join(process.cwd(), '..', BUILD_STAMP_FILE)]
}

function readStampFile(): Partial<BuildStamp> | null {
  for (const p of candidatePaths()) {
    try {
      const parsed = JSON.parse(readFileSync(p, 'utf8')) as Partial<BuildStamp>
      if (parsed && typeof parsed === 'object') return parsed
    } catch {
      /* غيابُ الملفّ حالةٌ عاديّة لا خطأ — التشغيلُ المحلّيُّ بلا بناء */
    }
  }
  return null
}

let cached: BuildStamp | undefined

/** الختمُ كما يُقرأ وقتَ التشغيل. يُخزَّن لأنّه لا يتغيّر ما دامت العمليّةُ حيّة. */
export function buildStamp(): BuildStamp {
  if (cached) return cached
  const envCommit = commitFromEnv()
  if (envCommit) {
    cached = {
      commit: envCommit,
      ref: refFromEnv() ?? null,
      message: messageFromEnv()?.split('\n')[0] ?? null,
      builtAt: readStampFile()?.builtAt ?? null,
      source: 'بيئة',
    }
    return cached
  }
  const file = readStampFile()
  cached = file?.commit
    ? {
        commit: String(file.commit),
        ref: file.ref ? String(file.ref) : null,
        message: file.message ? String(file.message).split('\n')[0] : null,
        builtAt: file.builtAt ? String(file.builtAt) : null,
        source: 'ملفّ',
      }
    : { ...EMPTY, builtAt: file?.builtAt ? String(file.builtAt) : null }
  return cached
}

/** للاختبارات وحدَها: يُبطل الخزن فتُقرأ البيئةُ من جديد */
export function resetBuildStampCache(): void {
  cached = undefined
}

/** البيئةُ المُعلَنة — بأيّ اسمٍ أعلنها المضيف، ولا يُفترض مضيفٌ بعينه */
export function runtimeEnvLabel(): string {
  return fromEnv('APP_ENV', 'VERCEL_ENV', 'NODE_ENV') ?? 'محلية'
}
