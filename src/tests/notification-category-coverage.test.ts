/* كلُّ مفتاحِ إشعارٍ يُرسله الخادمُ له صنفٌ في الشاشة — والغيابُ يُسكِت نصفَ خبر.
 *
 * ── العطبُ الذي كشفه هذا الحارسُ يومَ كُتب ──
 *
 * وظيفةُ التذكير تُرسل مفتاحَين: `session.reminder.24h` و`session.reminder.1h`.
 * وكان المسجَّلُ في الأصناف `session.reminder` (لا تستعمله إلّا بذرةُ الديمو)
 * و`.24h` وحدَهما — و`.1h` بلا صنفٍ إطلاقا.
 *
 * وأثرُه ليس نظريّا: `isSilenceable` تردّ `false` لما لا صنفَ له. فمن كتم
 * «تذكيرَ الجلسات» كان يكتم تذكيرَ اليوم **ويبقى تذكيرُ الساعة يصله** —
 * فيقرأ التفضيلَ كاذبا، وهو أسوأُ من ألّا يكون.
 *
 * ── ولماذا مسحٌ لا قائمةٌ مكتوبة ──
 *
 * قائمةٌ باليد تشيخ عند أوّل مفتاحٍ جديد، وهي بعينها الطريقةُ التي أخفت
 * `.1h` سنةً. فالمصدرُ هو الشيفرةُ نفسُها: ما يُمرَّر إلى `notify` فعلا.
 */

import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { categoryForTemplate } from '../application/notifications/categories'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(root, dir))) {
    const rel = `${dir}/${name}`
    if (statSync(join(root, rel)).isDirectory()) {
      /* الاختباراتُ تخترع مفاتيحَ وهميّةً لتفحص الرفض — ليست وعدا لأحد */
      if (name !== 'tests' && name !== 'node_modules') walk(rel, out)
    } else if (name.endsWith('.ts')) out.push(rel)
  }
  return out
}

/* ═══ ثغرةٌ كانت في هذا الحارس نفسِه، ساعةَ كتابته ═══

   كان يقرأ `templateKey: '…'` وحدَه — و**تذكيرُ الجلسات لا يُكتب هكذا**:
   مفاتيحُه في ثابتٍ (`REMINDERS`) وتُمرَّر متغيّرا (`templateKey: window.key`).
   فالمفتاحُ الذي كُتب هذا الحارسُ لأجله كان خارجَ مسحِه، ومرّ الحارسُ أخضرَ
   على العطب نفسِه.

   ورُصد بنقضه: حُذف `.1h` من الأصناف فبقي أخضر. والدرسُ أنّ حارسا يقيس
   نصفَ الساحة يطمئن بلا حقّ.

   فالمصدران صريحان الآن، **وغيابُ أيّهما يُحمِّر** — فلو أُعيدت تسميةُ
   `REMINDERS` لَشكا الحارسُ بدل أن يمسح أقلَّ في صمت. */
const JOBS = readFileSync(join(root, 'server/worker/jobs.ts'), 'utf8')
const REMINDERS_BLOCK = JOBS.match(/const REMINDERS = \[([\s\S]*?)\] as const/)

/* ═══ وبابٌ ثالثٌ: مفاتيحُ تُبنى وقتَ التنفيذ ═══

   ستّةُ مفاتيحَ كانت تُرسَل ولا يراها أحد، لأنّها تُكتب بقالبٍ نصّيٍّ لا
   بحرفٍ بين علامتَي اقتباس — فلا يقرؤها مسحٌ يبحث عن الحرف. وهي الثغرةُ
   نفسُها التي أُصلحت في هذا الحارس مرّتَين، عادت من صيغةٍ ثالثة.

   **فالبابُ يُغلق لا يُرقَّع:** كلُّ مفتاحٍ يُبنى بقالبٍ نصّيٍّ يُرفَض حتّى
   تُسمَّى توسّعاتُه هنا صراحةً. فمن أضاف موضعا رابعا تحمرّ عنده البوّابةُ
   وتقول له ماذا يكتب — لا يمرّ صامتا كما مرّ هؤلاء. */
const DYNAMIC: Record<string, readonly string[]> = {
  'submission.@action@': [
    'submission.start_review', 'submission.request_resubmit',
    'submission.accept', 'submission.reject',
  ],
  'grade.@kind@': ['grade.create', 'grade.update'],
}

