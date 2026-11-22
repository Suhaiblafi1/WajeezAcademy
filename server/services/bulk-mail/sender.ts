/* ═══ مُرسِلُ الحملات — نطاقٌ فرعيٌّ لا نطاقُ بريد الحساب (٢٢ نوفمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: رسائلُ الحملات تخرج من `news@news.wajeezacademy.com` افتراضا، فما يصيب سمعتَها من شكوى أو ارتداد
   لا يمسّ نطاقَ رسائل الحساب والدفع وكلمة السرّ (`academy@wajeezacademy.com`). ورسائلُ الحساب لا تقرأ هذا الإعدادَ أبدا.

   · **يُحفظ إعدادا** (`SystemSetting`) ويُغيَّر من صفحة الحملات بأثرٍ يسمّي من غيّره.
   · **ويُكتب في الحملة ساعةَ تُرسل** (`MailCampaign.fromName/fromEmail`): تغييرُه بعدها لا يغيّر مُرسِلَ حملةٍ في طريقها.
   · **ولا رجوع**: إن لم يُوثَّق النطاقُ في Resend سقطت كلُّ رسالةٍ برسالة Resend نفسِها (`UNVERIFIED_DOMAIN_AR` في
     `mail.ts`) وأُعيدت حتّى حدّ محاولاتها — ولا تخرج من نطاق الحساب بديلا صامتا.

   والردُّ يصل عنوانَ الدعم نفسَه (`replyTo` في إعدادات البريد)، فلا يضيع جوابُ أحد. */

import type { PrismaClient } from '@prisma/client'
import { recordAudit } from '../audit'
import { AuthError } from '../auth.service'
import { cleanEmail } from './parse'
import { DEFAULT_BULK_SENDER } from '../../../src/application/marketing/bulk-mail'

export const BULK_SENDER_KEY = 'bulk_mail.sender'

export interface BulkSender { name: string; email: string }

export async function bulkSender(prisma: PrismaClient): Promise<BulkSender & { isDefault: boolean }> {
  const row = await prisma.systemSetting.findUnique({ where: { key: BULK_SENDER_KEY } })
  const v = (row?.value ?? null) as Partial<BulkSender> | null
  if (v?.email && v.name) return { name: v.name, email: v.email, isDefault: false }
  return { ...DEFAULT_BULK_SENDER, isDefault: true }
}

export async function setBulkSender(prisma: PrismaClient, input: BulkSender, actorId: string, ip?: string) {
  const name = input.name.replace(/[<>"\r\n]/g, '').trim()
  const email = cleanEmail(input.email)
  if (!name) throw new AuthError('bad_sender', 'اكتب اسم المرسل', 400)
  if (!email) throw new AuthError('bad_sender', 'بريد المرسل غير صالح', 400)
  const before = await bulkSender(prisma)
  await prisma.systemSetting.upsert({
    where: { key: BULK_SENDER_KEY },
    create: { key: BULK_SENDER_KEY, value: { name, email }, updatedBy: actorId },
    update: { value: { name, email }, updatedBy: actorId },
  })
  await recordAudit(prisma, {
    action: 'bulk_mail.sender', entityType: 'system_setting', entityId: BULK_SENDER_KEY, actorId, ip,
    before: { name: before.name, email: before.email }, after: { name, email },
  })
  return { name, email, isDefault: false }
}
