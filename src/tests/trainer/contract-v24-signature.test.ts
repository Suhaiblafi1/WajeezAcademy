/* ═══ v24 — اعتمادُ التوقيع ليس توقيعَنا (١ أكتوبر ٢٠٢٦) ═══
 *
 * سأل صاحبُ المنصّة: «عندما أصادق على توقيعٍ هل هذا معناه أنّنا وقّعنا مع
 * المدرّب؟… أين قاعدةُ أن لا نتعاقد مع أحدٍ قبل أن نعتمد دوراته؟». وقرارُه:
 * «نحن نعتمد توقيعَك وسوف نقوم بتوقيع العقد وتحويله إلى عقدٍ غير مشروط عندما
 * نقوم باعتماد دوراتك».
 *
 * وما يُقاس هنا الدوالُّ الخالصةُ التي يقرؤها الخادمُ والشاشةُ معا — والمتنُ كما
 * يُصيَّر لا كما يُكتب في ملفّه:
 *
 * ① `signatureApprovalOf`: ما يفعله الزرُّ بحسب ما وقّعه صاحبُه — والإصدارُ
 *    الحاضرُ لا يختم، وأجيالُ v12–v23 لا تُعتمَد إلّا خاتمة: فيختار المعتمِدُ
 *    أن يعتمدها كما وُقّعت أو يعيدها للتوقيع (٢ أكتوبر ٢٠٢٦: «لا تُجبرني»).
 * ② المتنُ الحاضرُ لا يقول في موضعٍ أنّ اعتمادَ التوقيع يُنفذ العرض — لا في البند
 *    ولا الديباجة ولا الخلاصة — والملحقُ (د) يقول متى نوقّع.
 * ③ والإقرارُ يتبع متنَه: من يوقّع متنا من v12–v23 يُقرّ بما فيه، لا بنقيضه.
 * ④ ونقطةُ v24 لا تُقال لمن عقدُه غيرُ مشروط.
 * ⑤ و«عقدي» يعرف الطورَ بين «وقّع» و«نافذ».
 * ⑥ وبريدُ اعتماد التوقيع يقول ما وقع: اعتمدنا ونوقّع حين نعتمد دوراتك — لا «نافذ».
 * ⑦ و«الاعتمادُ» لا يُسمّى به توقيعُنا: الرابطُ المقفلُ على عقدٍ نافذ يقول «وقّعته
 *    الأكاديميّةُ»، وملحقُ الدورات يقول ما يقوله البندُ 2-12 — «غيرُ مشروط».
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  APPROVAL_SEALED_BODIES, EXTENSION_DAYS, MATERIALS_WINDOW_DAYS, SEALED_BY_TEXT_AR, signatureApprovalOf,
} from '@/application/trainer/conditional-offer'
import {
  CONTRACT_BODY_VERSION, contractAcks, renderContractBodyAr, type ContractBodyInput,
} from '@/application/trainer/contract-body'
import { changeGroupsBetween } from '@/application/trainer/contract-changelog'
import { contractApprovedMail } from '../../../server/services/trainer-decision-mail'
import { renderMail } from '../../../server/services/mail-template'
import { executionStage } from '@/application/trainer/contract-execution'
import { DEFAULT_REQUIRED_DOCUMENTS } from '@/application/trainer/contract-documents'

const base: ContractBodyInput = {
  academyPartyLineAr: 'أكاديمية وجيز للتدريب', academyLegalNameAr: 'أكاديمية وجيز للتدريب',
  academyTradingNameAr: 'أكاديمية وجيز', governingLawAr: 'القانون الأردني', disputeVenueAr: 'محاكم عمّان',
  trainerFullName: 'سعادُ المدرّبة', trainerEmail: 't@example.com',
  applicationReference: 'WJ-TR-2026-00042', issuedOnAr: '1 أكتوبر 2026',
  courses: [{ courseId: 'C-ACC-101', titleAr: 'أساسيات المحاسبة' }],
  compensation: { type: 'per_seat', rate: '15', referralRate: '25', minSeats: 5, currency: 'USD' },
  rateWaivedReasonAr: null, hoursNoteAr: null, requiredDocuments: DEFAULT_REQUIRED_DOCUMENTS,
  conditional: { orientationOnAr: null, deadlineOnAr: null, windowDays: MATERIALS_WINDOW_DAYS, extensionDays: EXTENSION_DAYS },
}
const offer = renderContractBodyAr(base)
const plain = renderContractBodyAr({ ...base, conditional: null })

/* ما قاله المتنُ من v12 إلى v23 — بحروفه، فلا يعود منه شيءٌ في عرضٍ مشروط */
const APPROVAL_SEALS = [
  /فتوقع من جهتها ويصير العقد نافذا/,
  /يصير نافذا باعتماد الأكاديمية لتوقيعه/,
  /يصير العقد نافذا باعتماد توقيعك/,
  /يصير العقد نافذا باعتماد الأكاديمية لتوقيعي/,
]

