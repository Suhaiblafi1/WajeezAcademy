/* تأليف متن الوحدة — ثلاثُ خطواتٍ لا ثلاثةُ أزرار.

   ما يُحرَس هنا ليس أن الحفظ يحفظ، بل أن الحاكميّة تمنع فعلا:

   ١) المسوّدةُ واحدة — فتحُها مرّتين لا يُنشئ اثنتين، ولا يمتلئ السجلّ بصفٍّ
      لكلِّ ضغطةِ حفظ فيصير غيرَ مقروء لمراجعٍ بشريّ.
   ٢) والمسوّدةُ لا يراها متعلّم — وهو ما يحرسه أيضا حارسُ القرّاء الخمسة،
      ويُختبر هنا من جهة الكتابة: ما بعد الحفظ لا يظهر في الإصدار المقروء.
   ٣) ولا يعتمد أحدٌ ما كتبه — والمديرُ الأكاديميّ يملك التأليف والمراجعة
      معا، فبلا هذا الشرط تنهار الخطواتُ الثلاث إلى واحدة.
   ٤) والصيغةُ تُرفض عند الكتابة لا عند العرض — بالمحلّلات نفسها التي يقرأ
      بها المتعلّم، فلا يُقبل هنا ما ينكسر هناك.
   ٥) والرفضُ يوجب سببا — ردٌّ بلا سبب لا يُفيد الكاتب في شيء. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { ModuleAuthoringService, DRAFT, IN_REVIEW, AWAITING_FINAL, PUBLISHED } from '../../services/module-authoring.service'
import { readableVersionOf } from '../../catalog/module-version-visibility'

let prisma: PrismaClient
let svc: ModuleAuthoringService
let moduleId = ''

const AUTHOR = '11111111-1111-4111-8111-111111111111'
const REVIEWER = '22222222-2222-4222-8222-222222222222'
/* الحلقةُ الثالثة — ثالثٌ غيرُ الكاتب والمعتمِد الأكاديميّ */
const FINAL = '33333333-3333-4333-8333-333333333333'

const GOOD_CHECKS = `س: ما الفرق بين الهدف والنتيجة؟
- الهدف ما نقيسه
+ النتيجة أثرٌ يبقى بعد التدريب
ش: النتيجة تُقاس بعد أسابيع لا في القاعة`

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  svc = new ModuleAuthoringService(prisma)
  /* وحدةٌ منشورةٌ لها متن — كي يكون ما يُقارَن حقيقيا لا فارغا */
  const base = await prisma.courseModuleVersion.findFirst({
    where: { status: PUBLISHED, bodyAr: { not: null } }, orderBy: { version: 'asc' },
  })
  expect(base).toBeTruthy()
  moduleId = base!.moduleId
  /* تنظيفٌ بين التشغيلات: لا مسوّدةَ عالقة من تشغيلةٍ سابقة */
  await prisma.courseModuleVersion.deleteMany({ where: { moduleId, status: { in: [DRAFT, IN_REVIEW] } } })
})

