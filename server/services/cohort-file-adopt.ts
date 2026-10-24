/* ═══ ملفٌّ من شعبةٍ أخرى في خطّة الشعبة — يُنسخ إليها، لا يبقى مفتاحا لا يُفتح (٢٤ أكتوبر ٢٠٢٦) ═══

   ── العطبُ الذي وُلد منه ──

   نزّل صاحبُ المنصّة خططا للمراجعة، فلم تدخل الحزمةَ كرّاسةُ «القيادة للمديرين الجدد»: «ليس من ملفّات
   هذه الشعبة». مفتاحُها في خطّة الشعبة، وصفُّه (`CohortFile`) لشعبةٍ أخرى للمدرّبة نفسِها. والقراءةُ
   تحكم بصفّ الملفّ لا بالخطّة (`assertCanRead`): المتعلّمُ يقرأ ملفّاتِ شعبته وحدَها — فكان متعلّمو هذه
   الشعبة سيضغطون الكرّاسةَ فيُقال لهم «لا ملفّ بهذا المفتاح».

   ── من أين جاء ──

   صفحةُ الشعبة (`/trainer/cohort/:id`) مكوّنٌ واحدٌ لكلّ الشعب: من انتقل من شعبةٍ إلى أخرى بالجرس أو
   بزرّ الرجوع بقي المكوّنُ نفسُه، وفي يده خطّةُ الأولى حتّى تصل الثانية — فحفظٌ تلقائيٌّ في تلك اللحظة،
   أو رفعُ كرّاسةٍ انتهى بعد الانتقال، يكتب مفتاحَ ملفّ الأولى في خطّة الثانية. والحفظُ لم يكن يسأل لمن
   الملفّ. فعولج في الموضعين: الصفحةُ تُبنى من جديد لكلّ شعبة (`KeyedByParam` في `App.tsx`)، والحفظُ يسأل.

   ── ما يقع هنا ──

   · مفتاحٌ صفُّه لهذه الشعبة، أو لا صفَّ له (ملفٌّ قديمٌ قبل الصفوف) — يبقى كما هو.
   · مفتاحٌ صفُّه لشعبةٍ أخرى **يُدرّس فيها المدرّبُ نفسُه** — يُنسخ الملفُّ إلى هذه الشعبة بمفتاحٍ جديد،
     ويُكتب الجديدُ مكانه. فلا يُردّ حفظُه ولا يُطلب منه أن يرفعه ثانية (قرارُ ١٢ أكتوبر: لا طلبَ يعمله بنفسه).
   · مفتاحٌ لشعبةٍ ليست له — يُردّ باسم الملفّ: لو نُسخ لصار بابا يقرأ به ملفَّ شعبةٍ لا يدرّسها.
   · والعاملُ (`adopt_foreign_files`) يُصلح ما كُتب قبل هذا بلا مدرّب (`system`)، والإدارةُ تقرأ كلَّ ملفّ.

   ── ونسخةٌ واحدةٌ مهما تكرّر الحفظ ──

   الحفظُ التلقائيُّ لا يستبدل ما في يد المدرّب بما عاد من الخادم — فيُرسل المفتاحَ القديمَ مرّةً بعد
   مرّة. فالمفتاحُ الجديدُ مشتقٌّ من القديم ومن الشعبة (`adoptedKey`) لا عشوائيّ: الحفظُ الثاني يجد النسخةَ
   التي صنعها الأوّلُ فيأخذها، ولا يصنع غيرها. */

import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { getObject, getObjectMeta, putObject } from './object-store'
import { planFileKeys } from '../../src/application/trainer/plan-copy'

/** من يحفظ: مستخدمٌ تُسأل مدرّبيّتُه، أو النظامُ نفسُه (العامل والإدارة) */
export type AdoptActor = { userId: string } | 'system'

export interface Adopted<T> {
  value: T
  /** ملفّاتٌ نُسخت إلى الشعبة في هذا النداء — أو وُجدت نسختُها من قبل */
  adopted: number
  /** أسماءُ ملفّاتٍ من شعبٍ ليست للمدرّب — لا تُنسخ */
  refused: string[]
}

/** مفتاحُ النسخة في الشعبة — مشتقٌّ فلا تتكرّر النسخة، وبطول المفتاح العشوائيّ وأحرفه (`newStorageKey`) */
export function adoptedKey(sourceKey: string, cohortId: string): string {
  return createHash('sha256').update(`${sourceKey}\n${cohortId}`).digest('base64url').slice(0, 32)
}

/** يستبدل ما في الخريطة وحدَه — وما ليس فيها يبقى (بخلاف `remapFileKeys` الذي يُسقط ما لم يُنسخ) */
function replaceKeys<T>(value: T, map: ReadonlyMap<string, string>): T {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object') {
      const o: Record<string, unknown> = {}
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) o[k] = walk(x)
      const key = typeof o.bodyFileKey === 'string' ? o.bodyFileKey.trim() : ''
      if (key && map.has(key)) o.bodyFileKey = map.get(key)
      return o
    }
    return v
  }
  return walk(value) as T
}

/** شعبُ المدرّب — من يُنسخ من شعبته إلى شعبته الأخرى */
async function trainerCohorts(prisma: PrismaClient, userId: string): Promise<Set<string> | null> {
  const profile = await prisma.trainerProfile.findUnique({ where: { userId }, select: { id: true } })
  if (!profile) return null
  const links = await prisma.cohortTrainer.findMany({ where: { profileId: profile.id }, select: { cohortId: true } })
  return new Set(links.map((l) => l.cohortId))
}

export async function adoptCohortFiles<T>(prisma: PrismaClient, cohortId: string, value: T, actor: AdoptActor): Promise<Adopted<T>> {
  const keys = planFileKeys({ v: value })
  if (keys.length === 0) return { value, adopted: 0, refused: [] }
  const rows = await prisma.cohortFile.findMany({ where: { storageKey: { in: keys } } })
  const foreign = rows.filter((r) => r.cohortId !== cohortId)
  if (foreign.length === 0) return { value, adopted: 0, refused: [] }

  /* ومن لا ملفَّ مدرّبٍ له من الإدارة — يقرأ ملفّاتِ الشعب كلَّها (`assertCanRead`)، فيُنسخ له كالنظام */
  const mine = actor === 'system' ? null : await trainerCohorts(prisma, actor.userId)
  const map = new Map<string, string>()
  const refused: string[] = []
  for (const row of foreign) {
    if (mine && !mine.has(row.cohortId)) { refused.push(row.originalName); continue }
    const next = adoptedKey(row.storageKey, cohortId)
    const made = await prisma.cohortFile.findUnique({ where: { storageKey: next }, select: { cohortId: true } })
    if (made && made.cohortId !== cohortId) continue
    if (!made) {
      const body = await getObject(row.storageKey)
      /* ملفٌّ غاب عن المخزن لا نسخةَ له — يبقى مفتاحُه كما كان، ولا يُمحى ما لا يُعوَّض */
      if (!body) continue
      const meta = await getObjectMeta(row.storageKey)
      const size = await putObject(next, body, { mime: meta?.mime || row.mime, originalName: meta?.originalName || row.originalName })
      await prisma.cohortFile.create({
        data: {
          cohortId, purpose: row.purpose, refId: row.refId, storageKey: next,
          originalName: row.originalName, mime: row.mime, sizeBytes: size,
          uploadedBy: actor === 'system' ? row.uploadedBy : actor.userId,
        },
      })
    }
    map.set(row.storageKey, next)
  }
  return { value: map.size ? replaceKeys(value, map) : value, adopted: map.size, refused }
}