describe('① ما يفعله «اعتمِدِ التوقيع» بحسب ما وقّعه صاحبُه', () => {
  const conditional = (bodyVersion: string | null) => signatureApprovalOf({ gatesActivation: true, bodyVersion })

  it('⚠️ العرضُ المشروطُ على الإصدار الحاضر يُعتمَد ولا يُختَم', () => {
    expect(conditional(CONTRACT_BODY_VERSION), 'الإصدارُ الحاضرُ يختم باعتماد التوقيع').toBe('approve_only')
  })

  it('⚠️ وما وُقّع على v12–v23 لا يُعتمَد إلّا خاتما — متنُه يجعل الاعتمادَ توقيعا', () => {
    for (let g = APPROVAL_SEALED_BODIES.from; g < APPROVAL_SEALED_BODIES.before; g += 1) {
      expect(conditional(`v${g}-2026-09-30`), `v${g}`).toBe('sealed_by_text')
    }
    expect(APPROVAL_SEALED_BODIES, 'تبدّل مدى الأجيال التي قال متنُها إنّ الاعتمادَ توقيع')
      .toEqual({ from: 12, before: 24 })
  })

  it('ومتنُ v4–v11 يقول قولَ اليوم — وما لا جيلَ له لا يُخمَّن له نصّ', () => {
    expect(conditional('v4-2026-09-23')).toBe('approve_only')
    expect(conditional('v11-2026-09-27')).toBe('approve_only')
    expect(conditional(null)).toBe('approve_only')
  })

  it('والعقدُ غيرُ المشروط يُختَم باعتماد توقيعه — أيًّا كان جيلُه', () => {
    for (const v of ['v11-2026-09-27', 'v20-2026-10-01', CONTRACT_BODY_VERSION, null]) {
      expect(signatureApprovalOf({ gatesActivation: false, bodyVersion: v }), String(v)).toBe('seal')
    }
  })

  /* وردُّ الخادم حين يصله اعتمادٌ لم يقل أيَّ الخيارين أراد (صفحةٌ قديمة، أو
     خطواتُ التجهيز): يعرض الخيارين بأثرهما ولا يأمر بأحدهما. وكان «فأعِدْه
     للتوقيع… ثمّ اعتمِدْ توقيعَه الجديد» — بابا واحدا. */
  it('⚠️ وردُّ الخادم يعرض الخيارين بأثرهما ولا يُلزم بأحدهما — وبلا رقم إصدار', () => {
    expect(SEALED_BY_TEXT_AR).not.toMatch(/v\d+/)
    expect(SEALED_BY_TEXT_AR, 'لم يُعرض الاعتمادُ كما وقّعه').toContain('أن تعتمده كما وقّعه')
    expect(SEALED_BY_TEXT_AR, 'لم يُقل أثرُه').toContain('فيصير نافذا الآن قبل اعتماد دوراته')
    expect(SEALED_BY_TEXT_AR, 'لم تُعرض الإعادةُ').toContain('أن تعيده للتوقيع على النصّ الحاضر')
    expect(SEALED_BY_TEXT_AR, 'عاد الأمرُ بالإعادة بابا وحيدا').not.toMatch(/فأعِدْه|ثمّ اعتمِدْ توقيعَه الجديد/)
  })
})

describe('② والمتنُ الحاضرُ لا يُنفذ العرضَ باعتماد التوقيع في موضعٍ منه', () => {
  it('⚠️ لا جملةَ من جمل v12–v23 في عرضٍ مشروط — بندا ولا ديباجةً ولا خلاصة', () => {
    for (const re of APPROVAL_SEALS) expect(offer, `عاد في المتن: ${re}`).not.toMatch(re)
  })

  it('⚠️ والملحقُ (د) يقول متى يوقّع المفوَّضُ عنّا — يومَ نقبل الدورات', () => {
    const annex = offer.slice(offer.indexOf('الملحق (د) — التوقيع'))
    expect(annex, 'لا ملحقَ (د)').toContain('الطرف الأول')
    expect(annex, 'لا يُقال متى نوقّع').toContain('يوقع عنها المفوض بالتوقيع يوم تقبل دورات المدرب')
    expect(annex, 'لا يُقال إنّ الاعتمادَ قبلها ليس توقيعا').toContain('واعتمادها توقيع المدرب قبل ذلك لا يكون توقيعا منها')
    /* والعقدُ غيرُ المشروط يُوقَّع عند اعتماده — فملحقُه كما كان */
    const plainAnnex = plain.slice(plain.indexOf('الملحق (د) — التوقيع'))
    expect(plainAnnex).toContain('ويثبت اسمه وصفته وتاريخ اعتماده للتوقيع عند الاعتماد')
    expect(plainAnnex, 'قيل في عقدٍ غيرِ مشروطٍ إنّا نوقّع يومَ نقبل دوراته').not.toContain('يوم تقبل دورات المدرب')
  })
})

