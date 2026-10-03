/* ردُّنا على من اعتذر عن عقده — وخيارُه في بياناته يقع بكبسة زرّ.

   القرارُ ونصُّه الأوّلُ في `src/application/trainer/decline-reply.ts`. وهنا:

   · `reply` — يرسل نصَّ الإدارة (كما حرّرته) إلى صاحب العقد المعتذَر عنه، مرّةً
     واحدة، ومعه رابطُ صفحة الخيار. ويُحفَظ النصُّ وتاريخُه على العقد.
   · `choiceByToken` — ما تقرؤه الصفحة: الاسمُ، وأقرّر أم لا.
   · `chooseByToken` — `keep` يُكتب ويبقى كلُّ شيء. و`delete` يمحو طلبَه وملفَّه
     بعقوده ووثائقه في الحال، بالطريق المحروس نفسِه (`TrainerApplicationService.purge`)
     — والأثرُ يُكتب قبل المحو فيبقى بعده.

   ولا يُحذف ما لا يملك أن يُحذف بقرار طرفٍ واحد: عقدٌ نافذٌ آخرُ له، أو شهادةٌ
   صادرةٌ بيد متعلّم. هناك يُقال له إنّ طلبَه وصلنا، ويصل الإدارةَ لتتولّاه —
   فلا يُقال «حُذفت» عن شيءٍ لم يُحذف. */

import { createHash, randomBytes } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { notifyRole, sendDirectEmail, type DirectMailStatus } from './notification.service'
import { publicSiteUrl } from './site-url'
import { renderMail } from './mail-template'
import { declineReplyMail } from './trainer-decision-mail'
import { TrainerApplicationService, PURGEABLE_STATUSES } from './trainer-application.service'
import { fmtDateWith } from '../../src/application/text/format-ar'
import {
  DATA_CHOICE_LINK_DAYS, DECLINE_REPLY_BODY_MAX, DECLINE_REPLY_BODY_MIN, DECLINE_REPLY_SUBJECT_MAX,
  type DataChoice,
} from '../../src/application/trainer/decline-reply'

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

