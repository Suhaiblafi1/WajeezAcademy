/* قرارُ الصلاحية لا يُتَّخذ على نسخةٍ في المتصفّح.

   شكوى صاحب المنصّة: «عندما أدخل من حساب suhaib@wajeez.co أحيانا يأخذني
   لمنصّة طالب علما أني سوبر فقط».

   والسبب في `refreshSession`: كانت تسقط عند فشل النداء إلى النسخة المحلّية
   (`catch { return readSession() }`)، وحارسُ الصلاحيات يبني قرارَه عليها —
   بينما تعليقُ الحارس نفسِه يقول إنّه «يتحقق عند الخادم وليس من التخزين
   المحلي». فكان يكذب كلّما تعذّرت الشبكة.

   والدالّةُ لا سيرفريّة: أوّلُ نداءٍ بعد خمول يوقظها، فالتعذُّرُ حالةٌ
   متوقَّعة لا استثناء. والأثرُ في الاتّجاهين:

   · نسخةٌ أقدم من الحقيقة → سوبر أدمن يهبط إلى بوابة المتعلّم (الشكوى).
   · نسخةٌ أوسع من الحقيقة → من سُحبت أدوارُه يمرّ الحارسَ. وهذه أخطر. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')

/* الشيفرةُ بلا تعليقاتها.

   وهذا ليس تجميلا: تعليقاتُ هذا المستودع تقتبس الصيغةَ المعطوبة بنصّها
   لتشرح ما زال — فحارسٌ يقرأ الملفَّ كما هو يجد `refreshSession` في الشرح
   ويظنّها في الشيفرة، ويحمرّ على إصلاحٍ تمّ. وحارسٌ يمرّ أو يسقط لسببٍ غير
   الذي يزعمه ليس حارسا. */
const code = (f: string) =>
  read(f)
    .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
    .replace(/\/\/[^\n]*/g, '')

describe('«تعذّر الوصول» ليس جوابا', () => {
  const AUTH = code('src/services/auth.ts')

  it('الفحصُ يفرّق بين لا-جلسة وتعذُّرِ وصول — لا يجمعهما في null', () => {
    expect(AUTH).toMatch(/status:\s*"unreachable"/)
    expect(AUTH).toMatch(/status:\s*"anon"/)
    expect(AUTH).toMatch(/status:\s*"ok"/)
  })

  it('ولا يسقط إلى النسخة المحلّية عند الفشل — وهذا هو العطب بعينه', () => {
    expect(AUTH, 'عاد السقوطُ إلى التخزين المحلّيّ').not.toMatch(/catch\s*\{\s*return readSession\(\)/)
  })

  it('و٤٠١ وحدَه يُقرأ «لا جلسة» — وما عداه تعذُّرُ وصول', () => {
    expect(AUTH).toMatch(/e\.status === 401/)
  })

  it('والدالّةُ القديمة لم تبقَ بابا ثانيا', () => {
    expect(AUTH, 'بقي مسلكان لسؤالٍ واحد').not.toMatch(/export async function refreshSession/)
  })
})

describe('الحارسُ يعيد المحاولة ولا يُحوّل بلا جواب', () => {
  const GUARD = code('src/components/RequireRole.tsx')

  it('يقرأ الفحصَ الثلاثيّ لا الثنائيّ', () => {
    expect(GUARD).toMatch(/verifySession/)
    expect(GUARD).not.toMatch(/refreshSession/)
  })

  it('ويعيد المحاولة بتراخٍ قبل أن يستسلم', () => {
    expect(GUARD).toMatch(/RETRY_DELAYS_MS/)
    expect(GUARD).toMatch(/setState\('unreachable'\)/)
  })

  it('وحالةُ التعذُّر شاشةٌ بزرِّ إعادة — لا `Navigate`', () => {
    expect(GUARD).toMatch(/أعد المحاولة/)
    /* الحالاتُ التي تُحوِّل ثنتان لا ثلاث: anon و forbidden */
    expect(GUARD.match(/<Navigate\b/g)?.length ?? 0).toBe(2)
  })
})

describe('إقلاعٌ واحد مهما تزامنت النداءات', () => {
  /* دالّةُ Vercel تستقبل طلباتٍ متزامنة على النسخة الواحدة. وحارسُ الإقلاع
     كان على الناتج لا على الوعد، والإقلاعُ بينهما غيرُ ذرّيّ — فيُقلع كلُّ
     نداءٍ من الصفر: عدّةُ عملاء Prisma وعدّةُ برك اتّصال، ويفوز آخرُها
     ويبقى الباقي ممسكا ببركه. */
  it('معالجُ Vercel يخزّن الوعد', () => {
    const H = code('server/http/vercel-handler.ts')
    expect(H).toMatch(/let booting: Promise<FastifyInstance> \| null/)
    expect(H, 'الفشلُ يُخزَّن فيرثه كلُّ نداءٍ بعده').toMatch(/booting = null/)
  })

  it('وعميلُ Prisma كذلك — بركةٌ واحدة لا برك', () => {
    const C = code('server/db/client.ts')
    expect(C).toMatch(/let connecting: Promise<PrismaClient> \| null/)
    expect(C).toMatch(/connecting = null/)
  })

  it('ومهلةُ الاتّصال مضبوطة — وافتراضُها انتظارٌ بلا نهاية', () => {
    const C = code('server/db/client.ts')
    expect(C, 'بلا مهلةٍ يعلّق النداءُ عند استنفاد الاتّصالات').toMatch(/connectionTimeoutMillis:\s*\d/)
    expect(C).toMatch(/max:\s*Number\(process\.env\.DB_POOL_MAX/)
  })
})