describe('③ والإقرارُ يتبع المتنَ الذي يُعرَض فوقه', () => {
  const ack = (v: string | null) => contractAcks(true, v).find((a) => a.key === 'offer_is_conditional')!.textAr

  it('⚠️ من يوقّع متنا من v12–v23 يُقرّ بما فيه — لا بنقيضه', () => {
    expect(ack('v20-2026-10-01'), 'أقرّ بأنّ الاعتمادَ ليس توقيعا ومتنُه يقول إنّه هو')
      .toMatch(/يصير العقد نافذا باعتماد الأكاديمية لتوقيعي/)
  })

  it('⚠️ ومن يوقّع الحاضرَ يُقرّ بأنّا نوقّع حين نقبل دوراته', () => {
    for (const v of [CONTRACT_BODY_VERSION, null]) {
      expect(ack(v), String(v)).not.toMatch(/يصير العقد نافذا باعتماد/)
      expect(ack(v), String(v)).toContain('ولا يكون توقيعا منها عليه')
    }
  })

  it('والمفتاحُ واحدٌ في الصيغتين — فما عُرض هو ما يُفحَص هو ما يُحفَظ', () => {
    expect(contractAcks(true, 'v20-2026-10-01').map((a) => a.key))
      .toEqual(contractAcks(true, CONTRACT_BODY_VERSION).map((a) => a.key))
  })
})

describe('④ ونقطةُ v24 لا تُقال لمن عقدُه غيرُ مشروط', () => {
  it('⚠️ «لا نوقّع عرضَك إلّا يومَ نعتمد دوراتك» للعرض المشروط وحدَه', () => {
    const titlesFor = (conditional: boolean) =>
      changeGroupsBetween('v23-2026-10-01', CONTRACT_BODY_VERSION, { conditional }).map((g) => g.titleAr)
    expect(titlesFor(true), 'لا نقطةَ لمن عرضُه مشروط').toContain('العرض المشروط وتوقيعنا — البند 2')
    expect(titlesFor(false), 'قيل لمن عقدُه غيرُ مشروطٍ إنّا لا نوقّعه حتّى نعتمد دوراته')
      .not.toContain('العرض المشروط وتوقيعنا — البند 2')
    /* ومن لا يُعرف أيَّ العقدين يقرأ لا يُحجَب عنه شيء */
    expect(changeGroupsBetween('v23-2026-10-01', CONTRACT_BODY_VERSION).map((g) => g.titleAr))
      .toContain('العرض المشروط وتوقيعنا — البند 2')
  })
})

describe('⑤ و«عقدي» يعرف الطورَ بين «وقّع» و«نافذ»', () => {
  it('⚠️ اعتُمد توقيعُه ولم نوقّع — طورٌ مسمّى لا «نافذ»', () => {
    const at = '2026-10-01T10:00:00Z'
    expect(executionStage({ signedAt: at, signatureApprovedAt: at })).toBe('approved')
    expect(executionStage({ signedAt: at })).toBe('signed')
    /* والخَتمُ يُسأل أوّلا: العقدُ غيرُ المشروط يُكتب له الاعتمادُ والخَتمُ معا */
    expect(executionStage({ signedAt: at, signatureApprovedAt: at, countersignedAt: at })).toBe('countersigned')
  })
})

