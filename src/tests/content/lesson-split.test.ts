/* المتنُ ليس جدارا واحدا — بل دروسٌ تُقرأ واحدا واحدا.

   العطب: الوحدة زمنُها ساعتان، ومتنُها يُعرض دفعةً واحدة في أكورديون —
   ألفا كلمةٍ تنهال على شاشةٍ واحدة بلا تقدّمٍ ولا توقّف. فوصفه صاحب
   المنصّة بأنّه «ممل». والقارئ الذي لا يرى أين هو ولا كم بقي يترك.

   وسياسة التأليف عندنا تجعل كلَّ `## ` درسا مستقلّا بأجزائه الخمسة. فهذه
   الوحدة تقرأ ذلك العقد وتحوّل المتن إلى دروسٍ لها عناوينُ وزمنُ قراءة —
   بلا أن يتغيّر شيءٌ في التخزين ولا في المحرّر. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { splitLessons, readingMinutes } from '@/application/content/lesson-split'

describe('تقسيم المتن إلى دروس', () => {
  it('١) كل `## ` درسٌ بعنوانه', () => {
    const ls = splitLessons('## الأول\nنصّ أوّل\n\n## الثاني\nنصّ ثانٍ')
    expect(ls.map((l) => l.title)).toEqual(['الأول', 'الثاني'])
    expect(ls[0].body).toContain('نصّ أوّل')
    expect(ls[0].body).not.toContain('نصّ ثانٍ')
  })

  it('٢) `### ` لا يقسّم — فهي أقسامٌ داخل الدرس لا دروس', () => {
    const ls = splitLessons('## الدرس\nتمهيد\n### جزء\nتفصيل\n### جزء آخر\nتفصيل')
    expect(ls).toHaveLength(1)
    expect(ls[0].body).toContain('### جزء آخر')
  })

  it('٣) ما قبل أوّل عنوانٍ درسٌ تمهيديّ لا يُفقَد', () => {
    const ls = splitLessons('سطرٌ قبل كل شيء\n\n## الدرس الأول\nمتن')
    expect(ls).toHaveLength(2)
    expect(ls[0].body).toContain('سطرٌ قبل كل شيء')
    expect(ls[1].title).toBe('الدرس الأول')
  })

  it('٤) متنٌ بلا عناوين درسٌ واحد — لا صفرَ دروس', () => {
    const ls = splitLessons('فقرةٌ وحيدة بلا عنوان')
    expect(ls).toHaveLength(1)
    expect(ls[0].body).toContain('فقرةٌ وحيدة')
  })

  it('٥) الفراغُ لا يُنتج درسا', () => {
    expect(splitLessons('')).toHaveLength(0)
    expect(splitLessons('   \n\n  ')).toHaveLength(0)
    expect(splitLessons(null)).toHaveLength(0)
  })

  it('٦) `## ` داخل كتلة كود لا يقسّم — وإلّا انشقّ الدرس عند تعليقة', () => {
    const ls = splitLessons('## الدرس\n```\n## هذا تعليقٌ في كود\n```\nبقيّة')
    expect(ls).toHaveLength(1)
    expect(ls[0].body).toContain('## هذا تعليقٌ في كود')
  })

  it('٧) لكل درسٍ ترتيبٌ يبدأ من واحد', () => {
    const ls = splitLessons('## أ\nنص\n## ب\nنص\n## ج\nنص')
    expect(ls.map((l) => l.index)).toEqual([1, 2, 3])
  })

  /* زمنُ القراءة يُعرض للمتعلّم قبل أن يبدأ — فيقرّر أيدخل الآن أم لاحقا.
     والمقياس من سياسة التأليف: مئةُ كلمةٍ عربية تقنية في الدقيقة. */
  it('٨) زمن القراءة بمقياس السياسة، وأدناه دقيقة', () => {
    expect(readingMinutes('كلمة '.repeat(800))).toBe(8)
    expect(readingMinutes('كلمتان اثنتان')).toBe(1)
    expect(readingMinutes('')).toBe(0)
  })

  it('٩) عنوان الدرس لا يحمل علامات التنسيق', () => {
    const ls = splitLessons('## **عنوان عريض**\nمتن')
    expect(ls[0].title).toBe('عنوان عريض')
  })
})

/* ── الشاشتان: خريطةٌ ومشغّل ──

   العقدُ الذي يُحرَس: صفحةُ الدورة تعرض المحطّات وعناوين دروسها ولا تفرّغ
   المتن فيها، والدراسةُ في شاشةٍ لها. فلو عاد المتنُ إلى الأكورديون عاد
   الجدارُ الذي شُكي منه. */
describe('أين يُقرأ المتن', () => {
  const read = (p: string) =>
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', p), 'utf8')

  it('١٠) صفحةُ الدورة خريطةٌ لا متن', () => {
    const src = read('src/pages/student/CourseMilestones.tsx')
    expect(src, 'المتن عاد يُفرَّغ في صفحة الدورة').not.toContain('<LessonBody')
    expect(src, 'التمارين عادت إلى صفحة الدورة').not.toContain('<ModuleCheck')
    expect(src, 'لا رابطَ إلى مشغّل الوحدة').toContain('/module/${m.id}')
    expect(src, 'عناوين الدروس لا تُعرض في الخريطة').toContain('splitLessons')
  })

  it('١١) المشغّل يعرض خطوةً واحدة ويحفظ الموضع', () => {
    const src = read('src/pages/student/ModuleStudy.tsx')
    expect(src, 'لا خطوةَ واحدة معروضة').toContain('const step = steps[pos]')
    expect(src, 'الموضع لا يُحفظ فلا يُستأنف').toContain('safeSet(POS_KEY(moduleId)')
    /* الاسترجاع بعد كل درس لا في آخر الوحدة وحدها — نصُّ السياسة */
    expect(src, 'الأسئلة لا تُوزَّع على الدروس').toContain('all.slice(from, to)')
    /* ولا يُكتب إتمامٌ من هنا: الإكمال بدليل لا بزرّ */
    expect(src, 'ظهر زرُّ إتمامٍ يضغطه المتعلّم على نفسه').not.toContain('markComplete')
  })
})
