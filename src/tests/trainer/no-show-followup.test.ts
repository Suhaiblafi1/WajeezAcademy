/* متابعةُ من لم يحضر — حارسُ من يُتابَع، وما يُقال له، وما يقع بطلبه.

   ═══ ما يُفحص، وكلُّ واحدٍ منها عطبٌ يُقرأ في بريدِ إنسان ═══

   ① **لا يُتابَع إلّا غائبٌ لم يُبَتّ أمرُه** — «لاحظنا أنّك لم تحضر» تصل
      من حضر ولُقي فتُقرأ إهمالا منّا، أو من رُدَّ طلبُه فتُقرأ أملا كاذبا.
   ② **والرسالتان مقصدان لا نبرتان** — ①تدعو إلى موعدٍ آخرَ وتُبقي الطلب،
      و②تشكر بلا دعوةٍ وتنقله إلى قائمة الانتظار. ولو حملت ②زرَّ حجزٍ لصارت
      دعوةً لم نُردها، ولو لم تنقل الحالةَ لبقي الموقعُ يدعوه وقد شكرناه.
   ③ **والمتنُ يصل كما كُتب** — لا المقترَح: لو أرسل القالبُ نصَّه الثابتَ
      لَما كان للتعديل معنى، ولا يُكتشف ذلك إلّا من قرأ بريدَه.
   ④ **ولا اسمَ في المتن** — القالبُ يبني «مرحبا فلان،» بنفسه، واسمٌ في
      المتن يُقرأ مرّتين أو يبقى اسمُ من قبله لمن بعده.
   ⑤ **والفراغُ يُردّ** — صندوقٌ فُرّغ سهوا ثمّ ضُغط يُنتج عنوانا بلا متن.

   والفحصُ على البنية لا على ورودِ حرف: الرسالةُ تُبنى فعلا وتُصيَّر، ثمّ
   يُقرأ ما فيها. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  FOLLOWUP_BODY_MAX, FOLLOWUP_BODY_MIN, NO_SHOW_FOLLOWUPS, NO_SHOW_FOLLOWUP_KEYS,
  canFollowUpNoShow, followupOf,
} from '@/application/trainer/no-show-followup'
import { BOOKABLE_STATUSES } from '@/application/trainer/application-options'
import { INTERVIEW_OUTCOMES, NO_SHOW } from '@/application/trainer/interview-outcome'
import { OUTREACH_ACTIONS } from '@/application/trainer/outreach'
import { noShowFollowupMail } from '../../../server/services/trainer-decision-mail'
import { renderMail, type MailBlock } from '../../../server/services/mail-template'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const code = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const REF = 'WJ-TR-2026-00041'
const STATUS = 'https://example.test/join-trainer/status'
const invite = followupOf('invite_again')!
const thanks = followupOf('thanks')!

const built = (variant: typeof invite, bodyAr = variant.bodyAr) =>
  noShowFollowupMail({ followup: variant, fullName: 'سلمى العمري', reference: REF, bodyAr, statusUrl: STATUS })

describe('① من يُتابَع بعد الغياب', () => {
  it.each([...BOOKABLE_STATUSES])('من سُجِّل غيابُه وحالتُه «%s» — يُتابَع', (status) => {
    expect(canFollowUpNoShow({ status, interviewOutcome: NO_SHOW })).toBe(true)
  })

  it('⚠️ ولا يُتابَع من لم يُسجَّل له غياب — ولا يُقال لمن حضر إنّه لم يحضر', () => {
    for (const o of INTERVIEW_OUTCOMES.filter((x) => x.key !== NO_SHOW)) {
      expect(canFollowUpNoShow({ status: 'submitted', interviewOutcome: o.key }), o.key).toBe(false)
    }
    expect(canFollowUpNoShow({ status: 'submitted', interviewOutcome: null }), 'بلا نتيجةٍ بعد').toBe(false)
  })

  it.each([
    ['rejected', 'رُدَّ طلبُه — فالدعوةُ أملٌ كاذب، والنقلُ إلى انتظارٍ نقضٌ لقرار'],
    ['withdrawn', 'سحب طلبَه'],
    ['active', 'صار مدرّبا'],
    ['interview_scheduled', 'حجز موعدا جديدا بعد غيابه — فأمرُه أوضحُ من متابعة'],
    ['draft', 'طلبٌ لم يصل بعد'],
  ])('⚠️ ولا من حالتُه «%s» ولو سُجِّل غيابُه — %s', (status) => {
    expect(canFollowUpNoShow({ status, interviewOutcome: NO_SHOW })).toBe(false)
  })

  it('ومِحَكُّه حالاتُ الحجز نفسُها — وهي التي يعود إليها الطلبُ بعد الغياب', () => {
    const src = code('src/application/trainer/no-show-followup.ts')
    expect(src, 'الوحدةُ تكتب قائمةَ حالاتٍ بيدها لا بالمِحَكّ المشترك')
      .toContain('BOOKABLE_STATUSES.includes(app.status)')
  })
})

describe('② الرسالتان — مقصدان لا نبرتان', () => {
  it('اثنتان لا أكثر، ومفاتيحُهما هي التي يقبلها الخادم', () => {
    expect(NO_SHOW_FOLLOWUPS).toHaveLength(2)
    expect([...NO_SHOW_FOLLOWUP_KEYS].sort()).toEqual(['invite_again', 'thanks'])
    expect(followupOf('لا.أعرفها'), 'مفتاحٌ مجهولٌ يُقبل').toBeUndefined()
  })

  it('⚠️ وكلتاهما تقول إنّا افتقدناه وتطمئنّ عليه — وهو أوّلُ ما طُلب', () => {
    for (const f of NO_SHOW_FOLLOWUPS) {
      expect(f.bodyAr, `«${f.key}» لا يذكر الغياب`).toMatch(/لم تتمكّن من حضور|لم يحضر|لم نلتقِ/)
      expect(f.bodyAr, `«${f.key}» لا يطمئنّ عليه`).toMatch(/تكون بخير|نطمئنّ/)
    }
  })

  it('⚠️ ①تدعوه إلى موعدٍ آخرَ ولا تنقل حالتَه', () => {
    expect(invite.movesTo, 'الدعوةُ تنقل حالةَ من ندعوه').toBeNull()
    expect(invite.ctaAr, 'دعوةٌ بلا زرّ — فإلى أين يذهب؟').toBeTruthy()
    const cta = built(invite).doc.blocks.filter((b: MailBlock) => b.kind === 'cta')
    expect(cta, 'زرٌّ واحدٌ لا أكثر').toHaveLength(1)
    expect(cta[0].kind === 'cta' && cta[0].href, 'الزرُّ لا يفتح صفحةَ طلبه').toBe(STATUS)
    expect(invite.bodyAr, 'لا يُقال له إنّ طلبَه لم يتأخّر').toMatch(/طلبك/)
  })

  it('⚠️ و②تشكر بلا دعوةٍ — ولا زرَّ فيها ولا رابطَ حجز', () => {
    const doc = built(thanks).doc
    expect(doc.blocks.filter((b: MailBlock) => b.kind === 'cta'), 'زرٌّ في رسالةٍ لا تدعو إلى شيء').toHaveLength(0)
    const out = renderMail(doc)
    expect(out.text, 'رسالةُ الشكر تحمل رابطَ حجز').not.toContain(STATUS)
    expect(out.text, 'تطلب منه حجزا وهي لا تدعوه').not.toMatch(/احجز/)
    expect(thanks.bodyAr, 'لا شكرَ في رسالة شكر').toMatch(/نشكر/)
    expect(thanks.bodyAr, 'لا تطلّعَ إلى المستقبل — وهو لبُّ ما طُلب').toMatch(/مستقبلا/)
  })

  it('⚠️ و②تنقل الطلبَ إلى قائمة الانتظار — وإلّا دعاه الموقعُ وقد شكرناه', () => {
    expect(thanks.movesTo).toBe('waitlisted')
    expect(BOOKABLE_STATUSES, 'قائمةُ الانتظار تقبل الحجزَ — فالتناقضُ باقٍ')
      .not.toContain('waitlisted')
    /* وما يقع بالضغط مكتوبٌ للموظّف قبله — فلا يُبدّل حالةً وهو يظنّ أنّه أرسل بريدا */
    expect(thanks.whatAr, 'لا يُقال للموظّف إنّ الحالةَ تُنقل').toMatch(/قائمة الانتظار/)
  })
})

