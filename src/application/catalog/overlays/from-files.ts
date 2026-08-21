/* ج-٢ · تحويل ملفات الكتالوج الموثقة إلى مُدخل المولّد.
   موضعه في الطبقة المشتركة لا في السكربت: باني اللقطة يستعمله أيضا حين يبني
   المُدخل من حمولة اللقطة (نفس الأشكال بالضبط — اللقطة تعيد تركيب الملفات). */

import type { OverlaySource } from './source'

interface CatalogFiles {
  questions: { questions: unknown[] }
  skills: { skills: unknown[] }
  core: { launch_pathways: unknown[]; courses: unknown[]; skill_extensions?: unknown[] }
  templates: { templates: unknown[] }
}

export function sourceFromCatalogFiles(f: CatalogFiles): OverlaySource {
  return {
    questions: f.questions.questions as OverlaySource['questions'],
    skills: f.skills.skills as OverlaySource['skills'],
    skillExtensions: (f.core.skill_extensions ?? []) as OverlaySource['skillExtensions'],
    pathways: f.core.launch_pathways as OverlaySource['pathways'],
    courses: f.core.courses as OverlaySource['courses'],
    templates: f.templates.templates as OverlaySource['templates'],
  }
}