export class TrainerDeclineReplyService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) { this.prisma = prisma }

  private choiceUrl(token: string) {
    return `${publicSiteUrl()}/data-choice/${encodeURIComponent(token)}`
  }

  async reply(contractId: string, actorId: string, input: { subjectAr: string; bodyAr: string }): Promise<{
    ok: true; emailDelivery: DirectMailStatus; choiceUrl: string
  }> {
    const subject = input.subjectAr.trim()
    const body = input.bodyAr.trim()
    if (subject.length < 3 || subject.length > DECLINE_REPLY_SUBJECT_MAX) {
      throw new AuthError('bad_subject', 'اكتب عنوانَ الرسالة', 422)
    }
    if (body.length < DECLINE_REPLY_BODY_MIN || body.length > DECLINE_REPLY_BODY_MAX) {
      throw new AuthError('bad_body', 'نصُّ الرسالة أقصرُ أو أطولُ ممّا يُرسَل', 422)
    }
    const c = await this.prisma.trainerContract.findUnique({
      where: { id: contractId },
      include: { profile: { include: { application: true } } },
    })
    if (!c) throw new AuthError('not_found', 'العقد غير موجود', 404)
    if (c.status !== 'declined') throw new AuthError('bad_state', 'لا يُردّ هنا إلّا على عقدٍ اعتذر عنه صاحبُه', 409)

    const token = randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + DATA_CHOICE_LINK_DAYS * 86_400_000)
    /* مرّةً واحدة — قارنْ واضبطْ في نداءٍ واحد: نقرتان لا تُرسلان رسالتين */
    const done = await this.prisma.trainerContract.updateMany({
      where: { id: c.id, status: 'declined', declineRepliedAt: null },
      data: {
        declineReplyAr: body.slice(0, DECLINE_REPLY_BODY_MAX), declineRepliedAt: new Date(), declineRepliedBy: actorId,
        dataChoiceTokenHash: sha256(token), dataChoiceExpiresAt: expiresAt,
      },
    })
    if (done.count === 0) throw new AuthError('already_replied', 'رُدّ على هذا الاعتذار من قبل', 409)

    await recordAudit(this.prisma, {
      actorId, action: 'trainer.contract.decline_replied', entityType: 'trainer_contract', entityId: c.id,
      meta: { subjectAr: subject },
    })
    const app = c.profile.application
    const doc = declineReplyMail({
      fullName: app.fullName, reference: app.reference, contractNumber: c.number,
      subjectAr: subject, bodyAr: body, choiceUrl: this.choiceUrl(token),
      expiresOnAr: fmtDateWith(expiresAt, { year: 'numeric', month: 'long', day: 'numeric' }),
    })
    const mail = await sendDirectEmail(this.prisma, { to: c.signerEmail ?? app.email, subject: doc.subject, ...renderMail(doc.doc) })
    return { ok: true, emailDelivery: mail.status, choiceUrl: this.choiceUrl(token) }
  }

  private async byToken(token: string) {
    const c = await this.prisma.trainerContract.findUnique({
      where: { dataChoiceTokenHash: sha256(token) },
      include: { profile: { include: { application: true } } },
    })
    if (!c) throw new AuthError('invalid_token', 'هذا الرابطُ غيرُ صالح — أو حُذفت البياناتُ التي يشير إليها', 404)
    return c
  }

  async choiceByToken(token: string) {
    const c = await this.byToken(token)
    return {
      fullName: c.profile.application.fullName,
      choice: c.dataChoice as DataChoice | null,
      choiceAt: c.dataChoiceAt,
      expired: !c.dataChoiceExpiresAt || c.dataChoiceExpiresAt < new Date(),
    }
  }

  async chooseByToken(token: string, choice: DataChoice): Promise<{ choice: DataChoice; done: boolean; noteAr: string }> {
    const c = await this.byToken(token)
    if (!c.dataChoiceExpiresAt || c.dataChoiceExpiresAt < new Date()) {
      throw new AuthError('expired', 'انتهت صلاحيةُ هذا الرابط — ردَّ على رسالتنا وننفّذ ما تريد', 410)
    }
    const app = c.profile.application
    if (choice === 'keep') {
      await this.prisma.trainerContract.update({ where: { id: c.id }, data: { dataChoice: 'keep', dataChoiceAt: new Date() } })
      await recordAudit(this.prisma, {
        actorId: null, action: 'trainer.data_choice.keep', entityType: 'trainer_contract', entityId: c.id,
      })
      await notifyRole(this.prisma, ['academic_manager', 'super_admin'], {
        channel: 'in_app', templateKey: 'trainer.data_choice.made',
        title: 'اختار مدرّبٌ إبقاءَ بياناته',
        body: `اختار ${app.fullName} أن نُبقي بياناته للمواسم القادمة.`,
        data: { applicationId: app.id },
      }).catch(() => undefined)
      return { choice, done: true, noteAr: 'أبقينا بياناتك — ونتواصل معك في المواسم القادمة. ولك أن تطلب حذفَها متى شئت بالردّ على رسالتنا.' }
    }

    /* ═══ الحذفُ في الحال — بالطريق المحروس ═══
       `purge` لا يقبل إلّا طلبا منتهيا، وطلبُ من اعتذر عن عقده قائمٌ بحاله.
       فيُنهى بطلبه هو (`withdrawn`) ثمّ يُمحى — وإن أبى المحوُ لعقدٍ نافذٍ أو
       شهادةٍ صادرة عادت حالُه كما كانت، ووصل طلبُه الإدارةَ. */
    const before = app.status
    const reason = 'حذفُ بياناته بطلبه — من صفحة خياره بعد اعتذاره عن عقده'
    if (!(PURGEABLE_STATUSES as readonly string[]).includes(before)) {
      await this.prisma.trainerApplication.update({ where: { id: app.id }, data: { status: 'withdrawn' } })
    }
    try {
      await new TrainerApplicationService(this.prisma).purge(app.reference, null, reason)
    } catch (e) {
      if (before !== 'withdrawn') {
        await this.prisma.trainerApplication.update({ where: { id: app.id }, data: { status: before } }).catch(() => undefined)
      }
      await this.prisma.trainerContract.update({ where: { id: c.id }, data: { dataChoice: 'delete', dataChoiceAt: new Date() } })
      await notifyRole(this.prisma, ['academic_manager', 'super_admin'], {
        channel: 'in_app', templateKey: 'trainer.data_choice.made',
        title: 'طلب مدرّبٌ حذفَ بياناته — ولم يُحذف آليّا',
        body: `طلب ${app.fullName} حذفَ بياناته، وتعذّر الحذفُ الآليّ: ${e instanceof AuthError ? e.message : 'خطأ'} — تولَّه بيدك.`,
        data: { applicationId: app.id },
      }).catch(() => undefined)
      return { choice, done: false, noteAr: 'وصلنا طلبُك حذفَ بياناتك، ويتولّاه فريقُنا بنفسه لأنّ في سجلّك ما لا يُحذف آليّا — ونبلغك حين يتمّ.' }
    }
    await notifyRole(this.prisma, ['academic_manager', 'super_admin'], {
      channel: 'in_app', templateKey: 'trainer.data_choice.made',
      title: 'حُذفت بياناتُ مدرّبٍ بطلبه',
      body: `اختار ${app.fullName} حذفَ بياناته، فحُذف طلبُه وملفُّه بعقوده ووثائقه.`,
      data: {},
    }).catch(() => undefined)
    return { choice, done: true, noteAr: 'حذفنا بياناتك نهائيّا. شكرا لك، ونتمنّى لك كلَّ التوفيق — وبابُنا مفتوحٌ إن أردت العودةَ يوما.' }
  }
}
