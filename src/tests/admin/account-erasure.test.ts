/* حسابٌ يُمحى أو يُعمّى — والرسالةُ الأخيرةُ بريدٌ يتقدّم الفعل (ي-٤).

   ═══ ما يُحرَس، ولمَ الثاني أهمُّهما ═══

   ① **الرسالةُ تسبق الفعل** — على عرف الأثر نفسِه في هذه المواضع الثلاثة
      («الأثرُ قبل المحو: بعده لا يبقى ما يُشار إليه»). والعنوانُ مُلتقَطٌ في
      متغيّرٍ قبلَه فلو أُخِّر لخرجت الرسالة، لكنّ التقديمَ يمنع أن يعتمد
      يوما على صفٍّ يوشك أن يزول أو على بريدٍ تُعمّيه المعاملةُ وهي تجري.

   ② **ولا جرسَ في هذا الباب** — وهذا هو الحاملُ للحكم. صفُّ `Notification`
      معلَّقٌ بصاحبه بـ`onDelete: Cascade` فيذهب معه، والمؤرشَفُ لا يُقرأ له
      جرسٌ لأنّ الدخولَ ممنوعٌ على غير `active`.

      وهذه بعينها الزلّةُ التي تُغري من يأتي بعدُ: يرى بابا بلا إشعارٍ في
      المنصّة فيُضيف `safeNotify` إحسانا، فيصير في القاعدة صفٌّ يُحسَب
      إخبارا — عند الحارس وعند من يراجع — **ولا يقرؤه أحدٌ أبدا**. وإشعارٌ
      كهذا أسوأُ من الصمت لأنّه يبدو عملا. */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { handlerAround } from '../helpers/audit-sites'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf-8')

/* ═══ بابان يُخرجان الرسالة، لا واحد (ي-٦) ═══

   `sendAccountErasedEmail` تُرسل في حينها، و`enqueueMail` تكتب في طابور
   البريد ليُرسله العامل. والقسمةُ بينهما قاعدةٌ مكتوبةٌ في
   `admin-users.routes.ts`: **ما يراه إنسانٌ ينتظر جوابَه يخرج في حينه، وما
   لا يُرى يُوضَع في طابورٍ يُعيد المحاولة.**

   فحذفٌ مفردٌ يقف عليه موظّفٌ أمام شاشةٍ يُرسِل مباشرةً، ودفعةٌ من مئتَي
   حسابٍ تكتب في الطابور — لأنّ مئتَي نداءٍ متتابعٍ تتجاوز حدَّ المزوّد
   (طلبان في الثانية) فتُبتلع رسائلُ ناسٍ حقيقيّين.

   والحارسُ يقبل البابَين: دعواه أنّ **أحدا يُخبَر**، لا أيُّ دالّةٍ تُنادى.
   ولو ثُبِّت على اسمٍ واحدٍ لَحمِر على تحسينٍ صحيحٍ — وقد حمِر فعلا حين
   تحوّلت الدفعاتُ إلى الطابور، فأُصلح ولم يُسكَت. */
const TELLS = ['sendAccountErasedEmail(', 'enqueueMail(']

/** موضعُ أوّلِ إبلاغٍ في المقطع — أو `-1` */
const tellsAt = (handler: string): number => {
  const hits = TELLS.map((t) => handler.indexOf(t)).filter((i) => i > -1)
  return hits.length === 0 ? -1 : Math.min(...hits)
}

/** مواضعُ المحو والتعمية — ومعها الفعلُ الذي يجب أن تسبقه الرسالة */
const SITES: readonly { file: string; mutation: RegExp; whatAr: string }[] = [
  {
    file: 'server/http/routes/admin-users.routes.ts',
    mutation: /await purgeAccountWithHistory\(prisma, id\)/,
    whatAr: 'محوُ حسابٍ من شاشة المستخدمين',
  },
  {
    file: 'server/services/bulk-purge.service.ts',
    mutation: /await this\.prisma\.user\.delete\(/,
    whatAr: 'المحوُ جملةً',
  },
  {
    file: 'server/services/account-reset.service.ts',
    mutation: /await purgeAccountWithHistory\(this\.prisma, t\.id\)/,
    whatAr: 'محوُ الحسابات في إعادة الضبط',
  },
  {
    file: 'server/services/account-reset.service.ts',
    mutation: /await this\.prisma\.\$transaction\(async \(tx\) => \{\n\s*await tx\.session\.deleteMany/,
    whatAr: 'تعميةُ الهويّة في إعادة الضبط',
  },
]

describe('رسالةُ آخرِ العهد', () => {
  it('تسبق الفعلَ في كلِّ موضعٍ يمحو أو يُعمّي', () => {
    for (const site of SITES) {
      const src = read(site.file)
      const at = src.search(site.mutation)
      expect(at, `لم يُعثر على ${site.whatAr} في ${site.file}`).toBeGreaterThan(-1)
      const handler = handlerAround(src, at)
      const sent = tellsAt(handler)
      expect(sent, `${site.whatAr}: يقع بلا رسالةٍ أخيرة`).toBeGreaterThan(-1)
      const mutated = handler.search(site.mutation)
      expect(sent, `${site.whatAr}: الرسالةُ بعد الفعل لا قبله`).toBeLessThan(mutated)
    }
  })

  it('ولا جرسَ يُضاف إليها — صفٌّ يُحذف مع صاحبه ليس إخبارا', () => {
    for (const site of SITES) {
      const handler = handlerAround(read(site.file), read(site.file).search(site.mutation))
      expect(
        handler,
        `${site.whatAr}: أُضيف جرسٌ في بابٍ لا يُقرأ فيه جرس — يُحذف مع صاحبه أو يُمنع صاحبُه من الدخول`,
      ).not.toMatch(/\bsafeNotify\(|\.notify\(/)
    }
  })

  it('والسببُ المكتوب يصل صاحبَ الشأن حيث يُلزَم به الموظّف', () => {
    /* المحوُ بالسجلّ يُلزم سببا (`reason_required`)، وإعادةُ الضبط كذلك.
       وإلزامٌ بسببٍ ثمّ إخفاؤه عمّن يمسّه إلزامٌ بلا فائدةٍ لصاحب الشأن. */
    for (const file of ['server/http/routes/admin-users.routes.ts', 'server/services/account-reset.service.ts']) {
      const src = read(file)
      /* و`accountErasedMail(` هي الصياغةُ التي يأخذها البابان معا — فهي
         الموضعُ الذي يُمرَّر فيه السببُ أو يُنسى، أيًّا كان البابُ بعدها. */
      for (const m of src.matchAll(/(?:sendAccountErasedEmail|accountErasedMail)\([\s\S]{0,320}?\}\)/g)) {
        expect(m[0], `${file}: رسالةٌ تخرج بلا السبب المكتوب`).toMatch(/reasonAr/)
      }
    }
  })
})
