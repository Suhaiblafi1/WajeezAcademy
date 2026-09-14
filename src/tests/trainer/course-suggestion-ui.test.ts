/* ربطُ «دوراته التي ليست عندنا» — بنيةٌ لا نصّ.

   ═══ ثلاثةُ مواضعَ تسقط بها الميزةُ وهي خضراء ═══

   ١) **الزرُّ في الموضع الخاطئ.** `ApplicationDossier` تعرضها صفحةُ المراجعة
      الخارجيّةُ (`/r/:token`) لمراجعٍ بلا حساب. فزرٌّ يُنشئ طلبَ تغييرٍ على
      الكتالوج لا يسكن هناك — وهذا ليس أمرَ ذوق: خارجيٌّ يضغطه فيُردّ بخطأٍ
      لا يفهمه، أو يُقرأ له مسارٌ ليس له.
   ٢) **الطابورُ يعرض معرّفا لا يقول شيئا.** «دورة · C-PROPOSED-XY12Z» يصل
      ولا يُفهم — وهو عطبُ الملاحظةِ الميّتةِ نفسُه منقولا من الملفّ إلى
      الطابور.
   ٣) **صلاحيّةٌ واحدة.** المسارُ يقرأ طلبَ متقدّمٍ ويسمّي صاحبَه، فلا يُفتح
      لمن يملك الكتالوجَ وحدَه. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const code = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const apps = code('src/pages/admin/TrainerApplications.tsx')
const dossier = code('src/pages/admin/ApplicationDossier.tsx')
const dialog = code('src/pages/admin/CourseSuggestionDialog.tsx')
const catalog = code('src/pages/admin/CatalogAdmin.tsx')
const routes = code('server/http/routes/catalog.routes.ts')

describe('موضعُ الزرّ', () => {
  it('في شاشة الإدارة — لا في الملفّ الذي تعرضه صفحةُ المراجعة الخارجيّة', () => {
    expect(apps).toMatch(/<CourseSuggestionDialog/)
    expect(dossier, 'الزرُّ في ملفٍّ يراه مراجعٌ بلا حساب').not.toMatch(/CourseSuggestionDialog|course-suggestions/)
  })

  /* ١٤ سبتمبر ٢٠٢٦: انتقل عرضُ الاقتراحات إلى `ProposalsEditor` — صار الأدمنُ
     يكتب أسماءها ويصحّحها، لا يقرؤها فقط. فالحارسُ ينتقل معه ويبقى على
     المعنى: زرٌّ لكلّ اقتراحٍ لا زرٌّ للطلب، والترتيبُ يُمرَّر. */
  it('وزرٌّ لكلّ اقتراحٍ لا زرٌّ للطلب — فالطلبُ يحمل عشرين', () => {
    const ed = code('src/pages/admin/ProposalsEditor.tsx')
    expect(ed, 'السجلّاتُ لا تُقرأ بالدالّة المشتركة').toMatch(/readProposals\(raw\)/)
    expect(ed, 'زرٌّ واحدٌ للطلب كلِّه').toMatch(/rows\.map\(\(r, i\)/)
    expect(ed, 'لا يُمرَّر ترتيبُ الاقتراح').toMatch(/onLink\(i,/)
    expect(apps, 'الشاشةُ لا تمرّر الترتيبَ إلى النافذة').toMatch(/setSuggestFor\(\{ id: a\.id, index, line \}\)/)
  })
})

describe('النافذةُ والشكلان', () => {
  it('تنادي المسارَ القائم، وتُرسل أحدَ الشكلَين لا ثالثا', () => {
    expect(dialog).toContain('/api/admin/catalog/course-suggestions')
    expect(dialog).toMatch(/kind:\s*"variant"/)
    expect(dialog).toMatch(/kind:\s*"new_course"/)
  })

  it('وكلامُ المتقدّم أمام عينِ من يربط — فلا يُربط من ذاكرة', () => {
    expect(dialog).toMatch(/\{trainerWordsAr\}/)
  })
})

describe('الخادم', () => {
  it('المسارُ مسجَّلٌ ويشترط صلاحيّتَين — كتالوجا ومراجعةَ طلبات', () => {
    expect(routes).toContain("app.post('/api/admin/catalog/course-suggestions'")
    const at = routes.indexOf("app.post('/api/admin/catalog/course-suggestions'")
    const body = routes.slice(at, at + 900)
    expect(body).toContain("requirePermission('catalog.view')")
    expect(body, 'بابٌ إلى أسماء المتقدّمين بصلاحيّة الكتالوج وحدَها')
      .toContain("permissions.includes('trainer.applications.review')")
  })

  it('ولا شكلَ ثالثٌ يمرّ — اتّحادٌ مميَّزٌ لا سلسلةٌ حرّة', () => {
    expect(routes).toMatch(/discriminatedUnion\('kind'/)
  })
})

describe('الطابور', () => {
  it('يعرض المقترحَ مقروءا لا معرّفا وحدَه', () => {
    expect(catalog).toMatch(/<TrainerSuggestion payload=\{cr\.payload\}/)
    expect(catalog, 'لا يفرّق بين الشكلَين').toContain('trainer_new_course')
    expect(catalog).toContain('trainer_course_variant')
    expect(catalog, 'لا يقول من اقترحه').toMatch(/fromApplication/)
    expect(catalog, 'لا يعرض كلامَه').toMatch(/trainerWordsAr/)
  })
})
