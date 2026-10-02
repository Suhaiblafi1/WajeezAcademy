/* طابورُ التأليف — الترتيبُ نفسُه قرارٌ تحريريّ.

   ٤٠٠ وحدةٍ بلا متن لا تُواجَه بقائمةٍ أبجديّة. ومن يجلس ساعةً ليكتب يجب
   أن تُوضع ساعتُه حيث تُقرأ: وحدةٌ في دورةٍ فيها متعلّمون مسجَّلون الآن
   تسبق وحدةً في دورةٍ لا شعبةَ لها. وهذا ما يُحرَس هنا — لا أنّ القائمة
   تُرجع صفوفا، بل أنّها تُرجعها بالترتيب الذي يخدم متعلّما حقيقيا. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { ModuleAuthoringService } from '../../services/module-authoring.service'

let prisma: PrismaClient
let svc: ModuleAuthoringService

/** سقفُ الصفحة في `worklist` — والشاشةُ تطلب دونه (٤٠٠) */
const PAGE = 500

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  svc = new ModuleAuthoringService(prisma)
})

describe('طابور التأليف', () => {
  it('يقيس الفجوة الحقيقية — لا يفترضها', async () => {
    const all = await svc.worklist({ limit: PAGE })
    expect(all.total).toBeGreaterThan(300)
    expect(all.withBody + all.missing).toBe(all.total)
    /* الحال اليوم: الغالبية العظمى بلا متن — وهذا سببُ الدفعة كلّها */
    expect(all.missing).toBeGreaterThan(all.withBody)
  })

  it('و«الناقصة فقط» لا تُرجع وحدةً لها متن', async () => {
    const missing = await svc.worklist({ body: 'missing', limit: PAGE })
    expect(missing.rows.every((r) => !r.hasBody)).toBe(true)
    expect(missing.rows.length).toBeGreaterThan(0)
  })

  it('والعدّاد يصف الكتالوج لا الشريحة المعروضة', async () => {
    /* كان يُحسب بعد الترشيح، فيقول «لها متن: ٠» مع «الناقصة فقط» — رقمٌ
       صادقٌ عن الشريحة كاذبٌ عن الكتالوج، وهو ما تقرؤه بطاقاتُ الشاشة. */
    const all = await svc.worklist({ limit: PAGE })
    const missing = await svc.worklist({ body: 'missing', limit: PAGE })
    expect(missing.total).toBe(all.total)
    expect(missing.withBody).toBe(all.withBody)
    expect(missing.withBody).toBeGreaterThan(0)
    /* والصفحةُ تُقصّ والعدّادُ لا يُقصّ. كان الشرطُ «الصفوفُ = الناقص»، وصحّ ما
       دام الناقصُ دون سقف الصفحة (٥٠٠)؛ فلمّا دخلت دوراتُ الإنجليزيّة الأربع
       (٢ أكتوبر ٢٠٢٦) بلغ ٥٢١، فامتلأت الصفحةُ وبقي العدّادُ للكتالوج — وهو ما
       يقوله اسمُ هذا الفحص. فالصفحةُ ملأى ما بقي ناقصٌ وراءها. */
    expect(missing.rows.length).toBe(Math.min(missing.missing, PAGE))
    /* واكتمالُ المرشِّح يُقاس حيث تتّسع له الصفحة: في دورةٍ واحدة، ناقصُها في
       عدّاد الكتالوج يساوي صفوفَها في «بلا متن». وأوسعُها نقصا لتُحرَس أكثرُ
       الوحدات — فمرشِّحٌ يُسقط بضعَ وحداتٍ لا تكشفه صفحةٌ ملأى، وتكشفه هذه. */
    const widest = [...missing.courses].sort((a, b) => (b.total - b.withBody) - (a.total - a.withBody))[0]
    const inCourse = await svc.worklist({ body: 'missing', courseId: widest.courseId, limit: PAGE })
    expect(widest.total - widest.withBody).toBeGreaterThan(0)
    expect(inCourse.rows.length).toBe(widest.total - widest.withBody)
  })

  it('ومن ينتظره متعلّمٌ يسبق من لا ينتظره أحد', async () => {
    const rows = (await svc.worklist({ limit: PAGE })).rows
    /* الترتيب غير متزايد في عدد المنتظرين */
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].learnersWaiting).toBeGreaterThanOrEqual(rows[i].learnersWaiting)
    }
  })

  it('وضمن المتساوين: صاحبُ الشعبة المفتوحة أوّلا', async () => {
    const rows = (await svc.worklist({ limit: PAGE })).rows
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1], b = rows[i]
      if (a.learnersWaiting !== b.learnersWaiting) continue
      expect(Number(a.courseHasOpenCohort)).toBeGreaterThanOrEqual(Number(b.courseHasOpenCohort))
    }
  })

  it('وكلُّ صفٍّ يحمل ما يكفي لاختيارٍ واعٍ بلا فتحه', async () => {
    const r = (await svc.worklist({ limit: 1 })).rows[0]
    expect(r.courseTitleAr).not.toBe('')
    expect(typeof r.hasChecks).toBe('boolean')
    expect(typeof r.hasVideo).toBe('boolean')
    expect(typeof r.hasScenario).toBe('boolean')
  })
})
