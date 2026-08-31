/* نهاية التشخيص هي صفحة المسار — لا صفحةً قبلها.

   بقرار صاحب المنتج: «هذه الصفحة التي يجب أن تظهر بعد انتهاء التشخيص، ولا
   داعي للصفحات التي قبلها». وقد بنيتُ صفحة المسار وربطتُ الانتقال إليها
   بزرٍّ يضغطه المتعلّم، فبقيت شاشة النتيجة تعترضه قبل وجهته — نصفُ الطلب
   نُفِّذ وأُعلن تامّا. فحصُ المصدر هنا لأنّ العطب كان في وجود مسلكٍ ثانٍ لا
   في سلوك دالّةٍ واحدة.

   وحالتان تبقيان شاشةً: التوقّف الحوكميّ والاتّجاه الاستكشافيّ — لا مسار
   فيهما أصلا، فلا وجهةَ يُنتقل إليها. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { NEEDS_ADVISOR_KEY, needsAdvisorReferral } from '@/application/plan/advisor-referral'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

describe('التشخيص ينتهي على صفحة المسار', () => {
  const diag = read('src/pages/Diagnostic.tsx')

  it('١) `finish` يعتمد الخطّة وينتقل بدل أن يعرض شاشة النتيجة', () => {
    const finish = diag.slice(diag.indexOf('const finish = '), diag.indexOf('const restart') > 0 ? diag.length : diag.length)
    const body = finish.slice(0, finish.indexOf('\n  };') + 5)
    expect(body).toContain('adoptFromResult(res)')
    /* الاعتماد قبل السقوط إلى الشاشة، لا بعده */
    expect(body.indexOf('adoptFromResult(res)')).toBeLessThan(body.indexOf('setStage("result")'))
  })

  it('٢) الحالتان اللتان لا مسار فيهما تبقيان شاشةً', () => {
    expect(diag).toContain('res.resultJson.kind !== "guardrail_stop" && res.top')
  })

  it('٣) الاعتماد يشتقّ من النتيجة لا من حالة React', () => {
    /* قراءتُه من الحالة كانت تمنع نداءه من `finish`: الحالة لم تستقرّ بعد */
    expect(diag).toContain('const adoptFromResult = (res: DiagResult')
    expect(diag).toContain('function planCourseIdsOf(res: DiagResult | null')
    expect(diag).toContain('function composedPrimaryOf(res: DiagResult | null')
  })

  it('٤) وجهة الانتقال هي صفحة المسار بهوية المضيف', () => {
    expect(diag).toContain('navigate(`/pathways/${hostId}`)')
  })
})

describe('إحالة المستشار تسافر مع الخطّة', () => {
  it('٥) التشخيص يكتب العَلَم عند الحاجة ويمسحه عند عدمها', () => {
    const diag = read('src/pages/Diagnostic.tsx')
    expect(diag).toContain('if (res.needsAdvisor) sessionStorage.setItem(NEEDS_ADVISOR_KEY, "1")')
    expect(diag).toContain('else sessionStorage.removeItem(NEEDS_ADVISOR_KEY)')
  })

  it('٦) صفحة المسار تقرؤه وتعرض الدعوة — وإلّا دفع من كان يُستشار', () => {
    const page = read('src/pages/Pathway.tsx')
    expect(page).toContain('needsAdvisorReferral')
    expect(page).toContain('حالتك تستحق جلسة مع مستشار بشري')
    /* فوق بوّابة العرض: تُقرأ قبل السعر لا بعده */
    expect(page.indexOf('advisorReferral &&')).toBeLessThan(page.indexOf('id="offer"'))
  })

  it('٧) القراءة تصمد بلا تخزين — خصوصيّةٌ صارمة لا تُعطّل الصفحة', () => {
    /* الوصفُ الأصليّ يُحفظ ويُعاد — إعادةُ القيمة وحدها تترك خاصّيةً عاديّة
       مكان مُلتقِط النموذج الأوّل، فيسقط ما بعده من اختبارات. */
    const original = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      get() { throw new Error('محجوب') },
    })
    try {
      expect(() => needsAdvisorReferral()).not.toThrow()
      expect(needsAdvisorReferral()).toBe(false)
    } finally {
      if (original) Object.defineProperty(globalThis, 'sessionStorage', original)
      else Reflect.deleteProperty(globalThis, 'sessionStorage')
    }
  })

  /* هذا الملفّ يجري في بيئة node لا jsdom، فلا sessionStorage عالميّ.
     ونصبُ بديلٍ بسيط أصدق من استدعاء jsdom لأجل خاصّيّتين. */
  it('٨) العَلَم يُقرأ حين يُكتب', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
    const box = new Map<string, string>()
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => box.get(k) ?? null,
        setItem: (k: string, v: string) => { box.set(k, v) },
        removeItem: (k: string) => { box.delete(k) },
      },
    })
    try {
      expect(needsAdvisorReferral()).toBe(false)
      box.set(NEEDS_ADVISOR_KEY, '1')
      expect(needsAdvisorReferral()).toBe(true)
      box.delete(NEEDS_ADVISOR_KEY)
      expect(needsAdvisorReferral()).toBe(false)
    } finally {
      if (original) Object.defineProperty(globalThis, 'sessionStorage', original)
      else Reflect.deleteProperty(globalThis, 'sessionStorage')
    }
  })
})
