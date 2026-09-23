/* حسابُ المدرّب البنكيّ — الموضعُ **الوحيد** الذي يمسّ `trainerBankAccount`.

   ═══ ولمَ في بوّابته لا في العقد ═══

   قرارُ صاحب المنصّة على المشورة القانونيّة (١٩ سبتمبر ٢٠٢٦): «الحساب
   البنكيُّ في منصّته». والبندُ ٤-٤ من العقد الموقَّع يقولها صراحةً — «في
   بوّابته على المنصّة تحت مستحقّاتي بعد تفعيل حسابه».

   وعلّتُه أنّ العقدَ **وثيقةٌ تُجمَّد وتُرسَل بالبريد وتُطبَع وتُشارَك**:
   رقمُ حسابٍ فيها يسافر في كلّ نسخةٍ منها إلى كلّ من مرّت به. والحسابُ
   يتبدّل كذلك، فوضعُه في وثيقةٍ مجمَّدةٍ يجعل المجمَّدَ كاذبا بعد شهر.

   ═══ ومن يقرأ ماذا ═══

   · **المدرّبُ** يكتبه، ولا يراه بعدها إلّا مقنَّعا (`JO ····1234`). ومن
     أراد تغييرَه أعاد كتابتَه كاملا — ولا تُقبل قيمةٌ مقنَّعةٌ تُعاد من
     الشاشة (نمطُ `integrations.service.ts` نفسُه).
   · **الإدارةُ** ترى المقنَّعَ في طابور المستحقّات.
   · **والصريحُ لا يُفكّ إلّا لحظةَ الصرف**، لمستحقٍّ معتمَدٍ بعينه، بصلاحيّةٍ
     ماليّةٍ مستقلّة، ويُكتب كلُّ كشفٍ في الأثر بمستحقِّه ومبلغِه.

     > وهذه **حدودُ تدقيقٍ لا حدودُ تفويض**: الصلاحيّةُ عند من يصرف أصلا.
     > وقيمتُها أنّ كلّ فكٍّ يُسأل عنه: «لمَ فُتح هذا الحساب؟» يُجاب بفترةٍ
     > ومبلغٍ لا بـ«لأنّ موظّفا ضغط».

   ═══ ومطابقةُ الاسم تُقال ولا تمنع ═══

   اختلافُ اسم المستفيد عن اسم الموقِّع بابُ احتيالٍ معروف. ومنعُه باتّا خطأ:
   يتزوّج فيتغيّر اسمُه، أو يكتبه المصرفُ لاتينيّا، أو يكون حسابا مشتركا.
   فيُحسَب الفرقُ ويُعرَض لمن يصرف، والقرارُ له — وهو مكتوبٌ في الصفّ فيُقرأ
   بعد سنةٍ حين يُسأل. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { sendDirectEmail } from './notification.service'
import { renderMail } from './mail-template'
import { fmtDateWith } from '../../src/application/text/format-ar'
import {
  assertBankVaultEnabled, bankAad, bankVaultEnabled, openBankValue, sealBankValue,
} from './bank-crypto'
import { portalDoorProblemAr } from '../../src/application/trainer/portal-access'

/** الحدُّ الأدنى لطولِ رقمِ حسابٍ يُقبَل — أقصرُ IBAN في العالم ١٥ */
export const MIN_ACCOUNT_LEN = 15
export const MAX_ACCOUNT_LEN = 34
/** ما يُعرض بدل الرقم — وأيُّ قيمةٍ تحمله تُردّ كتابةً */
export const BANK_MASK = '····'

export interface BankAccountInput {
  /** رقمُ الحساب أو الـIBAN كاملا — لا يُخزَّن صريحا ولا يُعاد أبدا */
  iban: string
  holderName: string
  bankNameAr: string
  branchAr?: string | null
  swiftBic?: string | null
}

/** ما تراه الشاشةُ — ولا رقمَ فيه */
export interface MaskedBankAccount {
  id: string
  maskedAr: string
  tail4: string
  countryCode: string
  holderName: string
  bankNameAr: string
  branchAr: string | null
  swiftBic: string | null
  outcome: string
  outcomeScore: number
  outcomeSaidAr: string
  createdAt: Date
  lastRevealAt: Date | null
}

const OUTCOME_AR: Record<string, string> = {
  matches: 'اسمُ صاحب الحساب يطابق اسمَ الموقِّع على العقد',
  differs: 'اسمُ صاحب الحساب يختلف عن اسم الموقِّع على العقد — تُراجَع قبل الصرف',
  unverifiable: 'لا عقدَ نافذٌ يُقابَل به الاسم بعد',
}