/** ما وُجد مبنيّا بقالبٍ نصّيّ في الخادم — بنصّه كما كُتب */
const DYNAMIC_FOUND = (() => {
  const found = new Set<string>()
  for (const f of walk('server')) {
    for (const m of readFileSync(join(root, f), 'utf8').matchAll(/templateKey:\s*`([^`]+)`/g)) {
      /* يُطبَّع شكلُ الإقحام حتّى يُكتب مفتاحُ الخريطة أعلاه بلا قالبٍ فعليّ */
      found.add(m[1].replace(/\$\{([^}]+)\}/g, '@$1@'))
    }
  }
  return [...found].sort()
})()

const KEYS = (() => {
  const found = new Set<string>()
  /* ١) ما يُمرَّر حرفا في موضعه */
  for (const f of walk('server')) {
    for (const m of readFileSync(join(root, f), 'utf8').matchAll(/templateKey:\s*'([^']+)'/g)) {
      found.add(m[1])
    }
  }
  /* ٢) وما يُعلَن في جدول التذكير ثمّ يُمرَّر متغيّرا */
  for (const m of (REMINDERS_BLOCK?.[1] ?? '').matchAll(/(?:key|trainerKey):\s*'([^']+)'/g)) {
    found.add(m[1])
  }
  /* ٣) وتوسّعاتُ ما يُبنى وقتَ التنفيذ */
  for (const expansions of Object.values(DYNAMIC)) for (const k of expansions) found.add(k)
  return [...found].sort()
})()

describe('أصنافُ الإشعارات تغطّي ما يُرسَل فعلا', () => {
  it('المسحُ يقرأ الخادمَ فعلا — فلا يمرّ الحارسُ بصفرٍ كاذب', () => {
    /* حارسُ الحارس: خطأٌ في المسار يجعل القائمةَ فارغةً فيمرّ كلُّ شيء */
    expect(KEYS.length, 'لم يُقرأ مفتاحٌ واحد — تعطّل المسحُ نفسُه').toBeGreaterThan(15)
  })

  it('وجدولُ التذكير مقروءٌ باسمِه — فلا يضيق المسحُ صامتا', () => {
    expect(
      REMINDERS_BLOCK,
      'لم يُعثر على «const REMINDERS = [...] as const» في server/worker/jobs.ts.\n'
      + 'إن أُعيدت تسميتُه فحدّث هذا الحارسَ معه — وإلّا خرجت مفاتيحُ التذكير '
      + 'من المسح، وهي بعينها التي كُتب لأجلها.',
    ).not.toBeNull()
    expect(KEYS).toContain('session.reminder.1h')
    expect(KEYS).toContain('session.reminder.trainer.24h')
  })

  it('وكلُّ مفتاحٍ يُبنى بقالبٍ نصّيٍّ مُسمّى التوسّعات — فلا بابَ رابع', () => {
    const unnamed = DYNAMIC_FOUND.filter((raw) => !DYNAMIC[raw])
    expect(
      unnamed,
      `مفتاحٌ يُبنى وقتَ التنفيذ ولم تُسمَّ توسّعاتُه: ${unnamed.join('، ')}.\n`
      + 'أضفه إلى «DYNAMIC» في هذا الملفّ بتوسّعاته كلِّها، ثمّ سجّلها في '
      + '«categories.ts». وبلا ذلك تُرسَل ولا تظهر في شاشة التفضيلات — '
      + 'لا مفتوحةً ولا مقفلة.',
    ).toEqual([])
    /* والعكسُ كذلك: صيغةٌ سُمّيت هنا ثمّ حُذفت من الشيفرة تبقى تُفحَص بلا داعٍ */
    expect(Object.keys(DYNAMIC).sort()).toEqual(DYNAMIC_FOUND)
  })

  it.each(KEYS)('«%s» له صنف', (key) => {
    expect(
      categoryForTemplate(key),
      `المفتاحُ «${key}» يُرسَل ولا صنفَ له في `
      + '«src/application/notifications/categories.ts».\n'
      + 'وما لا صنفَ له لا يُكتَم ولا يظهر في شاشة التفضيلات — '
      + 'فيصل صاحبَه وهو يظنّ أنّه أسكته. أضفه إلى صنفه.',
    ).not.toBeNull()
  })
})
