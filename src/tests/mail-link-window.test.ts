/* مهلةُ الروابط المرسَلة بالبريد — سقفٌ واحدٌ، ونصٌّ يتبعه.

   ═══ ما يُحرس هنا ═══

   شكا صاحبُ المنصّة (١٩ سبتمبر ٢٠٢٦) أنّ «الرابط صالحٌ سبعةَ أيّام» غيرُ
   احترافيّ، وقرّر سقفَ أربعٍ وعشرين ساعة، ثمّ أدخل فيه دعوةَ الموظّفين صراحةً
   (٢٠ سبتمبر). وكانت المدى ثلاثةً لا واحدا — سبعةُ أيّامٍ لطلب الانضمام،
   وثمانٍ وأربعون ساعةً لتوثيق الحساب، وسبعةُ أيّامٍ للدعوة — **والمدّةُ
   مكتوبةً بيدٍ في أربع رسائلَ وثلاثِ شاشات**. فما يُحرس ثلاثة:

   ① **السقفُ لا يُرفع** — والفحصُ على الرقم المحسوب لا على نصّه.
   ② **ومن يكتب لحظةَ الانتهاء يحسبها منه** — `issueEmailVerification`
      و`issueInvite` تُناديان بقاعدةٍ صوريّة فتُقرأ اللحظةُ التي كتبتاها
      فعلا، لا سطرٌ يُفتَّش عنه في ملفّهما.
   ③ **والجملةُ تتبع الرقم** — كلُّ موضعٍ تُقال فيه المدّةُ للقارئ يقرؤها من
      الثابت. ولو كُتبت بيدٍ لَقال النصُّ «سبعةَ أيّام» والخادمُ يقطع بعد
      يومٍ، ولا يحمرّ شيء. وهذا وقع في هذا المستودَع مع مدّةٍ أخرى.

   ورابطُ استعادة كلمة المرور خارج هذا: ساعةٌ واحدة — تحت السقف لا فوقه،
   وضيقُه مقصودٌ مكتوبٌ في `mail-link-window.ts`. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PrismaClient } from '@prisma/client'
import { AuthService } from '../../server/services/auth.service'
import {
  MAIL_LINK_TTL_HOURS, MAIL_LINK_TTL_MS, MAIL_LINK_WINDOW_AR,
} from '@/application/links/mail-link-window'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')
/* بلا التعليقات: ذِكرُ المدّة القديمة في شرحٍ يقول ما كان ليس وعدا بها */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
const code = (p: string) => strip(read(p))

/* ورسائلُ الحساب ملفٌّ يجمع أربعةَ أبواب، ولكلٍّ مدّتُه. فتُقرأ منه الرسالةُ
   المقصودةُ وحدَها — ولو قُرئ كلُّه لَحمِر الحارسُ على رسالة الاستعادة،
   ومدّتُها ساعةٌ بقصد. */
const mailBetween = (from: string, to: string): string => {
  const src = strip(read('server/services/account-mail.ts'))
  const start = src.indexOf(from)
  const end = src.indexOf(to)
  expect(start, `${from} غابت عن ملفّ رسائل الحساب`).toBeGreaterThan(-1)
  expect(end, `${to} غابت — فلا حدَّ يُقطع عنده`).toBeGreaterThan(start)
  return src.slice(start, end)
}

const HOUR = 3_600_000

