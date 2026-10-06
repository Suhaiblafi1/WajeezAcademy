/* متابعةُ المؤجَّل إلى الفصول القادمة حين يحلّ موعدُه (٦ أكتوبر ٢٠٢٦).

   القرارُ وعلّتُه في `src/application/trainer/deferral.ts`: حين يحلّ الموعدُ الذي
   وُعد به في بريد التأجيل يقع أمران معا — اختارهما صاحبُ المنصّة من أربعة بدائل:

   ① **يُسأل المتقدّمُ بالبريد** «أما زلتَ مهتمّا؟» (`deferralFollowUpMail`)، وفيه
      رابطٌ برمزٍ يُجاب به مرّةً واحدة. والرمزُ لا يُحفظ — هاشُه وحدَه.
   ② **ويُذكَّر الفريق** في الجرس والبريد: حين يحلّ الموعد، ثمّ حين يُجيب.

   ويُكتب «سُئل» قبل أن يخرج البريد، بكتابةٍ مشروطةٍ تفوز بها دورةٌ واحدة — فلا
   يُسأل مرّتين إن تزامنت دورتان، ولا يُعاد سؤالُه كلَّ ساعةٍ إن أخفق البريد: إخفاقُه
   يُكتب في الأثر ويُقال للفريق ليتواصل بنفسه.

   والجوابُ يقلب الحالةَ من `transition` نفسِه — فيُمحى الرمزُ معها (لا يُجاب
   مرّتين)، ويُكتب السطرُ في سجلّ الحالة كأيّ انتقال. */

import { createHash, randomBytes } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { notifyRole, publicSiteUrl, sendDirectEmail, type DirectMailStatus } from './notification.service'
import { renderMail } from './mail-template'
import { deferralFollowUpMail } from './trainer-decision-mail'
import { TrainerApplicationService } from './trainer-application.service'
import {
  DEFERRED, INTEREST_CHOICES, INTEREST_PAGE_PATH, answerTarget, type InterestAnswer,
} from '../../src/application/trainer/deferral'

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const newToken = () => randomBytes(32).toString('base64url')

/** من يُذكَّر — أدوارُ مراجعة طلبات المدرّبين، كإشعار الطلب الجديد */
export const DEFERRAL_STAFF_ROLES = ['super_admin', 'academic_manager', 'operations_manager']
/** مفتاحُ قالبِ الجرس والبريد للفريق — صنفُه ووجهتُه في `application/notifications` */
export const DEFERRAL_STAFF_KEY = 'admin.trainer_deferral'
/** كم طلبا تسأل الدورةُ الواحدة — والباقي في الدورة التالية بعد ساعة */
const ASK_LIMIT = 50

