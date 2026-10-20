/* صفحةُ «منحة أعضاء وجيز» — من النموذج إلى الكود والدورات (٢٠ أكتوبر ٢٠٢٦).

   ═══ القرارات ═══

   · «A»: **من يعبّئ النموذج يأخذ الكودَ فورا ويختار دوراتِه ويدفع بنفسه**، والمستشارُ لمن يطلبه —
     «فبهذه الحركة قد نكون قد أتممنا عمليّة الشراء قبل أن نذهب ونعود بإرسال رسالةٍ له ثانية».
   · **مفتوحةٌ لكلّ من يعبّئه** حتّى تنتهي المنح.
   · **والحسابُ يُنشأ حين يدفع** — النموذجُ أربعُ خاناتٍ لازمة، وسؤالان اختياريّان (مستواه، وما
     يريد تطويرَه) أُضيفا بقراره (٢٠ أكتوبر ٢٠٢٦) — «الجديدُ منها اختياريّ»: لا يُسقط نموذجا تُرك فيه.

   ═══ ما يقع ═══

   ١) **عميلٌ محتملٌ واحدٌ لكلّ هاتفٍ أو بريد** في الحملة — ولا يُجمع بالنموذج كودان بالهاتف نفسِه.
   ٢) **وكودُه في الصفحة وفي بريده.** ومن عبّأه ثانيةً لا يُعرض له الكودُ في الصفحة: يُرسَل ثانيةً إلى
      **البريد المحفوظ** ويُقال له أين — وإلّا كفى أن يكتب أحدٌ رقمَ غيره ليأخذ منحتَه.
   ٣) **والمنحةُ المغلقةُ أو المنتهيةُ لا تُسقط العميل** — يُحفظ ويُقال له السببُ، وزرُّ المستشار قائم.
   ٤) **والدوراتُ للزائر بلا أجور المدرّبين** — ما يُشترى في الفصل القادم القريب (`grant-courses.service.ts`).
   ٥) **و«تواصل مع مستشار» حالةٌ واحدة** تُسند تلقائيّا — بمرجعه الذي أخذه من النموذج لا بهاتفٍ يكتبه
      أيُّ أحد.

   والحارس: `server/tests/commerce/grant-landing.test.ts`. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { AdvisorService } from './advisor.service'
import { GrantService } from './grant.service'
import { GrantCoursesService } from './grant-courses.service'
import { enqueueMail } from './outbox.service'
import { publicSiteUrl } from './site-url'
import { normalizePhone } from '../../src/application/advisor/guest-contact'
import {
  CAREER_LEVELS, GRANT_CONSENT_AR, GRANT_INTEREST_DOMAINS, GRANT_MAX_INTERESTS, WORK_FIELDS, campaignTag, leadProfileAr,
} from '../../src/application/commerce/grant-landing'
import { courseDomain } from '../../src/application/catalog/course-domain'
import { MEMBER_GRANT_SLUG } from '../../src/application/commerce/grant'
import { fmtDate } from '../../src/application/text/format-ar'

export interface GrantApplyInput {
  fullName: string
  phone: string
  email: string
  workField: string
  careerLevel?: string | null
  interests?: readonly string[]
  channel?: string | null
  wave?: string | null
}

const OPEN_CASE = { notIn: ['closed', 'enrolled', 'not_interested'] }

export class GrantLandingService {
  private prisma: PrismaClient
  private grants: GrantService
  private courses: GrantCoursesService
  private advisors: AdvisorService
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.grants = new GrantService(prisma)
    this.courses = new GrantCoursesService(prisma)
    this.advisors = new AdvisorService(prisma)
  }

  /** ما تعرضه الصفحة: حالُ المنحة، ودوراتُها بفصلها — دوراتٌ فقط، بلا أجور المدرّبين */
  async view(now = new Date()) {
    const [s, open] = await Promise.all([this.grants.settings(now), this.courses.openCourses(now)])
    return {
      campaign: { open: s.open, percentOff: s.percentOff, maxCourses: s.maxCourses, closesAt: s.closesAt, left: s.left },
      termAr: open.termAr,
      openCourses: open.courses.map((c) => ({
        courseId: c.courseId, titleAr: c.courseTitleAr, cohortId: c.cohortId, startsAt: c.startsAt, price: c.price,
        domainAr: courseDomain(c.courseId),
      })),
    }
  }

  /** النموذج: عميلٌ محتملٌ وكودُه — أو سببُ غيابه */
  async apply(input: GrantApplyInput, ip?: string, now = new Date()) {
    const fullName = input.fullName.trim()
    const email = input.email.trim().toLowerCase()
    const phone = normalizePhone(input.phone)
    if (fullName.length < 2) throw new AuthError('bad_name', 'اكتب اسمك', 400)
    if (!phone) throw new AuthError('bad_phone', 'رقم واتساب غير صحيح، اكتبه بالأرقام', 400)
    if (!WORK_FIELDS.includes(input.workField)) throw new AuthError('bad_field', 'اختر مجال عملك من القائمة', 400)
    const careerLevel = input.careerLevel?.trim() || null
    if (careerLevel && !CAREER_LEVELS.includes(careerLevel)) throw new AuthError('bad_level', 'اختر مستواك من القائمة', 400)
    const interests = [...new Set((input.interests ?? []).map((x) => x.trim()))]
    if (interests.length > GRANT_MAX_INTERESTS) throw new AuthError('bad_interests', `اختر حتى ${GRANT_MAX_INTERESTS} مجالات`, 400)
    if (interests.some((x) => !GRANT_INTEREST_DOMAINS.has(x))) throw new AuthError('bad_interests', 'اختر ما تريد تطويره من القائمة', 400)

    const had = await this.prisma.lead.findFirst({
      where: { campaign: MEMBER_GRANT_SLUG, erasedAt: null, OR: [{ phone }, { email }] },
      orderBy: { createdAt: 'asc' },
    })
    const lead = had ?? await this.prisma.lead.create({
      data: {
        fullName, email, phone, source: 'campaign', campaign: MEMBER_GRANT_SLUG, consentAr: GRANT_CONSENT_AR,
        channel: campaignTag(input.channel), wave: campaignTag(input.wave), workField: input.workField,
        careerLevel, interests,
      },
    })
    if (!had) {
      await recordAudit(this.prisma, {
        action: 'coupon.grant_apply', entityType: 'lead', entityId: lead.id, ip,
        meta: { leadId: lead.id, channel: lead.channel, wave: lead.wave },
      })
    }

    let grant: { code: string | null; sentTo: string | null; percentOff: number; closesAt: Date | null } | null = null
    let reasonAr: string | null = null
    try {
      const g = await this.grants.issue({ leadId: lead.id }, now)
      const to = lead.email ?? email
      await this.mailCode(to, lead.fullName, g.code, g.percentOff, g.closesAt)
      grant = g.reused
        ? { code: null, sentTo: maskEmail(to), percentOff: g.percentOff, closesAt: g.closesAt }
        : { code: g.code, sentTo: null, percentOff: g.percentOff, closesAt: g.closesAt }
    } catch (e) {
      if (!(e instanceof AuthError) || !['grant_closed', 'grant_sold_out'].includes(e.code)) throw e
      reasonAr = e.message
    }
    return { ref: lead.id, grant, reasonAr, ...(await this.view(now)) }
  }

  /** «تواصل مع مستشار» — حالةٌ واحدةٌ لصاحب المرجع، تُسند تلقائيّا */
  async askAdvisor(ref: string, noteAr?: string | null, ip?: string) {
    const lead = await this.prisma.lead.findFirst({ where: { id: ref, campaign: MEMBER_GRANT_SLUG, erasedAt: null } })
    if (!lead) throw new AuthError('not_found', 'عبئ النموذج أولا', 404)
    const open = await this.prisma.advisorCase.findFirst({ where: { leadId: lead.id, status: OPEN_CASE }, select: { id: true } })
    if (open) return { ok: true as const }
    const note = noteAr?.trim().slice(0, 500) || null
    const kase = await this.prisma.advisorCase.create({
      data: {
        leadId: lead.id,
        nextAction: ['تواصل أول — طلب مستشارا من صفحة المنحة', leadProfileAr(lead)].filter(Boolean).join(' · '),
        ...(note ? { contactEvents: { create: { channel: 'in_app', direction: 'in', summary: `كتب: ${note}` } } } : {}),
      },
    })
    await recordAudit(this.prisma, {
      action: 'advisor.case.guest_request', entityType: 'advisor_case', entityId: kase.id, ip,
      meta: { leadId: lead.id, campaign: MEMBER_GRANT_SLUG },
    })
    try { await this.advisors.autoAssign(kase.id) } catch { /* بلا مستشارٍ متاح: تبقى في «حالات بلا مستشار» */ }
    return { ok: true as const }
  }

  private async mailCode(to: string, name: string, code: string, percentOff: number, closesAt: Date | null) {
    const url = `${publicSiteUrl()}/grant`
    const last = closesAt ? fmtDate(new Date(closesAt.getTime() - 1)) : null
    await enqueueMail(this.prisma, {
      to, purpose: 'grant.code',
      subject: 'كود منحتك من أكاديمية وجيز',
      text: [
        `مرحبا ${name}،`, '',
        `كود منحتك: ${code}`,
        `تدفع ${100 - percentOff}% فقط من سعر الدورات.`,
        ...(last ? [`آخر يوم لاستعماله: ${last}`] : []),
        '', `اختر دوراتك: ${url}`, '',
        'الكود يستعمل مرة واحدة، ويمكنك أن تهديه لغيرك.',
      ].join('\n'),
    })
  }
}

