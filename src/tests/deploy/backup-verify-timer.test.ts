/* إثباتُ الاسترجاع يتجدّد من نفسِه — حارسُ ما جرى مرّةً ثمّ نُسي.

   ═══ العطبُ الذي كُتب له ═══

   `deploy/backup.sh --verify` ينزّل آخرَ نسخةٍ ويسترجعها في قاعدةِ خدشٍ ويعدّ
   صفوفَها، ثمّ يكتب إثباتَه في `SystemSetting`. وتشترطه **إعادةُ ضبط
   الحسابات** — محوٌ لا رجعةَ فيه.

   والإثباتُ **يشيخ بعد ٣١ يوما** عمدا: المخطَّطُ يتغيّر، وحجمُ البيانات
   يتغيّر، وقد يكون المؤقّتُ توقّف بينهما.

   وكان السكربتُ يختم بسطرٍ يقول «أعد هذا الاختبار شهريا» — **وصيّةٌ لإنسان،
   لا مؤقّتٌ يعمل**. فجرى الإثباتُ مرّةً واحدةً بيدٍ في ١٤ سبتمبر ٢٠٢٦، ولا
   شيءَ يجدّده. وكان سيشيخ في ١٥ أكتوبر، فيُغلق بابُ إعادة ضبط الحسابات من
   نفسِه — ولا يُعلَم إلّا عند محاولة فتحه.

   وهو صنفُ العطب نفسُه الذي وقع في النشر يومَها: آليّةٌ مبنيّةٌ صحيحةً، لا
   شيءَ يشغّلها، ولا شيءَ يقول إنّها لا تعمل.

   ═══ وما يُقاس هنا ═══

   ① أنّ ثمّ **مؤقّتا يجدّده** لا وصيّةً في نصّ.
   ② وأنّ دورتَه **أقصرُ من عمر الإثبات** — وإلّا كانت كلُّ تشغيلةٍ فرصةً
      وحيدةً تسقط فيشيخ الإثباتُ بلا عطبٍ حقيقيّ.
   ③ وأنّه **غيرُ مدموجٍ في مؤقّت النسخ**: الأوّلُ يفشل فتضيع نسخةُ ليلة،
      والثاني يفشل فيتبيّن أنّ النسخَ كلَّها لا تُسترجَع.
   ④ وأنّ حالَه **يُقرأ في صحّة النظام** قبل أن يشيخ. */

import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MAX_AGE_DAYS } from '../../../server/services/backup-attestation'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

describe('مؤقّتٌ يجدّد الإثبات — لا وصيّةٌ في نصّ', () => {
  it('⚠️ وحدتا systemd موجودتان', () => {
    for (const f of ['deploy/wajeez-verify.service', 'deploy/wajeez-verify.timer']) {
      expect(existsSync(join(root, f)), `${f} مفقود — فالإثباتُ يبقى وصيّةً لإنسان`).toBe(true)
    }
  })

  it('⚠️ والخدمةُ تنادي `--verify` لا النسخَ العاديّ', () => {
    const svc = read('deploy/wajeez-verify.service')
    expect(svc, 'تأخذ نسخةً ولا تُثبت استرجاعَها').toMatch(/backup\.sh --verify/)
  })

  it('⚠️ ودورتُه أقصرُ من عمر الإثبات — فأربعُ فرصٍ لا واحدة', () => {
    /* `OnCalendar=Sun …` أسبوعيّ. ومؤقّتٌ شهريٌّ يجعل كلَّ تشغيلةٍ فرصةً
       وحيدةً: تسقط واحدةٌ فيشيخ الإثباتُ ويُغلق بابُ إعادة الضبط. */
    const timer = read('deploy/wajeez-verify.timer')
    const cal = /OnCalendar=([^\n]+)/.exec(timer)?.[1] ?? ''
    expect(cal, 'لا جدولةَ في المؤقّت').toBeTruthy()
    expect(cal, 'الجدولةُ ليست أسبوعيّةً — راجع لماذا قبل تغييرها')
      .toMatch(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/)
    /* والسقفُ يُقرأ من الشيفرة لا يُكتب رقما هنا: لو رُفع `MAX_AGE_DAYS`
       أو خُفض بقي هذا الفحصُ صادقا. */
    expect(MAX_AGE_DAYS, 'عمرُ الإثبات أقصرُ من أسبوع — الأسبوعيُّ لا يكفيه')
      .toBeGreaterThan(7)
  })

  it('⚠️ وهو منفصلٌ عن مؤقّت النسخ — فشلاهما يعنيان شيئَين', () => {
    const backupSvc = read('deploy/wajeez-backup.service')
    expect(backupSvc, 'دُمج الإثباتُ في خدمة النسخ — ففشلُه يُقرأ فشلَ نسخة')
      .not.toMatch(/--verify/)
  })

  it('والمنطقةُ الزمنيّةُ في الصيغة لا في التعليق', () => {
    /* خادمُ Hetzner على UTC، فصيغةٌ بلا منطقةٍ تعمل في غير الساعة المكتوبة —
       وهو عطبٌ وقع في `wajeez-backup.timer` وصُحّح. */
    expect(read('deploy/wajeez-verify.timer')).toMatch(/OnCalendar=[^\n]*Asia\/Amman/)
  })
})