describe('③ المتنُ يصل كما كُتب — وإلّا لم يكن للتعديل معنى', () => {
  it('⚠️ المتنُ المعدَّلُ هو الذي يخرج، لا المقترَح', () => {
    const edited = 'أتمنّى أن تكون بخير يا أستاذ. نأمل أن يكون المانعُ خيرا، ونحبّ لقاءك.'
    const out = renderMail(built(invite, edited).doc)
    expect(out.text, 'المتنُ المكتوبُ لم يخرج').toContain(edited)
    expect(out.text, 'المقترَحُ خرج مكانَ ما كُتب').not.toContain(invite.bodyAr)
  })

  it('⚠️ والسطرُ الفارغُ يُقرأ فاصلَ فقرتَين — لا حرفا يُبتلع', () => {
    const doc = built(invite, 'الفقرةُ الأولى تقول شيئا كافيا.\n\nوالثانيةُ تقول غيرَه.').doc
    expect(doc.blocks.filter((b: MailBlock) => b.kind === 'p'), 'الفقرتان صارتا واحدة').toHaveLength(2)
  })

  it('⚠️ ولا اسمَ في المتن — القالبُ يبني التحيّةَ بنفسه', () => {
    for (const f of NO_SHOW_FOLLOWUPS) {
      expect(f.bodyAr, `«${f.key}» يحمل تحيّةً باسم — فتُقرأ مرّتين`).not.toMatch(/مرحبا|عزيز/)
    }
    /* والتحيّةُ موجودةٌ فعلا في المُصيَّر — فالخلوُّ أعلاه ليس نقصا */
    expect(renderMail(built(invite).doc).text).toContain('مرحبا سلمى العمري')
  })

  it('وحدُّ المتن مُعلَنٌ يقرؤه الطرفان — لا رقمٌ في الشاشة وآخرُ في الخادم', () => {
    expect(FOLLOWUP_BODY_MIN).toBeGreaterThan(0)
    expect(FOLLOWUP_BODY_MAX).toBeGreaterThan(FOLLOWUP_BODY_MIN)
    expect(code('src/pages/admin/TrainerApplications.tsx'), 'الشاشةُ تكتب حدَّها بيدها')
      .toContain('FOLLOWUP_BODY_MIN')
    expect(code('server/http/routes/admin-trainer.routes.ts'), 'المسارُ يكتب حدَّه بيده')
      .toContain('FOLLOWUP_BODY_MIN')
  })

  it('ورقمُ الطلب في الموضوع وفي الحقائق — فيُسأل به إن سأل', () => {
    for (const f of NO_SHOW_FOLLOWUPS) {
      const mail = built(f)
      expect(mail.subject, `«${f.key}» بلا رقمٍ في الموضوع`).toContain(REF)
      const facts = mail.doc.blocks.find((b: MailBlock) => b.kind === 'facts')
      expect(facts && facts.kind === 'facts' && facts.rows.map((r) => r.value)).toEqual([REF])
    }
  })
})