/** تطبيعٌ للمقارنة: الهمزاتُ والتاءُ المربوطةُ والمدُّ تُكتب بوجوهٍ شتّى */
function normalizeName(v: string): string {
  return String(v ?? '')
    .replace(/[ً-ٰٟ]/g, '')
    .replace(/[أإآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىي]/g, 'ي')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase()
}

/** نسبةُ اشتراكِ الكلمات — لا مسافةُ تحرير: الأسماءُ تُقارَن بأجزائها،
    ومن سقط منه اسمُ جدّه ليس رجلا آخر. */
function nameScore(a: string, b: string): number {
  const x = new Set(normalizeName(a).split(' ').filter(Boolean))
  const y = new Set(normalizeName(b).split(' ').filter(Boolean))
  if (x.size === 0 || y.size === 0) return 0
  let shared = 0
  for (const w of x) if (y.has(w)) shared += 1
  return Math.round((shared / Math.max(x.size, y.size)) * 100)
}

export class TrainerBankService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** ملفُّ المدرّب من حسابه — ولا يُجيب أحدٌ عن حساب غيره */
  private async profileForUser(userId: string) {
    const profile = await this.prisma.trainerProfile.findFirst({
      where: { userId },
      select: {
        id: true, suspendedAt: true,
        application: { select: { status: true, fullName: true, email: true } },
      },
    })
    if (!profile) throw new AuthError('no_profile', 'لا ملفَّ مدرّبٍ لحسابك', 404)
    return profile
  }

  private mask(row: {
    id: string; tail4: string; countryCode: string; holderName: string
    bankNameAr: string; branchAr: string | null; swiftBic: string | null
    outcome: string; outcomeScore: number; createdAt: Date; lastRevealAt: Date | null
  }): MaskedBankAccount {
    return {
      id: row.id,
      maskedAr: `${row.countryCode} ${BANK_MASK}${row.tail4}`,
      tail4: row.tail4,
      countryCode: row.countryCode,
      holderName: row.holderName,
      bankNameAr: row.bankNameAr,
      branchAr: row.branchAr,
      swiftBic: row.swiftBic,
      outcome: row.outcome,
      outcomeScore: row.outcomeScore,
      outcomeSaidAr: OUTCOME_AR[row.outcome] ?? OUTCOME_AR.unverifiable,
      createdAt: row.createdAt,
      lastRevealAt: row.lastRevealAt,
    }
  }

  private static readonly VIEW = {
    id: true, tail4: true, countryCode: true, holderName: true,
    bankNameAr: true, branchAr: true, swiftBic: true,
    outcome: true, outcomeScore: true, createdAt: true, lastRevealAt: true,
  } as const

  /* ═══════════ المدرّب — يكتب ويقرأ مقنَّعا ═══════════ */

  /** حسابي كما أراه — مقنَّعا، ومعه هل تعمل الخانةُ أصلا */
  async mine(userId: string) {
    const profile = await this.profileForUser(userId)
    const row = await this.prisma.trainerBankAccount.findFirst({
      where: { profileId: profile.id, status: 'active' },
      select: TrainerBankService.VIEW,
    })
    return {
      enabled: bankVaultEnabled(),
      account: row ? this.mask(row) : null,
      /* ويُعرَض له اسمُ الموقِّع ليكتب مثلَه — لا ليُمنع، بل ليُقلَّ الخلافُ
         من أصله. وبلا عقدٍ نافذٍ لا يُعرَض شيء. */
      contractNameAr: await this.signerNameOf(profile.id),
    }
  }

  private async signerNameOf(profileId: string): Promise<string | null> {
    const c = await this.prisma.trainerContract.findFirst({
      where: { profileId, status: 'countersigned' },
      orderBy: { countersignedAt: 'desc' },
      select: { signerLegalName: true },
    })
    return c?.signerLegalName ?? null
  }

  /** يكتبه المدرّبُ بنفسه — والنسخةُ السابقةُ تُزاح ولا تُمحى */
  async setMine(userId: string, input: BankAccountInput) {
    assertBankVaultEnabled()
    const profile = await this.profileForUser(userId)
    /* ويبقى مغلقا في الطور المشروط — البندُ 2-11 من عرضه: «ولا يستحق
       المدرب قبل تحقق هذا الشرط إسناد شعبة، ولا أتعابا». والقراءةُ مفتوحةٌ
       أصلا، فيرى «مستحقّاتي» صفرا ويعرف أنّ البابَ لم يُفتح بعد. */
    const problem = portalDoorProblemAr('active_only', {
      status: profile.application.status, suspendedAt: profile.suspendedAt,
    })
    if (problem) throw new AuthError('not_active', problem, 403)
    /* ومن فُتح له ملفُّ رحيلٍ لا يُبدّل وجهةَ المال: تلك اللحظةُ بعينها
       التي يُنتظَر فيها تغييرُ حسابٍ من غير صاحبه. */
    const leaving = await this.prisma.trainerDeparture.count({
      where: { profileId: profile.id, closedAt: null },
    })
    if (leaving > 0) {
      throw new AuthError(
        'departing',
        'ملفُّ رحيلك مفتوحٌ — لا يُبدَّل الحسابُ البنكيُّ في أثنائه. راجِع الإدارةَ إن كان تغييرُه لازما.',
        409,
      )
    }

    const iban = String(input.iban ?? '').replace(/\s+/g, '').toUpperCase()
    if (iban.includes(BANK_MASK)) {
      /* القيمةُ المقنَّعةُ تُعاد من الشاشة — ولا تُكتب فوق السرّ الحقيقيّ */
      throw new AuthError('masked_value', 'أعِدْ كتابةَ رقم الحساب كاملا — المعروضُ مقنَّعٌ لا يصلح للحفظ', 422)
    }
    if (iban.length < MIN_ACCOUNT_LEN || iban.length > MAX_ACCOUNT_LEN || !/^[A-Z0-9]+$/.test(iban)) {
      throw new AuthError(
        'bad_iban',
        `رقمُ الحساب غيرُ مقبول — يُكتب كاملا بحروفٍ وأرقامٍ بلا مسافات (بين ${MIN_ACCOUNT_LEN} و${MAX_ACCOUNT_LEN} خانة)`,
        422,
      )
    }
    const holderName = String(input.holderName ?? '').trim()
    if (holderName.length < 4) throw new AuthError('bad_holder', 'اكتب اسمَ صاحب الحساب كما يطبعه المصرف', 422)
    const bankNameAr = String(input.bankNameAr ?? '').trim()
    if (bankNameAr.length < 2) throw new AuthError('bad_bank', 'اكتب اسمَ المصرف', 422)

    const signer = await this.signerNameOf(profile.id)
    const score = signer ? nameScore(holderName, signer) : 0
    const outcome = !signer ? 'unverifiable' : score >= 70 ? 'matches' : 'differs'
    /* ورمزُ الدولة من أوّل حرفين إن كانا حرفين (صيغةُ IBAN)، وإلّا `JO` —
       فالكيانُ أردنيٌّ وأكثرُ المدرّبين فيه. */
    const countryCode = /^[A-Z]{2}/.test(iban) ? iban.slice(0, 2) : 'JO'

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.trainerBankAccount.updateMany({
        where: { profileId: profile.id, status: 'active' },
        data: { status: 'superseded', supersededAt: new Date() },
      })
      return tx.trainerBankAccount.create({
        data: {
          profileId: profile.id, status: 'active',
          ibanSealed: sealBankValue(iban, bankAad(profile.id)),
          tail4: iban.slice(-4),
          countryCode,
          holderName, bankNameAr,
          branchAr: String(input.branchAr ?? '').trim() || null,
          swiftBic: String(input.swiftBic ?? '').trim().toUpperCase() || null,
          outcome, outcomeScore: score,
          setBy: userId,
        },
        select: TrainerBankService.VIEW,
      })
    }).catch((e: unknown) => {
      /* نقرتان متزامنتان: الفهرسُ الجزئيُّ يردّ الثانيةَ بـP2002. ولولاه
         لَكان لرجلٍ واحدٍ حسابان فعّالان، ولا يُعرف إلى أيّهما يُصرَف. */
      if ((e as { code?: string }).code === 'P2002') {
        throw new AuthError('concurrent_write', 'وصل طلبان معا — حدّثِ الصفحةَ وتحقّقْ من حسابك ثمّ أعِدْ إن لزم', 409)
      }
      throw e
    })

    /* ولا رقمَ في الأثر: الطرفُ الأخيرُ والمصرفُ يكفيان للسؤال، والرقمُ
       الصريحُ في السجلّ يُبطل التعميةَ التي في العمود. */
    await recordAudit(this.prisma, {
      actorId: userId, action: 'trainer.bank.set',
      entityType: 'trainer_profile', entityId: profile.id,
      meta: {
        accountRowId: row.id, tail4: row.tail4, countryCode: row.countryCode,
        bankNameAr: row.bankNameAr, outcome: row.outcome, outcomeScore: row.outcomeScore,
      },
    })
    /* ═══ ويصله خبرُ التبديل ولو كان هو من بدّل ═══

       وهذا ليس تكرارا لفعله: إن لم يكن هو من كتبه فهذه **أوّلُ أمارةٍ** على
       أنّ حسابَه في يدِ غيره، وهو أوّلُ من يكتشفها. ولذلك بريدٌ لا جرسٌ في
       البوّابة: من سُرقت جلستُه يقرأ الجرسَ سارقُه، والبريدُ صندوقٌ آخر.

       ولا رقمَ في الرسالة — الطرفُ الأخيرُ يكفي ليعرفَ أهو حسابُه أم لا. */
    try {
      await sendDirectEmail(this.prisma, {
        to: profile.application.email,
        subject: 'تغيّر حسابُك البنكيُّ في وجيز',
        ...renderMail({
          greetingName: profile.application.fullName,
          heading: 'سُجّل حسابٌ بنكيٌّ جديدٌ لمستحقّاتك',
          blocks: [
            {
              kind: 'p',
              text: `سُجّل بتاريخ ${fmtDateWith(new Date(), { year: 'numeric', month: 'long', day: 'numeric' })}`
                + ` حسابٌ في «${row.bankNameAr}» ينتهي بـ${row.tail4}، وإليه تُحوَّل مستحقّاتُك من الآن.`,
            },
            {
              kind: 'callout',
              text: 'فإن لم تكن أنت من فعل هذا فراسِلْنا فورا وغيّرْ كلمةَ مرورك — '
                + 'فتبديلُ وجهةِ المال أوّلُ ما يفعله من يصل إلى حسابٍ ليس له.',
            },
            { kind: 'note', text: 'ولا يُعرض رقمُ حسابك في أيّ رسالةٍ منّا، ولا في أيّ عقد.' },
          ],
        }),
      })
    } catch { /* البريدُ رفاهية — الحفظُ وقع، ولا يُردّ لأجل رسالة */ }

    return this.mask(row)
  }

  /* ═══════════ الإدارة — مقنَّعٌ للقراءة، وصريحٌ لحظةَ الصرف ═══════════ */

  /** المقنَّعُ لمن يقرأ طابورَ المستحقّات */
  async maskedFor(profileId: string) {
    const row = await this.prisma.trainerBankAccount.findFirst({
      where: { profileId, status: 'active' },
      select: TrainerBankService.VIEW,
    })
    return row ? this.mask(row) : null
  }

  /** ═══ الكشف — لمستحقٍّ معتمَدٍ بعينه، ومرّةً تُكتب ═══

      وشرطُ `approved` بقصد: هي الحالةُ التي يقبلها `markPaid`، فالكشفُ
      يقع خطوةً واحدةً قبل أن يتحرّك المال. ولا يُكشف على `pending` —
      فذاك مستحقٌّ لم يُعتمَد بعد، ولا سببَ لفتح حسابِ صاحبه. */
  async revealForPayout(payoutId: string, actorId: string) {
    assertBankVaultEnabled()
    const payout = await this.prisma.trainerPayout.findUnique({
      where: { id: payoutId },
      select: { id: true, profileId: true, status: true, period: true, total: true, currency: true },
    })
    if (!payout) throw new AuthError('not_found', 'المستحقُّ غير موجود', 404)
    if (payout.status !== 'approved') {
      throw new AuthError('bad_state', 'لا يُكشف حسابٌ إلّا لمستحقٍّ معتمَدٍ ينتظر الصرف', 409)
    }
    const row = await this.prisma.trainerBankAccount.findFirst({
      where: { profileId: payout.profileId, status: 'active' },
    })
    if (!row) {
      throw new AuthError(
        'no_bank_account',
        'لا حسابَ بنكيّا فعّالا لهذا المدرّب — يُدخله بنفسه من «مستحقّاتي» في بوّابته',
        409,
      )
    }

    const iban = openBankValue(row.ibanSealed, bankAad(payout.profileId))
    const at = new Date()
    await this.prisma.$transaction(async (tx) => {
      await tx.trainerBankAccount.update({ where: { id: row.id }, data: { lastRevealAt: at } })
      /* ويُربَط المستحقُّ بالنسخة التي كُشفت: فإن بُدّل الحسابُ بين الكشف
         والتأكيد رُدَّ التأكيدُ — وذاك بابُ الاحتيال في هذا الموضع بعينه. */
      await tx.trainerPayout.update({ where: { id: payout.id }, data: { bankAccountId: row.id } })
    })
    await recordAudit(this.prisma, {
      actorId, action: 'trainer.bank.reveal',
      entityType: 'trainer_profile', entityId: payout.profileId,
      meta: {
        accountRowId: row.id, payoutId: payout.id, period: payout.period,
        total: String(payout.total), currency: payout.currency,
        tail4: row.tail4, outcome: row.outcome,
      },
    })
    return { ...this.mask({ ...row, lastRevealAt: at }), iban }
  }
}
