/* مهلةُ روابط توثيق البريد — سقفٌ واحدٌ، ونصٌّ يتبعه.

   ═══ ما يُحرس هنا ═══

   شكا صاحبُ المنصّة (١٩ سبتمبر ٢٠٢٦) أنّ «الرابط صالحٌ سبعةَ أيّام» غيرُ
   احترافيّ، وقرّر سقفَ أربعٍ وعشرين ساعة. وكان الرقمُ في الشيفرة اثنين لا
   واحدا (سبعةُ أيّامٍ لطلب الانضمام، وثمانٍ وأربعون ساعةً للحساب)، **والمدّةُ
   مكتوبةً بيدٍ في ثلاث رسائلَ وشاشة**. فما يُحرس شيئان:

   ① **السقفُ لا يُرفع** — والفحصُ على الرقم المحسوب لا على نصّه.
   ② **ومن يكتب لحظةَ الانتهاء يحسبها منه** — `issueEmailVerification` تُنادى
      بقاعدةٍ صوريّة فتُقرأ اللحظةُ التي كتبتها فعلا، لا سطرٌ يُفتَّش عنه.
   ③ **والجملةُ تتبع الرقم** — المواضعُ الأربعةُ التي تُقال فيها المدّةُ
      للقارئ تقرؤها من الثابت. ولو كُتبت بيدٍ لَقال النصُّ «سبعةَ أيّام»
      والخادمُ يقطع بعد يومٍ، ولا يحمرّ شيء.

   ودعوةُ إنشاء الحساب خارج هذا السقف بقصد — ليست توثيقَ عنوانٍ بين يدَي
   صاحبه. ومكتوبٌ ذلك في `verification-window.ts`. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PrismaClient } from '@prisma/client'
import { AuthService } from '../../server/services/auth.service'
import {
  VERIFY_LINK_TTL_HOURS, VERIFY_LINK_TTL_MS, VERIFY_LINK_WINDOW_AR,
} from '@/application/links/verification-window'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')
/* بلا التعليقات: ذِكرُ المدّة القديمة في شرحٍ يقول ما كان ليس وعدا بها */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
const code = (p: string) => strip(read(p))

/* ورسائلُ الحساب ملفٌّ يجمع بابَين: التوثيقَ ودعوةَ إنشاء الحساب. والسقفُ
   للأوّل وحدَه — فيُقرأ منه ما بين أوّل رسالةِ توثيقٍ وأوّلِ ما بعدهما، لا
   الملفُّ كلُّه. ولو قُرئ كلُّه لَحمِر الحارسُ على دعوةٍ مدّتُها قرارٌ آخر. */
const verifyMailsOfAccountMail = (): string => {
  const src = strip(read('server/services/account-mail.ts'))
  const from = src.indexOf('export async function sendVerifyEmail')
  const to = src.indexOf('export async function sendPasswordResetEmail')
  expect(from, 'رسالةُ التوثيق غابت عن ملفّ رسائل الحساب').toBeGreaterThan(-1)
  expect(to, 'رسالةُ الاستعادة غابت — فلا حدَّ يُقطع عنده').toBeGreaterThan(from)
  return src.slice(from, to)
}

const HOUR = 3_600_000

describe('سقفُ رابط التوثيق', () => {
  it('لا يتجاوز أربعا وعشرين ساعة', () => {
    expect(VERIFY_LINK_TTL_HOURS, 'رُفع السقفُ فوق يوم').toBeLessThanOrEqual(24)
    expect(VERIFY_LINK_TTL_MS, 'الميلّي ثانيةُ لا تطابق الساعات').toBe(VERIFY_LINK_TTL_HOURS * HOUR)
  })

  it('ولحظةُ الانتهاء المكتوبةُ في الحساب تُحسب منه — لا من رقمٍ آخر', async () => {
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
    const expiresAt = written!.emailVerifyExpiresAt!
    const life = expiresAt.getTime() - before
    expect(life, 'الرابطُ يعيش أكثرَ من السقف').toBeLessThanOrEqual(VERIFY_LINK_TTL_MS + 1_000)
    expect(life, 'الرابطُ يموت قبل ساعةٍ من إصداره').toBeGreaterThan(HOUR)
  })
})

describe('والجملةُ تتبع الرقم', () => {
  /* الخدمتان تحسبان من الثابت، والمواضعُ الأربعةُ تقول جملتَه */
  const SITES: { what: string; symbol: string; src: () => string }[] = [
    {
      what: 'مهلةُ توثيق الحساب', symbol: 'VERIFY_LINK_TTL_MS',
      src: () => code('server/services/auth.service.ts'),
    },
    {
      what: 'مهلةُ رابط طلب الانضمام', symbol: 'VERIFY_LINK_TTL_MS',
      src: () => code('server/services/trainer-application.service.ts'),
    },
    {
      what: 'رسالتا توثيق الحساب', symbol: 'VERIFY_LINK_WINDOW_AR',
      src: verifyMailsOfAccountMail,
    },
    {
      what: 'شاشةُ الرابط المنتهي', symbol: 'VERIFY_LINK_WINDOW_AR',
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
    expect(VERIFY_LINK_WINDOW_AR).toContain('عشرين ساعة')
  })
})
