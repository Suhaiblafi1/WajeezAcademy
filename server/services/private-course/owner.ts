/* ═══ بابُ اللوحة الخاصّة — صاحبُ المنصّة وحدَه (١٩ نوفمبر ٢٠٢٦) ═══

   قرارُه: «يسمح للسوبر أدمن فقط الوصولَ إليه.. فقط أنا suhaib@wajeez.co». فالشرطان معا لا أحدُهما:
   دورُ `super_admin` **وبريدُ الحساب** هذا بعينه. فمديرُ نظامٍ آخرُ لا يراها، ولا يفتحها من سُرق منه البريدُ
   وحدَه بحسابٍ بلا رتبة.

   ولماذا لا صلاحيّةٌ في `permissions.ts`: الصلاحيّاتُ تُمنح للأدوار، وكلُّ مديرِ نظامٍ يأخذها كلَّها
   (`nav-reachable.test.ts` يحرس ذلك). فصلاحيّةٌ هنا كانت تفتحها لكلّ `super_admin` — وهو ما قال لا له.

   والبريدُ يُقارَن بحروفٍ صغيرةٍ كما يُخزَّن عند التسجيل (`founders.ts`). */

import type { FastifyReply, FastifyRequest } from 'fastify'
import type { AuthContext } from '../auth.service'
import { PRIVATE_OWNER_EMAIL } from '../../../src/application/private-course/ai-jobs'

export { PRIVATE_OWNER_EMAIL }

export function isPrivateOwner(auth: Pick<AuthContext, 'email' | 'roles'> | null | undefined): boolean {
  if (!auth) return false
  return auth.roles.includes('super_admin') && auth.email.trim().toLowerCase() === PRIVATE_OWNER_EMAIL
}

/** حارسُ المسار — ٤٠١ بلا جلسة، و٤٠٤ لغيره: لا يُقال لمن ليس صاحبَها إنّ هنا شيئا */
export async function requirePrivateOwner(req: FastifyRequest, reply: FastifyReply) {
  if (!req.auth) {
    return reply.status(401).send({ error: { code: 'unauthenticated', message_ar: 'سجّل الدخول أولا' } })
  }
  if (!isPrivateOwner(req.auth)) {
    return reply.status(404).send({ error: { code: 'not_found', message_ar: 'الصفحة غير موجودة' } })
  }
}
