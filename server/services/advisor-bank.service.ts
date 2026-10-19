/* حسابُ المستشار البنكيّ لعمولته (١٩ أكتوبر ٢٠٢٦) — الموضعُ الوحيد الذي يمسّ `advisorBankAccount`.

   ═══ القرار ═══

   قرارُ صاحب المنصّة بين اثنين (يكتب حسابَه في المنصّة كالمدرّب · يُدفع له خارجها ويُكتب مرجعُ الحوالة):
   **«A» — حسابُه في المنصّة كالمدرّب.**

   ═══ وهو حسابُ المدرّب نفسُه في كلّ ما يحرس المال (`trainer-bank.service.ts`) ═══

   · **يكتبه المستشارُ بنفسه** في «عمولتي»، ولا يراه بعدها إلّا مقنَّعا. ومن أراد تبديلَه كتبه كاملا،
     والقيمةُ المقنَّعةُ تُردّ. والفحصُ واحدٌ للاثنين (`parseBankInput`).
   · **والنسخةُ السابقةُ تُزاح ولا تُمحى**: كشفٌ قديمٌ رُبط بها يبقى يُقرأ إليها. وفعّالٌ واحدٌ لكلّ
     مستشار (`AdvisorBankAccount_one_active`).
   · **والصريحُ لا يُفكّ إلّا لحظةَ الصرف**: لكشفٍ معتمَدٍ بعينه، بصلاحيّة `finance.bank.reveal`، ويُكتب
     كلُّ كشفٍ في الأثر بكشفه ومبلغه. ويُربط الكشفُ بالنسخة التي كُشفت، فإن تبدّل الحسابُ بعدها رُدّ
     تأكيدُ الصرف (`AdvisorPayoutService.markPaid`).
   · **ويصله بريدٌ بكلّ تبديلٍ وإلغاء** — لا جرس: من سُرقت جلستُه يقرأ الجرسَ سارقُه.
   · **ومطابقةُ الاسم تُقال ولا تمنع**: لا عقدَ للمستشار، فيُقابَل اسمُ صاحب الحساب باسمه في المنصّة.

   وظرفُه مربوطٌ به بغير بادئة المدرّب (`advisorBankAad`)، فلا يُفكّ ظرفٌ نُقل من جدولٍ إلى جدول.

   والحارس: `server/tests/advisors/advisor-bank.test.ts`. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { sendDirectEmail } from './notification.service'
import { renderMail } from './mail-template'
import { fmtDateWith } from '../../src/application/text/format-ar'
import { advisorBankAad, assertBankVaultEnabled, bankVaultEnabled, openBankValue, sealBankValue } from './bank-crypto'
import { BANK_MASK, nameScore, parseBankInput, type BankAccountInput, type MaskedBankAccount } from './trainer-bank.service'

const OUTCOME_AR: Record<string, string> = {
  matches: 'اسم صاحب الحساب يطابق اسم المستشار في المنصة',
  differs: 'اسم صاحب الحساب يختلف عن اسم المستشار في المنصة — راجعه قبل الصرف',
  unverifiable: 'لا اسم في المنصة يقابل به',
}

const VIEW = {
  id: true, tail4: true, countryCode: true, holderName: true,
  bankNameAr: true, branchAr: true, swiftBic: true,
  accountKind: true, routingCode: true,
  outcome: true, outcomeScore: true, createdAt: true, lastRevealAt: true,
} as const

type Row = {
  id: string; tail4: string; countryCode: string; holderName: string
  bankNameAr: string; branchAr: string | null; swiftBic: string | null
  accountKind: string; routingCode: string | null
  outcome: string; outcomeScore: number; createdAt: Date; lastRevealAt: Date | null
}

/** حقلا حقلا لا بنشر الصفّ — فلا يخرج الظرفُ المعمّى ولو قُرئ الصفُّ كلُّه */
function mask(row: Row): MaskedBankAccount {
  return {
    id: row.id, maskedAr: `${row.countryCode} ${BANK_MASK}${row.tail4}`, tail4: row.tail4, countryCode: row.countryCode,
    holderName: row.holderName, bankNameAr: row.bankNameAr, branchAr: row.branchAr, swiftBic: row.swiftBic,
    accountKind: row.accountKind, routingCode: row.routingCode,
    outcome: row.outcome, outcomeScore: row.outcomeScore, outcomeSaidAr: OUTCOME_AR[row.outcome] ?? OUTCOME_AR.unverifiable!,
    createdAt: row.createdAt, lastRevealAt: row.lastRevealAt,
  }
}