describe('④ والشاشةُ والخادمُ يقرآن المِحَكَّ نفسَه', () => {
  it('⚠️ الشاشةُ لا تعرض الزرَّ إلّا بالمِحَكّ المشترك', () => {
    const screen = code('src/pages/admin/TrainerApplications.tsx')
    expect(screen, 'الشاشةُ تكتب شرطَها بيدها — فيُعرض زرٌّ يردّه الخادم')
      .toMatch(/canFollowUpNoShow\(\{\s*status: a\.status, interviewOutcome: a\.interviewOutcome/)
  })

  it('⚠️ والخادمُ يحرس به قبل أن يُرسل', () => {
    const service = code('server/services/trainer-review.service.ts')
    const fn = service.slice(service.indexOf('async followUpNoShow'))
    expect(fn, 'المسارُ لا يقرأ المِحَكَّ المشترك').toContain('canFollowUpNoShow(')
    expect(fn.slice(0, 4000), 'لا يُكتب أثرٌ لما أُرسل').toContain("action: 'trainer.no_show.followup'")
  })

  it('⚠️ ولا يُتابَع غيابٌ مرّتين — والأثرُ يُسأل بمعرّف الموعد', () => {
    const service = code('server/services/trainer-review.service.ts')
    const fn = service.slice(service.indexOf('async followUpNoShow'), service.indexOf('async remindToBookInterview'))
    expect(fn, 'لا سؤالَ عن متابعةٍ سابقة — فتصله رسالتان على غيابٍ واحد')
      .toMatch(/path: \['interviewId'\]/)
    /* ═══ والمقيسُ أنّ الجوابَ يُعمل به لا أنّ السؤالَ مكتوب ═══

       أوّلُ صياغةٍ هنا قالت `toContain('already_followed_up')` — فمرّ عليها
       نقضُ `if (false)`: السؤالُ يُسأل، والعددُ يُقرأ، ثمّ يُهمَل. فيُقاس
       الشرطُ على العدد نفسِه، وأمّا وقوعُ الردّ فبقاعدةٍ حقيقيّةٍ في
       `server/tests/trainer/no-show.test.ts`. */
    expect(fn, 'العددُ يُقرأ ولا يُعمَل به').toMatch(/if \(already > 0\) \{/)
    expect(fn, 'لا ردَّ على التكرار').toContain('already_followed_up')
  })

  it('⚠️ والحالةُ تُنقل قبل البريد — فلا تخرج رسالةُ شكرٍ والموقعُ يدعوه', () => {
    const service = code('server/services/trainer-review.service.ts')
    const fn = service.slice(service.indexOf('async followUpNoShow'), service.indexOf('async remindToBookInterview'))
    const move = fn.indexOf('this.apps.transition(')
    const send = fn.indexOf('sendDirectEmail(')
    expect(move, 'لا نقلَ للحالة أصلا').toBeGreaterThan(-1)
    expect(send, 'لا إرسالَ أصلا').toBeGreaterThan(-1)
    expect(move, 'البريدُ يخرج قبل أن تُنقل الحالة').toBeLessThan(send)
  })

  it('وفعلُها في معجم المراسَلات — فتُقرأ شارتُه في الصفّ ولا يُراسَل مرّتين', () => {
    expect(OUTREACH_ACTIONS).toContain('trainer.no_show.followup')
  })
})
