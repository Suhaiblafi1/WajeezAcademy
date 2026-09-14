/* اعتمادُ طلبِ تغييرٍ — و«يُرفَع ما هو موجود».

   ═══ العطبُ الذي كُتب له ═══

   طلبُ التغيير ليس دائما تغييرا على صفٍّ قائم. منه ما هو **طلبُ ميلاد**:
   `skill_request` معرّفُه «مَزلَقُ» مهارةٍ لم تُخلَق بعد، ومعرّفٌ لدورةٍ
   مقترحةٍ لا صفَّ لها في `Course`.

   وكان `promoteEntity` يكتب `update({ where: { id } })` في كلّ حال — فيرمي
   Prisma الرمزَ `P2025`، وتُلغى المعاملةُ كلُّها، **ويرى المراجعُ ٥٠٠ بلا
   سبب** على أنّ قرارَه سليمٌ ومكتوبٌ وقد سُجّل في `ContentApprovalDecision`
   قبل أن يُلغى معها.

   ولم يُحرَس ببادئةٍ في الاسم: البادئةُ تحرس صنفا واحدا، والأصنافُ أكثر.
   فالقاعدةُ تُسأل عنها القاعدةُ نفسُها: **أهذا الصفُّ موجود؟**

   ═══ وهذا الملفُّ كان اسمُه `trainer-course-suggestion` ═══

   حرس طريقا ثانيا لاقتراح دورةٍ من مدرّب، أُزيل بقرار صاحب المنصّة حين
   تبيّن أنّ الطريقَ مبنيٌّ مرّتَين. وحُفظت منه هذه الحرّاسُ وحدَها لأنّ
   ما تحرسه ليس ذلك الطريقَ بل **قاعدةَ الاعتماد المشتركة** — وهي حيّةٌ
   بعده، يمرّ عليها طلبُ المهارة وكلُّ طلبِ تغييرٍ في المنصّة. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { CatalogAdminService } from '../../services/catalog-admin.service'

let prisma: PrismaClient
let admin: CatalogAdminService
let courseId = ''

const ACTOR = '00000000-0000-0000-0000-00000000000a'
const CHECKER = '00000000-0000-0000-0000-00000000000b'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  admin = new CatalogAdminService(prisma)
  const course = await prisma.course.findFirst({ select: { id: true } })
  courseId = course!.id
}, 240_000)

describe('يُرفَع ما هو موجود', () => {
  /* ═══ الصنفُ الأوّل: مهارةٌ تُطلَب ولم تُخلَق ═══

     شاشةُ الكتالوج تفتح بابا واحدا لطلب مهارةٍ جديدة، فتكتب طلبَ تغييرٍ
     صنفُه `skill` ومعرّفُه اسمٌ لا صفَّ له في `Skill`. */
  it('مهارةٌ طُلب ميلادُها تُعتمد ولا تصطدم بصفٍّ معدوم', async () => {
    const cr = await admin.submitChangeRequest(
      'skill', 'mahara-la-tujad',
      { kind: 'skill_request', slug: 'mahara-la-tujad', nameAr: 'مهارةٌ مطلوبة', reasonAr: 'يحتاجها مؤلّف' },
      ACTOR,
    )
    const done = await admin.decide(cr.id, 'approve', 'مهارةٌ وجيهة', CHECKER)
    expect(done.status).toBe('approved')
    expect(
      await prisma.skill.findUnique({ where: { id: 'mahara-la-tujad' } }),
      'وُلدت مهارةٌ من باب القرار — والمهارةُ تُخلق حيث تُربط بالكتالوج',
    ).toBeNull()
  })

  /* والصنفُ الثاني: دورةٌ لم تُؤلَّف بعد */
  it('ودورةٌ لا صفَّ لها تُعتمد قرارا ولا تُخلَق بابا خلفيّا', async () => {
    const cr = await admin.submitChangeRequest(
      'course', 'C-LA-YUJAD',
      { kind: 'proposed_course', titleAr: 'تحليلُ الأثر الاجتماعيّ' },
      ACTOR,
    )
    const done = await admin.decide(cr.id, 'approve', 'مقترحٌ وجيه', CHECKER)
    expect(done.status).toBe('approved')
    expect(
      await prisma.course.findUnique({ where: { id: 'C-LA-YUJAD' } }),
      'وُلدت دورةٌ في الكتالوج من باب القرار لا من باب التأليف',
    ).toBeNull()
  })

  /* ═══ ولا يُسكِت الإصلاحُ الرفعَ حيث يجب أن يقع ═══

     حارسٌ بلا هذا نصفُ حارس: «لا يرمي» تتحقّق أيضا بـ`return` دائم. */
  it('وصفٌّ قائمٌ يُرفع كما كان — فالإصلاحُ لم يُعطّل الرفع', async () => {
    const cr = await admin.submitChangeRequest('course', courseId, { kind: 'tidy' }, ACTOR)
    const done = await admin.decide(cr.id, 'approve', 'تعديلٌ مقبول', CHECKER)
    expect(done.status).toBe('approved')
    const row = await prisma.course.findUnique({ where: { id: courseId } })
    expect(row?.status, 'الدورةُ القائمةُ لم تُرفع').toBe('approved')
  })
})