describe('⑥ وبريدُ اعتماد التوقيع يقول ما وقع — لا «نافذ»', () => {
  const input = {
    legalName: 'سعادُ المدرّبة', title: 'عرضُ تدريبٍ مشروط', approvedOnAr: '1 أكتوبر 2026',
    portalUrl: 'https://x.test/trainer', guideUrl: 'https://x.test/guide', contractNumber: 'WJ-CT-2026-00042',
  }
  /* والنصُّ كما يُصيَّر للبريد — ما يقرؤه المدرّبُ لا بنيةُ الكتل */
  const textOf = (gatesActivation: boolean) => renderMail(contractApprovedMail({ ...input, gatesActivation }).doc).text

  it('⚠️ العرضُ المشروط: اعتمدنا توقيعَك، ونوقّع حين نعتمد دوراتك، وبوّابتُك مفتوحة', () => {
    const t = textOf(true)
    expect(t, 'قيل له إنّ العقدَ نفذ ولم نوقّعه').not.toContain('نافذا بين الطرفين')
    expect(t, 'وُعد بنسخةٍ بتوقيع الطرفين قبل أن نوقّع').not.toContain('ونسختُك بتوقيع الطرفين')
    expect(t, 'لم يُقل متى نوقّع').toContain('وسنوقّع العقدَ من جهتنا ونحوّله إلى عقدٍ غيرِ مشروطٍ حين نعتمد دوراتك')
    expect(t, 'لم يُقل إنّ بوّابتَه مفتوحة').toContain('ولك الآن بوّابتُك مفتوحةً')
  })

  it('والعقدُ غيرُ المشروط يُختَم بهذا الاعتماد — فرسالتُه تقول إنّه نفذ', () => {
    expect(textOf(false)).toContain('فصار العقدُ نافذا بين الطرفين')
  })

  /* وعرضٌ مشروطٌ اعتُمد كما وقّعه على نصٍّ يجعل الاعتمادَ توقيعا (٢ أكتوبر ٢٠٢٦):
     خُتم الآن. فلو قالت رسالتُه «نوقّعه حين نعتمد دوراتك» لَوعدته بتوقيعٍ وقع. */
  it('⚠️ وعرضٌ اعتُمد كما وقّعه: وقّعناه الآن ونفذ — لا «نوقّعه حين نعتمد دوراتك»', () => {
    const mail = contractApprovedMail({ ...input, gatesActivation: true, sealedNow: true })
    const t = renderMail(mail.doc).text
    expect(t, 'لم يُقل له إنّا وقّعناه').toContain('ووقّعناه من جهتنا بالنصّ الذي وقّعتَه — فصار نافذا بين الطرفين')
    expect(t, 'وُعد بتوقيعٍ وقع').not.toContain('وسنوقّع العقدَ من جهتنا')
    expect(t, 'قيل إنّ نسختَه تصير بتوقيع الطرفين لاحقا').not.toContain('وتصير بتوقيع الطرفين حين نوقّعها')
    expect(t, 'ضاع البابُ المفتوح').toContain('ولك الآن بوّابتُك مفتوحةً')
    expect(mail.subject).toContain('ووقّعنا عرضَك')
  })
})

/* ═══ ⑦ — والقراءةُ على الكتلة لا على الملفّ ═══
   الملفّان يقولان «اعتمدنا» و«نافذ» صادقَين في مواضعَ أخرى (حالُ
   `signature_approved`، وسطرُ «كان نافذا منذ…»). فيُقرأ فرعُ الحال وحدَه،
   وفقرةُ الملحق وحدَها — بلا التعليقات، فلا يطابق الحارسُ حرفا في شرح. */
const bare = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
const between = (src: string, from: string, to: string) => {
  const at = src.indexOf(from)
  return at < 0 ? '' : src.slice(at, src.indexOf(to, at + from.length))
}

describe('⑦ وتوقيعُنا لا يُسمّى «اعتمادا» في ما يقرؤه المدرّب', () => {
  it('⚠️ الرابطُ المقفلُ على عقدٍ نافذ: «ووقّعته الأكاديميّةُ من جهتها» يومَ توقيعها', () => {
    const LINES = between(bare('src/pages/ContractSign.tsx'), 'function closedLinesAr(', '\nfunction ')
    const sealed = between(LINES, "case 'countersigned':", 'case ')
    expect(sealed, 'لم تُقرأ جملةُ العقد النافذ — فالحارسُ يقيس الفراغ').toContain('countersignedAt')
    expect(sealed, 'سُمّي توقيعُنا اعتمادا — والاعتمادُ صار اسما لغيره').not.toMatch(/اعتمدته|اعتمدناه/)
    expect(sealed, 'لم يُقل إنّا وقّعناه من جهتنا').toContain('ووقّعته الأكاديميّةُ من جهتها')
  })

  it('وملحقُ الدورات المعتمدة يقول ما يقوله البندُ 2-12: صار عقدا نهائيّا غيرَ مشروط', () => {
    const lede = between(bare('src/components/ContractApproval.tsx'), 'className="ca-lede"', '</p>')
    expect(lede, 'لم تُقرأ فقرةُ الملحق').toContain('فتحقّق شرطُ عرضك')
    expect(lede, 'قيل «صار نافذا» عن عقدٍ خُتم قبلها').not.toMatch(/نافذ/)
    expect(lede).toContain('غيرَ مشروط')
  })
})
