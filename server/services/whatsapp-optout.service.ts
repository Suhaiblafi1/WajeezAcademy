/* ═══ من ردّ «توقف» على واتساب (١١ نوفمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «سجّل من يردّ "توقف" على واتساب في المنصة».

   · **يُسجَّل بيد من قرأ الردّ**: رسائلُ واتساب تُرسَل من هاتف المدير أو المستشار (زرُّ `wa.me`)، وردُّها يصل هاتفَه لا
     المنصّة. فالمديرُ يسجّله من «من عبّأ النموذج»، والمستشارُ من حالته — وكلاهما بزرّ.
   · **بذيل الرقم** (`phoneTail`): الرقمُ نفسُه في نموذجَي منحتين وفي حالة مستشار، ويُكتب بمسافاتٍ ومفتاحِ دولةٍ أو بلا.
     فمن سُجّل مرّةً عُرف في كلّ مكان.
   · **وأثرُه**: لا يظهر له زرُّ واتساب في قائمة من عبّأ، ويرى المستشارُ بجانب رقمه «طلب ألا نراسله على واتساب».
     ورسائلُ بريده لا تُمسّ — لها إلغاؤها هي (`mail-optout.service.ts`).
   · **ويُرجَع عنه** بزرٍّ إن سُجّل خطأً أو عاد صاحبُه يطلب. وكلاهما في الأثر باسم من فعل. */

import type { Prisma, PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { phoneTail } from '../../src/application/advisor/phone-tail'

type Db = PrismaClient | Prisma.TransactionClient

/** ذيولُ من طلب ألّا نراسله من هذه الأرقام — يُقرأ مرّةً للقائمة كلِّها */
export async function whatsappStopped(db: Db, phones: readonly (string | null | undefined)[]): Promise<Set<string>> {
  const tails = [...new Set(phones.map(phoneTail).filter((t): t is string => !!t))]
  if (tails.length === 0) return new Set()
  const rows = await db.whatsAppOptOut.findMany({ where: { tail: { in: tails } }, select: { tail: true } })
  return new Set(rows.map((r) => r.tail))
}

/** أطلبَ صاحبُ هذا الرقم ألّا نراسله؟ */
export const isWhatsappStopped = (stopped: Set<string>, phone: string | null | undefined): boolean => {
  const t = phoneTail(phone)
  return !!t && stopped.has(t)
}

/** يسجّله أو يرجع عنه — بأثرٍ يسمّي من فعل ومن أين */
export async function setWhatsappStop(
  db: PrismaClient, phone: string | null | undefined, stopped: boolean, actorId: string,
  where: { entityType: 'lead' | 'advisor_case'; entityId: string }, ip?: string,
): Promise<{ stopped: boolean }> {
  const tail = phoneTail(phone)
  if (!tail || !phone) throw new AuthError('no_phone', 'لا رقم واتساب له', 400)
  await db.$transaction(async (tx) => {
    if (stopped) await tx.whatsAppOptOut.upsert({ where: { tail }, create: { tail, phone, createdBy: actorId }, update: {} })
    else await tx.whatsAppOptOut.deleteMany({ where: { tail } })
    await recordAudit(tx, {
      action: stopped ? 'contact.whatsapp_stop' : 'contact.whatsapp_resume',
      entityType: where.entityType, entityId: where.entityId, actorId, ip, meta: { tail },
    })
  })
  return { stopped }
}