describe('تأليف متن الوحدة', () => {
  it('١) المسوّدة واحدة مهما فُتحت', async () => {
    const a = await svc.openDraft(moduleId, AUTHOR)
    const b = await svc.openDraft(moduleId, AUTHOR)
    expect(b.id).toBe(a.id)
    const count = await prisma.courseModuleVersion.count({ where: { moduleId, status: DRAFT } })
    expect(count).toBe(1)
  })

  it('٢) وما يُحفظ فيها لا يراه متعلّم', async () => {
    await svc.save(moduleId, { bodyAr: '# متنٌ لم يُعتمد بعد\n\nنصٌّ في المسوّدة.' }, AUTHOR)
    const readable = await prisma.courseModuleVersion.findFirst(readableVersionOf(moduleId))
    expect(readable?.status).toBe(PUBLISHED)
    expect(readable?.bodyAr ?? '').not.toContain('لم يُعتمد بعد')
  })

  it('٣) والصيغة تُرفض عند الكتابة بالمحلّل نفسه', async () => {
    await expect(svc.save(moduleId, { checksAr: 'س: سؤالٌ بلا خيارات' }, AUTHOR)).rejects.toThrow()
    await expect(svc.save(moduleId, { videoAr: 'javascript:alert(1)' }, AUTHOR)).rejects.toThrow()
    /* والصالحُ يمرّ — كي لا يكون الحارس مانعا لكلِّ شيء */
    await svc.save(moduleId, { checksAr: GOOD_CHECKS }, AUTHOR)
    const d = await prisma.courseModuleVersion.findFirst({ where: { moduleId, status: DRAFT } })
    expect(d?.checksAr).toContain('النتيجة أثرٌ يبقى')
  })

  it('٤) ولا تُرفع وحدةٌ بلا متن', async () => {
    const other = await prisma.courseModuleVersion.findFirst({
      where: { status: PUBLISHED, bodyAr: null, moduleId: { not: moduleId } },
      orderBy: { version: 'desc' },
    })
    expect(other).toBeTruthy()
    await prisma.courseModuleVersion.deleteMany({
      where: { moduleId: other!.moduleId, status: { in: [DRAFT, IN_REVIEW] } },
    })
    await svc.openDraft(other!.moduleId, AUTHOR)
    await expect(svc.submit(other!.moduleId, AUTHOR)).rejects.toThrow()
  })

  it('٥) ولا يعتمد أحدٌ ما كتبه', async () => {
    await svc.submit(moduleId, AUTHOR)
    const pending = await prisma.courseModuleVersion.findFirst({ where: { moduleId, status: IN_REVIEW } })
    expect(pending).toBeTruthy()
    await expect(svc.reviewAcademic(moduleId, { decision: 'approve' }, AUTHOR)).rejects.toThrow()
  })

  it('٦) والردُّ بالتعديل يوجب سببا، ويُعيدها مسوّدةً لا يراها متعلّم', async () => {
    await expect(svc.reviewAcademic(moduleId, { decision: 'request_changes', noteAr: 'لا' }, REVIEWER)).rejects.toThrow()
    await svc.reviewAcademic(moduleId, { decision: 'request_changes', noteAr: 'المتن بلا مثالٍ تطبيقيّ — أضف واحدا' }, REVIEWER)
    const back = await prisma.courseModuleVersion.findFirst({ where: { moduleId, status: DRAFT } })
    expect(back?.reviewNoteAr).toContain('مثالٍ تطبيقيّ')
    const readable = await prisma.courseModuleVersion.findFirst(readableVersionOf(moduleId))
    expect(readable?.status).toBe(PUBLISHED)
  })

  it('٧) والنشرُ بعد حلقتين يجعلها هي المقروءة', async () => {
    await svc.submit(moduleId, AUTHOR)
    /* حلقتان لا واحدة: اعتمادٌ أكاديميّ ثمّ موافقةٌ نهائية من ثالثٍ غيرهما */
    await svc.reviewAcademic(moduleId, { decision: 'approve' }, REVIEWER)
    await svc.reviewFinal(moduleId, { decision: 'publish' }, FINAL)
    const readable = await prisma.courseModuleVersion.findFirst(readableVersionOf(moduleId))
    expect(readable?.bodyAr ?? '').toContain('لم يُعتمد بعد')
    expect(readable?.status).toBe(PUBLISHED)
    /* الموقِّعُ الأخير هو المسجَّل مراجعا — وهو من نشر فعلا */
    expect(readable?.reviewedBy).toBe(FINAL)
    expect(readable?.academicApprovedBy, 'ضاع أثرُ الحلقة الوسطى').toBe(REVIEWER)
  })

  it('٨) والسجلُّ لا يُفشي اسم كاتبٍ — العرضُ باسم الأكاديمية', async () => {
    const rows = await svc.history(moduleId)
    expect(rows.length).toBeGreaterThan(1)
    const serialized = JSON.stringify(rows)
    expect(serialized).not.toContain(AUTHOR)
    expect(serialized).not.toContain(REVIEWER)
    expect(serialized).not.toContain(FINAL)
    expect(rows.some((r) => r.hasAuthor)).toBe(true)
  })
})

/* ─────────── ما يجعل «ثلاث خطوات» ثلاثا ───────────

   قرارُ صاحب المنصّة: «المدرب يعدّل دوراته ← المدير الأكاديميّ يستعرض
   الكلَّ ويعتمد ← السوبر أدمن يعطي الموافقة النهائية أو يعيدها بملاحظة إلى
   المدير الأكاديميّ، وهو يعيدها بملاحظته إلى المدرب — رفضٌ دائما مع سبب،
   لا رفضٌ صامت».

   وحارسان لا واحد: لا يوقّعها كاتبُها، **ولا مَن اعتمدها أكاديميّا**.
   فسلسلةٌ يوقّعها شخصٌ واحد ثلاثَ مرّات خطوةٌ واحدة بثلاثة أزرار. */
