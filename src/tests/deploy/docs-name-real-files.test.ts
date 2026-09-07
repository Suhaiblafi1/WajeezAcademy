/* البند ٧ · وثيقةٌ تسمّي ملفّا غيرَ موجودٍ تكذب على قارئها.

   ── العطبُ الذي أمسكه هذا الحارسُ أوّلَ مرّةٍ ──

   `docs/RUNBOOK_AR.md` كان يقول للمشغّل إنّ استيرادَ الكتالوج «يجري تلقائيا
   في `scripts/vercel-build.sh`» — ملفٌّ **محذوفٌ منذ الخروج من Vercel** —
   ثمّ يأمره بأن ينشر اللقطةَ بيده من `/admin/publishing`. وكلاهما خطأ:
   الاستيرادَ والنشرَ صارا خطوةً واحدةً في `deploy/deploy.sh`.

   فمن اتّبع الدليلَ حرفا بحث عن سكربتٍ لا وجودَ له، ثمّ نشر لقطةً ثانيةً بلا
   داعٍ. **والوثيقةُ التي تعطي إجراءً خاطئا أخطرُ من غيابها**: الغائبةُ تُرسل
   قارئَها إلى الشيفرة، والكاذبةُ تُقنعه أنّه لا يحتاج.

   ── ولماذا على المسارات لا على الكلمات ──

   حارسٌ يبحث عن كلمة «Vercel» يحمرّ على كلّ وثيقةٍ تشرح **لماذا** خرجنا منها
   — وهي وثائقُ صادقةٌ يجب أن تبقى. والمقياسُ الصحيح: **كلُّ مسارِ ملفٍّ
   تسمّيه وثيقةٌ تشغيليّةٌ يجب أن يوجد على القرص.**

   والتقاريرُ المؤرَّخةُ (`docs/review-*`، `docs/audit-*`) مستثناةٌ بقصد:
   تقريرُ يومٍ يصف حالَ ذلك اليوم، وتصحيحُه بأثرٍ رجعيٍّ يمحو الدليلَ على ما
   كان. والوثائقُ التشغيليّةُ وحدَها تُقرأ لتُتَّبع اليوم. */

import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

/** الوثائقُ التي تُقرأ لتُتَّبع — لا التقاريرُ التي تُقرأ لتُعرَف */
const OPERATIONAL = [
  'docs/RUNBOOK_AR.md',
  'docs/DEPLOYMENT.md',
  'docs/OPS_AR.md',
  'docs/SERVER_ENV_AR.md',
]

/* مسارٌ داخل ` ` يبدأ بمجلّدٍ من مجلّدات المستودَع وينتهي بلاحقةٍ معروفة.
   والقيدُ مقصود: `npm run x` و`/admin/publishing` ليسا مسارَي ملفّ. */
const PATH_IN_CODE = /`((?:src|server|scripts|deploy|docs|prisma)\/[A-Za-z0-9._/-]+\.(?:ts|tsx|sh|yml|yaml|json|md|sql))`/g

/* ما يُذكر ليُقال إنّه **زال** — لا ليُتَّبع.

   ── والاستثناءُ مقيَّدٌ بالوثيقة، وهذا ليس تدقيقا زائدا ──

   كتبتُ هذه القائمةَ أوّلَ مرّةٍ مجموعةً واحدةً لكلّ الوثائق، ثمّ نقضتُ الحارسَ
   لأراه يسقط: **أعدتُ الجملةَ الكاذبةَ بعينها إلى دليل التشغيل فمرّت خضراء.**
   لأنّ الاستثناءَ العامَّ يُجيز ذكرَ الملفّ المحذوف **في أيّ سياق**، بما فيه
   الإجراءُ الحيُّ الذي كُتب هذا الحارسُ لمنعه.

   فصار لكلّ وثيقةٍ استثناؤها: `DEPLOYMENT.md` هي سجلُّ «ما حُذف» فذكرُها له
   صدقٌ، و`RUNBOOK_AR.md` دليلُ عملٍ يُتَّبع فذكرُه فيه أمرٌ بالبحث عن معدوم.

   وهو الدرسُ نفسُه المتكرّرُ في هذه المنصّة: **حارسٌ يقيس نصفَ الساحةِ يُطمئن
   بلا حقّ.** ولا يُعرف نصفُه من كلِّه إلّا بنقضِه. */
const NAMED_AS_GONE: Record<string, string[]> = {
  /* سجلُّ «ما حُذف بعد الخروج من Vercel وCloudways» — موضعُه الصحيحُ الوحيد.
     من يبحث عن أحدها في المستودَع يجد هنا الجوابَ لماذا لا يجده. */
  'docs/DEPLOYMENT.md': [
    'scripts/vercel-build.sh',
    'server/http/vercel-handler.ts',
    'scripts/audit-csp.ts',
    'scripts/deploy-cloudways.sh',
  ],
}

describe('البند ٧ · الوثائقُ التشغيليّةُ لا تسمّي ملفّا غيرَ موجود', () => {
  it.each(OPERATIONAL)('%s', (rel) => {
    const src = readFileSync(join(root, rel), 'utf8')
    const missing: string[] = []
    for (const m of src.matchAll(PATH_IN_CODE)) {
      const p = m[1]
      if (NAMED_AS_GONE[rel]?.includes(p)) continue
      if (!existsSync(join(root, p))) missing.push(p)
    }
    expect(
      missing,
      `${rel} يسمّي ملفّاتٍ لا وجودَ لها — من اتّبع الدليلَ بحث عمّا حُذف:\n  ${missing.join('\n  ')}`,
    ).toEqual([])
  })

  it('والمذكورُ بوصفه زائلا زائلٌ فعلا — وإلّا فالاستثناءُ هو الكذب', () => {
    /* لو عاد أحدُ هذه الملفّاتِ إلى الوجود لصار استثناؤه هنا هو ما يخفي
       الحقيقة: وثيقةٌ تقول «حُذف» عن ملفٍّ يعمل. */
    for (const p of Object.values(NAMED_AS_GONE).flat()) {
      expect(existsSync(join(root, p)), `${p} عاد إلى الوجود — يُرفع من قائمة الزائل`).toBe(false)
    }
  })
})
