/* ثلاثةُ أعطابٍ رآها صاحبُ المنصّة في شاشته — وحرسُها.

   الثلاثةُ كانت في الحالة التي لم تُجرَّب: **متعلّمٌ اعتمد خطّةً ولم يسجّل
   بعد**. وحساباتُ الديمو كلُّها مسجَّلة، فلم تظهر الحالةُ في أيّ جولة. وهذا
   هو الدرس: الفراغُ ليس شاشةً واحدةً بل حالةُ بيانات — ولا تُرى إلّا إن
   صُنعت عمدا.

   ١) **قفلٌ فوقَ كلمة «شعبة مفتوحة»** في البطاقة نفسِها: الأيقونةُ تقول
      «مغلق» والنصُّ يقول «مفتوحة». والقفلُ كان يُرسَم لكلّ ما لم يُسجَّل فيه.
   ٢) **ثلاثةُ أصفار** لمن لم يسجّل — والملفُّ نفسُه يقول «غيابُ التسجيل ليس
      صفرا» ويطبّقها على الشريط وينساها في العدّادات.
   ٣) **بلاغُ البريد يتصدّر الصفحة** في كلّ زيارة فوقَ رحلة المتعلّم. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const rail = read('src/components/journey/StageRail.tsx')
const notice = read('src/components/VerifyEmailNotice.tsx')

describe('١) لا قفل على ما ليس مقفلا', () => {
  it('لا أيقونة قفل في شريط المراحل إطلاقا', () => {
    expect(rail).not.toMatch(/\bLock\b/)
  })

  it('وما شعبته مفتوحة يعرض برقم مرحلته — دعوة لا منع', () => {
    expect(rail).toMatch(/joinable = stage\.state === "schedulable"/)
    expect(rail).toMatch(/mine \|\| joinable \? \(\s*stage\.sequenceLabel/)
  })

  it('وما ينتظر شعبة يعرض بساعة، وما ليس في الخطّة بزائد', () => {
    expect(rail).toMatch(/waiting = stage\.state === "awaiting_cohort"/)
    expect(rail).toMatch(/waiting \? \(\s*<Clock3/)
    expect(rail).toMatch(/<Plus/)
  })
})

describe('٢) غياب التسجيل ليس صفرا — في العدّادات كما في الشريط', () => {
  it('«بدأ» يعني تسجيلا واقعا لا خطّة اعتمدت', () => {
    expect(rail).toMatch(/const started = counts\.owned > 0 \|\| counts\.completed > 0/)
  })

  it('ومن لم يبدأ يقرأ شكل خطّته: عدد دوراتها وساعاتها', () => {
    expect(rail).toMatch(/started \?/)
    expect(rail).toMatch(/دورات أمامك/)
    expect(rail).toMatch(/ساعة تدريب/)
  })

  it('والعدّادات الثلاثة تبقى لمن بدأ فعلا', () => {
    expect(rail).toMatch(/أنجزتها/)
    expect(rail).toMatch(/تعمل فيها/)
  })
})

describe('٣) بلاغ البريد يطوى ولا يخفى', () => {
  it('المطويّ يبقي الحدّ معلنا: الشهادة تنتظر التوثيق — والشراء لا ينتظره (٢٦ أكتوبر ٢٠٢٦)', () => {
    expect(notice).toMatch(/if \(folded\)/)
    expect(notice).toMatch(/شهادتك تنتظر توثيقه\./)
    /* والنفيُ على الشيفرة بلا تعليقاتها: رأسُ الملفّ يروي ما كان يقوله البلاغ */
    expect(notice.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, ''), 'عاد البلاغ يقول إن الشراء موقوف — والدفع أولا').not.toMatch(/شراء الشعب|الشراء والشهادة موقوفان/)
  })

  it('ويبقي زرّ الإرسال في الحالتين — طيّ لا تعطيل', () => {
    expect(notice).toMatch(/const sendButton = \(/)
    /* مرّتان: في المطويّ وفي المفصَّل */
    expect(notice.match(/\{sendButton\}/g) ?? []).toHaveLength(2)
  })

  it('والطيّ محفوظ بالعنوان — تغيير البريد يعيد البلاغ كاملا', () => {
    expect(notice).toMatch(/safeGet\(FOLD_KEY\) === email/)
    expect(notice).toMatch(/safeSet\(FOLD_KEY, next \? email : ""\)/)
  })

  it('ولا يخفى بلا رجعة: زرّ يفصّله من جديد', () => {
    expect(notice).toMatch(/fold\(false\)/)
    expect(notice).toMatch(/التفصيل/)
    expect(notice).toMatch(/aria-expanded/)
  })
})