describe('سلسلةُ الاعتماد الثلاثيّة', () => {
  /* علامةٌ لا تلتبس بالنصّ حولها.

     كانت العلامةُ «السلسلة الثلاثيّة» والمتنُ يقول «للسلسلة الثلاثيّة» —
     ولامُ الجرّ تبتلع ألفَ التعريف، فالمقطعُ غيرُ موجودٍ أصلا. فمرّ تأكيدُ
     النفي («لا يراها متعلّم») لسببٍ غير الذي يزعمه، وسقط تأكيدُ الإثبات
     فكُشف الاثنان. */
  const CHAIN_MARK = 'وسمُ-حلقاتٍ-ثلاث'
  let chainModule = ''

  beforeAll(async () => {
    const base = await prisma.courseModuleVersion.findFirst({
      where: { status: 'published', bodyAr: { not: null }, moduleId: { not: moduleId } },
      orderBy: { version: 'asc' },
    })
    chainModule = base!.moduleId
    await prisma.courseModuleVersion.deleteMany({
      where: { moduleId: chainModule, status: { in: [DRAFT, IN_REVIEW, AWAITING_FINAL] } },
    })
  })

  /** يعيد المسوّدة إلى أوّل السلسلة بمتنٍ صالح */
  const freshDraft = async () => {
    await prisma.courseModuleVersion.deleteMany({
      where: { moduleId: chainModule, status: { in: [DRAFT, IN_REVIEW, AWAITING_FINAL] } },
    })
    await svc.openDraft(chainModule, AUTHOR)
    await svc.save(chainModule, { bodyAr: `متنُ ${CHAIN_MARK} — نصٌّ كافٍ للرفع.` }, AUTHOR)
    await svc.submit(chainModule, AUTHOR)
  }

  it('الاعتمادُ الأكاديميّ لا ينشر — يرفعها إلى الحلقة الأخيرة', async () => {
    await freshDraft()
    const v = await svc.reviewAcademic(chainModule, { decision: 'approve' }, REVIEWER)
    expect(v.status, 'نشرَ المديرُ الأكاديميّ وحدَه').toBe(AWAITING_FINAL)
    /* ولا يراها متعلّم قبل التوقيع الأخير */
    const readable = await prisma.courseModuleVersion.findFirst(readableVersionOf(chainModule))
    expect(readable?.bodyAr ?? '').not.toContain(CHAIN_MARK)
  })

  it('ولا يوقّع النهائيةَ مَن اعتمدها أكاديميّا — وإلّا صارت الحلقتان واحدة', async () => {
    await expect(
      svc.reviewFinal(chainModule, { decision: 'publish' }, REVIEWER),
    ).rejects.toThrow(/اعتمدها أكاديميّا/)
  })

  it('ولا يوقّعها كاتبُها', async () => {
    await expect(svc.reviewFinal(chainModule, { decision: 'publish' }, AUTHOR)).rejects.toThrow(/كتبتَه/)
  })

  it('والإعادةُ من الأخير ترجع إلى الحلقة الوسطى بملاحظتها — لا إلى الكاتب', async () => {
    const v = await svc.reviewFinal(
      chainModule, { decision: 'return_to_academic', noteAr: 'المصطلحُ الأوّل يخالف معجم الأكاديمية' }, FINAL,
    )
    expect(v.status).toBe(IN_REVIEW)
    expect(v.reviewNoteAr).toContain('معجم الأكاديمية')
    expect(v.academicApprovedBy, 'بقي أثرُ اعتمادٍ أُلغي').toBeNull()
  })

  it('ولا إعادةَ صامتة — سببٌ يُقرأ أو لا إعادة', async () => {
    await svc.reviewAcademic(chainModule, { decision: 'approve' }, REVIEWER)
    await expect(
      svc.reviewFinal(chainModule, { decision: 'return_to_academic', noteAr: 'لا' }, FINAL),
    ).rejects.toThrow(/سبب/)
  })

  it('ثمّ يوقّع الأخيرُ فتُنشر — بعد ثلاثِ أيدٍ لا يدين', async () => {
    const v = await svc.reviewFinal(chainModule, { decision: 'publish' }, FINAL)
    expect(v.status).toBe(PUBLISHED)
    const readable = await prisma.courseModuleVersion.findFirst(readableVersionOf(chainModule))
    expect(readable?.bodyAr ?? '').toContain(CHAIN_MARK)
  })
})