describe('سقفُ الرابط المرسَل بالبريد', () => {
  it('لا يتجاوز أربعا وعشرين ساعة', () => {
    expect(MAIL_LINK_TTL_HOURS, 'رُفع السقفُ فوق يوم').toBeLessThanOrEqual(24)
    expect(MAIL_LINK_TTL_MS, 'الميلّي ثانيةُ لا تطابق الساعات').toBe(MAIL_LINK_TTL_HOURS * HOUR)
  })

  it('ولحظةُ انتهاء رابط التوثيق تُحسب منه — لا من رقمٍ آخر', async () => {
    /* قاعدةٌ صوريّة: تردّ حسابا غيرَ موثَّقٍ وتلتقط ما يُكتب فيه. فالمفحوصُ
       ما كتبته الخدمةُ فعلا، لا سطرٌ يُقرأ في ملفّها. */
    let written: { emailVerifyExpiresAt?: Date } | null = null
    const prisma = {
      user: {
        findUnique: async () => ({
          id: 'u-1', email: 'x@test.local', displayName: 'مستخدم', emailVerifiedAt: null,
        }),
        update: async ({ data }: { data: { emailVerifyExpiresAt?: Date } }) => {
          written = data
          return {}
        },
      },
    } as unknown as PrismaClient

    const before = Date.now()
    const issued = await new AuthService(prisma).issueEmailVerification('u-1')
    expect(issued, 'لم يُصدَر رمزٌ أصلا').not.toBeNull()
    const life = written!.emailVerifyExpiresAt!.getTime() - before
    expect(life, 'رابطُ التوثيق يعيش أكثرَ من السقف').toBeLessThanOrEqual(MAIL_LINK_TTL_MS + 1_000)
    expect(life, 'رابطُ التوثيق يموت قبل ساعةٍ من إصداره').toBeGreaterThan(HOUR)
  })

  it('ودعوةُ الموظّف مثلُه — دخلت السقفَ بقرار ٢٠ سبتمبر ٢٠٢٦', async () => {
    /* كانت سبعةَ أيّام، وحجّتُها أنّ الموظّفَ الجديد لا يفتح بريدَه ساعتَه —
       وهي تُوفى بيومٍ كامل. والفحصُ على ما تردّه الخدمةُ لا على ثابتٍ يُقرأ. */
    const prisma = {
      user: { findUnique: async () => ({ id: 'u-1' }) },
      passwordResetToken: {
        updateMany: (args: unknown) => args,
        create: (args: unknown) => args,
      },
      $transaction: async (ops: unknown[]) => ops,
    } as unknown as PrismaClient

    const before = Date.now()
    const { expiresAt } = await new AuthService(prisma).issueInvite('u-1')
    const life = expiresAt.getTime() - before
    expect(life, 'دعوةُ الموظّف تعيش أكثرَ من السقف').toBeLessThanOrEqual(MAIL_LINK_TTL_MS + 1_000)
    expect(life, 'الدعوةُ تموت قبل ساعةٍ من إصدارها').toBeGreaterThan(HOUR)
  })
})

describe('والجملةُ تتبع الرقم', () => {
  /* الخدمتان تحسبان من الثابت، والمواضعُ التي تُقال فيها المدّةُ تقول جملتَه */
  const SITES: { what: string; symbol: string; src: () => string }[] = [
    {
      what: 'مهلتا التوثيق والدعوة', symbol: 'MAIL_LINK_TTL_MS',
      src: () => code('server/services/auth.service.ts'),
    },
    {
      what: 'مهلةُ رابط طلب الانضمام', symbol: 'MAIL_LINK_TTL_MS',
      src: () => code('server/services/trainer-application.service.ts'),
    },
    {
      what: 'رسالتا توثيق الحساب', symbol: 'MAIL_LINK_WINDOW_AR',
      src: () => mailBetween('export async function sendVerifyEmail', 'export async function sendPasswordResetEmail'),
    },
    {
      what: 'رسالةُ دعوة الموظّف', symbol: 'MAIL_LINK_WINDOW_AR',
      src: () => mailBetween('export async function sendStaffInviteEmail', 'export function accountErasedMail'),
    },
    {
      what: 'خبرُ إعادة إرسال الدعوة', symbol: 'MAIL_LINK_WINDOW_AR',
      src: () => code('server/http/routes/admin-users.routes.ts'),
    },
    {
      what: 'شاشةُ إنشاء حساب الموظّف', symbol: 'MAIL_LINK_WINDOW_AR',
      src: () => code('src/pages/admin/Users.tsx'),
    },
    {
      what: 'شاشةُ الرابط المنتهي', symbol: 'MAIL_LINK_WINDOW_AR',
      src: () => code('src/pages/JoinTrainerVerify.tsx'),
    },
  ]

  for (const site of SITES) {
    it(`${site.what} تقرأ المدّةَ من الثابت`, () => {
      expect(site.src(), `${site.what}: كُتبت المدّةُ بيدٍ بدل ${site.symbol}`).toContain(site.symbol)
    })
  }

  it('ولا مدّةٌ قديمةٌ باقيةٌ في نصٍّ يقرؤه صاحبُ الرابط', () => {
    /* المدّتان اللتان نُقضتا — تُفتَّش في الشيفرة العاملة لا في الشرح */
    for (const site of SITES) {
      expect(site.src(), `${site.what}: ما زالت تَعِد بسبعة أيّام`).not.toContain('سبعةَ أيّام')
      expect(site.src(), `${site.what}: ما زالت تَعِد بثمانٍ وأربعين ساعة`).not.toContain('ثمانيَ وأربعين')
    }
    /* والجملةُ نفسُها تقول يوما لا أكثر */
    expect(MAIL_LINK_WINDOW_AR).toContain('عشرين ساعة')
  })
})