const dayAr = (d: Date) => fmtDateWith(d, { year: 'numeric', month: 'long', day: 'numeric' })

export class AdvisorBankService {
  private readonly prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** المستشارُ نفسُه — ولا يجيب أحدٌ عن حساب غيره */
  private async advisorOf(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }, select: { id: true, email: true, displayName: true, status: true, roles: { select: { roleId: true } } },
    })
    if (!user || !user.roles.some((r) => r.roleId === 'advisor')) throw new AuthError('not_advisor', 'حسابك ليس حساب مستشار', 403)
    return user
  }

  /** ما يمنع تبديلَ وجهة ماله — يُقال قبل الكتابة لا بعدها */
  private writeProblemAr(status: string): string | null {
    return status === 'active' ? null : 'حسابك موقوف، فلا يبدل الحساب البنكي الآن. راجع الإدارة.'
  }

  /** حسابي كما أراه — مقنَّعا، ومعه هل تعمل الخانةُ أصلا */
  async mine(userId: string) {
    const user = await this.advisorOf(userId)
    const row = await this.prisma.advisorBankAccount.findFirst({ where: { userId, status: 'active' }, select: VIEW })
    return {
      enabled: bankVaultEnabled(),
      account: row ? mask(row) : null,
      writeProblemAr: this.writeProblemAr(user.status),
      nameAr: user.displayName,
    }
  }

  async setMine(userId: string, input: BankAccountInput) {
    assertBankVaultEnabled()
    const user = await this.advisorOf(userId)
    const problem = this.writeProblemAr(user.status)
    if (problem) throw new AuthError('not_active', problem, 403)
    if (input.ownNameConfirmed !== true) {
      throw new AuthError('not_own_name', 'أقر أن الحساب باسمك الشخصي — لا تحول العمولة إلى حساب غيرك ولا إلى حساب شركة', 422)
    }
    const { kind, iban, countryCode, routingCode, swiftBic, holderName, bankNameAr, branchAr } = parseBankInput(input)
    const score = nameScore(holderName, user.displayName)
    const outcome = user.displayName.trim() ? (score >= 70 ? 'matches' : 'differs') : 'unverifiable'

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.advisorBankAccount.updateMany({
        where: { userId, status: 'active' }, data: { status: 'superseded', supersededAt: new Date() },
      })
      return tx.advisorBankAccount.create({
        data: {
          userId, status: 'active',
          ibanSealed: sealBankValue(iban, advisorBankAad(userId)),
          tail4: iban.slice(-4), countryCode, holderName, bankNameAr, branchAr, swiftBic,
          accountKind: kind, routingCode, ownNameConfirmedAt: new Date(),
          outcome, outcomeScore: score, setBy: userId,
        },
        select: VIEW,
      })
    }).catch((e: unknown) => {
      /* نقرتان معا: الفهرسُ الجزئيُّ يردّ الثانية — ولولاه لكان لمستشارٍ واحدٍ حسابان فعّالان */
      if ((e as { code?: string }).code === 'P2002') {
        throw new AuthError('concurrent_write', 'وصل طلبان معا — حدث الصفحة وتحقق من حسابك ثم أعد إن لزم', 409)
      }
      throw e
    })

    /* ولا رقمَ في الأثر ولا في البريد — الطرفُ الأخيرُ والمصرفُ يكفيان */
    await recordAudit(this.prisma, {
      actorId: userId, action: 'advisor.bank.set', entityType: 'advisor', entityId: userId,
      meta: {
        accountRowId: row.id, tail4: row.tail4, countryCode: row.countryCode, accountKind: row.accountKind,
        bankNameAr: row.bankNameAr, outcome: row.outcome, outcomeScore: row.outcomeScore,
      },
    })
    await this.mail(user, 'تغير حسابك البنكي في وجيز', 'سجل حساب بنكي جديد لعمولتك',
      `سجل بتاريخ ${dayAr(new Date())} حساب في «${row.bankNameAr}» ينتهي بـ${row.tail4}، وإليه تحول عمولتك من الآن.`)
    return mask(row)
  }

  /** إلغاءُ حسابي — يُزاح ولا يُمحى، ولا تُصرف عمولةٌ حتّى يكتب غيرَه */
  async removeMine(userId: string) {
    const user = await this.advisorOf(userId)
    const problem = this.writeProblemAr(user.status)
    if (problem) throw new AuthError('not_active', problem, 403)
    const active = await this.prisma.advisorBankAccount.findFirst({
      where: { userId, status: 'active' }, select: { id: true, tail4: true, countryCode: true, bankNameAr: true },
    })
    if (!active) return { removed: false }
    const at = new Date()
    await this.prisma.advisorBankAccount.updateMany({ where: { id: active.id, status: 'active' }, data: { status: 'superseded', supersededAt: at } })
    await recordAudit(this.prisma, {
      actorId: userId, action: 'advisor.bank.remove', entityType: 'advisor', entityId: userId,
      meta: { accountRowId: active.id, tail4: active.tail4, countryCode: active.countryCode, bankNameAr: active.bankNameAr },
    })
    await this.mail(user, 'ألغي حسابك البنكي في وجيز', 'ألغي الحساب البنكي لعمولتك',
      `ألغي بتاريخ ${dayAr(at)} حسابك في «${active.bankNameAr}» المنتهي بـ${active.tail4}. ولا تصرف عمولتك حتى تدخل حسابا جديدا.`)
    return { removed: true }
  }

  private async mail(user: { email: string; displayName: string }, subject: string, heading: string, text: string) {
    try {
      await sendDirectEmail(this.prisma, {
        to: user.email, subject,
        ...renderMail({
          greetingName: user.displayName, heading,
          blocks: [
            { kind: 'p', text },
            { kind: 'callout', text: 'فإن لم تكن أنت من فعل هذا فراسلنا فورا وغير كلمة مرورك.' },
            { kind: 'note', text: 'ولا يعرض رقم حسابك في أي رسالة منا.' },
          ],
        }),
      })
    } catch { /* البريدُ رفاهية — الفعلُ وقع، ولا يُردّ لأجل رسالة */ }
  }

  /** المقنَّعُ لمن يقرأ الكشوف */
  async maskedFor(userId: string) {
    const row = await this.prisma.advisorBankAccount.findFirst({ where: { userId, status: 'active' }, select: VIEW })
    return row ? mask(row) : null
  }

  /** الكشفُ — لكشفٍ معتمَدٍ بعينه، ويُكتب. وشرطُ `approved` بقصد: الخطوةُ التي تسبق الصرف وحدَها */
  async revealForPayout(payoutId: string, actorId: string) {
    assertBankVaultEnabled()
    const payout = await this.prisma.advisorPayout.findUnique({
      where: { id: payoutId }, select: { id: true, advisorId: true, status: true, period: true, total: true, currency: true },
    })
    if (!payout) throw new AuthError('not_found', 'الكشف غير موجود', 404)
    if (payout.status !== 'approved') throw new AuthError('bad_state', 'لا يكشف حساب إلا لكشف معتمد ينتظر الصرف', 409)
    const row = await this.prisma.advisorBankAccount.findFirst({ where: { userId: payout.advisorId, status: 'active' } })
    if (!row) throw new AuthError('no_bank_account', 'لم يدخل المستشار حسابه البنكي بعد — يدخله من «عمولتي»', 409)

    const iban = openBankValue(row.ibanSealed, advisorBankAad(payout.advisorId))
    const at = new Date()
    await this.prisma.$transaction(async (tx) => {
      await tx.advisorBankAccount.update({ where: { id: row.id }, data: { lastRevealAt: at } })
      await tx.advisorPayout.update({ where: { id: payout.id }, data: { bankAccountId: row.id } })
    })
    await recordAudit(this.prisma, {
      actorId, action: 'advisor.bank.reveal', entityType: 'advisor', entityId: payout.advisorId,
      meta: {
        accountRowId: row.id, payoutId: payout.id, period: payout.period,
        total: String(payout.total), currency: payout.currency, tail4: row.tail4, outcome: row.outcome,
      },
    })
    return { ...mask({ ...row, lastRevealAt: at }), iban }
  }
}