export class TrainerDeferralService {
  private prisma: PrismaClient
  private apps: TrainerApplicationService
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.apps = new TrainerApplicationService(prisma)
  }

  /** في الجرس والبريد معا — وإخفاقُ أحدهما لا يمنع الآخر ولا الحدثَ نفسَه */
  private async tellStaff(title: string, body: string, data: Record<string, unknown>) {
    for (const channel of ['in_app', 'email'] as const) {
      await notifyRole(this.prisma, DEFERRAL_STAFF_ROLES, { channel, title, body, templateKey: DEFERRAL_STAFF_KEY, data })
    }
  }

  /* ═══ ① يحلّ الموعد: يُسأل، ويُذكَّر الفريق ═══ */
  async askDue(now = new Date()): Promise<{ asked: number; mailFailed: number }> {
    const due = await this.prisma.trainerApplication.findMany({
      where: { status: DEFERRED, deferredFollowUpAt: { lte: now }, deferredInterestAskedAt: null },
      orderBy: { deferredFollowUpAt: 'asc' },
      take: ASK_LIMIT,
      select: { id: true, fullName: true, reference: true, email: true },
    })
    let asked = 0
    let mailFailed = 0
    for (const app of due) {
      const token = newToken()
      /* الكتابةُ المشروطةُ هي القفل: تفوز بها دورةٌ واحدة، والخاسرةُ تمضي */
      const claimed = await this.prisma.trainerApplication.updateMany({
        where: { id: app.id, status: DEFERRED, deferredInterestAskedAt: null },
        data: { deferredInterestAskedAt: now, deferredInterestTokenHash: sha256(token) },
      })
      if (claimed.count === 0) continue
      const mail = deferralFollowUpMail({
        fullName: app.fullName, reference: app.reference,
        answerUrl: `${publicSiteUrl()}${INTEREST_PAGE_PATH}/${token}`,
      })
      let delivery: DirectMailStatus = 'failed'
      try {
        delivery = (await sendDirectEmail(this.prisma, { to: app.email, subject: mail.subject, ...renderMail(mail.doc) })).status
      } catch { /* يُكتب إخفاقا ويُقال للفريق */ }
      await recordAudit(this.prisma, {
        actorId: null, action: 'trainer.deferral.ask', entityType: 'trainer_application', entityId: app.id,
        meta: { emailDelivery: delivery },
      })
      if (delivery !== 'sent') mailFailed += 1
      await this.tellStaff(
        `حلّ موعدُ التواصل مع ${app.fullName}`,
        delivery === 'sent'
          ? `أُجّل طلبُه (${app.reference}) إلى الفصول القادمة قبل شهرين، وحلّ اليومَ موعدُ التواصل معه — فسألناه بالبريد عن اهتمامه. ويصلكم جوابُه حين يُجيب.`
          : `أُجّل طلبُه (${app.reference}) إلى الفصول القادمة قبل شهرين، وحلّ اليومَ موعدُ التواصل معه — ولم يخرج إليه بريدُ السؤال. فتواصلوا معه بأنفسكم.`,
        { applicationId: app.id, reference: app.reference, emailDelivery: delivery },
      )
      asked += 1
    }
    return { asked, mailFailed }
  }

  private async byToken(token: string) {
    const app = await this.prisma.trainerApplication.findUnique({
      where: { deferredInterestTokenHash: sha256(token) },
      select: { id: true, fullName: true, reference: true, status: true },
    })
    /* والرابطُ بعد الجواب لا يعمل: الرمزُ مُحي مع الانتقال — فالقولُ واحدٌ لهما */
    if (!app || app.status !== DEFERRED) {
      throw new AuthError('interest_link_used', 'هذا الرابطُ أُجيب عنه أو لم يعد صالحا — ولك أن تكتب إلينا مباشرة.', 404)
    }
    return app
  }

  /* ═══ ② صفحةُ الجواب تقرأ — ولا تُجيب ═══ */
  async view(token: string) {
    const app = await this.byToken(token)
    /* الاسمُ الأوّلُ وحدَه ورقمُ الطلب: الرابطُ في بريده، ولا يلزم أكثرُ من ذلك ليعرف نفسَه */
    return { firstName: app.fullName.split(/\s+/)[0] ?? app.fullName, reference: app.reference, choices: INTEREST_CHOICES }
  }

  /* ═══ ③ الجواب — ضغطةٌ في الصفحة ═══ */
  async answer(token: string, answer: InterestAnswer) {
    const app = await this.byToken(token)
    const to = answerTarget(answer)
    const noteAr = answer === 'interested'
      ? 'أجاب سؤالَ المتابعة: ما زال مهتمّا بالفصول القادمة'
      : 'أجاب سؤالَ المتابعة: لم يعد مهتمّا'
    await this.prisma.$transaction(async (tx) => {
      if (to === 'withdrawn') {
        await tx.trainerApplication.update({ where: { id: app.id }, data: { withdrawReason: 'لم يعد مهتمّا — أجاب سؤالَ متابعة التأجيل' } })
      }
      await this.apps.transition(app.id, to, null, noteAr, tx)
    })
    await recordAudit(this.prisma, {
      actorId: null, action: 'trainer.deferral.answer', entityType: 'trainer_application', entityId: app.id,
      meta: { answer, movedTo: to },
    })
    await this.tellStaff(
      answer === 'interested' ? `${app.fullName} ما زال مهتمّا بالتدريب معنا` : `${app.fullName} لم يعد مهتمّا`,
      answer === 'interested'
        ? `أجاب سؤالَ متابعة التأجيل: ما زال مهتمّا بالفصول القادمة — فعاد طلبُه (${app.reference}) إلى «قيد المراجعة».`
        : `أجاب سؤالَ متابعة التأجيل: لم يعد مهتمّا — فسُحب طلبُه (${app.reference}) بطلبه.`,
      { applicationId: app.id, reference: app.reference, answer },
    )
    return { answer, status: to }
  }
}
