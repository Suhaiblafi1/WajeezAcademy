/* ═══ «تواصل معنا» — رسالةٌ تصل فعلا (١٩ أكتوبر ٢٠٢٦) ═══

   كان نموذجُ الموقع العامّ يحاكي الإرسال: ينتظر سبعَ مئة جزءٍ من الثانية، ويعرض رقما مرجعيّا
   عشوائيّا، ولا يصل أحدا. فمن كتب يسأل عن برنامجٍ لجهته — أو يطلب استردادا، وسياسةُ الاسترداد
   تحيله إلى هذا النموذج بالاسم — ظنّ أنّه أُجيب بالاستلام، وانتظر ردّا لن يأتي.

   وخُيّر صاحبُ المنصّة بين أن يصير حقيقيّا، أو يُستبدل بروابط بريدٍ وواتساب، أو يبقى — فاختار
   الأوّل. فالرسالةُ هنا:
   ١) تُحفظ برقمٍ مرجعيٍّ فريد — هو الرقمُ الذي يراه صاحبُها لا رقمٌ يُخترع في المتصفّح.
   ٢) وتصل بريدَ الأكاديميّة، و«ردّ» فيه يصل صاحبَها لا الأكاديميّةَ نفسَها.
   ٣) وتصل صاحبَها نسخةٌ منها برقمها — فيعرف أنّها وصلت، ويجد ما كتب.
   ٤) وتظهر للفريق في شاشة الدعم حتّى يُعلَّم أنّه رُدّ عليها.

   وإخفاقُ البريد لا يُسقط الحفظ: الصفُّ هو الأصل، والجرسُ يُخبر الفريقَ وإن تعطّلت قناةُ البريد. */

import { randomBytes } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { notifyRole, sendDirectEmail, type DirectMailStatus } from './notification.service'
import { renderMail } from './mail-template'
import { ACADEMY_EMAILS } from '../../src/data/academy-email'

export interface ContactInput {
  name: string
  email: string
  entity: string
  organization?: string
  topic: string
  message: string
}

/** من يُخبَر في الجرس — من يُخبَر بتذكرة الدعم نفسِها */
const CONTACT_STAFF_ROLES = ['super_admin', 'support']

const ENTITY_AR: Record<string, string> = {
  individual: 'فرد', company: 'شركة أو قطاع خاص', gov: 'جهة حكومية',
  edu: 'جهة تعليمية أو تدريبية', nonprofit: 'منظمة غير ربحية',
}

const newReference = () => `WJ-C-${randomBytes(4).toString('hex').slice(0, 6).toUpperCase()}`

export class ContactService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  async submit(input: ContactInput): Promise<{ reference: string; copySent: boolean }> {
    if (input.entity !== 'individual' && !input.organization?.trim()) {
      throw new AuthError('no_org', 'اكتب اسم جهتك ليصل طلبك للفريق المختص', 400)
    }
    /* الرقمُ فريدٌ بقيد القاعدة — وتصادمُه نادر، فيُعاد مرّتين ولا يُفترض */
    let row = null
    for (let i = 0; i < 3 && !row; i++) {
      try {
        row = await this.prisma.contactMessage.create({
          data: {
            reference: newReference(),
            name: input.name, email: input.email, entity: input.entity,
            organization: input.organization?.trim() || null,
            topic: input.topic, message: input.message,
          },
        })
      } catch (e) {
        if (!(e instanceof Error && /Unique constraint/i.test(e.message)) || i === 2) throw e
      }
    }
    if (!row) throw new AuthError('contact_failed', 'تعذّر حفظ رسالتك — أعد المحاولة', 500)

    const who = `${row.name}${row.organization ? ` — ${row.organization}` : ''} (${ENTITY_AR[row.entity] ?? row.entity})`

    /* ② إلى بريد الأكاديميّة — و«ردّ» يصل صاحبَها */
    await sendDirectEmail(this.prisma, {
      to: ACADEMY_EMAILS.support,
      replyTo: row.email,
      subject: `رسالة من الموقع: ${row.topic} (${row.reference})`,
      ...renderMail({
        heading: `${row.topic} — من ${row.name}`,
        blocks: [
          { kind: 'facts', rows: [
            { label: 'المرسل', value: who },
            { label: 'البريد', value: row.email },
            { label: 'الرقم المرجعي', value: row.reference },
          ] },
          { kind: 'p', text: row.message },
          { kind: 'note', text: 'اضغط «رد» ليصل جوابك صاحب الرسالة مباشرة، ثم علّمها «تم الرد» في شاشة الدعم.' },
        ],
      }),
    })

    /* ③ نسخةٌ إلى صاحبها برقمها */
    const copy: { status: DirectMailStatus } = await sendDirectEmail(this.prisma, {
      to: row.email,
      subject: `وصلتنا رسالتك (${row.reference}) — أكاديمية وجيز`,
      ...renderMail({
        greetingName: row.name,
        heading: 'وصلتنا رسالتك',
        blocks: [
          { kind: 'p', text: `رقمها المرجعي ${row.reference}. نرد عليك خلال يوم عمل واحد على هذا البريد.` },
          { kind: 'facts', rows: [{ label: 'نوع الطلب', value: row.topic }] },
          { kind: 'callout', text: row.message },
        ],
      }),
    })

    /* ④ والفريقُ يُخبَر في الجرس — وإن تعطّل البريد */
    await notifyRole(this.prisma, CONTACT_STAFF_ROLES, {
      channel: 'in_app',
      templateKey: 'admin.contact_message',
      title: `رسالة من الموقع: ${row.topic}`,
      body: `من ${who}. تجدها في «الدعم» تحت «رسائل الموقع».`,
      data: { contactMessageId: row.id, reference: row.reference },
    })

    return { reference: row.reference, copySent: copy.status === 'sent' }
  }

  /** ما ينتظر ردّا أوّلا، ثمّ الأحدث — وما رُدّ عليه يبقى مرجعا */
  async list(limit = 100) {
    return this.prisma.contactMessage.findMany({
      orderBy: [{ handledAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'desc' }],
      take: limit,
    })
  }

  /** «تمّ الرد» — ومن ردّ ومتى؛ ويُعاد فتحُها إن أخطأ */
  async setHandled(id: string, actorId: string, handled: boolean) {
    const found = await this.prisma.contactMessage.findUnique({ where: { id }, select: { id: true } })
    if (!found) throw new AuthError('not_found', 'الرسالة غير موجودة', 404)
    return this.prisma.contactMessage.update({
      where: { id },
      data: handled ? { handledAt: new Date(), handledBy: actorId } : { handledAt: null, handledBy: null },
    })
  }
}
