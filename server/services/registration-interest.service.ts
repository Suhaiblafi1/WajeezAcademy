/* من جاء ليشتري فوجد البابَ مغلقا — بريدُه ووعدُه (قرارُ صاحب المنصّة ١٨ سبتمبر ٢٠٢٦).

   ═══ الفرقُ بين «لا» و«لا، الآن» ═══

   البابُ المغلقُ بلا بابٍ ثانٍ يطرد من جاء يشتري: وصل بنيّةِ الدفع، ووجد
   جملةً تقول «ليس الآن»، ثمّ لا شيء — فلا سبيلَ له إلينا إلّا أن يتذكّرنا
   من نفسه بعد شهرين. وهو لا يتذكّر.

   فالجملةُ وحدَها خسارةُ من جاء. والبريدُ يقلب الإغلاقَ من طردٍ إلى موعد.

   ═══ ولا يُجمع إلّا ما يوصَلُ به ═══

   عنوانٌ وموسمٌ ونصُّ ما وُعد به. لا اسمَ ولا هاتفَ ولا بلدَ ولا ما كان
   يتصفّح — فكلُّ حقلٍ يُجمع بلا حاجةٍ دينٌ يُحرَس ويُمحى ويُسأل عنه، والوعدُ
   المقطوعُ هنا **رسالةٌ واحدة**.

   ونصُّ الموافقة يُحفظ مع الصفّ لا يُستذكَر من الشيفرة: يومَ يُسأل «بمَ
   وعدتموه؟» يُقرأ ما رآه هو على شاشته يومَها، لا ما تقوله نسخةُ اليوم. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { readSeasonGate, type SeasonGate } from './registration-window'
import { enqueueMail } from './outbox.service'
import { renderMail } from './mail-template'
import { publicSiteUrl } from './site-url'
import { recordAudit } from './audit'

/** نصُّ الوعد — يُعرض على الشاشة ويُحفظ مع الصفّ، فلا يفترق ما قيل عمّا حُفظ */
export const INTEREST_CONSENT_AR =
  'أوافق أن تصلني رسالةٌ واحدةٌ على هذا البريد عند فتح باب التسجيل — ولا شيءَ غيرها.'

/** من أيّ شاشةٍ تُرك البريد — قائمةٌ مغلقةٌ فلا يصير الحقلُ نصّا حرّا */
export const INTEREST_SOURCES = ['pathway', 'course', 'cohort', 'buy'] as const
export type InterestSource = (typeof INTEREST_SOURCES)[number]

export class RegistrationInterestService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** يسجّل انتظارَ عنوانٍ للموسم المغلق الآن.

      ولا يُقبل والبابُ مفتوح: لا معنى لانتظارِ ما لا يُنتظَر، وقبولُه يبني
      قائمةً تُرسَل إلى من يستطيع الشراءَ الآن — فيصلهم خبرُ فتحٍ وقع أمس. */
  async record(email: string, source: InterestSource) {
    const gate = await readSeasonGate(this.prisma)
    if (gate.open) {
      throw new AuthError('season_open', 'باب التسجيل مفتوح الآن — أكمل شراءك', 409)
    }
    const normalized = email.trim().toLowerCase()
    const seasonKey = gate.seasonKey || 'unset'

    /* والعائدُ يُقال له إنّه مسجَّلٌ من قبل، لا يُشكَر شكرَ أوّلِ مرّة: من
       ترك بريدَه أمس ونسي، يحتاج أن يعرف أنّه في القائمة — لا أن يشكّ. */
    const existing = await this.prisma.registrationInterest.findUnique({
      where: { email_seasonKey: { email: normalized, seasonKey } },
    })
    await this.prisma.registrationInterest.upsert({
      where: { email_seasonKey: { email: normalized, seasonKey } },
      update: { lastSeenAt: new Date() },
      create: {
        email: normalized, seasonKey, source,
        consentAr: INTEREST_CONSENT_AR,
      },
    })
    return { alreadyWaiting: existing !== null, seasonAr: gate.seasonAr }
  }

  /** كم ينتظر، وكم أُبلغ — الرقمُ الذي يُقرأ قبل فتح الباب */
  async waiting(seasonKey: string) {
    const [total, pending] = await Promise.all([
      this.prisma.registrationInterest.count({ where: { seasonKey } }),
      this.prisma.registrationInterest.count({ where: { seasonKey, notifiedAt: null } }),
    ])
    return { total, pending }
  }

  /** يُبلغ من ينتظر أنّ البابَ فُتح — ولا يُبلَغ أحدٌ مرّتين.

      والرسائلُ تُكتب في الطابور لا تُرسَل هنا: ألفُ عنوانٍ بحدِّ مزوّدٍ
      طلبَين في الثانية يعني تسعَ دقائقَ داخلَ طلبِ HTTP واحد — والعاملُ
      يُفرّغها مُمَهَّلا. والعلّةُ كاملةً في رأس `outbox.service`.

      و`notifiedAt` تُوسَم مع الكتابة في الطابور لا بعد الإرسال: ما يُحرَس
      هنا ألّا يُبلَّغ أحدٌ مرّتين، وإعادةُ المحاولة شأنُ الطابور وحدَه. */
  async notifyWaiting(actorId: string, gate: SeasonGate, seasonKey: string, seasonAr: string) {
    const rows = await this.prisma.registrationInterest.findMany({
      where: { seasonKey, notifiedAt: null },
      select: { id: true, email: true },
    })
    if (rows.length === 0) return { queued: 0 }

    const season = seasonAr || 'الموسم الجديد'
    const url = `${publicSiteUrl()}/catalog`
    for (const row of rows) {
      await enqueueMail(this.prisma, {
        to: row.email,
        subject: `فُتح باب التسجيل — ${season}`,
        purpose: 'registration.season.open',
        ...renderMail({
          preheader: `بابُ التسجيل ل${season} مفتوحٌ الآن — والمقاعدُ بالأسبقيّة.`,
          heading: `فُتح باب التسجيل ل${season}`,
          blocks: [
            { kind: 'p', text: 'تركتَ بريدَك لنُعلمك حين يُفتح، وهذه هي الرسالة.' },
            { kind: 'cta', label: 'تصفّح الدورات واحجز مقعدك', href: url },
            { kind: 'note', text: 'وصلتك هذه لأنّك طلبتَ أن نُعلمك — وهي الرسالةُ الوحيدة، فلا شيء بعدها.' },
          ],
        }),
      })
    }
    await this.prisma.registrationInterest.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: { notifiedAt: new Date() },
    })
    await recordAudit(this.prisma, {
      actorId, action: 'registration.season.notify',
      entityType: 'platform', entityId: seasonKey,
      meta: { queued: rows.length, seasonAr: season, gateOpen: gate.open },
    })
    return { queued: rows.length }
  }
}