describe('وحالُه يُقرأ في صحّة النظام قبل أن يشيخ', () => {
  const health = read('server/services/system-health.service.ts')
  /** صفُّ الإثبات وحدَه — لا الملفُّ كلُّه، ولا الصفُّ المجاور */
  const row = () => health.slice(
    health.indexOf("key: 'backup_restore_proof'"),
    health.indexOf("key: 'last_migration'"),
  )

  it('⚠️ سطرُ الإثبات موجودٌ ويقرأ الحالةَ الحقيقيّة', () => {
    expect(health, 'لا سطرَ يقول متى استُرجعت النسخةُ آخرَ مرّة')
      .toContain("key: 'backup_restore_proof'")
    expect(health, 'لا يقرأ الإثباتَ من مصدره — فقد يقول ما ليس صحيحا')
      .toContain('attestationState(')
  })

  it('⚠️ ويصفرّ قبل الشيخوخة لا بعدها — فلا يُفاجأ ببابٍ مغلق', () => {
    /* أن يحمرّ يومَ يبطل إنذارٌ متأخّر: البابُ أُغلق سلفا. فالأصفرُ قبله
       بعشرة أيّام هو ما يُنقذ.

       ═══ ويُقاس على تعبير `level` وحدَه ═══

       أوّلُ صياغةٍ لهذا الحارس قرأت الصفَّ كلَّه، فمرّت وأنا أحذف فرعَ
       `attention` نفسَه — لأنّ `MAX_AGE_DAYS - 10` بقيت في سطر `actionAr`
       المجاور. حارسٌ يمرّ على نقضِ ما يحرسه زينة. */
    const level = /level:([\s\S]*?)\n\s*meaningAr:/.exec(row())?.[1] ?? ''
    expect(level, 'لا تعبيرَ مستوًى يُقرأ — تغيّرت بنيةُ الصفّ').toBeTruthy()
    expect(level, 'لا اصفرارَ قبل الشيخوخة — يحمرّ بعد فوات الأوان')
      .toContain("'attention'")
    expect(level, 'الاصفرارُ غيرُ مربوطٍ بعمر الإثبات').toMatch(/MAX_AGE_DAYS - \d+/)
    expect(level, 'لا يحمرّ لِما بطل فعلا').toContain("'broken'")
  })

  it('⚠️ و«لم يجرِ قطّ» تُقرأ معطَّلةً لا سليمة', () => {
    expect(row(), 'غيابُ الإثبات يُقرأ حالا سليمة — وهو أخطرُ ما في الباب')
      .toMatch(/!attest\.attestation \? 'broken'/)
  })

  it('ويُسمّى الأثرُ على إعادة ضبط الحسابات — فلا يُقرأ سطرا إداريّا', () => {
    expect(row(), 'لا يُقال لماذا يهمّ').toMatch(/إعادةُ ضبط الحسابات|لا رجعةَ/)
  })
})

describe('والوثيقةُ تقول كيف يُركَّب — فما لا يُركَّب لا يعمل', () => {
  const readme = read('deploy/README.md')

  it('⚠️ تركيبُ المؤقّتَين معا', () => {
    expect(readme, 'وحدةُ الإثبات غيرُ مذكورةٍ في التركيب')
      .toContain('wajeez-verify')
    expect(readme, 'لا تُفعَّل مع أختها').toMatch(/enable --now[^\n]*wajeez-verify\.timer/)
  })

  it('ولا تُبقي الوصيّةَ اليدويّة بعد أن صار مؤقّتا', () => {
    expect(readme, 'ما زالت تقول «أعده شهريا» وقد صار يعيد نفسَه')
      .not.toMatch(/أعده شهريا/)
  })
})
