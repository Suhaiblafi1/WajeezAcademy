/* مؤسِّسو المنصّة — من يملك لوحةَ الإدارة، معلَنا في الشيفرة لا في أمرٍ يدويّ.
 *
 * ── العطبُ الذي يُزيله ──
 *
 * التسجيلُ يمنح `learner` وحدَه، وتعيينُ دورٍ من الشاشة محكومٌ بالرتبة: لا
 * يمنح `super_admin` إلّا `super_admin`. **فقاعدةٌ بلا مديرِ نظامٍ لا سبيلَ
 * إليها من الواجهة أصلا** — وكان السبيلُ الوحيد `npm run promote:super-admin`
 * على الخادم.
 *
 * وذلك يعني أنّ صاحبَ المنصّة لا يرى لوحتَه إلّا بيدِ من يملك SSH. وهو يملك
 * المستودَع، ويملك حساباتِ مزوّديه، ولا يملك الخادم — فبقيت شاشةُ التكاملات
 * (البريدُ والدفع) وراءَ بابٍ لا يفتحه هو.
 *
 * ── وكيف يعمل ──
 *
 * عند كلّ إقلاعٍ للخادم: من كان بريدُه هنا **وله حسابٌ على المنصّة** يُضاف
 * إليه `super_admin`. ثمّ يصير كلُّ شيءٍ من المتصفّح: الأدوارُ من
 * `/admin/users`، والبريدُ والدفعُ من `/admin/integrations`.
 *
 * ── وأربعةُ حدودٍ مقصودة ──
 *
 * ١) **لا يُنشئ حسابا.** لا كلمةَ مرورٍ تُخترع ولا حسابٌ يظهر لم يسجّله أحد.
 *    فمن أراد لوحتَه يسجّل من `/auth` أوّلا كأيّ أحد، ثمّ تُضاف رتبتُه.
 * ٢) **لا ينزع دورا ولا حسابا.** يُضيف فقط — فلا يُسقط أحدا بتعديل قائمة.
 * ٣) **يُسجَّل في الأثر** بلا فاعلٍ (النظام)، ويُطبع في السجلّ. لا ترقيةَ
 *    صامتة.
 * ٤) **البريدُ يُقارَن بحروفٍ صغيرة** — كما يُخزَّن عند التسجيل.
 *
 * ── وهل هو بابٌ خلفيّ؟ ──
 *
 * من يستطيع تعديلَ هذا الملفّ يستطيع تعديلَ الشيفرة كلِّها ونشرَها. فمن ملك
 * الكتابةَ في المستودَع ملك الخادمَ فعلا، وهذه القائمةُ لا تمنحه صلاحيّةً
 * جديدة — لكنّها **تجعل ما كان يقع في الظلّ مكتوبا في سجلّ Git**: من أُضيف،
 * ومتى، وبأيّ التزام، وبمراجعةِ طلبِ سحب. وذلك أوثقُ من أمرٍ يُنفَّذ في
 * طرفيّةٍ لا يراها أحد ولا يبقى منه أثر.
 *
 * وحدُّه الحقيقيّ، ويجب أن يُقرأ صريحا: **من ملك بريدا في هذه القائمة وملك
 * حسابا به ملك المنصّة كاملةً.** فلا يُضاف بريدٌ إلّا بقرارِ صاحبها، ولا
 * يُترك بريدٌ لم يعد صاحبُه من أهل المنصّة.
 */

import type { PrismaClient } from '@prisma/client'
import { recordAudit } from '../services/audit'

/** بُرُدُ المؤسِّسين — بحروفٍ صغيرة، وبقرارِ صاحب المنصّة وحدَه */
export const FOUNDER_EMAILS: readonly string[] = [
  'suhaib@wajeez.co',
]

const ROLE = 'super_admin'

export interface FounderResult {
  /** من رُقّي في هذا الإقلاع */
  promoted: string[]
  /** من كان مرقّى من قبل */
  already: string[]
  /** بريدٌ لا حسابَ له بعد — يُقال ولا يُخترع له حساب */
  missing: string[]
}

/** يضمن أنّ لكلّ مؤسِّسٍ له حسابٌ رتبةَ مدير النظام. يُستدعى عند الإقلاع. */
export async function ensureFoundersPromoted(prisma: PrismaClient): Promise<FounderResult> {
  const out: FounderResult = { promoted: [], already: [], missing: [] }

  for (const raw of FOUNDER_EMAILS) {
    const email = raw.trim().toLowerCase()
    if (!email.includes('@')) continue

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, roles: { select: { roleId: true } } },
    })
    if (!user) { out.missing.push(email); continue }
    if (user.roles.some((r) => r.roleId === ROLE)) { out.already.push(email); continue }

    /* `skipDuplicates`: إقلاعان متزامنان لا يتنازعان على صفٍّ واحد */
    await prisma.userRole.createMany({
      data: [{ userId: user.id, roleId: ROLE }],
      skipDuplicates: true,
    })
    await recordAudit(prisma, {
      actorId: null,
      action: 'auth.founder.promoted',
      entityType: 'user',
      entityId: user.id,
      meta: { email, role: ROLE, source: 'FOUNDER_EMAILS' },
    })
    out.promoted.push(email)
  }

  return out
}
