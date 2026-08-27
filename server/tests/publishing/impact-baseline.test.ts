/* «قبل» في تحليل الأثر يجب أن يكون ما يقرأه المحرك الآن، لا ما تقوله الجداول.
 *
 * التحليل هو الخطوة التي تسبق كل نشر: يشغّل الشخصيات الاثنتي عشرة على
 * «قبل» و«بعد» ليرى المشغّل ما سيتغيّر لدى المستخدم. وكان الطرفان يُبنيان
 * من الجداول نفسها — «قبل» من المنشور، و«بعد» من المنشور + المعتمد.
 *
 * هذا صحيح ما دامت الجداول واللقطة متطابقتين، وهما تفترقان في الحالة التي
 * يُنشر فيها أصلا: يُستورد كتالوج جديد إلى الجداول، ولمّا تُنشر لقطته بعد.
 * عندها يُبنى الطرفان من الجداول الجديدة فيتطابقان، فيقول التحليل «لم تتغيّر
 * توصية أحد» عن نشرٍ يغيّر الكتالوج كلّه. طمأنينةٌ في الخطوة التي وُضعت
 * لتحذّر — وهي أخطر من الصمت.
 *
 * القياس الصحيح: اللقطة المنشورة المجمّدة مقابل المرشّح.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { analyzeImpact } from '../../services/impact.service'
import { getActiveSnapshot } from '../../catalog/snapshot-builder'

let prisma: PrismaClient

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
})

describe('تحليل الأثر يقيس على اللقطة المنشورة لا على الجداول', () => {
  it('اللقطة المنشورة موجودة أصلا — بلا هذا يفقد الاختبار معناه', async () => {
    const active = await getActiveSnapshot(prisma)
    expect(active).not.toBeNull()
    expect(active!.label).toBeTruthy()
  })

  it('يعلن مرجع القياس صراحة بتسمية اللقطة الحية', async () => {
    const active = await getActiveSnapshot(prisma)
    const r = await analyzeImpact(prisma, 'اختبار المرجع')
    expect(r.baselineLabel).toBe(active!.label)
    expect(r.baselineAr).toContain(active!.label)
  })

  it('جداول انحرفت عن اللقطة المنشورة تظهر انحرافا لا صفرا', async () => {
    /* انحراف واقعي: سؤال يخرج من الجداول وتبقى اللقطة المنشورة تحويه —
       نفس ما يحدث حين يُستورد بنك أسئلة جديد قبل نشر لقطته. */
    const active = await getActiveSnapshot(prisma)
    const payload = active!.payload as { questions: { questions: { question_id: string }[] } }
    const asked = new Set<string>()
    const baseline = await analyzeImpact(prisma, 'قبل الانحراف')
    for (const p of baseline.before) for (const q of p.asked) asked.add(q)

    /* يُعطَّل سؤال تسأله الشخصيات فعلا — وإلا لم يكن الانحراف مرئيا في المخرجات */
    const victim = payload.questions.questions.find((q) => asked.has(q.question_id))
    expect(victim, 'لا سؤال مشترك بين اللقطة وما تسأله الشخصيات').toBeTruthy()
    await prisma.question.update({ where: { id: victim!.question_id }, data: { active: false } })

    try {
      const r = await analyzeImpact(prisma, 'بعد الانحراف')
      /* اللقطة المنشورة لم تتغيّر، فالمرجع نفسه — والفرق كله من جهة «بعد» */
      expect(r.baselineLabel).toBe(active!.label)
      const drifted = r.changedQuestions.some((d) => d.removed.includes(victim!.question_id))
      expect(drifted, 'الانحراف بين الجداول واللقطة لم يظهر في التحليل').toBe(true)
      expect(r.touchesDiagnostic).toBe(true)
    } finally {
      await prisma.question.update({ where: { id: victim!.question_id }, data: { active: true } })
    }
  })

  it('بعد إعادة السؤال يعود التحليل إلى لا-أثر — الحارس لا يبلّغ عن فرق دائم', async () => {
    const r = await analyzeImpact(prisma, 'بعد الإرجاع')
    expect(r.changedQuestions).toEqual([])
    expect(r.changedWinners).toEqual([])
  })
})
