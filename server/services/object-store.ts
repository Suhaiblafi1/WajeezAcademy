/* مخزنُ الكائنات — الملفُّ على القرص، والقاعدةُ تحفظ اسمَه لا محتواه.

   ═══ لماذا كان في عمودِ قاعدةٍ، ولماذا لم يعد ═══

   كُتب التخزينُ الأوّلُ على القرص، ثمّ نُقل إلى عمود `Bytes` في القاعدة —
   **لا لأنّه الأصوب بل لأنّ القرصَ لم يكن موجودا**: المنصّةُ كانت على Vercel،
   و`/var/task` للقراءة فقط، و`/tmp` يذهب مع انتهاء الاستدعاء. فكلُّ رفعٍ كان
   يسقط عند `mkdirSync`، ولا يظهر ذلك محلّيّا أبدا.

   **والقيدُ زال ولم ينتبه أحد.** الخادمُ اليومَ حاويةٌ على جهازٍ نملكه، ولها
   حجمُ Docker دائمٌ اسمُه `storage` يبقى بين النشرات (`deploy/compose.prod.yml`).
   فالسببُ الذي دفع البايتاتِ إلى القاعدة لم يعد قائما — كما زالت أسطورةُ
   Cloudways ومانعُ العامل الخلفيّ قبله.

   ── وكلفةُ بقائها في القاعدة ليست نظريّة ──

   كلُّ نسخةٍ احتياطيّةٍ تحمل البايتاتِ كلَّها، وكلُّ استرجاعٍ يعيدها،
   وكلُّ `pg_dump` ينفخ بها. وسقفُ الرفع أربعةُ ميغابايت **لأنّ الدالّةَ
   السحابيّةَ كانت تحدّه**، لا لأنّ أربعةً كافية لكرّاسة.

   ═══ وما يحفظه هذا المخزن ═══

   لكلّ كائنٍ ملفّان: بايتاتُه، وملفٌّ مجاورٌ يحمل نوعَه واسمَه الأصليَّ وحجمَه.

     storage/private/objects/ab/abcdef…            ← البايتات
     storage/private/objects/ab/abcdef….meta.json  ← {mime, originalName, …}

   ولماذا مجاورٌ لا عمودٌ في القاعدة: **ثلاثةٌ من النماذج الستّة التي تحمل
   `storageKey` لا تحمل نوعا ولا اسما أصليّا** (موادُّ الشعبة، وإجاباتُ
   التقييم، وملفُّ التسليم). فإمّا ترحيلُ مخطّطٍ على ثلاثة جداول، وإمّا أن
   يحمل المخزنُ ما يلزم لتقديمِ ما يخزّنه. والثاني أصغرُ وأصدق: من يخزّن
   البايتاتِ يعرف نوعَها.

   ⚠️ **والمفتاحُ يأتي من عنوانِ URL** — فيُتحقَّق من شكله قبل أن يمسّ مسارا.
   مفتاحٌ فيه `..` أو `/` يخرج من الجذر ويقرأ ما ليس له. والتحقّقُ **قائمةُ
   سماحٍ لا قائمةُ منع**: `newStorageKey` يولّد base64url وحدَها، فما خالفها
   يُرفض بلا تفصيل. */

import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { AuthError } from './auth.service'

/** جذرُ المخزن — حجمُ `storage` في الإنتاج، ومجلّدٌ محلّيٌّ في التطوير */
export function objectRoot(): string {
  return process.env.STORAGE_ROOT?.trim() || join(process.cwd(), 'storage', 'private', 'objects')
}

/* شكلُ المفتاح: ما يولّده `newStorageKey` وحدَه — base64url بلا فواصلَ ولا نقاط.
   والطولُ محدودٌ من الطرفين كي لا يُبنى اسمُ ملفٍّ لا يقبله نظامُ الملفّات. */
const KEY_SHAPE = /^[A-Za-z0-9_-]{16,128}$/

export function assertSafeKey(storageKey: string): void {
  if (KEY_SHAPE.test(storageKey)) return
  /* لا يُفصَّل السبب: من يجرّب الخروجَ من الجذر لا يُعان بتشخيص */
  throw new AuthError('bad_key', 'مفتاح التخزين غير صالح', 400)
}

/** مسارُ الكائن — مشرَّحٌ بحرفَين كي لا يجتمع آلافُ الملفّات في مجلّدٍ واحد */
function pathsFor(storageKey: string): { dir: string; body: string; meta: string } {
  assertSafeKey(storageKey)
  /* التشريحُ من بصمةِ المفتاح لا من أوّل حرفَيه: المفاتيحُ عشوائيّةٌ فالتوزيعُ
     سيّانِ، لكنّ البصمةَ تبقى موزّعةً لو تغيّر مولّدُ المفاتيح يوما. */
  const shard = createHash('sha256').update(storageKey).digest('hex').slice(0, 2)
  const dir = join(objectRoot(), shard)
  return { dir, body: join(dir, storageKey), meta: join(dir, `${storageKey}.meta.json`) }
}

export interface ObjectMeta {
  mime: string
  originalName: string
  sizeBytes: number
  storedAt: string
}

/** يكتب البايتاتِ ومجاورَها. ويُعيد الحجمَ كما كُتب فعلا. */
export async function putObject(
  storageKey: string, content: Buffer, meta: { mime: string; originalName: string },
): Promise<number> {
  const p = pathsFor(storageKey)
  await mkdir(p.dir, { recursive: true })
  await writeFile(p.body, content)
  const full: ObjectMeta = {
    mime: meta.mime || 'application/octet-stream',
    originalName: meta.originalName || storageKey,
    sizeBytes: content.length,
    storedAt: new Date().toISOString(),
  }
  await writeFile(p.meta, JSON.stringify(full), 'utf8')
  return content.length
}

/** البايتاتُ، أو `null` إن لم يُرفع بعد */
export async function getObject(storageKey: string): Promise<Buffer | null> {
  const p = pathsFor(storageKey)
  try {
    return await readFile(p.body)
  } catch {
    return null
  }
}

/** المجاورُ، أو `null`. وكائنٌ بلا مجاورٍ يُقدَّم بنوعٍ محايد. */
export async function getObjectMeta(storageKey: string): Promise<ObjectMeta | null> {
  const p = pathsFor(storageKey)
  try {
    const parsed = JSON.parse(await readFile(p.meta, 'utf8')) as Partial<ObjectMeta>
    if (typeof parsed?.mime !== 'string') return null
    return {
      mime: parsed.mime,
      originalName: typeof parsed.originalName === 'string' ? parsed.originalName : storageKey,
      sizeBytes: typeof parsed.sizeBytes === 'number' ? parsed.sizeBytes : 0,
      storedAt: typeof parsed.storedAt === 'string' ? parsed.storedAt : '',
    }
  } catch {
    return null
  }
}

export async function objectExists(storageKey: string): Promise<boolean> {
  try {
    await stat(pathsFor(storageKey).body)
    return true
  } catch {
    return false
  }
}

/** حذفٌ لا يسقط على غياب — يُستعمل في التنظيف وفي التراجع عن رفعٍ نصفيّ */
export async function deleteObject(storageKey: string): Promise<void> {
  const p = pathsFor(storageKey)
  await rm(p.body, { force: true })
  await rm(p.meta, { force: true })
}