/** «j•••@gmail.com» — يُقال أين ذهب الكودُ بلا أن يُكشف بريدُ أحدٍ لمن كتب رقمَه */
export function maskEmail(email: string): string {
  const [name, domain] = email.split('@')
  return domain ? `${name.slice(0, 1)}•••@${domain}` : '•••'
}

/** ما يُعدّ شراءً بالمنحة — دُفع ولو رُدّ بعضُه */
const BOUGHT = ['paid', 'partially_refunded']

/** نتائجُ الحملة لصاحب المنصّة: من عبّأ، ومن أخذ كودا، ومن اشترى، وبكم — بالقناة والدفعة، وبمجال العمل.
    والشراءُ يُنسب إلى قناة **صاحب الكود** لا المشتري: كودٌ أُهدي لصديقٍ فاشترى به جاء من القناة التي
    أوصلت الكودَ أصلا. والمبلغُ ما دُفع بعملته (الحملةُ بالدولار). */
export async function grantResults(prisma: PrismaClient) {
  const campaign = await new GrantService(prisma).campaign()
  const [leads, fields, codes, cases] = await Promise.all([
    prisma.lead.groupBy({ by: ['channel', 'wave'], where: { campaign: MEMBER_GRANT_SLUG }, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ['workField'], where: { campaign: MEMBER_GRANT_SLUG }, _count: { _all: true } }),
    prisma.grantCode.findMany({
      where: { campaignId: campaign.id },
      select: {
        lead: { select: { channel: true, wave: true } },
        coupon: { select: { orders: { where: { status: { in: BOUGHT } }, select: { total: true } } } },
      },
    }),
    prisma.advisorCase.count({ where: { lead: { campaign: MEMBER_GRANT_SLUG } } }),
  ])
  type Row = { channel: string | null; wave: string | null; leads: number; codes: number; bought: number; revenue: number }
  const key = (c: string | null, w: string | null) => `${c ?? ''}|${w ?? ''}`
  const rows = new Map<string, Row>()
  const row = (c: string | null, w: string | null) => {
    const k = key(c, w)
    if (!rows.has(k)) rows.set(k, { channel: c, wave: w, leads: 0, codes: 0, bought: 0, revenue: 0 })
    return rows.get(k)!
  }
  for (const l of leads) row(l.channel, l.wave).leads += l._count._all
  for (const g of codes) {
    const r = row(g.lead?.channel ?? null, g.lead?.wave ?? null)
    r.codes += 1
    for (const o of g.coupon.orders) { r.bought += 1; r.revenue += Number(o.total) }
  }
  const list = [...rows.values()]
    .map((r) => ({ ...r, revenue: Math.round(r.revenue * 100) / 100 }))
    .sort((a, b) => b.leads - a.leads)
  const sum = (k: 'leads' | 'codes' | 'bought' | 'revenue') => Math.round(list.reduce((s, r) => s + r[k], 0) * 100) / 100
  return {
    totals: { leads: sum('leads'), codes: sum('codes'), bought: sum('bought'), revenue: sum('revenue'), advisorCases: cases },
    rows: list,
    fields: fields.map((f) => ({ workField: f.workField, leads: f._count._all })).sort((a, b) => b.leads - a.leads),
  }
}
