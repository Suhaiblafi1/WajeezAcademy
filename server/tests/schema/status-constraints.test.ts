/* التعليقُ عقدٌ، والقاعدةُ تُنفّذه.

   العطب: خمسةٌ وخمسون عمودا في المخطّط يحمل حالةً نصّيّةً، وقيمُها المسموحة
   مكتوبةٌ في **تعليقٍ** بجانبها:
     `status String @default("draft") // draft | published | superseded`

   والتعليقُ لا يمنع شيئا. فخطأٌ مطبعيٌّ واحد — `publised` بدل `published` —
   يصنع حالةً جديدةً لا تعرفها الواجهةُ ولا التقاريرُ ولا أحد: الصفُّ يبقى في
   القاعدة، ويسقط من كلّ قائمةٍ تُرشِّح بالحالة، ولا يشكو أحد. وهذا أخطرُ من
   خطأٍ يُلقي استثناءً، لأنّه **صامت**.

   والحلُّ الكامل أنواعٌ مُعدَّدةٌ في القاعدة، وهي تمسّ نوعَ كلّ قراءةٍ
   وكتابةٍ في الشيفرة. والحرسُ نفسُه يُنجَز بقيدِ `CHECK` مشتقٍّ من التعليق،
   بلا مساسٍ بحرفٍ من TypeScript.

   وما يحرسه هذا الملفّ ثلاثةُ أشياء:
   ١) كلُّ عمودٍ تعليقُه يعدّ قيمَه **له قيدٌ في القاعدة** — فلا عمودٌ يُضاف
      ويُنسى قيدُه.
   ٢) والقيدُ **يطابق تعليقَه**: كلُّ قيمةٍ في التعليق مقبولةٌ في القيد. فمن
      أضاف حالةً في التعليق ولم يولّد الترحيل، سقط هنا لا في الإنتاج.
   ٣) والقيدُ **يعمل فعلا**: تُحاوَل كتابةُ حالةٍ ليست في القائمة، ويُنتظَر
      الرفض. فقيدٌ موجودٌ ولا يمنع أسوأُ من غيابه: يُطمئن بلا أن يحرس. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { checkName, statusColumns } from '../../../scripts/status-checks'

let prisma: PrismaClient
let live: Map<string, string>

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const rows = await prisma.$queryRawUnsafe<{ conname: string; def: string }[]>(
    `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE contype = 'c'`,
  )
  live = new Map(rows.map((r) => [r.conname, r.def]))
})

describe('قيودُ الحالات', () => {
  it('لكلّ عمودِ حالةٍ تعليقُه يعدّ قيمَه قيدٌ في القاعدة', () => {
    const cols = statusColumns()
    /* العددُ حرسٌ ثانٍ: لو انكسر المُفسِّرُ فصار يجد عمودَين، مرّ الاختبارُ
       بلا أن يفحص شيئا. */
    expect(cols.length, 'المُفسِّرُ لم يجد أعمدةَ الحالة — راجع scripts/status-checks.ts').toBeGreaterThanOrEqual(50)
    const missing = cols.filter((c) => !live.has(checkName(c))).map((c) => `${c.model}.${c.field}`)
    expect(missing, `ولّد الترحيل: npx tsx scripts/status-checks.ts\n${missing.join('\n')}`).toEqual([])
  })

  it('والقيدُ يطابق تعليقَه — لا حالةٌ في التعليق يردّها القيد', () => {
    const stale: string[] = []
    for (const c of statusColumns()) {
      const def = live.get(checkName(c))
      if (!def) continue
      for (const v of c.values) {
        if (!def.includes(`'${v}'`)) stale.push(`${c.model}.${c.field} — «${v}» في التعليق وليست في القيد`)
      }
    }
    expect(stale, `القيدُ متأخّرٌ عن تعليقه — ولّد الترحيل من جديد:\n${stale.join('\n')}`).toEqual([])
  })

  it('والقيدُ يمنع فعلا: حالةٌ غيرُ مذكورةٍ تُردّ', async () => {
    /* على `User.status` — أوّلُ عمودٍ في المخطّط، وقيمُه أربع */
    const u = await prisma.user.create({
      data: {
        email: `status-check-${Date.now()}@test.local`,
        displayName: 'حسابُ فحصِ القيد',
        passwordHash: 'x'.repeat(60),
      },
    })
    await expect(
      prisma.user.update({ where: { id: u.id }, data: { status: 'publised' } }),
    ).rejects.toThrow()
    /* والحالةُ الأصليّةُ لم تتغيّر — المعاملةُ رُدّت كلُّها */
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).status).toBe('active')
    /* وحالةٌ مذكورةٌ تُقبل — القيدُ يمنع الضرر لا الحركة */
    await prisma.user.update({ where: { id: u.id }, data: { status: 'suspended' } })
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).status).toBe('suspended')
  })
})
